/** Backend may return "Super_admin" or "super_admin"; we treat all as super admin. */
export function isSuperAdmin(role) {
  if (!role) return false;
  const r = String(role).toLowerCase().replace(/_/g, '');
  return r === 'superadmin';
}
