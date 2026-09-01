import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { h, listColl, getDoc, createDoc, updateDoc, deleteDoc, whereEq } from '../fs.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();
const myStore = (req) => String(req.user.store_id);

const PUBLIC = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, created_at: u.created_at, store_id: u.store_id != null ? String(u.store_id) : null });

router.use(authRequired, adminRequired);

router.get(
  '/',
  h(async (req, res) => {
    const sid = myStore(req);
    const users = (await listColl('users')).filter((u) => String(u.store_id) === sid);
    const sales = (await listColl('sales')).filter((s) => String(s.store_id) === sid);
    const out = [];
    for (const u of users) {
      const us = sales.filter((s) => String(s.user_id) === String(u.id));
      out.push({ ...PUBLIC(u), sales_count: us.length, sales_total: +us.reduce((a, s) => a + (+s.total || 0), 0).toFixed(2) });
    }
    out.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    res.json(out);
  })
);

router.post(
  '/',
  h(async (req, res) => {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    if (password.length < 6) return res.status(400).json({ error: 'Contrasena de al menos 6 caracteres' });
    const emailL = String(email).toLowerCase().trim();
    const dup = await whereEq('users', 'email', emailL);
    if (dup.length) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
    const hash = await bcrypt.hash(password, 10);
    const id = await createDoc('users', {
      name: name.trim(),
      email: emailL,
      password_hash: hash,
      role: role === 'admin' ? 'admin' : 'empleado',
      active: 1,
      store_id: myStore(req),
    });
    res.status(201).json(PUBLIC(await getDoc('users', id)));
  })
);

router.put(
  '/:id',
  h(async (req, res) => {
    const user = await getDoc('users', req.params.id);
    if (!user || String(user.store_id) !== myStore(req)) return res.status(404).json({ error: 'Usuario no encontrado' });
    const { name, role, active, password } = req.body || {};
    if (String(user.id) === '1') {
      return res.status(400).json({ error: 'El administrador principal no puede modificarse' });
    }
    if (user.role === 'admin' && String(req.user.id) === String(user.id)) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol o desactivarte' });
    }
    const updates = {};
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Contrasena de al menos 6 caracteres' });
      updates.password_hash = await bcrypt.hash(password, 10);
    }
    if (name !== undefined || role !== undefined || active !== undefined) {
      updates.name = name !== undefined ? String(name).trim() : user.name;
      updates.role = role === 'admin' ? 'admin' : 'empleado';
      updates.active = active === undefined || active === 1 || active === true ? 1 : 0;
    }
    await updateDoc('users', user.id, updates);
    res.json(PUBLIC(await getDoc('users', user.id)));
  })
);

router.delete(
  '/:id',
  h(async (req, res) => {
    const user = await getDoc('users', req.params.id);
    if (!user || String(user.store_id) !== myStore(req)) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (String(user.id) === '1') {
      return res.status(400).json({ error: 'El administrador principal no puede eliminarse' });
    }
    if (user.role === 'superadmin') {
      return res.status(400).json({ error: 'No puedes eliminar al super administrador' });
    }
    if (user.role === 'admin' && String(req.user.id) === String(user.id)) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Un administrador no puede eliminar a otro administrador' });
    }
    await deleteDoc('users', user.id);
    res.json({ message: 'Usuario eliminado' });
  })
);

export default router;