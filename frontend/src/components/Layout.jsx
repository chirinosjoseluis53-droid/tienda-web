import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';

const MENU_ITEMS_ADMIN = [
  { to: '/',            label: 'Dashboard',       icon: '📊', end: true },
  { to: '/pos',         label: 'Punto de venta',  icon: '🛒' },
  { to: '/sales',       label: 'Ventas',           icon: '💰' },
  { to: '/products',    label: 'Productos',        icon: '📦' },
  { to: '/categories',  label: 'Categorías',       icon: '🗂️' },
  { to: '/clients',     label: 'Clientes',         icon: '👥' },
  { to: '/employees',   label: 'Empleados',        icon: '👤' },
  { to: '/settings',    label: 'Configuración',    icon: '⚙️' },
  { to: '/cash-close',  label: 'Cierre de Caja',   icon: '🔒' },
  { to: '/profile',     label: 'Mi perfil',        icon: '🪪' },
];

const MENU_ITEMS_EMP = [
  { to: '/',          label: 'Dashboard',       icon: '📊', end: true },
  { to: '/pos',       label: 'Punto de venta',  icon: '🛒' },
  { to: '/sales',     label: 'Ventas',           icon: '💰' },
  { to: '/products',  label: 'Productos',        icon: '📦' },
  { to: '/clients',   label: 'Clientes',         icon: '👥' },
  { to: '/cash-close', label: 'Cierre de Caja',   icon: '🔒' },
  { to: '/profile',   label: 'Mi perfil',        icon: '🪪' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('Mi Minimarket');
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get('/settings').then((s) => setStoreName(s.store_name)).catch(() => {});
  }, []);

  const isAdmin = user?.role === 'admin';
  const menu = isAdmin ? MENU_ITEMS_ADMIN : MENU_ITEMS_EMP;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {/* ====== SIDEBAR ====== */}
      {menuOpen && <div className="shell-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`shell-sidebar ${collapsed ? 'collapsed' : ''} ${menuOpen ? 'menu-open' : ''}`}>
        {/* Brand - clic para colapsar/expandir */}
        <div
          className="shell-brand"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <span className="shell-brand-icon">🏪</span>
          {!collapsed && (
            <div className="shell-brand-text">
              <strong>{storeName}</strong>
              <span className="shell-brand-role">{isAdmin ? '⭐ Admin' : '🧑‍💼 Empleado'}</span>
            </div>
          )}
          {!collapsed && <span className="shell-collapse-btn">◀</span>}
        </div>

        {/* Nav */}
        <nav className="shell-nav">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              end={m.end}
              className={({ isActive }) => 'shell-nav-item' + (isActive ? ' active' : '')}
              title={collapsed ? m.label : ''}
              onClick={() => setMenuOpen(false)}
            >
              <span className="shell-nav-icon">{m.icon}</span>
              {!collapsed && <span className="shell-nav-label">{m.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="shell-footer">
          <button onClick={handleLogout} className="shell-logout-btn">
            <span>🚪</span>
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* ====== MAIN CONTENT ====== */}
      <main className="shell-main">
        {/* Topbar */}
        <header className="shell-topbar">
          <div className="shell-topbar-left">
            <button
              className="shell-hamburger"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <span className="shell-topbar-greeting">
              👋 Hola, <strong>{user?.name?.split(' ')[0]}</strong>
            </span>
          </div>
          <div className="shell-topbar-right">
            <div className="shell-avatar">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="shell-topbar-info">
              <span className="shell-topbar-name">{user?.name}</span>
              <span className="shell-topbar-role">{isAdmin ? 'Administrador' : 'Empleado'}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="shell-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}