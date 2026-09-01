import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { h, getDoc, whereEq, createDoc, setDoc, updateDoc, ts } from '../fs.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active };
}

router.post(
  '/register',
  h(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contrasena son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const emailL = String(email).toLowerCase().trim();
    const existing = await whereEq('users', 'email', emailL);
    if (existing.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

    const hash = await bcrypt.hash(password, 10);
    const id = await createDoc('users', { name: name.trim(), email: emailL, password_hash: hash, role: 'empleado', active: 1 });
    const user = await getDoc('users', id);
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/login',
  h(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Correo y contrasena requeridos' });

    const users = await whereEq('users', 'email', String(email).toLowerCase().trim());
    const user = users[0];
    if (!user) return res.status(401).json({ error: 'Correo o contrasena incorrectos' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Correo o contrasena incorrectos' });
    if (!user.active) return res.status(403).json({ error: 'Tu cuenta esta desactivada, contacta al administrador' });

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.post(
  '/forgot-password',
  h(async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Correo requerido' });

    const users = await whereEq('users', 'email', String(email).toLowerCase().trim());
    const user = users[0];
    const resetUrl = 'https://tienda.example/reset?token=';
    if (!user) {
      return res.status(404).json({ error: 'No existe una cuenta con ese correo' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await setDoc('password_resets', token, {
      user_id: user.id,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      used: 0,
      created_at: ts(),
    });

    res.json({
      message: 'Si el correo existe, recibira un enlace de recuperacion.',
      resetUrl: `${resetUrl}${token}`,
      devToken: token,
    });
  })
);

router.post(
  '/reset-password',
  h(async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: 'Token y contrasena requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });

    const reset = await getDoc('password_resets', String(token));
    if (!reset || reset.used) return res.status(400).json({ error: 'Enlace invalido o ya utilizado' });
    if (new Date(reset.expires_at) < new Date()) return res.status(400).json({ error: 'El enlace ha expirado' });

    const hash = await bcrypt.hash(password, 10);
    await updateDoc('users', reset.user_id, { password_hash: hash });
    await updateDoc('password_resets', token, { used: 1 });
    res.json({ message: 'Contrasena actualizada, ya puedes iniciar sesion.' });
  })
);

router.get(
  '/me',
  authRequired,
  h(async (req, res) => {
    const user = await getDoc('users', req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: publicUser(user) });
  })
);

router.put(
  '/password',
  authRequired,
  h(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Contrasena actual y nueva requeridas' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const user = await getDoc('users', req.user.id);
    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'La contrasena actual es incorrecta' });
    const hash = await bcrypt.hash(new_password, 10);
    await updateDoc('users', user.id, { password_hash: hash });
    res.json({ message: 'Contrasena actualizada' });
  })
);

export default router;