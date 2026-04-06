import client from '../client.js';

/**
 * List all services for the admin's tenant.
 */
export function getServices() {
  return client.get('/api/admin/services').then((res) => res.data);
}

/**
 * Create a service.
 * @param {{ name: string, managed_by?: string, description?: string, price: number, slot_duration_minutes: number, max_bookings_per_user_per_day: number, available_from_time: string, available_to_time: string }} payload
 */
export function createService(payload) {
  return client.post('/api/admin/services', payload).then((res) => res.data);
}

/**
 * Get a service by id.
 * @param {number} serviceId
 */
export function getService(serviceId) {
  return client.get(`/api/admin/services/${serviceId}`).then((res) => res.data);
}

/**
 * Update a service.
 * @param {number} serviceId
 * @param {{ name?: string, managed_by?: string, description?: string, price?: number, slot_duration_minutes?: number, max_bookings_per_user_per_day?: number, available_from_time?: string, available_to_time?: string }} payload
 */
export function updateService(serviceId, payload) {
  return client.put(`/api/admin/services/${serviceId}`, payload).then((res) => res.data);
}

/**
 * Delete a service. Fails if there are existing bookings.
 * @param {number} serviceId
 */
export function deleteService(serviceId) {
  return client.delete(`/api/admin/services/${serviceId}`);
}
