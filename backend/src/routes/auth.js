import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { h, getDoc, whereEq, createDoc, setDoc, updateDoc, ts, listColl } from '../fs.js';
import { signToken, authRequired } from '../middleware/auth.js';

const router = Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, store_id: u.store_id != null ? String(u.store_id) : null };
}

async function withStore(u) {
  const user = publicUser(u);
  if (user.store_id) {
    const store = await getDoc('stores', user.store_id);
    user.store = store ? { id: String(store.id), name: store.name, slug: store.slug, active: store.active } : null;
  } else {
    user.store = null;
  }
  return user;
}

router.post(
  '/register',
  h(async (req, res) => {
    const { name, email, password, store } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contrasena son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
    }

    let storeId = null;
    if (store) {
      const found = await whereEq('stores', 'slug', String(store).trim().toLowerCase());
      if (!found.length) return res.status(404).json({ error: 'Tienda no encontrada. Usa el enlace de acceso que genero el super administrador.' });
      if (!found[0].active) return res.status(403).json({ error: 'La tienda esta desactivada, contacta al super administrador.' });
      storeId = found[0].id;
    } else {
      return res.status(400).json({ error: 'Registro publico deshabilitado. Usa el enlace de acceso de tu tienda.' });
    }

    const emailL = String(email).toLowerCase().trim();
    const existing = await whereEq('users', 'email', emailL);
    if (existing.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

    const hash = await bcrypt.hash(password, 10);
    const id = await createDoc('users', { name: name.trim(), email: emailL, password_hash: hash, role: 'empleado', active: 1, store_id: storeId });
    const user = await withStore(await getDoc('users', id));
    res.status(201).json({ token: signToken(user), user });
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
    if (!user.active) return res.status(403).json({ error: 'Tu cuenta esta desactivada, contacta al super administrador' });
    if (user.store_id) {
      const store = await getDoc('stores', user.store_id);
      if (!store || !store.active) return res.status(403).json({ error: 'Tu tienda esta desactivada, contacta al super administrador' });
    }

    const u = await withStore(user);
    res.json({ token: signToken(u), user: u });
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
    res.json({ user: await withStore(user) });
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

// Alias para el frontend (Profile.jsx usa PUT /api/profile)
router.put(
  '/',
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

// Info publica de una tienda por slug (para la pantalla de login/registro)
router.get(
  '/store/:slug',
  h(async (req, res) => {
    const found = await whereEq('stores', 'slug', String(req.params.slug).trim().toLowerCase());
    const store = found[0];
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    res.json({ id: String(store.id), name: store.name, slug: store.slug, active: !!store.active });
  })
);

export default router;