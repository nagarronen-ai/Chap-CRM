import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import CompanyProfile from './pages/CompanyProfile';
import Import from './pages/Import';
import Emails from './pages/Emails';
import Team from './pages/Team';
import Marketing from './pages/Marketing';
import Finance from './pages/Finance';
import Clients from './pages/Clients';
import ClientProfile from './pages/ClientProfile';
import ServiceProviders from './pages/ServiceProviders';
import ServiceProviderProfile from './pages/ServiceProviderProfile';
import Settings from './pages/Settings';
import EmailInbox from './pages/EmailInbox';
import CalendarPage from './pages/Calendar';
import AiBrain from './components/AiBrain';
import AiLog from './pages/AiLog';
import Thoughts from './pages/Thoughts';
import Onboarding from './pages/Onboarding';
import { AppProvider } from './context/AppContext';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  
  // Check if onboarding is completed
  const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
  if (!settings.onboarding_completed && window.location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" />;
  }
  
  return children;
};

function AuthenticatedApp() {
  return (
    <>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/companies/:id" element={<CompanyProfile />} />
        <Route path="/import" element={<Import />} />
        <Route path="/emails" element={<Emails />} />
        <Route path="/team" element={<Team />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientProfile />} />
        <Route path="/service-providers" element={<ServiceProviders />} />
        <Route path="/service-providers/:id" element={<ServiceProviderProfile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/inbox" element={<EmailInbox />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/ai/log" element={<AiLog />} />
        <Route path="/thoughts" element={<Thoughts />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
      <AiBrain />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={
          <PrivateRoute>
            <AuthenticatedApp />
          </PrivateRoute>
        } />
      </Routes>
      </Router>
    </AppProvider>
  );
}