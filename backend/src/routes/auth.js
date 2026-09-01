import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { run, get } from '../db.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active };
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, correo y contrasena son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
  }
  const emailL = String(email).toLowerCase().trim();
  const existing = get('SELECT id FROM users WHERE email = ?', [emailL]);
  if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

  const hash = await bcrypt.hash(password, 10);
  const { id } = run('INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)', [
    name.trim(),
    emailL,
    hash,
    'empleado',
  ]);
  const user = get('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contrasena requeridos' });

  const user = get('SELECT * FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'Correo o contrasena incorrectos' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Correo o contrasena incorrectos' });
  if (!user.active) return res.status(403).json({ error: 'Tu cuenta esta desactivada, contacta al administrador' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Correo requerido' });

  const user = get('SELECT id FROM users WHERE email = ?', [String(email).toLowerCase().trim()]);
  // No revelar si el correo existe, pero devolvemos el link en desarrollo.
  const resetUrl = 'https://tienda.example/reset?token=';
  if (!user) {
    return res.status(404).json({ error: 'No existe una cuenta con ese correo' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  run('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?,?,?)', [user.id, token, expires]);

  res.json({
    message: 'Si el correo existe, recibira un enlace de recuperacion.',
    resetUrl: `${resetUrl}${token}`,
    devToken: token,
  });
});

router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token y contrasena requeridos' });
  if (password.length < 6) return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });

  const reset = get('SELECT * FROM password_resets WHERE token = ?', [token]);
  if (!reset || reset.used) return res.status(400).json({ error: 'Enlace invalido o ya utilizado' });
  if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'El enlace ha expirado' });

  const hash = await bcrypt.hash(password, 10);
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, reset.user_id]);
  run('UPDATE password_resets SET used = 1 WHERE id = ?', [reset.id]);
  res.json({ message: 'Contrasena actualizada, ya puedes iniciar sesion.' });
});

router.get('/me', authRequired, (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ user: publicUser(user) });
});

router.put('/password', authRequired, async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Contrasena actual y nueva requeridas' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
  }
  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const ok = await bcrypt.compare(current_password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'La contrasena actual es incorrecta' });
  const hash = await bcrypt.hash(new_password, 10);
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  res.json({ message: 'Contrasena actualizada' });
});

export default router;