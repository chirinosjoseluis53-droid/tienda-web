import { db, query, get, run } from './db.js';

export const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function normalize(coll, row) {
  if (!row) return null;
  return { ...row, id: String(row.id) };
}

// Colecciones cuyo identificador no es la columna 'id' autoincrement.
const KEY_BY_COLLECTION = {
  settings: 'id',
  password_resets: 'token',
  store_settings: 'store_id',
};

function normalizeKey(coll, id) {
  if (coll === 'settings' && (id === 'main' || id === '1')) return '1';
  return String(id);
}

function idColOf(coll) {
  return KEY_BY_COLLECTION[coll] || 'id';
}

function tableCols(coll, data) {
  const existing = db.prepare(`PRAGMA table_info(${coll})`).all().map((c) => c.name);
  return Object.keys(data).filter((k) => existing.includes(k));
}

const SUBQUERY = {
  'sales/items': (parentId) => ['sale_items', `sale_id = ?`, [String(parentId)]],
  'clients/sales': (parentId) => ['sales', `client_id = ? AND client_id IS NOT NULL`, [String(parentId)]],
};

function subTarget(coll, parentId, sub) {
  const key = `${coll}/${sub}`;
  if (SUBQUERY[key]) return SUBQUERY[key](parentId);
  throw new Error(`Subcoleccion no soportada: ${key}`);
}

export async function getDoc(coll, id) {
  const key = normalizeKey(coll, id);
  if (coll === 'password_resets') {
    return normalize(coll, get(`SELECT * FROM password_resets WHERE token = ?`, [key]));
  }
  if (coll === 'settings') {
    return normalize(coll, get(`SELECT * FROM settings WHERE id = 1`));
  }
  if (coll === 'store_settings') {
    return normalize(coll, get(`SELECT * FROM store_settings WHERE store_id = ?`, [key]));
  }
  return normalize(coll, get(`SELECT * FROM ${coll} WHERE id = ?`, [key]));
}

export async function listColl(coll) {
  return query(`SELECT * FROM ${coll}`).map((r) => normalize(coll, r));
}

export async function whereEq(coll, field, value) {
  return query(`SELECT * FROM ${coll} WHERE ${field} = ?`, [value]).map((r) => normalize(coll, r));
}

export async function createDoc(coll, data) {
  const cols = tableCols(coll, data);
  const r = run(
    `INSERT INTO ${coll} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    cols.map((c) => data[c])
  );
  return Number(r.id);
}

export async function setDoc(coll, id, data) {
  if (coll.includes('/')) {
    const parts = coll.split('/');
    const pColl = parts[0];
    const pId = parts[1];
    const sub = parts[2];
    const [table, where, params] = subTarget(pColl, pId, sub);
    let cols = tableCols(table, data);
    const existing = get(`SELECT * FROM ${table} WHERE ${where}`, params);
    if (existing) {
      if (cols.length) {
        const sets = cols.map((c) => `${c} = ?`).join(',');
        run(`UPDATE ${table} SET ${sets} WHERE ${where}`, [...cols.map((c) => data[c]), ...params]);
      }
    } else {
      const fkCol = where.split(' ')[0];
      const insertCols = cols.includes(fkCol) ? cols : [fkCol, ...cols];
      const values = cols.includes(fkCol)
        ? cols.map((c) => data[c])
        : [...params, ...cols.map((c) => data[c])];
      run(
        `INSERT INTO ${table} (${insertCols.join(',')}) VALUES (${insertCols.map(() => '?').join(',')})`,
        values
      );
    }
    return id;
  }

  const key = normalizeKey(coll, id);

  if (coll === 'password_resets') {
    const existing = get(`SELECT * FROM password_resets WHERE token = ?`, [key]);
    const cols = tableCols('password_resets', data);
    if (existing && cols.length) {
      const sets = cols.map((c) => `${c} = ?`).join(',');
      run(`UPDATE password_resets SET ${sets} WHERE token = ?`, [...cols.map((c) => data[c]), key]);
    } else if (!existing) {
      const insertCols = ['token', ...cols];
      run(
        `INSERT INTO password_resets (${insertCols.join(',')}) VALUES (${insertCols.map(() => '?').join(',')})`,
        [key, ...cols.map((c) => data[c])]
      );
    }
    return key;
  }

  if (coll === 'settings') {
    const existing = get(`SELECT * FROM settings WHERE id = 1`);
    const cols = tableCols('settings', data);
    if (existing && cols.length) {
      const sets = cols.map((c) => `${c} = ?`).join(',');
      run(`UPDATE settings SET ${sets} WHERE id = 1`, cols.map((c) => data[c]));
    }
    return '1';
  }

  const existing = get(`SELECT * FROM ${coll} WHERE ${idColOf(coll)} = ?`, [key]);
  const cols = tableCols(coll, data);
  if (existing) {
    if (cols.length) {
      const sets = cols.map((c) => `${c} = ?`).join(',');
      run(`UPDATE ${coll} SET ${sets} WHERE ${idColOf(coll)} = ?`, [...cols.map((c) => data[c]), key]);
    }
  } else {
    run(
      `INSERT INTO ${coll} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      cols.map((c) => data[c])
    );
  }
  return key;
}

export async function updateDoc(coll, id, updates) {
  const key = normalizeKey(coll, id);
  const cols = tableCols(coll, updates);
  if (cols.length === 0) return;

  if (coll === 'password_resets') {
    const sets = cols.map((c) => `${c} = ?`).join(',');
    run(`UPDATE password_resets SET ${sets} WHERE token = ?`, [...cols.map((c) => updates[c]), key]);
    return;
  }
  if (coll === 'settings') {
    const sets = cols.map((c) => `${c} = ?`).join(',');
    run(`UPDATE settings SET ${sets} WHERE id = 1`, cols.map((c) => updates[c]));
    return;
  }

  const idCol = idColOf(coll);
  const sets = cols.map((c) => `${c} = ?`).join(',');
  run(`UPDATE ${coll} SET ${sets} WHERE ${idCol} = ?`, [...cols.map((c) => updates[c]), String(key)]);
}

export async function deleteDoc(coll, id) {
  const key = normalizeKey(coll, id);
  if (coll === 'password_resets') {
    run(`DELETE FROM password_resets WHERE token = ?`, [key]);
    return;
  }
  run(`DELETE FROM ${coll} WHERE ${idColOf(coll)} = ?`, [String(key)]);
}

export async function listSub(coll, parentId, sub) {
  const [table, where, params] = subTarget(coll, parentId, sub);
  return query(`SELECT * FROM ${table} WHERE ${where}`, params).map((r) => normalize(table, r));
}

export async function userMap() {
  const users = await listColl('users');
  return Object.fromEntries(users.map((u) => [String(u.id), u]));
}

export async function categoryMap() {
  const cats = await listColl('categories');
  return Object.fromEntries(cats.map((c) => [String(c.id), c]));
}

export async function productMap() {
  const products = await listColl('products');
  return Object.fromEntries(products.map((p) => [String(p.id), p]));
}

export function h(fn) {
  return (req, res, _next) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error(e);
      if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
    });
  };
}

export { db, run };
