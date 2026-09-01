import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, (req, res) => {
  res.json(query('SELECT * FROM categories ORDER BY name'));
});

router.post('/', authRequired, adminRequired, (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const { id } = run('INSERT INTO categories (name) VALUES (?)', [name]);
    res.status(201).json(get('SELECT * FROM categories WHERE id = ?', [id]));
  } catch {
    res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
  }
});

router.put('/:id', authRequired, adminRequired, (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const r = run('UPDATE categories SET name = ? WHERE id = ?', [name, req.params.id]);
    if (!r.changes) return res.status(404).json({ error: 'Categoria no encontrada' });
    res.json(get('SELECT * FROM categories WHERE id = ?', [req.params.id]));
  } catch {
    res.status(409).json({ error: 'Ya existe una categoria con ese nombre' });
  }
});

router.delete('/:id', authRequired, adminRequired, (req, res) => {
  const count = get('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', [req.params.id]);
  if (count.n > 0) {
    return res.status(409).json({ error: 'No se puede borrar: tiene productos asignados' });
  }
  const r = run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: 'Categoria no encontrada' });
  res.json({ message: 'Categoria eliminada' });
});

export default router;