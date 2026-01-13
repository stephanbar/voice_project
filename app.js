// Voice Clone App - Using ElevenLabs API

class VoiceCloneApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordedBlob = null;
        this.clonedVoiceId = null;
        this.apiKey = localStorage.getItem('elevenLabsApiKey') || '';

        this.initElements();
        this.initEventListeners();
        this.loadSavedState();
    }

    initElements() {
        // API Key elements
        this.apiKeyInput = document.getElementById('apiKey');
        this.saveApiKeyBtn = document.getElementById('saveApiKey');

        // Recording elements
        this.recordBtn = document.getElementById('recordBtn');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.audioPreview = document.getElementById('audioPreview');
        this.recordedAudio = document.getElementById('recordedAudio');
        this.uploadVoiceBtn = document.getElementById('uploadVoice');
        this.voiceStatus = document.getElementById('voiceStatus');

        // Text to speech elements
        this.textInput = document.getElementById('textInput');
        this.speakBtn = document.getElementById('speakBtn');
        this.outputSection = document.getElementById('outputSection');
        this.outputAudio = document.getElementById('outputAudio');

        // Loading overlay
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingText = document.getElementById('loadingText');
    }

    initEventListeners() {
        this.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.uploadVoiceBtn.addEventListener('click', () => this.uploadVoice());
        this.speakBtn.addEventListener('click', () => this.speakText());
    }

    loadSavedState() {
        // Load API key
        if (this.apiKey) {
            this.apiKeyInput.value = this.apiKey;
        }

        // Load cloned voice ID
        const savedVoiceId = localStorage.getItem('clonedVoiceId');
        if (savedVoiceId) {
            this.clonedVoiceId = savedVoiceId;
            this.voiceStatus.textContent = 'Voice clone ready! You can type text below.';
            this.voiceStatus.className = 'voice-status success';
            this.speakBtn.disabled = false;
        }
    }

    saveApiKey() {
        const key = this.apiKeyInput.value.trim();
        if (key) {
            this.apiKey = key;
            localStorage.setItem('elevenLabsApiKey', key);
            this.showNotification('API key saved!', 'success');
        }
    }

    async toggleRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(this.recordedBlob);
                this.recordedAudio.src = audioUrl;
                this.audioPreview.classList.remove('hidden');

                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.recordBtn.textContent = 'Stop Recording';
            this.recordBtn.classList.add('recording');
            this.recordingStatus.textContent = 'Recording...';
            this.recordingStatus.classList.add('recording');

            // Start timer
            this.startRecordingTimer();

        } catch (err) {
            console.error('Error accessing microphone:', err);
            this.showNotification('Could not access microphone. Please allow microphone access.', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.recordBtn.innerHTML = '<span class="record-icon"></span> Start Recording';
            this.recordBtn.classList.remove('recording');
            this.recordingStatus.textContent = 'Recording complete';
            this.recordingStatus.classList.remove('recording');

            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
            }
        }
    }

    startRecordingTimer() {
        let seconds = 0;
        this.recordingTimer = setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            this.recordingStatus.textContent = `Recording... ${mins}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    async uploadVoice() {
        if (!this.apiKey) {
            this.showNotification('Please enter your ElevenLabs API key first', 'error');
            return;
        }

        if (!this.recordedBlob) {
            this.showNotification('Please record your voice first', 'error');
            return;
        }

        this.showLoading('Creating your voice clone...');

        try {
            // Create form data for voice cloning
            const formData = new FormData();
            formData.append('name', 'My Cloned Voice');
            formData.append('description', 'Voice cloned from recording');
            formData.append('files', this.recordedBlob, 'voice_sample.webm');

            // Add voice to ElevenLabs
            const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey
                },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail?.message || 'Failed to clone voice');
            }

            const data = await response.json();
            this.clonedVoiceId = data.voice_id;
            localStorage.setItem('clonedVoiceId', this.clonedVoiceId);

            this.voiceStatus.textContent = 'Voice cloned successfully! You can now type text below.';
            this.voiceStatus.className = 'voice-status success';
            this.speakBtn.disabled = false;

            this.hideLoading();

        } catch (err) {
            console.error('Error cloning voice:', err);
            this.voiceStatus.textContent = `Error: ${err.message}`;
            this.voiceStatus.className = 'voice-status error';
            this.hideLoading();
        }
    }

    async speakText() {
        const text = this.textInput.value.trim();

        if (!text) {
            this.showNotification('Please enter some text', 'error');
            return;
        }

        if (!this.apiKey) {
            this.showNotification('Please enter your ElevenLabs API key', 'error');
            return;
        }

        if (!this.clonedVoiceId) {
            this.showNotification('Please clone your voice first', 'error');
            return;
        }

        this.showLoading('Generating speech...');

        try {
            const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.clonedVoiceId}`, {
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail?.message || 'Failed to generate speech');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            this.outputAudio.src = audioUrl;
            this.outputSection.classList.remove('hidden');
            this.outputAudio.play();

            this.hideLoading();

        } catch (err) {
            console.error('Error generating speech:', err);
            this.showNotification(`Error: ${err.message}`, 'error');
            this.hideLoading();
        }
    }

    showLoading(message) {
        this.loadingText.textContent = message;
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }

    showNotification(message, type) {
        this.voiceStatus.textContent = message;
        this.voiceStatus.className = `voice-status ${type}`;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new VoiceCloneApp();
});
