import client from '../client.js';

export function getWorkingHours() {
  return client.get('/api/admin/working-hours').then((res) => res.data);
}

export function updateWorkingHours(payload) {
  return client.put('/api/admin/working-hours', payload).then((res) => res.data);
}
