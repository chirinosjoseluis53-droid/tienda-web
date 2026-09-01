import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

const SELECT = `
  SELECT p.*, c.name AS category_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
`;

router.get('/', authRequired, (req, res) => {
  let rows = query(SELECT + ' ORDER BY p.name');
  const { search, category, low_stock } = req.query;
  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(s) || (r.barcode || '').includes(s) || (r.serial || '').includes(s)
    );
  }
  if (category) rows = rows.filter((r) => r.category_id === Number(category));
  if (low_stock === '1') rows = rows.filter((r) => r.stock <= r.min_stock);
  res.json(rows);
});

/**
 * GET /products/barcode/:code
 * Busca un producto por código de barras O por número de serie.
 * Devuelve el producto encontrado con un campo `match_type` ('barcode' | 'serial').
 */
router.get('/barcode/:code', authRequired, (req, res) => {
  const code = String(req.params.code).trim();

  // Primero buscar por código de barras (exacto)
  let p = get(SELECT + ' WHERE p.barcode = ?', [code]);
  if (p) return res.json({ ...p, match_type: 'barcode' });

  // Si no se encontró, buscar por número de serie
  p = get(SELECT + ' WHERE p.serial = ?', [code]);
  if (p) return res.json({ ...p, match_type: 'serial' });

  return res.status(404).json({ error: 'Producto no encontrado' });
});

router.get('/:id', authRequired, (req, res) => {
  const p = get(SELECT + ' WHERE p.id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(p);
});

function validate(body) {
  const name = (body.name || '').trim();
  const price = Number(body.price);
  const cost = Number(body.cost);
  const stock = Number(body.stock);
  const min_stock = Number(body.min_stock);
  if (!name) return { error: 'El nombre es obligatorio' };
  if (isNaN(price) || price < 0) return { error: 'Precio invalido' };
  if (isNaN(cost) || cost < 0) return { error: 'Costo invalido' };
  if (isNaN(stock) || stock < 0) return { error: 'Stock invalido' };
  return {
    data: {
      name,
      description: (body.description || '').trim(),
      barcode: (body.barcode || '').trim(),
      serial: (body.serial || '').trim(),
      expiration_date: (body.expiration_date || '').trim(),
      price,
      cost,
      stock,
      min_stock: isNaN(min_stock) || min_stock < 0 ? 5 : min_stock,
      category_id: body.category_id ? Number(body.category_id) : null,
      image: (body.image || '').trim(),
    },
  };
}

router.post('/', authRequired, adminRequired, (req, res) => {
  const v = validate(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const d = v.data;
  const { id } = run(
    `INSERT INTO products (name, description, barcode, serial, expiration_date, price, cost, stock, min_stock, category_id, image)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [d.name, d.description, d.barcode, d.serial, d.expiration_date, d.price, d.cost, d.stock, d.min_stock, d.category_id, d.image]
  );
  res.status(201).json(get(SELECT + ' WHERE p.id = ?', [id]));
});

router.put('/:id', authRequired, adminRequired, (req, res) => {
  const v = validate(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const d = v.data;
  const r = run(
    `UPDATE products SET name=?, description=?, barcode=?, serial=?, expiration_date=?, price=?, cost=?, stock=?, min_stock=?, category_id=?, image=?
     WHERE id=?`,
    [d.name, d.description, d.barcode, d.serial, d.expiration_date, d.price, d.cost, d.stock, d.min_stock, d.category_id, d.image, req.params.id]
  );
  if (!r.changes) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(get(SELECT + ' WHERE p.id = ?', [req.params.id]));
});

router.patch('/:id/stock', authRequired, adminRequired, (req, res) => {
  const qty = Number(req.body.quantity);
  if (isNaN(qty) || qty === 0) return res.status(400).json({ error: 'Cantidad invalida' });
  const p = get('SELECT stock FROM products WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  const newStock = Math.max(0, p.stock + qty);
  run('UPDATE products SET stock = ? WHERE id = ?', [newStock, req.params.id]);
  res.json({ stock: newStock });
});

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  const r = run('DELETE FROM products WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ message: 'Producto eliminado' });
});

export default router;