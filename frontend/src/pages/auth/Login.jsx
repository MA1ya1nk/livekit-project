import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/roles';
import { validateEmail, validatePassword } from '../../utils/validation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import FormField from '../../components/ui/FormField';
import AuthForm from '../../components/auth/AuthForm';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const pwdError = validatePassword(password, 'Password');
    if (pwdError) {
      setError(pwdError);
      return;
    }

    setLoading(true);
    try {
      const user = await login({ email: email.trim(), password });
      const to =
        isSuperAdmin(user?.role) ? '/superadmin'
          : user?.role === 'admin' ? '/admin'
            : '/dashboard';
      navigate(to, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthForm
        title="Welcome back"
        subtitle="Sign in to your account to continue"
        error={error}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Sign in"
      >
        <FormField id="login-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <FormField id="login-password" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
        <div className="text-center text-sm text-[#2d3238]">
          <Link to="/forgot-password" className="text-[#15803d] font-medium hover:underline">Forgot password?</Link>
        </div>
      </AuthForm>
      <p className="mt-6 text-center text-sm text-[#2d3238]">
        Don't have an account? <Link to="/signup" className="text-[#15803d] font-medium hover:underline">Sign up</Link>
      </p>
    </>
  );
}
