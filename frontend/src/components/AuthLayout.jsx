export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-brand">
        <div className="auth-brand-inner">
          <div className="auth-logo">M</div>
          <h1>Mi Minimarket</h1>
          <p>Sistema de control de ventas e inventario para tu tienda.</p>
          <ul className="auth-features">
            <li>Punto de venta rapido</li>
            <li>Inventario y stock bajo</li>
            <li>Reportes diarios</li>
            <li>Roles de admin y empleado</li>
          </ul>
        </div>
      </div>
      <div className="auth-form">
        <div className="auth-card">
          <h2>{title}</h2>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}