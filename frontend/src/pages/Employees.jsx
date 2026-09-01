import { useEffect, useState } from 'react';
import { api, fmtMoney } from '../api.js';
import Modal from '../components/Modal.jsx';
import { ConfirmDialog, EmptyState, Money, useSettings } from '../components/Shared.jsx';
import { useAuth } from '../AuthContext.jsx';

const EMPTY = { name: '', email: '', password: '', role: 'empleado' };

export default function Employees() {
  const { user } = useAuth();
  const settings = useSettings();
  const cur = settings.currency;

  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setError('');
    try {
      setRows(await api.get('/users'));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await api.post('/users', form);
      else {
        const body = { name: form.name, role: form.role, active: form.active };
        if (form.password) body.password = form.password;
        await api.put(`/users/${editing}`, body);
      }
      setEditing(null);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/users/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  function openEdit(u) {
    setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active });
    setEditing(u.id);
    setError('');
  }

  async function toggleActive(u) {
    try {
      await api.put(`/users/${u.id}`, { active: u.active ? 0 : 1 });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (!rows) return <div className="page-center"><div className="spinner" /></div>;

  return (
    <div className="stack">
      <div className="toolbar-card">
        <span className="muted">Crea y administra los usuarios de tu tienda.</span>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setEditing('new'); }}>+ Nuevo empleado</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {rows.length === 0 ? (
        <EmptyState message="No hay usuarios." />
      ) : (
        <div className="card-table">
          <table className="table">
            <thead>
              <tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Ventas</th><th>Total vendido</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <div className="muted small">{u.email}</div>
                  </td>
                  <td>
                    <span className={u.role === 'admin' ? 'badge badge-admin' : 'badge'}>{u.role === 'admin' ? 'Admin' : 'Empleado'}</span>
                  </td>
                  <td>
                    <button className={`toggle ${u.active ? 'on' : ''}`} onClick={() => toggleActive(u)} disabled={u.id === user.id}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td>{u.sales_count}</td>
                  <td><Money value={u.sales_total} currency={cur} /></td>
                  <td className="row-actions">
                    <button className="btn btn-sm" onClick={() => openEdit(u)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleting(u)} disabled={u.id === user.id || u.role === 'admin'}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nuevo empleado' : 'Editar usuario'}>
        <form onSubmit={save} className="form form-grid">
          {error && <div className="alert alert-error">{error}</div>}
          <label className="field span-2">
            <span>Nombre</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Correo</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required disabled={editing !== 'new'} />
          </label>
          <label className="field">
            <span>{editing === 'new' ? 'Contrasena' : 'Nueva contrasena (opcional)'}</span>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={editing === 'new'} placeholder={editing !== 'new' ? 'Dejar vacio para no cambiar' : ''} />
          </label>
          <label className="field">
            <span>Rol</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="empleado">Empleado</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          {editing !== 'new' && (
            <label className="field">
              <span>Estado</span>
              <select value={form.active} onChange={(e) => setForm({ ...form, active: Number(e.target.value) })}>
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </label>
          )}
          <div className="modal-actions span-2">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Eliminar empleado"
        text={`¿Eliminar a "${deleting?.name}"? Perdera el acceso al sistema.`}
      />
    </div>
  );
}