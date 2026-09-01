import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-layout">
      <div className="glass-card">

        {/* Logo */}
        <div className="glass-logo">
          <span style={{ fontSize: '28px' }}>🏪</span>
          <span className="glass-logo-text">Mi Minimarket</span>
        </div>

        <h2>Acceso de SuperAdmin</h2>

        <form onSubmit={handleSubmit} className="glass-form">
          {error && <div className="alert alert-error">{error}</div>}

          {/* Email */}
          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>📧</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Correo Electrónico"
              className="glass-input"
              required
            />
          </div>

          {/* Password */}
          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>🔒</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Contraseña"
              className="glass-input"
              required
            />
          </div>

          <Link to="/forgot-password" className="glass-forgot">🔑 ¿Olvidaste tu contraseña?</Link>

          <button type="submit" className="glass-btn" disabled={loading}>
            {loading ? '⏳ Ingresando...' : '🚀 Iniciar Sesión'}
          </button>
        </form>

        {/* Registrarse */}
        <Link
          to="/register"
          className="glass-btn-outline"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', marginTop: '12px', padding: '12px 24px',
            borderRadius: '99px', border: '1.5px solid rgba(16,185,129,0.7)',
            color: '#047857', fontWeight: 600, fontSize: '15px',
            textDecoration: 'none', background: 'rgba(255,255,255,0.3)',
            backdropFilter: 'blur(4px)', transition: 'background 0.2s'
          }}
        >
          ✨ Crear cuenta nueva
        </Link>

      </div>
    </div>
  );
}