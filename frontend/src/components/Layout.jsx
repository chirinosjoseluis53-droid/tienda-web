import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';

const MENU_ITEMS_SUPER = [
  { to: '/superadmin', label: 'Panel Super Admin', icon: '🛡️', end: true },
  { to: '/profile',    label: 'Mi perfil',         icon: '🪪' },
];

const MENU_ITEMS_ADMIN = [
  { to: '/',            label: 'Dashboard',       icon: '📊', end: true },
  { to: '/pos',         label: 'Punto de venta',  icon: '🛒' },
  { to: '/sales',       label: 'Ventas',           icon: '💰' },
  { to: '/products',    label: 'Productos',        icon: '📦' },
  { to: '/categories',  label: 'Categorias',       icon: '🗂️' },
  { to: '/clients',     label: 'Clientes',         icon: '👥' },
  { to: '/employees',   label: 'Empleados',        icon: '👤' },
  { to: '/reports',     label: 'Reportes',         icon: '📄' },
  { to: '/settings',    label: 'Configuracion',    icon: '⚙️' },
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
  const [storeName, setStoreName] = useState(user?.role === 'superadmin' ? 'Panel Super Admin' : 'Mi Minimarket');
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.role === 'superadmin') return;
    api.get('/settings').then((s) => setStoreName(s.store_name)).catch(() => {});
  }, [user]);

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isSuper = role === 'superadmin';
  const menu = isSuper ? MENU_ITEMS_SUPER : isAdmin ? MENU_ITEMS_ADMIN : MENU_ITEMS_EMP;
  const roleLabel = isSuper ? '🛡️ Super Admin' : isAdmin ? '⭐ Admin' : '🧑‍💼 Empleado';
  const topRole = isSuper ? 'Super Administrador' : isAdmin ? 'Administrador' : 'Empleado';
  const brandName = isSuper ? 'Panel Super Admin' : storeName;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      {menuOpen && <div className="shell-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className={`shell-sidebar ${collapsed ? 'collapsed' : ''} ${menuOpen ? 'menu-open' : ''}`}>
        <div className="shell-brand" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expandir menu' : 'Colapsar menu'}>
          <span className="shell-brand-icon">🏪</span>
          {!collapsed && (
            <div className="shell-brand-text">
              <strong>{brandName}</strong>
              <span className="shell-brand-role">{roleLabel}</span>
            </div>
          )}
          {!collapsed && <span className="shell-collapse-btn">◀</span>}
        </div>

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

        <div className="shell-footer">
          <button onClick={handleLogout} className="shell-logout-btn">
            <span>🚪</span>
            {!collapsed && <span>Cerrar sesion</span>}
          </button>
        </div>
      </aside>

      <main className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar-left">
            <button className="shell-hamburger" onClick={() => setMenuOpen(true)} aria-label="Abrir menu">☰</button>
            <span className="shell-topbar-greeting">
              👋 Hola, <strong>{user?.name?.split(' ')[0]}</strong>
            </span>
          </div>
          <div className="shell-topbar-right">
            <div className="shell-avatar">{user?.name?.charAt(0)?.toUpperCase()}</div>
            <div className="shell-topbar-info">
              <span className="shell-topbar-name">{user?.name}</span>
              <span className="shell-topbar-role">{topRole}</span>
            </div>
          </div>
        </header>
        <div className="shell-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}