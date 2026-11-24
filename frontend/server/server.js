const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');

// Add this line at the top with other imports
const TranscriptionService = require('./transcription-service');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Initialize transcription service
const transcriptionService = new TranscriptionService(server);

// Make io accessible to transcription service
app.set('io', io);

// ... rest of your server code remains the same

// Export io for use in transcription-service
module.exports = { server, io };