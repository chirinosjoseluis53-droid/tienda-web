import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devLink, setDevLink] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const data = await api.post('/auth/forgot-password', { email });
      setMessage(
        data.devToken
          ? `Se enviará un enlace a ${email}. En esta versión de desarrollo, usa este enlace:`
          : data.message
      );
      setEmail('');
      if (data.resetUrl) setDevLink(data.resetUrl.replace('https://tienda.example/reset?token=', ''));
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

        <h2>Recuperar Contraseña</h2>

        <form onSubmit={handleSubmit} className="glass-form">
          {error && <div className="alert alert-error">{error}</div>}
          {message && (
            <div className="alert alert-info">
              {message}
              {devLink && (
                <Link to={`/reset-password?token=${devLink}`} style={{ display: 'block', marginTop: '8px', color: '#047857', fontWeight: 600 }}>
                  🔗 Abrir enlace de recuperación
                </Link>
              )}
            </div>
          )}

          <div className="glass-input-wrap">
            <span className="glass-input-icon-left" style={{ fontSize: '18px' }}>📧</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo Electrónico"
              className="glass-input"
              required
            />
          </div>

          <button type="submit" className="glass-btn" disabled={loading}>
            {loading ? '⏳ Enviando...' : '📨 Enviar enlace'}
          </button>
        </form>

        <div className="glass-footer-link">
          💡 ¿Recordaste tu contraseña? <Link to="/login">Inicia sesión</Link>
        </div>

      </div>
    </div>
  );
}