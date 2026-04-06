
export function getApiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const status = err.response?.status;
  const detail = err.response?.data?.detail;
  const message = err.response?.data?.message || err.message;

  if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || !err.response) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }
  if (status >= 500) {
    return "The server is temporarily unavailable. Please try again in a few moments.";
  }

  if (Array.isArray(detail)) {
    const parts = detail.map((x) => x.msg || x.message).filter(Boolean);
    if (parts.length) return parts.join('. ');
  }
  if (typeof detail === 'string') return detail;
  if (message) return message;

  return fallback;
}
