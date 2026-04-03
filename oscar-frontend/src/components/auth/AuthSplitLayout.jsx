export default function AuthSplitLayout({ imageSrc, quote, children }) {
  return (
    <div className="h-screen min-h-[100dvh] grid grid-cols-1 lg:grid-cols-2 bg-[#efece7]">
      <div
        className="relative hidden lg:block h-full min-h-0 bg-[#e8e6e3] bg-cover bg-center"
        style={{ backgroundImage: `url(${imageSrc})` }}
      >
        <div className="absolute inset-0 flex items-center justify-center p-10 bg-[#1a1d21]/50">
          <p className="text-[#fafaf8] text-lg md:text-xl font-medium text-center leading-relaxed max-w-md">
            {(() => {
              const parts = quote.split(' revenue ');
              return parts.length === 2 ? (
                <> {parts[0]}<span className="text-[#86efac]"> revenue </span>{parts[1]} </>
              ) : (
                quote
              );
            })()}
          </p>
        </div>
      </div>
      <div className="h-full min-h-0 flex flex-col justify-center overflow-y-auto p-8 md:p-12 lg:p-16">
        {children}
      </div>
    </div>
  );
}
