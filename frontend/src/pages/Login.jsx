import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slug = params.get('store');
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [store, setStore] = useState(null);
  const [storeError, setStoreError] = useState('');

  useEffect(() => {
    if (!slug) return;
    api.get(`/auth/store/${slug}`)
      .then((s) => { setStore(s); if (!s.active) setStoreError('Esta tienda esta desactivada.'); })
      .catch(() => setStoreError('Tienda no encontrada. Verifica el enlace.'));
  }, [slug]);

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

  const registerLink = slug ? `/register?store=${slug}` : '/register';
  const title = store ? `Acceso a ${store.name}` : 'Acceso al Sistema';
  const sub = store
    ? 'Inicia sesion para continuar.'
    : 'Inicia sesion como super administrador para gestionar las tiendas.';

  return (
    <div className="glass-layout">
      <div className="glass-card">

        <div className="glass-logo">
          <span style={{ fontSize: '28px' }}>🏪</span>
          <span className="glass-logo-text">{store?.name || 'Panel de Control'}</span>
        </div>

        <h2>{title}</h2>
        <p style={{ margin: '-4px 0 12px', fontSize: '14px', color: '#64748b' }}>{sub}</p>

        {storeError && <div className="alert alert-error">{storeError}</div>}

        <form onSubmit={handleSubmit} className="glass-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>📧</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Correo Electronico"
              className="glass-input"
              required
              disabled={!!storeError}
            />
          </div>

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>🔒</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Contrasena"
              className="glass-input"
              required
              disabled={!!storeError}
            />
          </div>

          <Link to="/forgot-password" className="glass-forgot">🔑 ¿Olvidaste tu contrasena?</Link>

          <button type="submit" className="glass-btn" disabled={loading || !!storeError}>
            {loading ? '⏳ Ingresando...' : '🚀 Iniciar Sesion'}
          </button>
        </form>

        <Link
          to={registerLink}
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