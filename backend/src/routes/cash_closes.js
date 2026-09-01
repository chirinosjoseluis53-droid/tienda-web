import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (consistent con created_at que usa UTC)
}

function scopeClause(req) {
  if (req.user.role === 'admin') return { sql: '', params: [] };
  return { sql: 'AND s.user_id = ?', params: [req.user.id] };
}

// Suma por metodo de pago a partir del detalle real guardado en la venta.
// payment_detail = {"cash": x, "card": y, "transfer": z} (en USD, bs ya convertido).
// Si falta el detalle, cae al metodo principal de la venta.
function summarise(salesRows, initialFund) {
  const out = { cash: 0, card: 0, transfer: 0, other: 0, total: 0, count: salesRows.length, initial_fund: initialFund };
  for (const row of salesRows) {
    const total = Number(row.total) || 0;
    out.total += total;
    const detail = parseDetail(row.payment_detail);
    if (detail) {
      out.cash += detail.cash || 0;
      out.card += detail.card || 0;
      out.transfer += detail.transfer || 0;
      continue;
    }
    const m = row.payment_method || 'efectivo';
    if (m === 'efectivo') out.cash += total;
    else if (m === 'tarjeta') out.card += total;
    else if (m === 'transferencia') out.transfer += total;
    else out.other += total;
  }
  out.cash = +out.cash.toFixed(2);
  out.card = +out.card.toFixed(2);
  out.transfer = +out.transfer.toFixed(2);
  out.other = +out.other.toFixed(2);
  out.total = +out.total.toFixed(2);
  return out;
}

function parseDetail(detail) {
  try {
    const d = JSON.parse(detail || '{}');
    if (typeof d.cash === 'number' || typeof d.card === 'number' || typeof d.transfer === 'number') {
      return {
        cash: Number(d.cash) || 0,
        card: Number(d.card) || 0,
        transfer: Number(d.transfer) || 0,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function initialFund() {
  return Number(get('SELECT initial_fund FROM settings WHERE id = 1').initial_fund) || 0;
}

function todayRows(req) {
  const scope = scopeClause(req);
  return query(
    `SELECT payment_method, payment_detail, total FROM sales s
     WHERE date(s.created_at) = ? ${scope.sql}`,
    [todayStr(), ...scope.params]
  );
}

// ─── GET /api/cash-closes  (historial de cierres, admin: todos / empleado: los suyos) ──
router.get('/', authRequired, (req, res) => {
  const scope = req.user.role === 'admin' ? '' : 'WHERE cc.user_id = ?';
  const params = req.user.role === 'admin' ? [] : [req.user.id];
  const rows = query(
    `SELECT cc.*, u.name AS user_name
     FROM cash_closes cc
     JOIN users u ON u.id = cc.user_id
     ${scope}
     ORDER BY cc.date DESC, cc.id DESC
     LIMIT 60`,
    params
  );
  res.json(rows);
});

// ─── GET /api/cash-closes/today-summary  (totales del dia por metodo) ────────────────
router.get('/today-summary', authRequired, (req, res) => {
  const summary = summarise(todayRows(req), initialFund());
  res.json(summary);
});

// ─── GET /api/cash-closes/latest  (cerrado para hoy o null) ─────────────────────────
router.get('/latest', authRequired, (req, res) => {
  const scope = req.user.role === 'admin' ? '' : 'AND user_id = ?';
  const params = req.user.role === 'admin' ? [] : [req.user.id];
  const row = get(
    `SELECT * FROM cash_closes WHERE date = ? ${scope} ORDER BY id DESC LIMIT 1`,
    [todayStr(), ...params]
  );
  res.json(row || null);
});

// ─── POST /api/cash-closes  (ejecutar el cierre de caja) ─────────────────────────────
router.post('/', authRequired, (req, res) => {
  const {
    turn = 'Matutino (08:00 - 13:00)',
    declared_cash = 0,
    declared_card = 0,
    declared_transfer = 0,
    declared_initial_fund,
    explanation = '',
  } = req.body || {};

  const today = todayStr();
  const existing = get('SELECT id FROM cash_closes WHERE user_id = ? AND date = ? AND turn = ?', [
    req.user.id,
    today,
    turn,
  ]);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un cierre de caja para este turno de hoy.' });
  }

  const sys = summarise(todayRows(req), initialFund());
  const fund = Number(declared_initial_fund);
  const declCash = +Number(declared_cash).toFixed(2);
  const declCard = +Number(declared_card).toFixed(2);
  const declTransfer = +Number(declared_transfer).toFixed(2);
  const declFund = isNaN(fund) || fund < 0 ? sys.initial_fund : +fund.toFixed(2);

  const sysTotal = +(sys.cash + sys.card + sys.transfer + sys.initial_fund).toFixed(2);
  const declTotal = +(declCash + declCard + declTransfer + declFund).toFixed(2);
  const difference = +(declTotal - sysTotal).toFixed(2);

  const { id } = run(
    `INSERT INTO cash_closes
       (user_id, turn, date,
        system_cash, system_card, system_transfer, system_initial_fund, system_total,
        declared_cash, declared_card, declared_transfer, declared_initial_fund, declared_total,
        difference, explanation)
     VALUES (?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?)`,
    [
      req.user.id, turn, today,
      sys.cash, sys.card, sys.transfer, sys.initial_fund, sysTotal,
      declCash, declCard, declTransfer, declFund, declTotal,
      difference, explanation,
    ]
  );

  const saved = get('SELECT * FROM cash_closes WHERE id = ?', [id]);
  res.status(201).json({ message: 'Cierre de caja registrado exitosamente', close: saved });
});

// ─── DELETE /api/cash-closes/:id  (reabrir caja — solo admin) ────────────────────────
router.delete('/:id', authRequired, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden reabrir la caja' });
  }
  const r = run('DELETE FROM cash_closes WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Cierre no encontrado' });
  res.json({ message: 'Caja reabierta correctamente', id: Number(req.params.id) });
});

// ─── GET /api/cash-closes/:id  (detalle de un cierre) ────────────────────────────────
router.get('/:id', authRequired, (req, res) => {
  const row = get(
    `SELECT cc.*, u.name AS user_name
     FROM cash_closes cc JOIN users u ON u.id = cc.user_id
     WHERE cc.id = ?`,
    [req.params.id]
  );
  if (!row) return res.status(404).json({ error: 'Cierre no encontrado' });
  if (req.user.role !== 'admin' && row.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Sin acceso' });
  }
  res.json(row);
});

export default router;