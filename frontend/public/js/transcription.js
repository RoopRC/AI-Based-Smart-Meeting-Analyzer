class TranscriptionManager {
  constructor() {
    this.isTranscribing = false;
    this.mediaStream = null;
    this.audioContext = null;
    this.processor = null;
    this.socket = io();
    this.transcriptionWs = null;
    
    this.initializeTranscriptionUI();
    this.setupEventListeners();
  }

  initializeTranscriptionUI() {
    // Create transcription UI elements
    const transcriptionContainer = document.createElement('div');
    transcriptionContainer.id = 'transcription-container';
    transcriptionContainer.className = 'transcription-container';
    
    transcriptionContainer.innerHTML = `
      <div class="transcription-header">
        <h3>Live Transcription</h3>
        <button id="toggle-transcription" class="transcription-btn">Start Transcription</button>
      </div>
      <div class="transcription-content">
        <div id="transcript-display"></div>
      </div>
    `;
    
    // Add to page - you might need to adjust based on your layout
    document.body.appendChild(transcriptionContainer);
    
    // Add CSS styles
    this.addTranscriptionStyles();
  }

  addTranscriptionStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .transcription-container {
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 300px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 8px;
        z-index: 1000;
        padding: 10px;
        max-height: 200px;
        overflow-y: auto;
      }
      
      .transcription-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      
      .transcription-btn {
        background: #4CAF50;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .transcription-btn.stop {
        background: #f44336;
      }
      
      #transcript-display {
        font-size: 14px;
        line-height: 1.4;
      }
      
      .transcript-item {
        margin-bottom: 5px;
        padding: 5px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
      }
    `;
    
    document.head.appendChild(style);
  }

  setupEventListeners() {
    // Toggle transcription button
    document.getElementById('toggle-transcription').addEventListener('click', () => {
      this.toggleTranscription();
    });

    // Listen for transcription results from server
    this.socket.on('transcription-result', (data) => {
      this.displayTranscript(data.transcript, data.isFinal);
    });
  }

  async toggleTranscription() {
    if (this.isTranscribing) {
      this.stopTranscription();
    } else {
      await this.startTranscription();
    }
  }

  async startTranscription() {
    try {
      // Get user media
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      // Set up audio processing
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      // Connect WebSocket to transcription server
      this.transcriptionWs = new WebSocket('ws://localhost:3000'); // Adjust port as needed
      
      this.transcriptionWs.onopen = () => {
        console.log('Connected to transcription server');
      };
      
      // Process audio data
      this.processor.onaudioprocess = (event) => {
        if (this.transcriptionWs && this.transcriptionWs.readyState === WebSocket.OPEN) {
          const audioData = event.inputBuffer.getChannelData(0);
          // Convert Float32Array to Int16Array for better compression
          const int16Data = this.floatTo16BitPCM(audioData);
          this.transcriptionWs.send(int16Data);
        }
      };
      
      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      
      this.isTranscribing = true;
      document.getElementById('toggle-transcription').textContent = 'Stop Transcription';
      document.getElementById('toggle-transcription').classList.add('stop');
      
    } catch (error) {
      console.error('Error starting transcription:', error);
    }
  }

  stopTranscription() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    if (this.transcriptionWs) {
      this.transcriptionWs.close();
    }
    
    this.isTranscribing = false;
    document.getElementById('toggle-transcription').textContent = 'Start Transcription';
    document.getElementById('toggle-transcription').classList.remove('stop');
  }

  floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  displayTranscript(transcript, isFinal) {
    const transcriptDisplay = document.getElementById('transcript-display');
    
    if (isFinal) {
      const transcriptItem = document.createElement('div');
      transcriptItem.className = 'transcript-item';
      transcriptItem.textContent = transcript;
      transcriptDisplay.appendChild(transcriptItem);
      
      // Auto-scroll to bottom
      transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight;
    } else {
      // For interim results, you might want to handle differently
      console.log('Interim result:', transcript);
    }
  }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
  window.transcriptionManager = new TranscriptionManager();
});