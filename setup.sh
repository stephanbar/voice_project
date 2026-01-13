#!/bin/bash

# OpenVoice Setup Script
# This script sets up the OpenVoice voice cloning environment

set -e

echo "=========================================="
echo "  OpenVoice Voice Clone Setup"
echo "=========================================="

# Check Python version
python_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "Python version: $python_version"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
echo "Installing dependencies (this may take a while)..."
pip install flask flask-cors torch torchaudio

# Install OpenVoice
echo "Installing OpenVoice..."
pip install git+https://github.com/myshell-ai/OpenVoice.git

# Install MeloTTS
echo "Installing MeloTTS..."
pip install git+https://github.com/myshell-ai/MeloTTS.git
python -m unidic download

# Download checkpoints
echo "Downloading OpenVoice V2 checkpoints..."
mkdir -p checkpoints_v2

# Download converter checkpoint
if [ ! -d "checkpoints_v2/converter" ]; then
    echo "Downloading converter model..."
    python3 -c "
from huggingface_hub import snapshot_download
snapshot_download(repo_id='myshell-ai/OpenVoiceV2', local_dir='checkpoints_v2', allow_patterns=['converter/*', 'base_speakers/*'])
print('Checkpoints downloaded successfully!')
"
fi

# Create outputs directory
mkdir -p outputs

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "To start the server, run:"
echo "  source venv/bin/activate"
echo "  python server.py"
echo ""
echo "Then open voice-clone.html in your browser."
echo ""
