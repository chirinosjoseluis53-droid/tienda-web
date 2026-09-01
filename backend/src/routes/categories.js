import { Router } from 'express';
import { h, listColl, getDoc, createDoc, updateDoc, deleteDoc, whereEq } from '../fs.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();
const myStore = (req) => String(req.user.store_id);

router.get(
  '/',
  authRequired,
  h(async (_req, res) => {
    const rows = (await listColl('categories')).filter((c) => String(c.store_id) !== myStore(_req) || String(c.store_id) === myStore(_req));
    res.json(rows.filter((c) => String(c.store_id) === myStore(_req)).sort((a, b) => a.name.localeCompare(b.name)));
  })
);

router.post(
  '/',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const dup = (await whereEq('categories', 'name', name)).filter((c) => String(c.store_id) === myStore(req));
    if (dup.length) return res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
    const id = await createDoc('categories', { name, store_id: myStore(req) });
    res.status(201).json(await getDoc('categories', id));
  })
);

router.put(
  '/:id',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const existing = await getDoc('categories', req.params.id);
    if (!existing || String(existing.store_id) !== myStore(req)) return res.status(404).json({ error: 'Categoria no encontrada' });
    const dup = (await whereEq('categories', 'name', name)).filter((c) => String(c.store_id) === myStore(req) && String(c.id) !== String(req.params.id));
    if (dup.length) return res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
    await updateDoc('categories', req.params.id, { name });
    res.json(await getDoc('categories', req.params.id));
  })
);

router.delete(
  '/:id',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const existing = await getDoc('categories', req.params.id);
    if (!existing || String(existing.store_id) !== myStore(req)) return res.status(404).json({ error: 'Categoria no encontrada' });
    const products = (await whereEq('products', 'category_id', Number(req.params.id))).filter((p) => String(p.store_id) === myStore(req));
    if (products.length) {
      return res.status(409).json({ error: 'No se puede borrar: tiene productos asignados' });
    }
    await deleteDoc('categories', req.params.id);
    res.json({ message: 'Categoria eliminada' });
  })
);

export default router;