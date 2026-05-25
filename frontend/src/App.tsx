import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './shell/AppShell';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AlertsPage from './pages/AlertsPage';
import LiveStreamPage from './pages/LiveStreamPage';
import GraphIntelligencePage from './pages/GraphIntelligencePage';
import ManualPredictPage from './pages/ManualPredictPage';
import SignupPage from './pages/SignupPage';

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
<Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/live-stream" element={<LiveStreamPage />} />
        <Route path="/graph-intelligence" element={<GraphIntelligencePage />} />
        <Route path="/predict" element={<ManualPredictPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
