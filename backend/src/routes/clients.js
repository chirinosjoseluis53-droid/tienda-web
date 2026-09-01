import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, (req, res) => {
  if (req.query.cedula) {
    const c = get('SELECT * FROM clients WHERE cedula = ?', [String(req.query.cedula).trim()]);
    return res.json(c ? [c] : []);
  }
  const rows = query(`
    SELECT c.*,
           (SELECT COUNT(*) FROM sales s WHERE s.client_id = c.id) AS purchases,
           (SELECT COALESCE(SUM(s.total),0) FROM sales s WHERE s.client_id = c.id) AS total_spent
    FROM clients c ORDER BY c.name`);
  const s = (req.query.search || '').toLowerCase();
  res.json(s ? rows.filter((r) => r.name.toLowerCase().includes(s) || r.phone.includes(s) || r.cedula.includes(s)) : rows);
});

router.get('/:id', authRequired, (req, res) => {
  const c = get('SELECT * FROM clients WHERE id = ?', [req.params.id]);
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(c);
});

router.post('/', authRequired, (req, res) => {
  const name = (req.body?.name || '').trim();
  const cedula = (req.body?.cedula || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (cedula && get('SELECT id FROM clients WHERE cedula = ?', [cedula])) {
    return res.status(409).json({ error: 'Ya existe un cliente con esa cedula' });
  }
  const { id } = run(
    'INSERT INTO clients (name, cedula, phone, email, address) VALUES (?,?,?,?,?)',
    [name, cedula, (req.body.phone || '').trim(), (req.body.email || '').trim(), (req.body.address || '').trim()]
  );
  res.status(201).json(get('SELECT * FROM clients WHERE id = ?', [id]));
});

router.put('/:id', authRequired, (req, res) => {
  const name = (req.body?.name || '').trim();
  const cedula = (req.body?.cedula || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (cedula) {
    const dupe = get('SELECT id FROM clients WHERE cedula = ? AND id != ?', [cedula, req.params.id]);
    if (dupe) return res.status(409).json({ error: 'Ya existe un cliente con esa cedula' });
  }
  const r = run(
    'UPDATE clients SET name=?, cedula=?, phone=?, email=?, address=? WHERE id=?',
    [name, cedula, (req.body.phone || '').trim(), (req.body.email || '').trim(), (req.body.address || '').trim(), req.params.id]
  );
  if (!r.changes) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(get('SELECT * FROM clients WHERE id = ?', [req.params.id]));
});

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  const r = run('DELETE FROM clients WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json({ message: 'Cliente eliminado' });
});

export default router;