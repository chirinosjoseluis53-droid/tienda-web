import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { h, listColl, getDoc, whereEq, createDoc, updateDoc, run } from '../fs.js';
import { authRequired, superRequired } from '../middleware/auth.js';

const router = Router();

router.use(authRequired, superRequired);

function slugify(name) {
  const base = String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 30);
  return base || `tienda-${Date.now()}`;
}

router.get(
  '/overview',
  h(async (_req, res) => {
    const stores = await listColl('stores');
    const users = await listColl('users');
    const sales = await listColl('sales');
    const clients = await listColl('clients');
    res.json({
      total_stores: stores.length,
      active_stores: stores.filter((s) => !!s.active).length,
      total_users: users.length,
      total_sales: sales.length,
      total_sales_amount: +sales.reduce((a, s) => a + (+s.total || 0), 0).toFixed(2),
      total_clients: clients.length,
    });
  })
);

router.get(
  '/stores',
  h(async (_req, res) => {
    const stores = await listColl('stores');
    const users = await listColl('users');
    const sales = await listColl('sales');
    const products = await listColl('products');
    const rows = await Promise.all(
      stores.map(async (s) => {
        const storeUsers = users.filter((u) => String(u.store_id) === String(s.id));
        const admins = storeUsers.filter((u) => u.role === 'admin');
        const storeSales = sales.filter((x) => String(x.store_id) === String(s.id));
        const storeProducts = products.filter((p) => String(p.store_id) === String(s.id));
        return {
          id: String(s.id),
          name: s.name,
          slug: s.slug,
          active: !!s.active,
          created_at: s.created_at,
          admin: admins.map((a) => ({ id: String(a.id), name: a.name, email: a.email, active: !!a.active })),
          admin_count: admins.length,
          employee_count: storeUsers.filter((u) => u.role === 'empleado').length,
          product_count: storeProducts.length,
          sales_count: storeSales.length,
          sales_amount: +storeSales.reduce((a, x) => a + (+x.total || 0), 0).toFixed(2),
        };
      })
    );
    rows.sort((a, b) => a.name.localeCompare(b.name));
    res.json(rows);
  })
);

router.post(
  '/stores',
  h(async (req, res) => {
    const { name, admin_name, admin_email, admin_password } = req.body || {};
    if (!name || !admin_name || !admin_email || !admin_password) {
      return res.status(400).json({ error: 'Nombre de tienda, admin (nombre, correo) y contrasena son obligatorios' });
    }
    if (admin_password.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
    }
    const emailL = String(admin_email).toLowerCase().trim();
    const dup = await whereEq('users', 'email', emailL);
    if (dup.length) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });

    let slug = slugify(name);
    let suffix = 1;
    while ((await whereEq('stores', 'slug', slug)).length) {
      suffix += 1;
      slug = `${slugify(name)}-${suffix}`;
    }

    const storeId = await createDoc('stores', { name: String(name).trim(), slug, active: 1 });
    await run('INSERT INTO store_settings (store_id, store_name) VALUES (?, ?)', [storeId, String(name).trim()]);

    const hash = await bcrypt.hash(admin_password, 10);
    const userId = await createDoc('users', {
      name: String(admin_name).trim(),
      email: emailL,
      password_hash: hash,
      role: 'admin',
      active: 1,
      store_id: storeId,
    });

    const store = await getDoc('stores', storeId);
    res.status(201).json({
      store: { id: String(store.id), name: store.name, slug: store.slug, active: !!store.active },
      admin: { id: String(userId), name: admin_name.trim(), email: emailL },
      url: `/?store=${store.slug}`,
    });
  })
);

router.put(
  '/stores/:id',
  h(async (req, res) => {
    const store = await getDoc('stores', req.params.id);
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });

    const { active, admin_password, admin_name } = req.body || {};

    if (active !== undefined) {
      await updateDoc('stores', store.id, { active: active ? 1 : 0 });
      const storeUsers = await whereEq('users', 'store_id', String(store.id));
      for (const u of storeUsers) await updateDoc('users', u.id, { active: active ? 1 : 0 });
    }

    const admins = (await whereEq('users', 'store_id', String(store.id))).filter((u) => u.role === 'admin');
    const adminUser = admins[0];
    if (adminUser) {
      const updates = {};
      if (admin_password !== undefined) {
        if (admin_password.length < 6) return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
        updates.password_hash = await bcrypt.hash(admin_password, 10);
      }
      if (admin_name !== undefined) updates.name = String(admin_name).trim();
      if (active !== undefined) updates.active = active ? 1 : 0;
      if (Object.keys(updates).length) await updateDoc('users', adminUser.id, updates);
    }

    res.json({ message: 'Tienda actualizada' });
  })
);

router.delete(
  '/stores/:id',
  h(async (req, res) => {
    const store = await getDoc('stores', req.params.id);
    if (!store) return res.status(404).json({ error: 'Tienda no encontrada' });
    await updateDoc('stores', store.id, { active: 0 });
    const users = (await whereEq('users', 'store_id', String(store.id))) || [];
    for (const u of users) await updateDoc('users', u.id, { active: 0 });
    res.json({ message: 'Tienda bloqueada' });
  })
);

export default router;