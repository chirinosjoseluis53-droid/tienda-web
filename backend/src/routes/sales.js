import { Router } from 'express';
import { h, listColl, getDoc, createDoc, setDoc, deleteDoc, listSub, whereEq, updateDoc } from '../fs.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

async function settings() {
  const s = await getDoc('settings', 'main');
  return { currency: '$', tax_rate: 0, ...s };
}

async function loadList(user) {
  const sales = await listColl('sales');
  let rows = sales;
  if (user.role !== 'admin') rows = rows.filter((s) => s.user_id === user.id);
  rows.sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  const users = Object.fromEntries((await listColl('users')).map((u) => [String(u.id), u]));
  const clients = Object.fromEntries((await listColl('clients')).map((c) => [String(c.id), c]));
  return await Promise.all(
    rows.map(async (s) => ({
      id: s.id,
      total: +s.total || 0,
      created_at: s.created_at,
      user_id: s.user_id,
      payment_method: s.payment_method,
      payment_detail: s.payment_detail,
      user_name: users[s.user_id]?.name || '?',
      client_name: s.client_id ? clients[s.client_id]?.name || null : null,
      items_count: (await listSub('sales', s.id, 'items')).length,
    }))
  );
}

router.post(
  '/',
  authRequired,
  h(async (req, res) => {
    const { items, client_id, payment_method = 'efectivo', payment_detail = {} } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La venta no tiene productos' });
    }

    const allowedMethods = ['efectivo', 'tarjeta', 'transferencia', 'mixto'];
    const method = allowedMethods.includes(payment_method) ? payment_method : 'efectivo';

    const today = new Date().toISOString().slice(0, 10);
    let closedRows = await whereEq('cash_closes', 'date', today);
    if (req.user.role !== 'admin') closedRows = closedRows.filter((c) => c.user_id === req.user.id);
    if (closedRows.length) {
      return res.status(403).json({ error: 'La caja de hoy ya fue cerrada. Reabre la caja para continuar vendiendo.' });
    }

    const saleId = await createDoc('sales', {
      user_id: req.user.id,
      client_id: client_id || null,
      total: 0,
      payment_method: method,
      payment_detail: JSON.stringify(payment_detail),
    });

    const details = [];
    let subtotal = 0;
    let idx = 0;
    for (const it of items) {
      const qty = Number(it.quantity);
      if (!qty || qty <= 0) {
        await deleteDoc('sales', saleId);
        return res.status(400).json({ error: 'Cantidad invalida' });
      }
      const p = await getDoc('products', it.product_id);
      if (!p) {
        await deleteDoc('sales', saleId);
        return res.status(400).json({ error: 'Producto no encontrado' });
      }
      if (+p.stock < qty) {
        await deleteDoc('sales', saleId);
        return res.status(400).json({ error: `Stock insuficiente de "${p.name}" (quedan ${p.stock})` });
      }
      const lineTotal = +(p.price * qty).toFixed(2);
      subtotal += lineTotal;
      idx += 1;
      await setDoc(`sales/${saleId}/items`, String(idx), { product_id: it.product_id, quantity: qty, unit_price: p.price, name: p.name });
      await updateDoc('products', String(it.product_id), { stock: +p.stock - qty });
      details.push({ product_id: it.product_id, qty, quantity: qty, unit_price: p.price, name: p.name });
    }

    const { tax_rate } = await settings();
    const tax = +(subtotal * (tax_rate / 100)).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    await updateDoc('sales', String(saleId), { total });
    if (client_id) await updateDoc('clients', String(client_id), {});

    res.status(201).json({ message: 'Venta registrada', sale: { id: saleId, subtotal: +subtotal.toFixed(2), tax, total, payment_method: method, details } });
  })
);

router.get(
  '/',
  authRequired,
  h(async (req, res) => {
    let rows = await loadList(req.user);
    const { from, to } = req.query;
    if (from) rows = rows.filter((s) => s.created_at >= `${from} 00:00:00`);
    if (to) rows = rows.filter((s) => s.created_at <= `${to} 23:59:59`);
    res.json(rows);
  })
);

router.get(
  '/:id',
  authRequired,
  h(async (req, res) => {
    const list = await loadList({ role: 'admin' });
    const s = list.find((x) => x.id === req.params.id) || (await getDoc('sales', req.params.id));
    if (!s) return res.status(404).json({ error: 'Venta no encontrada' });
    if (req.user.role !== 'admin' && String(s.user_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'No puedes ver esta venta' });
    }
    const products = Object.fromEntries((await listColl('products')).map((p) => [String(p.id), p]));
    const items = (await listSub('sales', req.params.id, 'items')).map((it) => ({
      ...it,
      product_name: products[it.product_id]?.name || it.name || '',
    }));
    res.json({ ...s, items });
  })
);

router.delete(
  '/:id',
  authRequired,
  h(async (req, res) => {
    const s = await getDoc('sales', req.params.id);
    if (!s) return res.status(404).json({ error: 'Venta no encontrada' });
    if (req.user.role === 'admin') {
      const items = await listSub('sales', req.params.id, 'items');
      for (const it of items) {
        const p = await getDoc('products', it.product_id);
        if (p) await updateDoc('products', String(it.product_id), { stock: +p.stock + it.quantity });
      }
      await deleteDoc('sales', req.params.id);
      res.json({ message: 'Venta eliminada y stock restaurado' });
    } else {
      res.status(403).json({ error: 'Solo administradores pueden eliminar ventas' });
    }
  })
);

export default router;