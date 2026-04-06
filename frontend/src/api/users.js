import client from './client.js';

/**
 * Fetch current user profile (GET /api/users/me).
 */
export function getMe() {
  return client.get('/api/users/me').then((res) => res.data);
}

/**
 * Fetch current user's bookings (GET /api/users/bookings).
 */
export function getMyBookings(status = 'active') {
  return client.get('/api/users/bookings', { params: { status } }).then((res) => res.data);
}
