import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import CompanyProfile from './pages/CompanyProfile';
import Import from './pages/Import';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/contacts" element={<PrivateRoute><Contacts /></PrivateRoute>} />
        <Route path="/companies/:id" element={<PrivateRoute><CompanyProfile /></PrivateRoute>} />
        <Route path="/import" element={<PrivateRoute><Import /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;