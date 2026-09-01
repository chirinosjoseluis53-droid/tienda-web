import { useState, useEffect } from 'react';
import { api, getToken } from '../api.js';

export default function Reports() {
  const [emps, setEmps] = useState([]);
  const [type, setType] = useState('sales');
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/users')
      .then((users) => setEmps(users.filter((u) => u.role === 'empleado')))
      .catch(() => {});
  }, []);

  async function download(e) {
    e.preventDefault();
    setError('');
    if (from && to && from > to) { setError('La fecha inicial no puede ser mayor que la final'); return; }

    const qs = new URLSearchParams();
    if (employeeId) qs.set('employee_id', employeeId);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);

    const path = type === 'sales' ? `employee-sales.csv` : `cash-closes.csv`;
    const empName = (emps.find((u) => String(u.id) === String(employeeId))?.name || 'todos').replace(/\s+/g, '_');
    const base = import.meta.env.VITE_API_URL || '';

    setLoading(true);
    try {
      const res = await fetch(`${base}/api/reports/${path}?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        let msg = 'Error al descargar el reporte';
        try { const d = await res.json(); msg = d.error || msg; } catch { /* no body */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${path.replace('.csv', '')}-${empName}-${from || 'ini'}_${to || 'fin'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack">
      <div className="toolbar-card">
        <span className="muted">Descarga el historial de ventas por empleado y de cierres de caja por empleado y fecha.</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="settings-card">
        <h2 style={{ margin: '0 0 16px' }}>📄 Reportes</h2>
        <form onSubmit={download} className="form form-grid" style={{ gap: '12px' }}>
          <label className="field">
            <span>Tipo de reporte</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="sales">Historial de ventas por empleado</option>
              <option value="closes">Cierre de caja por empleado</option>
            </select>
          </label>

          <label className="field">
            <span>Empleado</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Todos los empleados</option>
              {emps.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Desde</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>

          <label className="field">
            <span>Hasta</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>

          <div className="modal-actions span-2">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generando...' : '⬇️ Descargar CSV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}