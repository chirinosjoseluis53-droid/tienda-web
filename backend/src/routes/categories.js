import { Router } from 'express';
import { h, listColl, getDoc, createDoc, updateDoc, deleteDoc, whereEq } from '../fs.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  authRequired,
  h(async (_req, res) => {
    const rows = await listColl('categories');
    rows.sort((a, b) => a.name.localeCompare(b.name));
    res.json(rows);
  })
);

router.post(
  '/',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const dup = await whereEq('categories', 'name', name);
    if (dup.length) return res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
    const id = await createDoc('categories', { name });
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
    if (!existing) return res.status(404).json({ error: 'Categoria no encontrada' });
    const dup = await whereEq('categories', 'name', name);
    if (dup.some((d) => d.id !== req.params.id)) return res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
    await updateDoc('categories', req.params.id, { name });
    res.json(await getDoc('categories', req.params.id));
  })
);

router.delete(
  '/:id',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const products = await whereEq('products', 'category_id', Number(req.params.id));
    if (products.length) {
      return res.status(409).json({ error: 'No se puede borrar: tiene productos asignados' });
    }
    const existing = await getDoc('categories', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Categoria no encontrada' });
    await deleteDoc('categories', req.params.id);
    res.json({ message: 'Categoria eliminada' });
  })
);

export default router;