import appIcon from '../../assets/bookwiselogo.png';

export default function AppIcon({ className = 'w-10 h-10' }) {
  return (
    <img
      src={appIcon}
      alt=""
      className={`object-contain rounded-full ${className}`}
    />
  );
}
