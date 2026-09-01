import { useState, useEffect } from 'react';
import { api, fmtMoney } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function SuperAdmin() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [stores, setStores] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', admin_name: '', admin_email: '', admin_password: '' });
  const [saving, setSaving] = useState(false);
  const [resetPw, setResetPw] = useState(null);
  const [newPw, setNewPw] = useState('');

  async function load() {
    setError('');
    try {
      const [ov, st] = await Promise.all([api.get('/super/overview'), api.get('/super/stores')]);
      setOverview(ov);
      setStores(st);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function createStore(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/super/stores', form);
      const link = `${window.location.origin}${res.url}`;
      setSuccess(`Tienda creada. URL de acceso: ${link}`);
      setForm({ name: '', admin_name: '', admin_email: '', admin_password: '' });
      setCreating(false);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s) {
    setError('');
    try {
      await api.put(`/super/stores/${s.id}`, { active: !s.active });
      setSuccess(s.active ? `"${s.name}" desactivada.` : `"${s.name}" activada.`);
      load();
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function resetPassword(e) {
    e.preventDefault();
    if (!newPw || newPw.length < 6) { setError('Contrasena minimo 6 caracteres'); return; }
    setError('');
    try {
      await api.put(`/super/stores/${resetPw}`, { admin_password: newPw });
      setSuccess('Contrasena del admin actualizada.');
      setResetPw(null);
      setNewPw('');
    } catch (e2) {
      setError(e2.message);
    }
  }

  async function copyUrl(slug) {
    const url = `${window.location.origin}/?store=${slug}`;
    try { await navigator.clipboard.writeText(url); setSuccess('URL copiada al portapapeles.'); }
    catch { setSuccess(url); }
  }

  if (!overview || !stores) return <div className="page-center"><div className="spinner" /></div>;

  return (
    <div className="stack" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0 }}>🛡️ Panel Super Admin</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Bienvenido, <strong>{user?.name}</strong>. Gestiona todas las tiendas desde aqui.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Overview Cards */}
      <div className="dash-cards" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Tiendas',       value: overview.total_stores, sub: `${overview.active_stores} activas`, icon: '🏪', color: '#16a34a' },
          { label: 'Usuarios',      value: overview.total_users,   sub: 'En todas las tiendas', icon: '👥', color: '#2563eb' },
          { label: 'Ventas',        value: overview.total_sales,   sub: 'En todas las tiendas', icon: '💰', color: '#7c3aed' },
          { label: 'Monto total',   value: fmtMoney(overview.total_sales_amount), sub: 'Ventas globales', icon: '📈', color: '#dc2626' },
        ].map((c) => (
          <div key={c.label} className="dash-card" style={{ '--accent': c.color }}>
            <div className="dash-card-icon">{c.icon}</div>
            <div className="dash-card-body">
              <span className="dash-card-label">{c.label}</span>
              <span className="dash-card-value">{c.value}</span>
              <span className="dash-card-sub">{c.sub}</span>
            </div>
            <div className="dash-card-bar" style={{ background: c.color }} />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar-card">
        <span className="muted">Todas las tiendas registradas</span>
        <div className="spacer" />
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nueva tienda</button>
        )}
        <button className="btn" onClick={load}>🔄 Actualizar</button>
      </div>

      {/* Create Form (inline or modal) */}
      {creating && (
        <div className="settings-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px' }}>Crear nueva tienda</h3>
          <form onSubmit={createStore} className="form form-grid" style={{ gap: '12px' }}>
            <label className="field span-2"><span>Nombre de la tienda</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field"><span>Nombre del admin</span>
              <input value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} required />
            </label>
            <label className="field"><span>Correo del admin</span>
              <input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} required />
            </label>
            <label className="field"><span>Contrasena del admin</span>
              <input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} required />
            </label>
            <div className="modal-actions span-2">
              <button type="button" className="btn" onClick={() => setCreating(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creando...' : 'Crear tienda'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Stores Table */}
      <div className="card-table">
        <table className="table">
          <thead>
            <tr>
              <th>Tienda</th>
              <th>Slug</th>
              <th>Admin</th>
              <th>Productos</th>
              <th>Ventas</th>
              <th>Total</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id} style={{ opacity: s.active ? 1 : 0.55 }}>
                <td><strong>{s.name}</strong></td>
                <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>{s.slug}</code></td>
                <td>
                  {s.admin.length ? s.admin.map((a) => (
                    <div key={a.id} style={{ fontSize: '13px' }}>
                      {a.name} <span style={{ color: '#64748b' }}>({a.email})</span>
                    </div>
                  )) : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Sin admin</span>}
                </td>
                <td>{s.product_count}</td>
                <td>{s.sales_count}</td>
                <td>{fmtMoney(s.sales_amount)}</td>
                <td>
                  <span className={`toggle ${s.active ? 'on' : ''}`} onClick={() => toggleActive(s)}>
                    {s.active ? 'Activo' : 'Bloqueado'}
                  </span>
                </td>
                <td className="row-actions" style={{ flexWrap: 'wrap', gap: '6px' }}>
                  <button className="btn btn-sm" onClick={() => copyUrl(s.slug)} title="Copiar URL de acceso">
                    📋 URL
                  </button>
                  <button className="btn btn-sm" onClick={() => setResetPw(s.id)}>
                    🔑 Reset
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal */}
      {resetPw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setResetPw(null)}>
          <div className="settings-card" style={{ width: '360px', maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>Cambiar contrasena del admin</h3>
            <form onSubmit={resetPassword}>
              <label className="field" style={{ marginBottom: '12px' }}>
                <span>Nueva contrasena</span>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required placeholder="Minimo 6 caracteres" />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => setResetPw(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}