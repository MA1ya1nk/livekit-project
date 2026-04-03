import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../api/auth';
import { validatePassword } from '../../utils/validation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import FormField from '../../components/ui/FormField';
import AuthForm from '../../components/auth/AuthForm';

export default function ResetPassword() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenFromUrl, setTokenFromUrl] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) {
      setToken(t);
      setTokenFromUrl(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const pwdError = validatePassword(newPassword, 'New password');
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({ token, new_password: newPassword });
      setSuccess(res.message || 'Password updated. You can sign in now.');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Reset failed. Please use the link from your email and try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <h1 className="m-0 mb-2 text-2xl font-bold text-[#1a1d21] tracking-tight">Password updated</h1>
        <p className="m-0 mb-6 text-[15px] text-[#2d3238]">{success}</p>
        <Link to="/login" className="text-[#15803d] font-medium hover:underline">Sign in</Link>
      </>
    );
  }

  // Only show reset form when we have a token from the email link
  if (!tokenFromUrl || !token) {
    return (
      <>
        <h1 className="m-0 mb-2 text-2xl font-bold text-[#1a1d21] tracking-tight">Reset password</h1>
        <p className="m-0 mb-6 text-[15px] text-[#2d3238]">
          Use the link from your email to set a new password. If you didn&apos;t receive it, request a new one below.
        </p>
        <p className="mt-6 text-center text-sm text-[#2d3238]">
          <Link to="/forgot-password" className="text-[#15803d] font-medium hover:underline">Send reset link</Link>
          {' · '}
          <Link to="/login" className="text-[#15803d] font-medium hover:underline">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <AuthForm
        title="Set new password"
        subtitle="Enter your new password below"
        error={error}
        success={success}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Update password"
      >
        <FormField
          id="reset-new_password"
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          required
        />
        <FormField
          id="reset-confirm_password"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
        />
      </AuthForm>
      <p className="mt-6 text-center text-sm text-[#2d3238]">
        <Link to="/login" className="text-[#15803d] font-medium hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
