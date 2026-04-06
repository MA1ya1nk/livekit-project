/** User dashboard - calmer chrome than admin (white cards, subtle borders). */

export function UserPageHeader({ eyebrow, title, subtitle }) {
  return (
    <header className="mb-6 sm:mb-8">
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#15803d] mb-2">
          {eyebrow}
        </p>
      )}
      <h1 className="text-2xl sm:text-[1.65rem] font-semibold text-[#1a1d21] tracking-tight text-balance">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[#5c636a] text-[15px] mt-2 max-w-xl leading-relaxed">{subtitle}</p>
      )}
    </header>
  );
}

export function UserCard({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl bg-white border border-[#e5e2dd] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

export function UserSectionTitle({ title, description }) {
  return (
    <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-1">
      <h2 className="text-[15px] font-semibold text-[#1a1d21]">{title}</h2>
      {description && <p className="text-sm text-[#6b7280] mt-1">{description}</p>}
    </div>
  );
}
