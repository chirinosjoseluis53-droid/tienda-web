import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import POS from './pages/POS.jsx';
import Sales from './pages/Sales.jsx';
import Products from './pages/Products.jsx';
import Categories from './pages/Categories.jsx';
import Clients from './pages/Clients.jsx';
import Employees from './pages/Employees.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';
import CashClose from './pages/CashClose.jsx';
import SuperAdmin from './pages/SuperAdmin.jsx';
import Reports from './pages/Reports.jsx';

function FullLoader() {
  return (
    <div className="page-center">
      <div className="spinner" />
      <p>Cargando...</p>
    </div>
  );
}

function roleHome(user) {
  return user?.role === 'superadmin' ? '/superadmin' : '/';
}

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <FullLoader />;
  if (!user) {
    return <Navigate to={'/login' + window.location.search} replace />;
  }
  return children;
}

function AdminOnly({ children }) {
  const { user } = useAuth();
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function SuperOnly({ children }) {
  const { user } = useAuth();
  if (user.role !== 'superadmin') return <Navigate to="/" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <FullLoader />;
  if (user) return <Navigate to={roleHome(user)} replace />;
  return children;
}

function RoleHome() {
  const { user } = useAuth();
  if (user?.role === 'superadmin') return <Navigate to="/superadmin" replace />;
  return <Dashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<RoleHome />} />
        <Route path="superadmin" element={<SuperOnly><SuperAdmin /></SuperOnly>} />
        <Route path="pos" element={<POS />} />
        <Route path="sales" element={<Sales />} />
        <Route path="products" element={<Products />} />
        <Route path="categories" element={<AdminOnly><Categories /></AdminOnly>} />
        <Route path="clients" element={<Clients />} />
        <Route path="employees" element={<AdminOnly><Employees /></AdminOnly>} />
        <Route path="reports" element={<AdminOnly><Reports /></AdminOnly>} />
        <Route path="settings" element={<AdminOnly><Settings /></AdminOnly>} />
        <Route path="profile" element={<Profile />} />
        <Route path="cash-close" element={<CashClose />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}