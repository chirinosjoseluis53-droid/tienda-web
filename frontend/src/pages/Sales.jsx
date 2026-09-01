import { useEffect, useMemo, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { ConfirmDialog, useSettings, EmptyState } from '../components/Shared.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../AuthContext.jsx';

export default function Sales() {
  const { user } = useAuth();
  const settings = useSettings();
  const cur = settings.currency;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const data = await api.get('/sales?' + q.toString());
      setRows(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleFilter(e) {
    e.preventDefault();
    load();
  }

  async function handleViewDetail(sale) {
    try {
      const full = await api.get(`/sales/${sale.id}`);
      setDetail(full);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleReprint(sale) {
    try {
      const full = await api.get(`/sales/${sale.id}`);
      setDetail({ ...full, _reprint: true });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    try {
      await api.del(`/sales/${deleting.id}`);
      setDeleting(null);
      load();
    } catch (e) {
      setError(e.message);
      setDeleting(null);
    }
  }

  const PAY_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Pago movil', mixto: 'Mixto' };

  const totals = useMemo(() => {
    if (!rows) return { efectivo: 0, tarjeta: 0, transfer: 0, total: 0 };
    return rows.reduce((acc, sale) => {
      acc.total += sale.total;
      let det = null;
      try { det = JSON.parse(sale.payment_detail || '{}'); } catch { /* ignore */ }
      if (det && (typeof det.cash === 'number' || typeof det.card === 'number' || typeof det.transfer === 'number')) {
        acc.efectivo += Number(det.cash) || 0;
        acc.tarjeta += Number(det.card) || 0;
        acc.transfer += Number(det.transfer) || 0;
      } else {
        const m = sale.payment_method || 'efectivo';
        if (m === 'tarjeta') acc.tarjeta += sale.total;
        else if (m === 'transferencia') acc.transfer += sale.total;
        else acc.efectivo += sale.total;
      }
      return acc;
    }, { efectivo: 0, tarjeta: 0, transfer: 0, total: 0 });
  }, [rows]);

  function payBadge(method) {
    const map = {
      efectivo: { bg: '#dcfce7', color: '#166534', label: 'Efectivo' },
      tarjeta: { bg: '#dbeafe', color: '#1e40af', label: 'Tarjeta' },
      transferencia: { bg: '#fef3c7', color: '#92400e', label: 'Pago movil' },
      mixto: { bg: '#ede9fe', color: '#5b21b6', label: 'Mixto' },
    };
    const m = map[method] || map.efectivo;
    return <span className="badge" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
  }

  return (
    <div className="unified-view">
      <div className="unified-header">
        <h2 className="unified-title">Historial de Ventas</h2>
        <form className="unified-filters" onSubmit={handleFilter}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span>-</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="submit" className="unified-btn-gray">Filtrar</button>
        </form>
      </div>

      <div className="unified-body">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Cargando...</div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : rows?.length === 0 ? (
          <EmptyState message="No se encontraron ventas." />
        ) : (
          <table className="unified-table">
            <thead>
              <tr>
                <th>N° Factura</th>
                <th>Fecha / Hora</th>
                <th>Cliente</th>
                <th>Articulos</th>
                <th>Total</th>
                <th>Metodo de Pago</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((sale) => (
                <tr key={sale.id}>
                  <td>F10{sale.id}</td>
                  <td>{fmtDate(sale.created_at)}</td>
                  <td>{sale.client_name || 'Consumidor Final'}</td>
                  <td>{sale.items_count}</td>
                  <td>{fmtMoney(sale.total, cur)}</td>
                  <td>{payBadge(sale.payment_method)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="unified-btn-gray" onClick={() => handleViewDetail(sale)}>
                        Ver Detalle
                      </button>
                      <button className="unified-btn-gray" onClick={() => handleReprint(sale)}>
                        Reimprimir
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          className="unified-btn-gray"
                          style={{ background: '#dc2626', color: '#fff' }}
                          onClick={() => setDeleting(sale)}
                        >
                          Anular
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

      <div className="unified-totals">
        <div className="unified-totals-row">
          <span>Total Efectivo:</span>
          <span>{fmtMoney(totals.efectivo, cur)}</span>
        </div>
        <div className="unified-totals-row">
          <span>Total Tarjeta:</span>
          <span>{fmtMoney(totals.tarjeta, cur)}</span>
        </div>
        <div className="unified-totals-row">
          <span>Total Pago movil:</span>
          <span>{fmtMoney(totals.transfer, cur)}</span>
        </div>
        <div className="unified-totals-row bold">
          <span>Total General Recaudado:</span>
          <span>{fmtMoney(totals.total, cur)}</span>
        </div>
      </div>

      {/* ── Modal: Ver Detalle ── */}
      {detail && !detail._reprint && (
        <Modal open={true} onClose={() => setDetail(null)} title={`Venta F10${detail.id}`}>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#64748b' }}>
            {fmtDate(detail.created_at)} &mdash; {detail.client_name || 'Consumidor Final'}
          </div>
          <table className="unified-table">
            <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th></tr></thead>
            <tbody>
              {(detail.items || []).map((d) => (
                <tr key={d.id}>
                  <td>{d.product_name}</td>
                  <td>{d.quantity}</td>
                  <td>{fmtMoney(d.quantity * d.unit_price, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: 10, fontWeight: 600 }}>
            Total: {fmtMoney(detail.total, cur)}
          </div>
        </Modal>
      )}

      {/* ── Modal: Reimprimir ── */}
      {detail && detail._reprint && (
        <Modal
          open={true}
          onClose={() => setDetail(null)}
          title={`Reimprimir F10${detail.id}`}
          footer={
            <button className="btn btn-success" onClick={() => window.print()}>
              Imprimir
            </button>
          }
        >
          <div className="invoice-paper" id="invoice-print-area">
            <div className="invoice-header">
              <h2>{settings.store_name || 'Mi Minimarket'}</h2>
              <p>Factura N° F10{detail.id}</p>
              <p>{fmtDate(detail.created_at)}</p>
              <p>Cliente: {detail.client_name || 'Consumidor Final'}</p>
              <p>Vendedor: {detail.user_name}</p>
            </div>
            <table className="unified-table" style={{ marginTop: 12 }}>
              <thead><tr><th>Producto</th><th>Cant</th><th>Precio</th><th>Subtotal</th></tr></thead>
              <tbody>
                {(detail.items || []).map((d) => (
                  <tr key={d.id}>
                    <td>{d.product_name}</td>
                    <td>{d.quantity}</td>
                    <td>{fmtMoney(d.unit_price, cur)}</td>
                    <td>{fmtMoney(d.quantity * d.unit_price, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="invoice-footer" style={{ marginTop: 12, textAlign: 'right', fontWeight: 700, fontSize: 16 }}>
              Total: {fmtMoney(detail.total, cur)}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Confirm: Anular ── */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        title="Anular Venta"
        text={`¿Estas seguro de anular la venta F10${deleting?.id}? Se eliminara del historial y se devolvera el stock.`}
      />
    </div>
  );
}
