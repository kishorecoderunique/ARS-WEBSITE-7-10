const { io } = require('socket.io-client');

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Test client connected, id=', socket.id);
});

socket.on('newSOS', (data) => {
  console.log('TEST CLIENT RECEIVED newSOS:', JSON.stringify(data, null, 2));
});

socket.on('rescuerLocationUpdate', (data) => {
  console.log('TEST CLIENT RECEIVED rescuerLocationUpdate:', JSON.stringify(data, null, 2));
});

socket.on('disconnect', () => {
  console.log('Test client disconnected');
});

// Keep process alive
setInterval(() => {}, 1000000);
