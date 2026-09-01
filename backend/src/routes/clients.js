import { Router } from 'express';
import { h, listColl, listSub, getDoc, createDoc, updateDoc, deleteDoc, whereEq } from '../fs.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  authRequired,
  h(async (req, res) => {
    if (req.query.cedula) {
      const matches = await whereEq('clients', 'cedula', String(req.query.cedula).trim());
      return res.json(matches.map((c) => ({ ...c, total_purchases: 0, total_spent: 0 })));
    }
    const clients = await listColl('clients');
    const rows = [];
    for (const c of clients) {
      const sales = await listSub('clients', c.id, 'sales');
      const total_spent = sales.reduce((a, s) => a + (+s.total || 0), 0);
      rows.push({ ...c, total_purchases: sales.length, total_spent: +total_spent.toFixed(2) });
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const s = (req.query.search || '').toLowerCase();
    res.json(s ? rows.filter((r) => r.name.toLowerCase().includes(s) || r.phone.includes(s) || (r.cedula || '').includes(s)) : rows);
  })
);

router.get(
  '/:id',
  authRequired,
  h(async (req, res) => {
    const c = await getDoc('clients', req.params.id);
    if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json(c);
  })
);

router.post(
  '/',
  authRequired,
  h(async (req, res) => {
    const name = (req.body?.name || '').trim();
    const cedula = (req.body?.cedula || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (cedula) {
      const dup = await whereEq('clients', 'cedula', cedula);
      if (dup.length) return res.status(409).json({ error: 'Ya existe un cliente con esa cedula' });
    }
    const id = await createDoc('clients', {
      name,
      cedula,
      phone: (req.body.phone || '').trim(),
      email: (req.body.email || '').trim(),
      address: (req.body.address || '').trim(),
    });
    res.status(201).json(await getDoc('clients', id));
  })
);

router.put(
  '/:id',
  authRequired,
  h(async (req, res) => {
    const name = (req.body?.name || '').trim();
    const cedula = (req.body?.cedula || '').trim();
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const existing = await getDoc('clients', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (cedula) {
      const dup = await whereEq('clients', 'cedula', cedula);
      if (dup.some((d) => d.id !== req.params.id)) return res.status(409).json({ error: 'Ya existe un cliente con esa cedula' });
    }
    await updateDoc('clients', req.params.id, {
      name,
      cedula,
      phone: (req.body.phone || '').trim(),
      email: (req.body.email || '').trim(),
      address: (req.body.address || '').trim(),
    });
    res.json(await getDoc('clients', req.params.id));
  })
);

router.delete(
  '/:id',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const existing = await getDoc('clients', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
    await deleteDoc('clients', req.params.id);
    res.json({ message: 'Cliente eliminado' });
  })
);

export default router;