// Email: standard format
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password: min 8 chars, at least one letter and one number
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&^\-\_]{8,}$/;

// Full name: 2–100 chars, letters/spaces/hyphens/apostrophes
export const FULL_NAME_REGEX = /^[\p{L}\s\-']{2,100}$/u;

// Business name: 1–200 chars
export const BUSINESS_NAME_REGEX = /^[\p{L}\p{N}\s\-'&.,()]{1,200}$/u;

export function validateEmail(value) {
  if (!value || typeof value !== 'string') return 'Email is required';
  const trimmed = value.trim();
  if (!trimmed) return 'Email is required';
  if (!EMAIL_REGEX.test(trimmed)) return 'Please enter a valid email address';
  if (trimmed.length > 254) return 'Email is too long';
  return null;
}

export function validatePassword(value, fieldName = 'Password') {
  if (!value || typeof value !== 'string') return `${fieldName} is required`;
  if (value.length < 8) return `${fieldName} must be at least 8 characters`;
  if (!PASSWORD_REGEX.test(value)) return `${fieldName} must contain at least one letter and one number`;
  if (value.length > 128) return `${fieldName} is too long`;
  return null;
}

export function validateFullName(value) {
  if (!value || typeof value !== 'string') return 'Full name is required';
  const trimmed = value.trim();
  if (!trimmed) return 'Full name is required';
  if (!FULL_NAME_REGEX.test(trimmed)) return 'Please enter a valid full name (2–100 characters)';
  return null;
}

export function validateBusinessName(value) {
  if (!value || typeof value !== 'string') return 'Business name is required';
  const trimmed = value.trim();
  if (!trimmed) return 'Business name is required';
  if (!BUSINESS_NAME_REGEX.test(trimmed)) return 'Please enter a valid business name';
  return null;
}

export function validateRequired(value, fieldName = 'This field') {
  if (value == null || (typeof value === 'string' && !value.trim())) return `${fieldName} is required`;
  return null;
}
