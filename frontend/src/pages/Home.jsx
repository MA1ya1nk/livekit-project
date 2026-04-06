import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="h-full min-h-screen min-h-[100dvh] flex flex-col bg-[#efece7]">
      <section className="flex-1 flex flex-col justify-center min-h-0 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <span className="hero-badge inline-block px-4 py-1.5 text-sm font-medium text-white bg-[#1a1d21] rounded-full mb-6">
            Solutions for Every Business
          </span>
          <h1 className="hero-title text-3xl sm:text-4xl md:text-5xl font-bold text-[#1a1d21] tracking-tight leading-tight mb-6">
            Manage <span className="text-[#15803d]">bookings</span>, maximise <span className="text-[#15803d]">revenue</span> and give your customers a reason to return
          </h1>
          <p className="hero-subtitle text-lg md:text-xl text-[#2d3238] font-normal max-w-2xl mx-auto mb-10">
            The only online bookwise that puts <span className="text-[#15803d] font-medium">your business</span> first.
          </p>
          <div className="hero-cta flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center py-3.5 px-6 text-[15px] font-semibold text-[#1a1d21] bg-[#fafaf8] border border-[#e8e6e3] rounded-lg hover:bg-[#efece7] transition-colors no-underline"
            >
              Get started
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center py-3.5 px-6 text-[15px] font-semibold text-[#15803d] bg-transparent border-2 border-[#15803d] rounded-lg hover:bg-[#15803d]/10 transition-colors no-underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
      <section className="flex-shrink-0 py-10 md:py-8 border-t border-[#e8e6e3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#1a1d21] text-center mb-10">
            Everything you need to run <span className="text-[#15803d]">your business</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-6">
            {[
              { title: 'Smart Reservations', desc: 'Streamline bookings with intelligent scheduling that reduces no-shows and keeps your calendar full.' },
              { title: 'Revenue Optimization', desc: 'Dynamic pricing and demand forecasting help you capture every revenue opportunity.' },
              { title: 'Customer Profiles', desc: 'Build detailed customer histories to deliver personalized experiences that keep them coming back.' },
              { title: 'Seamless Experience', desc: 'From booking to completion, create memorable moments that turn first-timers into regulars.' },
            ].map(({ title, desc }) => (
              <div key={title} className="text-center md:text-left">
                <h3 className="text-lg font-semibold text-[#1a1d21] mb-2">{title}</h3>
                <p className="text-[15px] text-[#2d3238] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="flex-shrink-0 py-6 bg-[#fafaf8] border-t border-[#e8e6e3]">
        <p className="text-center text-sm font-medium text-[#1a1d21] tracking-wide">
          JOIN OVER 10,000 <span className="text-[#15803d]">BUSINESSES</span> GLOBALLY GROWING WITH OUR BOOKWISE
        </p>
      </section>
    </div>
  );
}
