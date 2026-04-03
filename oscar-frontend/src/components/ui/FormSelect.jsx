export default function FormSelect({ id, label, value, onChange, options, placeholder, error, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[#1a1d21]">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-3 border rounded-lg bg-[#fafaf8] text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#1a1d21]/20 focus:border-[#1a1d21] transition-colors ${
          error ? 'border-red-500' : 'border-[#e8e6e3]'
        }`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600 mt-0.5">{error}</span>}
    </div>
  );
}
