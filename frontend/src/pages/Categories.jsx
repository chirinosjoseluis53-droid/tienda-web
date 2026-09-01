import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { ConfirmDialog } from '../components/Shared.jsx';

export default function Categories() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setError('');
    try {
      const data = await api.get('/categories');
      const prods = await api.get('/products');
      setRows(data.map((c) => ({ ...c, products: prods.filter((p) => p.category_id === c.id).length })));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function openEdit(c) {
    setName(c.name || '');
    setEditing(c.id);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') await api.post('/categories', { name });
      else await api.put(`/categories/${editing}`, { name });
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
      await api.del(`/categories/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="stack">
      <div className="toolbar-card">
        <span className="muted">Administra las categorias de tus productos.</span>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => { setName(''); setEditing('new'); }}>+ Nueva categoria</button>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {!rows ? (
        <div className="page-center"><div className="spinner" /></div>
      ) : (
        <div className="card-table">
          <table className="table">
            <thead><tr><th>Categoria</th><th>Productos</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.products}</td>
                  <td className="row-actions">
                    <button className="btn btn-sm" onClick={() => openEdit(c)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setDeleting(c)} disabled={c.products > 0} title={c.products > 0 ? 'Tiene productos asignados' : ''}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nueva categoria' : 'Editar categoria'}>
        <form onSubmit={save} className="form">
          {error && <div className="alert alert-error">{error}</div>}
          <label className="field">
            <span>Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => setEditing(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Eliminar categoria"
        text={`¿Eliminar la categoria "${deleting?.name}"?"`}
      />
    </div>
  );
}