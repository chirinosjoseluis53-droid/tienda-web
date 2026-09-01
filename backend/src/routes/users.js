import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query, get, run } from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.use(authRequired, adminRequired);

router.get('/', (req, res) => {
  const users = query(`
    SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
           (SELECT COUNT(*) FROM sales s WHERE s.user_id = u.id) AS sales_count,
           (SELECT COALESCE(SUM(s.total),0) FROM sales s WHERE s.user_id = u.id) AS sales_total
    FROM users u ORDER BY u.id`);
  res.json(users);
});

router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  if (password.length < 6) return res.status(400).json({ error: 'Contrasena de al menos 6 caracteres' });
  const emailL = String(email).toLowerCase().trim();
  if (get('SELECT id FROM users WHERE email = ?', [emailL])) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });
  }
  const hash = await bcrypt.hash(password, 10);
  const r = run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', [
    name.trim(),
    emailL,
    hash,
    role === 'admin' ? 'admin' : 'empleado',
  ]);
  res.status(201).json(get('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?', [r.id]));
});

router.put('/:id', async (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const { name, role, active, password } = req.body || {};
  if (req.params.id === '1') {
    return res.status(400).json({ error: 'El administrador principal no puede modificarse' });
  }
  if (user.role === 'admin' && req.user.id === user.id) {
    return res.status(400).json({ error: 'No puedes cambiar tu propio rol o desactivarte' });
  }

  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Contrasena de al menos 6 caracteres' });
    const hash = await bcrypt.hash(password, 10);
    run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  }
  if (name !== undefined || role !== undefined || active !== undefined) {
    run('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?', [
      name !== undefined ? name.trim() : user.name,
      role === 'admin' ? 'admin' : 'empleado',
      active === 1 || active === true || active === undefined ? 1 : 0,
      user.id,
    ]);
  }
  res.json(get('SELECT id, name, email, role, active, created_at FROM users WHERE id = ?', [user.id]));
});

router.delete('/:id', (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (user.role === 'admin' && user.id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Un administrador no puede eliminar a otro administrador' });
  }
  run('DELETE FROM users WHERE id = ?', [user.id]);
  res.json({ message: 'Usuario eliminado' });
});

export default router;