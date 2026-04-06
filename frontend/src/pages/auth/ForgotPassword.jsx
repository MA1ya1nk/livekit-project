import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../api/auth';
import { validateEmail } from '../../utils/validation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import FormField from '../../components/ui/FormField';
import AuthForm from '../../components/auth/AuthForm';

const RESEND_COOLDOWN = 120;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword({ email: email.trim() });
      setSuccess(res.message || 'Check your email for reset instructions.');
      setResendIn(RESEND_COOLDOWN);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Request failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const canResend = resendIn === 0;

  return (
    <>
      <AuthForm
        title="Forgot password?"
        subtitle="Enter your email and we'll send you a reset link"
        error={error}
        success={success}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel={resendIn > 0 ? `Resend in ${resendIn}s` : 'Send reset link'}
        submitDisabled={!canResend}
      >
        <FormField id="forgot-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      </AuthForm>
      <p className="mt-6 text-center text-sm text-[#2d3238]">
        <Link to="/login" className="text-[#15803d] font-medium hover:underline">Back to sign in</Link>
      </p>
    </>
  );
}
