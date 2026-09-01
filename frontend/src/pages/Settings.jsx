import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Settings() {
  const [form, setForm] = useState({ store_name: '', currency: '$', tax_rate: 0, low_stock_alert: 1, initial_fund: 100, box_open_time: '08:00', box_close_time: '18:00' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/settings').then(setForm).catch((e) => setError(e.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await api.put('/settings', form);
      setForm(data);
      setMessage('Configuracion guardada correctamente.');
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="settings-card">
        <h2>Configuracion de la tienda</h2>
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={save} className="form form-grid">
          <label className="field span-2">
            <span>Nombre de la tienda</span>
            <input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} required />
          </label>
          <label className="field">
            <span>Simbolo de moneda</span>
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} required />
          </label>
          <label className="field">
            <span>Impuesto (%)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.tax_rate}
              onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Fondo inicial de caja (USD)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.initial_fund}
              onChange={(e) => setForm({ ...form, initial_fund: e.target.value })}
            />
            <span className="muted small">Este monto se usa al calcular el cierre de caja.</span>
          </label>
          <label className="field">
            <span>Horario de apertura de caja</span>
            <input
              type="time"
              value={form.box_open_time}
              onChange={(e) => setForm({ ...form, box_open_time: e.target.value })}
            />
            <span className="muted small">Hora en que abre la caja del día.</span>
          </label>
          <label className="field">
            <span>Horario de cierre de caja</span>
            <input
              type="time"
              value={form.box_close_time}
              onChange={(e) => setForm({ ...form, box_close_time: e.target.value })}
            />
            <span className="muted small">Hora en que cierra la caja del día.</span>
          </label>
          <label className="check span-2">
            <input
              type="checkbox"
              checked={!!form.low_stock_alert}
              onChange={(e) => setForm({ ...form, low_stock_alert: e.target.checked ? 1 : 0 })}
            />
            Mostrar alertas de stock bajo
          </label>
          <div className="modal-actions span-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}