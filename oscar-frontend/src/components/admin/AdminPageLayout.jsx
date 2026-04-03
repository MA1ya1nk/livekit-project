import { Link } from 'react-router-dom';

export function AdminPageBack() {
  return (
    <Link
      to="/admin"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2d3238] hover:text-[#15803d] mb-6 transition-colors no-underline"
    >
      <span>←</span>
      <span>Back to dashboard</span>
    </Link>
  );
}

export function AdminPageHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold text-[#1a1d21] tracking-tight mb-0.5">{title}</h1>
      {subtitle && <p className="text-[#2d3238] text-[15px]">{subtitle}</p>}
    </div>
  );
}

export function AdminCard({ children, className = '' }) {
  return (
    <div className={`rounded-[1.25rem] bg-[#fafaf8] shadow-sm ring-1 ring-[#e8e6e3]/60 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
