"""
OpenVoice Server - Local voice cloning API
Run with: python server.py
"""

import os
import io
import base64
import tempfile
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

# OpenVoice imports
import torch
from openvoice import se_extractor
from openvoice.api import ToneColorConverter
from melo.api import TTS

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Global model instances
tone_color_converter = None
tts_model = None
device = "cuda:0" if torch.cuda.is_available() else "cpu"

# Paths
CHECKPOINT_PATH = "checkpoints_v2/converter"
OUTPUT_DIR = "outputs"

def init_models():
    """Initialize OpenVoice models"""
    global tone_color_converter, tts_model

    print(f"Loading models on {device}...")

    # Load tone color converter
    tone_color_converter = ToneColorConverter(f"{CHECKPOINT_PATH}/config.json", device=device)
    tone_color_converter.load_ckpt(f"{CHECKPOINT_PATH}/checkpoint.pth")

    # Load TTS model (English)
    tts_model = TTS(language="EN", device=device)

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Models loaded successfully!")

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({"status": "ok", "device": device})

@app.route("/clone-voice", methods=["POST"])
def clone_voice():
    """
    Clone a voice from an audio file.
    Expects: multipart form with 'audio' file
    Returns: voice_id (path to saved embedding)
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]

    # Save uploaded audio temporarily
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        # Extract speaker embedding
        target_se, audio_name = se_extractor.get_se(
            tmp_path,
            tone_color_converter,
            vad=True
        )

        # Save embedding for later use
        voice_id = f"voice_{audio_name}"
        embedding_path = os.path.join(OUTPUT_DIR, f"{voice_id}.pth")
        torch.save(target_se, embedding_path)

        return jsonify({
            "success": True,
            "voice_id": voice_id,
            "message": "Voice cloned successfully"
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Cleanup temp file
        os.unlink(tmp_path)

@app.route("/speak", methods=["POST"])
def speak():
    """
    Generate speech with cloned voice.
    Expects JSON: { "text": "...", "voice_id": "..." }
    Returns: audio file
    """
    data = request.json

    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400

    text = data["text"]
    voice_id = data.get("voice_id", "default")
    speed = data.get("speed", 1.0)

    # Load voice embedding
    embedding_path = os.path.join(OUTPUT_DIR, f"{voice_id}.pth")
    if not os.path.exists(embedding_path):
        return jsonify({"error": "Voice not found. Please clone a voice first."}), 404

    target_se = torch.load(embedding_path, map_location=device)

    try:
        # Generate base TTS audio
        src_path = os.path.join(OUTPUT_DIR, "tmp_tts.wav")
        speaker_ids = tts_model.hps.data.spk2id

        # Use first available speaker
        speaker_key = list(speaker_ids.keys())[0]
        speaker_id = speaker_ids[speaker_key]

        tts_model.tts_to_file(text, speaker_id, src_path, speed=speed)

        # Get source speaker embedding
        source_se = torch.load(f"checkpoints_v2/base_speakers/ses/en-us.pth", map_location=device)

        # Apply voice conversion
        output_path = os.path.join(OUTPUT_DIR, f"output_{voice_id}.wav")

        tone_color_converter.convert(
            audio_src_path=src_path,
            src_se=source_se,
            tgt_se=target_se,
            output_path=output_path,
        )

        # Return audio file
        return send_file(
            output_path,
            mimetype="audio/wav",
            as_attachment=True,
            download_name="speech.wav"
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/voices", methods=["GET"])
def list_voices():
    """List all cloned voices"""
    voices = []
    for f in os.listdir(OUTPUT_DIR):
        if f.startswith("voice_") and f.endswith(".pth"):
            voices.append(f.replace(".pth", ""))
    return jsonify({"voices": voices})

@app.route("/", methods=["GET"])
def index():
    """Serve info page"""
    return jsonify({
        "name": "OpenVoice Server",
        "version": "1.0",
        "endpoints": {
            "POST /clone-voice": "Upload audio to clone voice",
            "POST /speak": "Generate speech with cloned voice",
            "GET /voices": "List cloned voices",
            "GET /health": "Health check"
        }
    })

if __name__ == "__main__":
    init_models()
    print("\n" + "="*50)
    print("OpenVoice Server running at http://localhost:5000")
    print("="*50 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
