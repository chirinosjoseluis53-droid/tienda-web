import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api } from '../api.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const slug = params.get('store');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [store, setStore] = useState(null);
  const [storeError, setStoreError] = useState('');

  useEffect(() => {
    if (!slug) { setStoreError('El registro publico esta deshabilitado. Usa el enlace de acceso que te proporciono tu administrador.'); return; }
    api.get(`/auth/store/${slug}`)
      .then((s) => { setStore(s); if (!s.active) setStoreError('Esta tienda esta desactivada.'); })
      .catch(() => setStoreError('Tienda no encontrada. Verifica el enlace.'));
  }, [slug]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Las contrasenas no coinciden'); return; }
    if (form.password.length < 6) { setError('La contrasena debe tener al menos 6 caracteres'); return; }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, slug);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!slug) {
    return (
      <div className="glass-layout">
        <div className="glass-card">
          <div className="glass-logo"><span style={{ fontSize: '28px' }}>🏪</span></div>
          <h2>Registro</h2>
          <div className="alert alert-error" style={{ margin: '12px 0' }}>El registro publico esta deshabilitado. Usa el enlace de acceso que te proporciono tu administrador.</div>
          <Link to="/login" className="glass-forgot" style={{ textAlign: 'center' }}>Volver al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-layout">
      <div className="glass-card">
        <div className="glass-logo">
          <span style={{ fontSize: '28px' }}>🏪</span>
          <span className="glass-logo-text">{store?.name || 'Tienda'}</span>
        </div>
        <h2>Crear Cuenta</h2>
        {storeError && <div className="alert alert-error">{storeError}</div>}

        <form onSubmit={handleSubmit} className="glass-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>👤</span>
            <input
              type="text" value={form.name} required placeholder="Nombre Completo"
              className="glass-input" disabled={!!storeError}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>📧</span>
            <input
              type="email" value={form.email} required placeholder="Correo Electronico"
              className="glass-input" disabled={!!storeError}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>🔒</span>
            <input
              type="password" value={form.password} required placeholder="Contrasena (min. 6 caracteres)"
              className="glass-input" disabled={!!storeError}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>✅</span>
            <input
              type="password" value={form.confirm} required placeholder="Confirmar Contrasena"
              className="glass-input" disabled={!!storeError}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>

          <button type="submit" className="glass-btn" disabled={loading || !!storeError}>
            {loading ? '⏳ Creando cuenta...' : '✨ Registrarme'}
          </button>
        </form>

        <div className="glass-footer-link">
          👋 Ya tienes cuenta? <Link to={`/login?store=${slug || ''}`}>Inicia sesion aqui</Link>
        </div>
      </div>
    </div>
  );
}