import { Router } from 'express';
import { query, get, run, transaction } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function settings() {
  return get('SELECT currency, tax_rate FROM settings WHERE id = 1');
}

router.post('/', authRequired, (req, res) => {
  const { items, client_id, payment_method = 'efectivo', payment_detail = {} } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'La venta no tiene productos' });
  }

  const allowedMethods = ['efectivo', 'tarjeta', 'transferencia', 'mixto'];
  const method = allowedMethods.includes(payment_method) ? payment_method : 'efectivo';

  // Si la caja de hoy ya fue cerrada, se bloquean nuevas ventas hasta reabrirla
  const today = new Date().toISOString().slice(0, 10);
  const closed = req.user.role === 'admin'
    ? get('SELECT id FROM cash_closes WHERE date = ?', [today])
    : get('SELECT id FROM cash_closes WHERE date = ? AND user_id = ?', [today, req.user.id]);
  if (closed) {
    return res.status(403).json({ error: 'La caja de hoy ya fue cerrada. Reabre la caja para continuar vendiendo.' });
  }

  try {
    const sale = transaction(() => {
      const details = [];
      let subtotal = 0;
      for (const it of items) {
        const qty = Number(it.quantity);
        if (!qty || qty <= 0) throw new Error('Cantidad invalida');
        const p = get('SELECT * FROM products WHERE id = ?', [it.product_id]);
        if (!p) throw new Error('Producto no encontrado');
        if (p.stock < qty) throw new Error(`Stock insuficiente de "${p.name}" (quedan ${p.stock})`);
        const lineTotal = +(p.price * qty).toFixed(2);
        subtotal += lineTotal;
        details.push({ product_id: p.id, quantity: qty, unit_price: p.price, name: p.name });
        run('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, p.id]);
      }
      const { tax_rate } = settings();
      const tax = +(subtotal * (tax_rate / 100)).toFixed(2);
      const total = +(subtotal + tax).toFixed(2);
      const detailJson = JSON.stringify(payment_detail);
      const { id } = run(
        'INSERT INTO sales (user_id, client_id, total, payment_method, payment_detail) VALUES (?,?,?,?,?)',
        [req.user.id, client_id || null, total, method, detailJson]
      );
      for (const d of details) {
        run('INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?,?,?,?)', [
          id,
          d.product_id,
          d.quantity,
          d.unit_price,
        ]);
      }
      return { id, subtotal: +subtotal.toFixed(2), tax, total, payment_method: method, details };
    });

    res.status(201).json({ message: 'Venta registrada', sale });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const LIST_SELECT = `
  SELECT s.id, s.total, s.created_at, s.user_id, s.payment_method, s.payment_detail,
         u.name AS user_name,
         c.name AS client_name,
         (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS items_count
  FROM sales s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN clients c ON c.id = s.client_id
`;

router.get('/', authRequired, (req, res) => {
  let sql = LIST_SELECT + ' WHERE 1=1';
  const params = [];
  if (req.user.role !== 'admin') {
    sql += ' AND s.user_id = ?';
    params.push(req.user.id);
  }
  const { from, to } = req.query;
  if (from) {
    sql += ' AND s.created_at >= ?';
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    sql += ' AND s.created_at <= ?';
    params.push(`${to} 23:59:59`);
  }
  sql += ' ORDER BY s.id DESC';
  res.json(query(sql, params));
});

router.get('/:id', authRequired, (req, res) => {
  const s = get(LIST_SELECT + ' WHERE s.id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Venta no encontrada' });
  if (req.user.role !== 'admin' && s.user_id !== req.user.id) {
    return res.status(403).json({ error: 'No puedes ver esta venta' });
  }
  const items = query(
    `SELECT si.*, p.name AS product_name FROM sale_items si
     JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?`,
    [s.id]
  );
  res.json({ ...s, items });
});

router.delete('/:id', authRequired, async (req, res) => {
  const s = get('SELECT * FROM sales WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Venta no encontrada' });

  if (req.user.role === 'admin') {
    const items = query('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [s.id]);
    transaction(() => {
      for (const it of items) {
        run('UPDATE products SET stock = stock + ? WHERE id = ?', [it.quantity, it.product_id]);
      }
      run('DELETE FROM sales WHERE id = ?', [s.id]);
    });
    res.json({ message: 'Venta eliminada y stock restaurado' });
  } else {
    res.status(403).json({ error: 'Solo administradores pueden eliminar ventas' });
  }
});

export default router;