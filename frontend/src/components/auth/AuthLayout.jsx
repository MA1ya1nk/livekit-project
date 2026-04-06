import { Outlet, useLocation } from 'react-router-dom';
import AuthSplitLayout from './AuthSplitLayout';
import bgImage from '../../assets/bg_image.jpg';

const AUTH_QUOTE = 'Manage bookings, maximise revenue and give your customers a reason to return.';

export default function AuthLayout() {
  const { pathname } = useLocation();
  return (
    <AuthSplitLayout imageSrc={bgImage} quote={AUTH_QUOTE}>
      <Outlet key={pathname} />
    </AuthSplitLayout>
  );
}
