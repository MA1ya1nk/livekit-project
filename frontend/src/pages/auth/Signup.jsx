import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { listTenants } from '../../api/tenants';
import { validateEmail, validatePassword, validateFullName, validateBusinessName } from '../../utils/validation';
import { getApiErrorMessage } from '../../utils/apiErrors';
import FormField from '../../components/ui/FormField';
import FormSelect from '../../components/ui/FormSelect';
import AuthForm from '../../components/auth/AuthForm';

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    tenant_id: '',
    business_name: '',
  });
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listTenants()
      .then(setTenants)
      .catch(() => setTenants([]))
      .finally(() => setTenantsLoading(false));
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const nameError = validateFullName(form.full_name);
    if (nameError) {
      setError(nameError);
      return;
    }
    const emailError = validateEmail(form.email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const pwdError = validatePassword(form.password, 'Password');
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (isAdmin) {
      const bizError = validateBusinessName(form.business_name);
      if (bizError) {
        setError(bizError);
        return;
      }
    } else {
      if (!form.tenant_id || !form.tenant_id.trim()) {
        setError('Please select a business.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        ...(isAdmin
          ? { business_name: form.business_name.trim() }
          : { tenant_id: Number(form.tenant_id), business_name: '' }),
      };
      await signup(payload);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Signup failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = form.role === 'admin';
  const tenantOptions = tenants.map((t) => ({ value: String(t.id), label: t.business }));

  return (
    <>
      <AuthForm
        title="Create an account"
        subtitle="Get started"
        error={error}
        onSubmit={handleSubmit}
        loading={loading}
        submitLabel="Sign up"
      >
        <FormField id="signup-full_name" label="Full name" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="Full name" required />
        <FormField id="signup-email" label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Email" required />
        <FormField id="signup-password" label="Password" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Password" required />
        <FormSelect id="signup-role" label="Role" value={form.role} onChange={(e) => update('role', e.target.value)} options={ROLES} />
        {isAdmin && (
          <FormField id="signup-business_name" label="Business name" value={form.business_name} onChange={(e) => update('business_name', e.target.value)} placeholder="Business name" required />
        )}
        {!isAdmin && (
          <FormSelect
            id="signup-tenant_id"
            label="Business"
            value={form.tenant_id}
            onChange={(e) => update('tenant_id', e.target.value)}
            options={tenantOptions}
            placeholder={tenantsLoading ? 'Loading…' : 'Select business'}
            disabled={tenantsLoading}
          />
        )}
      </AuthForm>
      <p className="mt-6 text-center text-sm text-[#2d3238]">
        Already have an account? <Link to="/login" className="text-[#15803d] font-medium hover:underline">Sign in</Link>
      </p>
    </>
  );
}
