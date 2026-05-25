import { useLocation } from 'react-router-dom';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
'/analytics': 'Analytics',
  '/alerts': 'Alert Monitoring',
  '/admin': 'Admin Panel',
};

export default function usePageTitle() {
  const location = useLocation();
  return TITLES[location.pathname] ?? 'FraudShield AI';
}
