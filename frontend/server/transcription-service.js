const { WebSocketServer } = require('ws');
const { SpeechClient } = require('@google-cloud/speech');
const socketIO = require('socket.io');

class TranscriptionService {
  constructor(server) {
    // Initialize Google Speech Client (you'll need to set up credentials)
    this.speechClient = new SpeechClient();
    
    // Create WebSocket server for audio streaming
    this.wss = new WebSocketServer({ server });
    
    // Initialize transcription streaming
    this.initializeTranscription();
  }

  initializeTranscription() {
    this.wss.on('connection', (ws) => {
      console.log('Client connected for transcription');
      
      // Configure speech recognition request
      const request = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          model: 'default'
        },
        interimResults: true
      };

      // Create recognize stream
      const recognizeStream = this.speechClient
        .streamingRecognize(request)
        .on('error', console.error)
        .on('data', (data) => {
          if (data.results[0] && data.results[0].alternatives[0]) {
            const transcript = data.results[0].alternatives[0].transcript;
            
            // Send transcript to all clients via Socket.IO
            const io = require('./server').io;
            io.emit('transcription-result', {
              transcript: transcript,
              isFinal: data.results[0].isFinal
            });
          }
        });

      // Handle incoming audio data
      ws.on('message', (audioData) => {
        recognizeStream.write(audioData);
      });

      ws.on('close', () => {
        recognizeStream.end();
      });
    });
  }
}

module.exports = TranscriptionService;