import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { ConfirmDialog, Money, useSettings } from '../components/Shared.jsx';
import { useAuth } from '../AuthContext.jsx';

const EMPTY = { name: '', cedula: '', phone: '', email: '', address: '' };

export default function Clients() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const settings = useSettings();
  const cur = settings.currency;

  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setError('');
    try {
      const data = await api.get('/clients');
      setRows(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((c) =>
      c.name.toLowerCase().includes(s) ||
      (c.cedula && c.cedula.includes(s)) ||
      (c.phone && c.phone.includes(s))
    );
  }, [rows, search]);

  function openAdd() { setForm(EMPTY); setEditing('new'); setError(''); }
  function openEdit(c) { setForm({ ...c }); setEditing(c.id); setError(''); }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/clients', form);
      else await api.put(`/clients/${editing}`, form);
      setEditing(null);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="unified-view">
      <div className="unified-header">
        <h2 className="unified-title">Gestión de Clientes</h2>
        <div className="unified-filters">
          <input
            placeholder="Buscar por nombre, cédula o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="unified-btn-green" onClick={openAdd}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
          Nuevo Cliente
        </button>
      </div>

      <div className="unified-body">
        {error && !editing && <div className="alert alert-error">{error}</div>}
        
        {!rows ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron clientes.</div>
        ) : (
          <table className="unified-table">
            <thead>
              <tr>
                <th>Cédula / DNI</th>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Compras Totales</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ color: '#64748b' }}>{c.cedula || '-'}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>
                    <span className="unified-badge gray">{c.total_purchases} compras</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="unified-btn-gray" onClick={() => openEdit(c)}>Editar</button>
                      {isAdmin && (
                        <button className="unified-btn-gray" style={{ background: '#dc2626' }} onClick={() => setDeleting(c.id)}>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Editing Modal */}
      {editing && (
        <Modal open={true} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nuevo Cliente' : 'Editar Cliente'}>
          <form onSubmit={save} className="form form-grid">
            {error && <div className="alert alert-error span-2">{error}</div>}
            <label className="field span-2">
              <span>Nombre completo</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Cédula / DNI</span>
              <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} required />
            </label>
            <label className="field">
              <span>Teléfono</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="field">
              <span>Correo (opcional)</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field">
              <span>Dirección (opcional)</span>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            
            <div className="modal-actions span-2">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
              <button type="submit" className="unified-btn-green" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleting && (
        <ConfirmDialog
          title="Eliminar Cliente"
          message="¿Seguro que deseas eliminar este cliente? Se mantendrá el historial de sus compras pasadas pero no podrá ser seleccionado para nuevas."
          onConfirm={async () => {
            await api.del(`/clients/${deleting}`);
            setDeleting(null);
            load();
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}