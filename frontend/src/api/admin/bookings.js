import client from '../client.js';

export function getBookings() {
  return client.get('/api/admin/bookings').then((res) => res.data);
}
