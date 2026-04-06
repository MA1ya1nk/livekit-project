import client from '../client.js';

export function getUsers() {
  return client.get('/api/admin/users').then((res) => res.data);
}
