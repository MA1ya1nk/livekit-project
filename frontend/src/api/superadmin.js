import client from './client.js';

/**
 * List all admins with tenant name.
 * @param {'active' | 'inactive' | null} statusFilter - active = admin and tenant both active; inactive = either inactive
 */
export function listAdmins(statusFilter = null) {
  const params = statusFilter ? { status_filter: statusFilter } : {};
  return client.get('/api/superadmin/admins', { params }).then((res) => res.data);
}

export function deactivateAdmin(adminId) {
  return client.post(`/api/superadmin/admins/${adminId}/deactivate`).then((res) => res.data);
}

export function activateAdmin(adminId) {
  return client.post(`/api/superadmin/admins/${adminId}/activate`).then((res) => res.data);
}

/**
 * List number requests.
 * @param {'requested' | 'assigned' | 'rejected' | null} statusFilter - requested (pending), assigned, or rejected. Default requested.
 */
export function listNumberRequests(statusFilter = 'requested') {
  const params = statusFilter ? { status_filter: statusFilter } : {};
  return client.get('/api/superadmin/number-requests', { params }).then((res) => res.data);
}

export function assignNumberToRequest(requestId, phoneNumber) {
  return client
    .post(`/api/superadmin/number-requests/${requestId}/assign`, { phone_number: phoneNumber })
    .then((res) => res.data);
}
