import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { validatePassword, validateRequired } from '../utils/validation';
import { getApiErrorMessage } from '../utils/apiErrors';
import { getPhoneNumber, requestPhoneNumber } from '../api/admin/phoneNumber';
import AppNav from '../components/layout/AppNav';
import FormField from '../components/ui/FormField';
import { isSuperAdmin } from '../utils/roles';

function ProfilePageIcon({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export default function Profile() {
  const { user, logout, updatePassword } = useAuth();
  const [editingPassword, setEditingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [phoneState, setPhoneState] = useState(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [requestingPhone, setRequestingPhone] = useState(false);

  const dashboardPath =
    isSuperAdmin(user?.role) ? '/superadmin'
      : user?.role === 'admin' ? '/admin'
        : '/dashboard';
  const showAdminNav = user?.role === 'admin';
  const showSuperAdminNav = isSuperAdmin(user?.role);
  const showUserNav = user?.role !== 'admin' && !isSuperAdmin(user?.role);
  const isAdmin = user?.role === 'admin';

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const oldErr = validateRequired(oldPassword, 'Current password');
    if (oldErr) {
      setError(oldErr);
      return;
    }
    const newErr = validatePassword(newPassword, 'New password');
    if (newErr) {
      setError(newErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword({ old_password: oldPassword, new_password: newPassword });
      setSuccess('Password updated successfully.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setEditingPassword(false);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update password.'));
    } finally {
      setLoading(false);
    }
  };

  const fetchPhoneNumber = () => {
    if (!isAdmin) return;
    setPhoneLoading(true);
    setPhoneError('');
    getPhoneNumber()
      .then((data) => setPhoneState(data && typeof data === 'object' ? data : null))
      .catch((err) => setPhoneError(getApiErrorMessage(err, 'Failed to load phone number status.')))
      .finally(() => setPhoneLoading(false));
  };

  useEffect(() => {
    if (isAdmin) fetchPhoneNumber();
  }, [isAdmin]);

  const handleRequestPhoneNumber = () => {
    setRequestingPhone(true);
    setPhoneError('');
    requestPhoneNumber()
      .then(() => fetchPhoneNumber())
      .catch((err) => setPhoneError(getApiErrorMessage(err, 'Failed to request phone number.')))
      .finally(() => setRequestingPhone(false));
  };

  const details = [
    { label: 'Email', value: user?.email ?? '—' },
    { label: 'Full name', value: user?.full_name ?? '—' },
    { label: 'Role', value: user?.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : '—' },
    ...(user?.tenant_id != null ? [{ label: 'Tenant ID', value: String(user.tenant_id) }] : []),
    { label: 'Status', value: user?.is_active ? 'Active' : 'Inactive' },
    ...(user?.tenant_name ? [{ label: 'Business name', value: user.tenant_name }] : []),
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#efece7]">
      <AppNav
        appName="Bookwise"
        dashboardPath={dashboardPath}
        showAdminNav={showAdminNav}
        showSuperAdminNav={showSuperAdminNav}
        showUserNav={showUserNav}
        onLogout={logout}
      />
      <main className="flex-1 overflow-auto flex flex-col">
        <div className="p-5 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#e8e6e3] text-[#15803d]">
              <ProfilePageIcon />
            </span>
            <h1 className="text-2xl font-semibold text-[#1a1d21] tracking-tight">Profile</h1>
          </div>
          <p className="text-[#2d3238] text-[15px] mb-6 ml-[3.25rem]">Your account details and password.</p>

          <div className="rounded-[1.25rem] bg-[#fafaf8] overflow-hidden shadow-sm ring-1 ring-[#e8e6e3]/60 mb-6">
            <div className="px-5 py-3 border-b border-[#e8e6e3]/80">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#15803d]">Your details</h2>
            </div>
            <div className="p-5 sm:p-6">
              <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-6 gap-y-4 items-center">
                {details.map(({ label, value }) => (
                  <Fragment key={label}>
                    <dt className="text-sm font-medium text-[#2d3238] shrink-0">{label}</dt>
                    <dd className="text-[#1a1d21] font-medium min-w-0">{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          </div>

          {isAdmin && (
            <div className="rounded-[1.25rem] bg-[#fafaf8] overflow-hidden shadow-sm ring-1 ring-[#e8e6e3]/60 mb-6">
              <div className="px-5 py-3 border-b border-[#e8e6e3]/80">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#15803d]">Phone number</h2>
              </div>
              <div className="p-5 sm:p-6">
                {phoneLoading ? (
                  <p className="text-[#2d3238] text-sm">Loading…</p>
                ) : phoneError ? (
                  <div className="py-3 px-4 rounded-xl bg-red-50/80 text-red-700 text-sm mb-3">{phoneError}</div>
                ) : null}
                {!phoneLoading && phoneState && (
                  <>
                    <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-6 gap-y-3 mb-4 items-center">
                      <dt className="text-sm font-medium text-[#2d3238] shrink-0">Status</dt>
                      <dd className="text-[#1a1d21] font-medium capitalize min-w-0">
                        {phoneState.status === 'assigned' ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" aria-hidden />
                            Assigned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
                            Pending (requested)
                          </span>
                        )}
                      </dd>
                      {phoneState.phone_number && (
                        <>
                          <dt className="text-sm font-medium text-[#2d3238] shrink-0">Phone number</dt>
                          <dd className="text-[#1a1d21] font-medium min-w-0">
                            <a href={`tel:${phoneState.phone_number.replace(/\s/g, '')}`} className="text-[#15803d] hover:text-[#166534] no-underline">
                              {phoneState.phone_number}
                            </a>
                          </dd>
                        </>
                      )}
                    </dl>
                    {phoneState.status !== 'assigned' && (
                      <button
                        type="button"
                        onClick={handleRequestPhoneNumber}
                        disabled={requestingPhone}
                        className="px-5 py-2.5 text-[15px] font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] disabled:opacity-60 transition-colors"
                      >
                        {requestingPhone ? 'Requesting…' : 'Request phone number'}
                      </button>
                    )}
                  </>
                )}
                {!phoneLoading && !phoneState && !phoneError && (
                  <div>
                    <p className="text-[#2d3238] text-sm mb-3">Request a Twilio number from super admin to enable voice booking.</p>
                    <button
                      type="button"
                      onClick={handleRequestPhoneNumber}
                      disabled={requestingPhone}
                      className="px-5 py-2.5 text-[15px] font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] disabled:opacity-60 transition-colors"
                    >
                      {requestingPhone ? 'Requesting…' : 'Request phone number'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-[1.25rem] bg-[#fafaf8] overflow-hidden shadow-sm ring-1 ring-[#e8e6e3]/60">
            <div className="px-5 py-3 border-b border-[#e8e6e3]/80 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#15803d]">Password</h2>
              {!editingPassword && (
                <button
                  type="button"
                  onClick={() => setEditingPassword(true)}
                  className="text-sm font-semibold text-[#15803d] hover:text-[#166534] transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            <div className="p-5 sm:p-6">
              {!editingPassword ? (
                <p className="text-[#2d3238] text-sm">Update your password to keep your account secure.</p>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  {error && (
                    <div className="py-3 px-4 rounded-xl bg-red-50/80 text-red-700 text-sm">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="py-3 px-4 rounded-xl bg-green-50 text-green-700 text-sm">
                      {success}
                    </div>
                  )}
                  <FormField
                    id="profile-old_password"
                    label="Current password"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Current password"
                    required
                  />
                  <FormField
                    id="profile-new_password"
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    required
                  />
                  <FormField
                    id="profile-confirm_password"
                    label="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2.5 text-[15px] font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] disabled:opacity-60 transition-colors"
                    >
                      {loading ? 'Updating…' : 'Update password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPassword(false);
                        setError('');
                        setSuccess('');
                        setOldPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="px-5 py-2.5 text-[15px] font-medium text-[#1a1d21] bg-[#fafaf8] border border-[#e8e6e3] rounded-xl hover:bg-[#efece7] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
