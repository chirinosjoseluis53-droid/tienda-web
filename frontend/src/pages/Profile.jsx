import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../components/Shared.jsx';

export default function Profile() {
  const { user } = useAuth();
  const settings = useSettings();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    if (form.new_password !== form.confirm) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    setSaving(true);
    try {
      await api.put('/auth/password', {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setMessage('Contraseña actualizada correctamente.');
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Settings mock for admin
  const [storeName, setStoreName] = useState(settings.store_name || '');
  const [savingSet, setSavingSet] = useState(false);

  async function saveSettings(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setSavingSet(true);
    try {
      await api.put('/settings', { store_name: storeName });
      setMessage('Configuración de tienda guardada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSet(false);
    }
  }

  return (
    <div className="unified-view" style={{ padding: '24px', background: 'transparent', border: 'none', boxShadow: 'none' }}>
      
      <div className="unified-profile-layout">
        {/* Left Side: Avatar & Info */}
        <div className="profile-sidebar">
          <div className="profile-avatar-large">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#1e293b' }}>{user?.name}</h2>
          <span className="unified-badge gray" style={{ background: user?.role === 'admin' ? '#0f172a' : '#64748b', fontSize: '14px' }}>
            {user?.role === 'admin' ? 'Administrador' : 'Empleado'}
          </span>
          <div style={{ marginTop: '32px', textAlign: 'left', width: '100%' }}>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0' }}><strong>ID:</strong> {user?.id}</p>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0' }}><strong>Usuario:</strong> {user?.username}</p>
          </div>
        </div>

        {/* Right Side: Forms */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="profile-form-area">
            <h3 style={{ margin: '0 0 20px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              Cambiar Contraseña
            </h3>
            <form onSubmit={save} className="form form-grid">
              <label className="field span-2">
                <span>Contraseña Actual</span>
                <input
                  type="password"
                  value={form.current_password}
                  onChange={(e) => setForm({ ...form, current_password: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Nueva Contraseña</span>
                <input
                  type="password"
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                <span>Confirmar Contraseña</span>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  required
                />
              </label>
              <div className="span-2" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '12px' }}>
                <button type="submit" className="unified-btn-green" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
                {message && <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{message}</span>}
                {error && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{error}</span>}
              </div>
            </form>
          </div>

          {user?.role === 'admin' && (
            <div className="profile-form-area">
              <h3 style={{ margin: '0 0 20px 0', color: '#334155', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                Configuración de la Tienda
              </h3>
              <form onSubmit={saveSettings} className="form form-grid">
                <label className="field span-2">
                  <span>Nombre de la Tienda</span>
                  <input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    required
                  />
                </label>
                <div className="span-2" style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '12px' }}>
                  <button type="submit" className="unified-btn-green" disabled={savingSet}>
                    {savingSet ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}