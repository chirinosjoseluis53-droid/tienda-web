import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDay } from '../api.js';
import { useData, useSettings, Money, EmptyState } from '../components/Shared.jsx';

export default function Dashboard() {
  const { data, error, loading, reload } = useData(() => api.get('/dashboard'));
  const settings = useSettings();
  const [now, setNow] = useState(() => new Date());
  const [boxOpen, setBoxOpen] = useState('08:00');
  const [boxClose, setBoxClose] = useState('18:00');
  const [savingBox, setSavingBox] = useState(false);
  const [boxMsg, setBoxMsg] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setBoxOpen(settings.box_open_time || '08:00');
    setBoxClose(settings.box_close_time || '18:00');
  }, [settings.box_open_time, settings.box_close_time]);

  function minutes(hhmm) {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const boxOpenNow = minutes(boxOpen) <= nowMin && nowMin < minutes(boxClose);

  async function saveHours(e) {
    e.preventDefault();
    setSavingBox(true);
    setBoxMsg('');
    try {
      await api.put('/settings', { box_open_time: boxOpen, box_close_time: boxClose });
      setBoxMsg('✓ Horario guardado');
      setTimeout(() => setBoxMsg(''), 2500);
    } catch (err) {
      setBoxMsg(err.message);
    } finally {
      setSavingBox(false);
    }
  }

  if (loading) return <div className="page-center"><div className="spinner" /></div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  const cur = settings.currency;
  const chartData = data.daily.labels.map((day, i) => ({ day: fmtDay(day), ventas: data.daily.series[i] }));

  const cards = [
    { label: 'Ventas de hoy',    value: fmtMoney(data.todaySales.total, cur), sub: `${data.todaySales.count} transacciones`, icon: '🛍️', color: '#16a34a' },
    { label: data.isAdmin ? 'Ventas totales' : 'Mis ventas totales', value: fmtMoney(data.totalSales.total, cur), sub: `${data.totalSales.count} transacciones`, icon: '💰', color: '#2563eb' },
    { label: 'Valor inventario', value: fmtMoney(data.inventory.value, cur), sub: 'Costo en bodega', icon: '📦', color: '#7c3aed' },
    { label: 'Stock bajo',       value: data.lowStock.length, sub: 'Productos por reabastecer', icon: '⚠️', color: '#dc2626' },
  ];

  return (
    <div className="dash-wrap">

      {/* ---- Fecha, hora y horario de la caja ---- */}
      <div className="dash-top">
        <div className="dash-clock">
          <span className="dash-time">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="dash-date">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        <form className="dash-box" onSubmit={saveHours}>
          <div className="dash-box-status">
            <span className={`dash-box-dot ${boxOpenNow ? 'open' : ''}`} />
            <div>
              <strong>{boxOpenNow ? 'Caja abierta' : 'Caja cerrada'}</strong>
              <span className="dash-box-sub">Horario de la caja de hoy</span>
            </div>
          </div>
          <label className="dash-box-field">
            <span>De</span>
            <input
              type="time"
              value={boxOpen}
              onChange={(e) => setBoxOpen(e.target.value)}
              disabled={!data.isAdmin}
            />
          </label>
          <label className="dash-box-field">
            <span>A</span>
            <input
              type="time"
              value={boxClose}
              onChange={(e) => setBoxClose(e.target.value)}
              disabled={!data.isAdmin}
            />
          </label>
          {data.isAdmin && (
            <button type="submit" className="dash-box-save" disabled={savingBox} title="Guardar horario">
              {savingBox ? '⏳' : '💾'}
            </button>
          )}
          {boxMsg && <span className="dash-box-msg">{boxMsg}</span>}
        </form>
      </div>

      {/* ---- KPI Cards ---- */}
      <div className="dash-cards">
        {cards.map((c) => (
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

      {/* ---- Area Chart ---- */}
      <section className="dash-panel">
        <div className="dash-panel-head">
          <span>📈 Ventas por día — últimos 14 días</span>
          <button className="dash-refresh-btn" onClick={reload}>🔄 Actualizar</button>
        </div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmtMoney(v, cur)} />
              <Area type="monotone" dataKey="ventas" stroke="#16a34a" fill="url(#gv)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ---- Bottom Grid ---- */}
      <div className="dash-grid-2">
        {/* Top Products */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>🏆 Productos más vendidos — 30 días</span>
          </div>
          {data.topProducts.length === 0 ? (
            <EmptyState message="No hay ventas en el periodo" />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Producto</th><th>Cantidad</th><th>Ingreso</th></tr>
              </thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td><span className="badge">{p.qty}</span></td>
                    <td><Money value={p.revenue} currency={cur} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Low Stock */}
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>⚠️ Stock bajo</span>
          </div>
          {data.lowStock.length === 0 ? (
            <EmptyState message="Sin productos con stock bajo ✅" />
          ) : (
            <table className="table">
              <thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th></tr></thead>
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td><span className="badge badge-warn">{p.stock}</span></td>
                    <td>{p.min_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ---- Category Bar Chart (admin only) ---- */}
      {data.isAdmin && data.byCategory.length > 0 && (
        <section className="dash-panel">
          <div className="dash-panel-head">
            <span>🗂️ Ventas por categoría — 30 días</span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCategory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => fmtMoney(v, cur)} />
                <Bar dataKey="total" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

    </div>
  );
}