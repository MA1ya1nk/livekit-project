import client from './client.js';

export function livekitHealth() {
  return client.get('/api/livekit/health').then((res) => res.data);
}

export function createLivekitToken(payload) {
  return client.post('/api/livekit/token', payload).then((res) => res.data);
}

export function receptionistTurn(payload) {
  return client.post('/api/livekit/receptionist/turn', payload).then((res) => res.data);
}
