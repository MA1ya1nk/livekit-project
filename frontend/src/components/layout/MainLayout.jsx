import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#efece7]">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
