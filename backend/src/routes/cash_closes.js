import { Router } from 'express';
import { h, listColl, getDoc, createDoc, deleteDoc, whereEq } from '../fs.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function scopeRows(req, rows) {
  if (req.user.role === 'admin') return rows;
  return rows.filter((r) => String(r.user_id) === String(req.user.id));
}

function parseDetail(detail) {
  try {
    const d = JSON.parse(detail || '{}');
    if (typeof d.cash === 'number' || typeof d.card === 'number' || typeof d.transfer === 'number') {
      return { cash: Number(d.cash) || 0, card: Number(d.card) || 0, transfer: Number(d.transfer) || 0 };
    }
  } catch {
    /* ignore */
  }
  return null;
}

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

async function initialFund() {
  const s = await getDoc('settings', 'main');
  return Number(s?.initial_fund) || 0;
}

async function todayRows(req) {
  const all = await listColl('sales');
  return scopeRows(req, all.filter((s) => s.created_at.slice(0, 10) === todayStr()));
}

router.get(
  '/',
  authRequired,
  h(async (req, res) => {
    const closes = await listColl('cash_closes');
    const scoped = scopeRows(req, closes).sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.id > b.id ? -1 : 1));
    const users = Object.fromEntries((await listColl('users')).map((u) => [String(u.id), u]));
    res.json(scoped.slice(0, 60).map((c) => ({ ...c, user_name: users[c.user_id]?.name || '?' })));
  })
);

router.get(
  '/today-summary',
  authRequired,
  h(async (req, res) => {
    res.json(summarise(await todayRows(req), await initialFund()));
  })
);

router.get(
  '/latest',
  authRequired,
  h(async (req, res) => {
    const closes = scopeRows(req, (await listColl('cash_closes')).filter((c) => c.date === todayStr())).sort((a, b) => (a.id > b.id ? -1 : 1));
    res.json(closes[0] || null);
  })
);

router.post(
  '/',
  authRequired,
  h(async (req, res) => {
    const {
      turn = 'Matutino (08:00 - 13:00)',
      declared_cash = 0,
      declared_card = 0,
      declared_transfer = 0,
      declared_initial_fund,
      explanation = '',
    } = req.body || {};

    const today = todayStr();
    const existing = (await whereEq('cash_closes', 'date', today)).find(
      (c) => String(c.user_id) === String(req.user.id) && c.turn === turn
    );
    if (existing) {
      return res.status(409).json({ error: 'Ya existe un cierre de caja para este turno de hoy.' });
    }

    const sys = summarise(await todayRows(req), await initialFund());
    const fund = Number(declared_initial_fund);
    const declCash = +Number(declared_cash).toFixed(2);
    const declCard = +Number(declared_card).toFixed(2);
    const declTransfer = +Number(declared_transfer).toFixed(2);
    const declFund = isNaN(fund) || fund < 0 ? sys.initial_fund : +fund.toFixed(2);

    const sysTotal = +(sys.cash + sys.card + sys.transfer + sys.initial_fund).toFixed(2);
    const declTotal = +(declCash + declCard + declTransfer + declFund).toFixed(2);
    const difference = +(declTotal - sysTotal).toFixed(2);

    const id = await createDoc('cash_closes', {
      user_id: req.user.id,
      turn,
      date: today,
      system_cash: sys.cash, system_card: sys.card, system_transfer: sys.transfer, system_initial_fund: sys.initial_fund, system_total: sysTotal,
      declared_cash: declCash, declared_card: declCard, declared_transfer: declTransfer, declared_initial_fund: declFund, declared_total: declTotal,
      difference,
      explanation,
    });

    res.status(201).json({ message: 'Cierre de caja registrado exitosamente', close: await getDoc('cash_closes', id) });
  })
);

router.delete(
  '/:id',
  authRequired,
  h(async (req, res) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Solo administradores pueden reabrir la caja' });
    }
    const existing = await getDoc('cash_closes', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cierre no encontrado' });
    await deleteDoc('cash_closes', req.params.id);
    res.json({ message: 'Caja reabierta correctamente', id: req.params.id });
  })
);

router.get(
  '/:id',
  authRequired,
  h(async (req, res) => {
    const row = await getDoc('cash_closes', req.params.id);
    if (!row) return res.status(404).json({ error: 'Cierre no encontrado' });
    if (req.user.role !== 'admin' && String(row.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Sin acceso' });
    }
    const users = Object.fromEntries((await listColl('users')).map((u) => [String(u.id), u]));
    res.json({ ...row, user_name: users[row.user_id]?.name || '?' });
  })
);

export default router;