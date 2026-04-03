import client from './client.js';

/**
 * Fetch available booking slots for a date and service.
 * @param {string} date - YYYY-MM-DD
 * @param {number} serviceId - Service id (from tenant's services)
 * @returns {Promise<Array<{ start_time: string, end_time: string }>>}
 */
export function getSlots(date, serviceId) {
  return client.get('/api/bookings/slots', { params: { date, service_id: serviceId } }).then((res) => res.data);
}

/**
 * Create a booking.
 * @param {{ start_time: string, end_time: string, service_id: number }} payload - ISO date-time strings and service id
 */
export function createBooking(payload) {
  return client.post('/api/bookings', payload).then((res) => res.data);
}

/**
 * Cancel a booking (DELETE).
 * @param {number} bookingId
 */
export function cancelBooking(bookingId) {
  return client.delete(`/api/bookings/${bookingId}`);
}
