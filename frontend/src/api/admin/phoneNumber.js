import client from '../client.js';

/**
 * Get phone number status for the current tenant.
 * Returns { status: 'assigned'|'requested', phone_number?, twilio_phone_number_sid?, voice_webhook_url? }
 */
export function getPhoneNumber() {
  return client.get('/api/admin/phone-number').then((res) => res.data);
}

/**
 * Request a phone number from super admin. Creates a pending request.
 */
export function requestPhoneNumber() {
  return client.post('/api/admin/phone-number/request').then((res) => res.data);
}
