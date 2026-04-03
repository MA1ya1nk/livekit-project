import client from './client.js';

export const listTenants = () => client.get('/api/tenants').then((res) => res.data);

/**
 * List services for a tenant (e.g. for user to pick when booking).
 * @param {number} tenantId
 * @returns {Promise<Array<{ id: number, tenant_id: number, name: string, managed_by?: string, description?: string, price: number, slot_duration_minutes: number, max_bookings_per_user_per_day: number, available_from_time: string, available_to_time: string, created_by?: number }>>}
 */
export function listTenantServices(tenantId) {
  return client.get(`/api/tenants/${tenantId}/services`).then((res) => res.data);
}
