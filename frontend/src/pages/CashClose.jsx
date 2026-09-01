import { useEffect, useState } from 'react';
import { api, fmtMoney, fmtDate } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useSettings } from '../components/Shared.jsx';

const PAY_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Pago móvil', mixto: 'Mixto' };

export default function CashClose() {
  const { user } = useAuth();
  const settings = useSettings();
  const cur = settings.currency;
  const isAdmin = user?.role === 'admin';
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const todayKey = new Date().toISOString().slice(0, 10);
  const turn = 'Matutino (08:00 - 13:00)';

  const [summary, setSummary] = useState(null);
  const [alreadyClosed, setAlreadyClosed] = useState(null); // el cierre de hoy si existe
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null); // cierre guardado

  const [declared, setDeclared] = useState({ cash: '', card: '', transfer: '', initial_fund: '' });
  const [explanation, setExplanation] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [sum, latest, hist] = await Promise.all([
        api.get('/cash-closes/today-summary'),
        api.get('/cash-closes/latest'),
        api.get('/cash-closes'),
      ]);
      setSummary(sum);
      setHistory(hist);
      if (latest && latest.date === todayKey) {
        setAlreadyClosed(latest);
      } else {
        setAlreadyClosed(null);
        setDeclared({
          cash: sum.cash?.toFixed(2) ?? '0.00',
          card: sum.card?.toFixed(2) ?? '0.00',
          transfer: sum.transfer?.toFixed(2) ?? '0.00',
          initial_fund: sum.initial_fund?.toFixed(2) ?? '0.00',
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function num(v) {
    return Number(v) || 0;
  }

  const totalDeclared =
    num(declared.cash) + num(declared.card) + num(declared.transfer) + num(declared.initial_fund);
  const totalSystem = summary
    ? summary.cash + summary.card + summary.transfer + summary.initial_fund
    : 0;
  const difference = totalDeclared - totalSystem;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/cash-closes', {
        turn,
        declared_cash: num(declared.cash),
        declared_card: num(declared.card),
        declared_transfer: num(declared.transfer),
        declared_initial_fund: num(declared.initial_fund),
        explanation: explanation.trim(),
      });
      setDone(res.close);
    } catch (e2) {
      setError(e2.message);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleReopen() {
    if (!alreadyClosed) return;
    setSaving(true);
    setError('');
    try {
      await api.del('/cash-closes/' + alreadyClosed.id);
      setAlreadyClosed(null);
      setDone(null);
      await load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="page-center"><div className="spinner" /><p>Cargando datos del día...</p></div>;
  }

  // Pantalla cuando la caja ya fue cerrada hoy (o termina el cierre)
  const closed = done || alreadyClosed;
  if (closed) {
    const diffClass = closed.difference < 0 ? 'neg' : closed.difference > 0 ? 'pos' : 'zero';
    return (
      <div className="stack" style={{ maxWidth: 620, margin: '0 auto' }}>
        <div className="cc-success">
          <div className="cc-success-badge">🔒</div>
          <h2>Cierre de Caja Ejecutado</h2>
          <p className="cc-success-sub">El sistema está bloqueado para el turno de hoy. No se pueden realizar ventas.</p>

          <div className="cc-success-card">
            <div className="cc-success-row"><span>Cierre #</span><strong>{closed.id}</strong></div>
            <div className="cc-success-row"><span>Fecha</span><strong>{fmtDate(closed.date)}</strong></div>
            <div className="cc-success-row"><span>Turno</span><strong>{closed.turn}</strong></div>
            <div className="cc-success-row"><span>Cajero</span><strong>{closed.user_name || user?.name}</strong></div>
            <div className="cc-success-divider" />
            <div className="cc-success-row big">
              <span>Total según sistema</span>
              <strong>{fmtMoney(closed.system_total, cur)}</strong>
            </div>
            <div className="cc-success-row big">
              <span>Total declarado</span>
              <strong>{fmtMoney(closed.declared_total, cur)}</strong>
            </div>
            <div className="cc-success-divider" />
            <div className={`cc-success-row diff ${diffClass}`}>
              <span>Diferencia</span>
              <strong>
                {closed.difference === 0
                  ? 'Caja cuadrada'
                  : `${fmtMoney(Math.abs(closed.difference), cur)} ${closed.difference < 0 ? '(Faltante)' : '(Sobrante)'}`}
              </strong>
            </div>
          </div>

          {closed.explanation && (
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 14 }}>
              Motivo: <strong>{closed.explanation}</strong>
            </p>
          )}

          {isAdmin && (
            <button className="cc-reopen" onClick={handleReopen} disabled={saving}>
              ⟳ Reabrir caja
            </button>
          )}
          {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
        </div>

        <History history={history} cur={cur} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="cc-panel">
        <form onSubmit={handleSubmit}>
          <div className="cc-hero">
            <div className="cc-hero-icon">🔒</div>
            <div className="cc-hero-text">
              <h2 className="cc-hero-title">Arqueo de Caja</h2>
              <p className="cc-hero-sub">Cierre del turno — verifica y declara el dinero físico</p>
            </div>
          </div>

          <div className="cc-meta">
            <div className="cc-meta-item">
              <span className="cc-meta-label">Cajero</span>
              <span className="cc-meta-value">{user?.name}</span>
            </div>
            <div className="cc-meta-item">
              <span className="cc-meta-label">Turno</span>
              <span className="cc-meta-value">{turn}</span>
            </div>
            <div className="cc-meta-item">
              <span className="cc-meta-label">Ventas del día</span>
              <span className="cc-meta-value">{summary?.count ?? 0} tickets</span>
            </div>
            <div className="cc-meta-item">
              <span className="cc-meta-label">Fecha</span>
              <span className="cc-meta-value">{today}</span>
            </div>
          </div>

          <div className="cc-grid">
            <div className="cc-col">
              <div className="cc-col-head">📊 Resumen del sistema</div>
              <div className="cc-row">
                <span className="cc-row-label">💰 Efectivo</span>
                <span className="cc-row-val">{fmtMoney(summary?.cash ?? 0, cur)}</span>
              </div>
              <div className="cc-row">
                <span className="cc-row-label">💳 Tarjeta</span>
                <span className="cc-row-val">{fmtMoney(summary?.card ?? 0, cur)}</span>
              </div>
              <div className="cc-row">
                <span className="cc-row-label">📱 Pago móvil</span>
                <span className="cc-row-val">{fmtMoney(summary?.transfer ?? 0, cur)}</span>
              </div>
              <div className="cc-row">
                <span className="cc-row-label">🏦 Fondo inicial</span>
                <span className="cc-row-val">{fmtMoney(summary?.initial_fund ?? 0, cur)}</span>
              </div>
              <div className="cc-row cc-row-total">
                <span>TOTAL A DECLARAR</span>
                <span className="cc-row-val">{fmtMoney(totalSystem, cur)}</span>
              </div>
            </div>

            <div className="cc-col">
              <div className="cc-col-head">✏️ Declaración física</div>
              {[
                { key: 'cash', label: '💵 Efectivo contado' },
                { key: 'card', label: '💳 Vouchers tarjeta' },
                { key: 'transfer', label: '📱 Vouchers pago móvil' },
                { key: 'initial_fund', label: '🏦 Fondo de caja' },
              ].map((f) => (
                <div className="cc-row" key={f.key}>
                  <span className="cc-row-label">{f.label}</span>
                  <div className="cc-input-wrap">
                    <span className="cc-input-cur">$</span>
                    <input
                      className="cc-input"
                      type="number"
                      step="0.01"
                      value={declared[f.key]}
                      onChange={(e) => setDeclared({ ...declared, [f.key]: e.target.value })}
                    />
                  </div>
                </div>
              ))}
              <div className="cc-row cc-row-total">
                <span>TOTAL DECLARADO</span>
                <span className="cc-row-val">{fmtMoney(totalDeclared, cur)}</span>
              </div>
            </div>
          </div>

          <div className="cc-balance">
            <div className="cc-balance-head">Balance final</div>
            <div className="cc-balance-main">
              <span className="cc-balance-label">Diferencia (descuadre)</span>
              <span className={`cc-diff ${difference === 0 ? 'cc-diff-ok' : difference > 0 ? 'cc-diff-over' : 'cc-diff-short'}`}>
                {fmtMoney(difference, cur)}
              </span>
            </div>
            <label className="cc-explain">
              <span>Explicación del descuadre (opcional)</span>
              <input
                className="cc-explain-input"
                type="text"
                placeholder="Motivo del descuadre si hubo diferencia..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </label>
          </div>

          {error && <div className="alert alert-error" style={{ margin: '0 28px' }}>{error}</div>}

          <div className="cc-actions">
            <button type="submit" className="cc-submit" disabled={saving}>
              🔒 {saving ? 'Ejecutando cierre...' : 'EJECUTAR CIERRE Y BLOQUEAR SISTEMA'}
            </button>
          </div>
        </form>
      </div>

      <History history={history} cur={cur} isAdmin={isAdmin} />
    </div>
  );
}

function History({ history, cur, isAdmin }) {
  const styles = { marginTop: 18 };
  return (
    <div className="card-table" style={styles}>
      <div className="cashclose-col-head" style={{ borderRadius: 0, border: 'none' }}>
        Historial de cierres {isAdmin ? '(todos los cajeros)' : '(los tuyos)'}
      </div>
      {history.length === 0 ? (
        <div className="empty" style={{ boxShadow: 'none', borderRadius: 0 }}>Aún no hay cierres registrados.</div>
      ) : (
        <table className="unified-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Cajero</th>
              <th>Turno</th>
              <th>Sistema</th>
              <th>Declarado</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.id}</td>
                <td>{fmtDate(h.date)}</td>
                <td>{h.user_name}</td>
                <td>{h.turn}</td>
                <td>{fmtMoney(h.system_total, cur)}</td>
                <td>{fmtMoney(h.declared_total, cur)}</td>
                <td>
                  <span className={h.difference === 0 ? 'badge' : h.difference < 0 ? 'badge badge-warn' : 'badge'} style={{ background: h.difference < 0 ? '#fee2e2' : '#dcfce7', color: h.difference < 0 ? '#b91c1c' : '#166534' }}>
                    {fmtMoney(h.difference, cur)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}