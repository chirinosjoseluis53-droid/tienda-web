import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import AuthLayout from '../components/AuthLayout.jsx';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Las contrasenas no coinciden');
      return;
    }
    if (form.password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Nueva contrasena" subtitle="Elige una contrasena nueva para tu cuenta">
      {done ? (
        <div className="alert alert-success">
          <p>Contrasena actualizada correctamente.</p>
          <Link to="/login" className="btn btn-primary btn-block" style={{ textAlign: 'center' }}>
            Iniciar sesion
          </Link>
        </div>
      ) : !token ? (
        <div className="alert alert-error">El enlace de recuperacion es invalido.</div>
      ) : (
        <form onSubmit={handleSubmit} className="form">
          {error && <div className="alert alert-error">{error}</div>}
          <label className="field">
            <span>Nueva contrasena</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Minimo 6 caracteres"
              required
            />
          </label>
          <label className="field">
            <span>Confirmar contrasena</span>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              placeholder="Repite la contrasena"
              required
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar contrasena'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}