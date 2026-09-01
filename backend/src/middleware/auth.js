import jwt from 'jsonwebtoken';
import { getDoc } from '../fs.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'minimarket-secret-key';
export const TOKEN_TTL = '12h';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, store_id: user.store_id ? String(user.store_id) : null },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, role: payload.role, store_id: payload.store_id };
    next();
  } catch {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
}

export function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

export function superRequired(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acceso restringido al super administrador' });
  }
  next();
}

export async function getUserById(id) {
  return getDoc('users', id);
}