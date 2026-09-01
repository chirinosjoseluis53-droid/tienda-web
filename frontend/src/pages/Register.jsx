import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
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

        <h2>Crear Cuenta</h2>

        <form onSubmit={handleSubmit} className="glass-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>👤</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre Completo"
              className="glass-input"
              required
            />
          </div>

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

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>🔒</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Contraseña (mín. 6 caracteres)"
              className="glass-input"
              required
            />
          </div>

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>✅</span>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              placeholder="Confirmar Contraseña"
              className="glass-input"
              required
            />
          </div>

          <button type="submit" className="glass-btn" disabled={loading}>
            {loading ? '⏳ Creando cuenta...' : '✨ Registrarme'}
          </button>
        </form>

        <div className="glass-footer-link">
          👋 ¿Ya tienes cuenta? <Link to="/login">Inicia sesión aquí</Link>
        </div>

      </div>
    </div>
  );
}