import { Router } from 'express';
import { h, listColl, getDoc, createDoc, updateDoc, deleteDoc, categoryMap } from '../fs.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

async function withCategory(products, cats) {
  return products.map((p) => ({ ...p, category_id: p.category_id != null ? Number(p.category_id) : null, category_name: p.category_id != null ? cats[String(p.category_id)]?.name || null : null }));
}

router.get(
  '/',
  authRequired,
  h(async (req, res) => {
    const cats = await categoryMap();
    let rows = await withCategory(await listColl('products'), cats);
    const { search, category, low_stock } = req.query;
    if (search) {
      const s = String(search).toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(s) || (r.barcode || '').includes(s) || (r.serial || '').includes(s));
    }
    if (category) rows = rows.filter((r) => r.category_id === Number(category));
    if (low_stock === '1') rows = rows.filter((r) => +r.stock <= +r.min_stock);
    rows.sort((a, b) => a.name.localeCompare(b.name));
    res.json(rows);
  })
);

router.get(
  '/barcode/:code',
  authRequired,
  h(async (req, res) => {
    const code = String(req.params.code).trim();
    let p = (await listColl('products')).find((x) => x.barcode === code);
    if (p) {
      const cats = await categoryMap();
      return res.json({ ...(await withCategory([p], cats))[0], match_type: 'barcode' });
    }
    p = (await listColl('products')).find((x) => x.serial === code);
    if (p) {
      const cats = await categoryMap();
      return res.json({ ...(await withCategory([p], cats))[0], match_type: 'serial' });
    }
    return res.status(404).json({ error: 'Producto no encontrado' });
  })
);

router.get(
  '/:id',
  authRequired,
  h(async (req, res) => {
    const p = await getDoc('products', req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    const cats = await categoryMap();
    res.json((await withCategory([p], cats))[0]);
  })
);

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

router.post(
  '/',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const v = validate(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const d = v.data;
    const id = await createDoc('products', d);
    const cats = await categoryMap();
    res.status(201).json((await withCategory([await getDoc('products', id)], cats))[0]);
  })
);

router.put(
  '/:id',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const v = validate(req.body);
    if (v.error) return res.status(400).json({ error: v.error });
    const d = v.data;
    const existing = await getDoc('products', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
    await updateDoc('products', req.params.id, d);
    const cats = await categoryMap();
    res.json((await withCategory([await getDoc('products', req.params.id)], cats))[0]);
  })
);

router.patch(
  '/:id/stock',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const qty = Number(req.body.quantity);
    if (isNaN(qty) || qty === 0) return res.status(400).json({ error: 'Cantidad invalida' });
    const p = await getDoc('products', req.params.id);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    const newStock = Math.max(0, +p.stock + qty);
    await updateDoc('products', req.params.id, { stock: newStock });
    res.json({ stock: newStock });
  })
);

router.delete(
  '/:id',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const existing = await getDoc('products', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
    await deleteDoc('products', req.params.id);
    res.json({ message: 'Producto eliminado' });
  })
);

export default router;