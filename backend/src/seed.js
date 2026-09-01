import bcrypt from 'bcryptjs';
import { db, run, transaction } from './db.js';

function clearAll() {
  db.exec(`
    DELETE FROM sale_items;
    DELETE FROM sales;
    DELETE FROM cash_closes;
    DELETE FROM clients;
    DELETE FROM products;
    DELETE FROM categories;
    DELETE FROM password_resets;
    DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `);
}

const cats = ['Lacteos', 'Bebidas', 'Snacks', 'Limpieza', 'Abarrotes', 'Cuidado personal'];

const products = [
  ['Leche Entera 1L', 'Leche descremada marca premium', '7501000611122', 18.5, 14.5, 40, 10, 1],
  ['Yogurt Fresa 250g', 'Yogurt de fresa', '7501000611139', 9, 6.5, 25, 8, 1],
  ['Queso Fresco 400g', '', '7501000611146', 32, 24, 15, 5, 1],
  ['Agua Mineral 600ml', '', '7501000611153', 7, 4.5, 80, 15, 2],
  ['Refresco Cola 2L', '', '7501000611160', 24, 17, 50, 12, 2],
  ['Jugo Naranja 1L', '', '7501000611177', 21, 15, 30, 10, 2],
  ['Cerveza 355ml', '', '7501000611184', 12, 8, 60, 20, 2],
  ['Papas Fritas 200g', '', '7501000611191', 11, 7.5, 45, 10, 3],
  ['Galletas Choc chip', '', '7501000611207', 8, 5, 35, 10, 3],
  ['Chocolate 90g', '', '7501000611214', 13, 9, 28, 8, 3],
  ['Palomitas 150g', '', '7501000611221', 9, 6, 20, 6, 3],
  ['Detergente 1kg', '', '7501000611238', 28, 20, 18, 5, 4],
  ['Cloro 1L', '', '7501000611245', 15, 10, 22, 6, 4],
  ['Jabon para trastes 500ml', '', '7501000611252', 19, 13, 16, 5, 4],
  ['Arroz 1kg', '', '7501000611269', 22, 16, 55, 10, 5],
  ['Frijol 1kg', '', '7501000611276', 26, 19, 48, 10, 5],
  ['Azucar 1kg', '', '7501000611283', 18, 13, 40, 10, 5],
  ['Aceite Vegetal 900ml', '', '7501000611290', 32, 24, 25, 8, 5],
  ['Shampoo 200ml', '', '7501000611306', 24, 17, 20, 6, 6],
  ['Pasta dental 100g', '', '7501000611313', 16, 11, 26, 8, 6],
  ['Cepillo de dientes', '', '7501000611320', 10, 6, 30, 8, 6],
];

const clients = [
  ['Maria Lopez', '001-17092005-1', '555-1020', 'maria@mail.com', 'Av. Central 12'],
  ['Juan Perez', '001-20031980-2', '555-3040', 'juan@mail.com', 'Calle Sur 45'],
  ['Ana Garcia', '002-15081995-3', '555-5060', '', 'Calle Norte 8'],
  ['Pedro Martinez', '001-01111970-4', '555-7080', '', 'Av. Industrial 120'],
  ['Luz Ramirez', '003-25071990-5', '555-9090', 'luz@mail.com', 'Calle Oriente 3'],
  ['Carlos Torres', '001-08121998-6', '555-1112', '', 'Av. Principal 90'],
];

async function seed() {
  clearAll();

  for (const name of cats) run('INSERT INTO categories (name) VALUES (?)', [name]);

  for (const p of products) {
    run(
      `INSERT INTO products (name, description, barcode, price, cost, stock, min_stock, category_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      p
    );
  }

  const adminHash = await bcrypt.hash('admin123', 10);
  const empHash = await bcrypt.hash('empleado123', 10);
  run(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Administrador', 'admin@tienda.com', ?, 'admin')",
    [adminHash]
  );
  run(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Empleado Demo', 'empleado@tienda.com', ?, 'empleado')",
    [empHash]
  );
  run(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Empleado 2', 'pedro@tienda.com', ?, 'empleado')",
    [empHash]
  );

  for (const c of clients) {
    run('INSERT INTO clients (name, cedula, phone, email, address) VALUES (?,?,?,?,?)', c);
  }

  const prods = db.prepare('SELECT id, price FROM products').all();
  const empUsers = db.prepare("SELECT id FROM users WHERE role = 'empleado'").all();
  const cli = db.prepare('SELECT id FROM clients').all();

  const now = Date.now();
  let saleCounter = 1;
  const dayTotals = new Map(); // dia -> { cash, card, transfer, total, count }

  for (let day = 13; day >= 0; day--) {
    const salesToday = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < salesToday; i++) {
      const date = new Date(now - day * 86400000 - (i * 60 + Math.floor(Math.random() * 50)) * 60000);
      const dateStr = date.toISOString().slice(0, 19).replace('T', ' ');
      const dayKey = date.toISOString().slice(0, 10);
      transaction(() => {
        const emp = empUsers[Math.floor(Math.random() * empUsers.length)];
        const client = Math.random() < 0.6 ? cli[Math.floor(Math.random() * cli.length)].id : null;
        const items = [];
        const nItems = 1 + Math.floor(Math.random() * 4);
        for (let k = 0; k < nItems; k++) {
          const p = prods[Math.floor(Math.random() * prods.length)];
          items.push({ product_id: p.id, quantity: 1 + Math.floor(Math.random() * 3), unit_price: p.price });
        }
        const total = +(items.reduce((s, it) => s + it.unit_price * it.quantity, 0)).toFixed(2);

        const r = Math.random();
        let method = 'efectivo';
        if (r > 0.6) method = 'tarjeta';
        if (r > 0.85) method = 'transferencia';
        const detail = {
          cash: method === 'efectivo' ? total : 0,
          card: method === 'tarjeta' ? total : 0,
          transfer: method === 'transferencia' ? total : 0,
        };
        run(
          `INSERT INTO sales (id, user_id, client_id, total, payment_method, payment_detail, created_at) VALUES (?,?,?,?,?,?,?)`,
          [saleCounter, emp.id, client, total, method, JSON.stringify(detail), dateStr]
        );
        for (const it of items) {
          run(
            `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?,?,?,?)`,
            [saleCounter, it.product_id, it.quantity, it.unit_price]
          );
        }
        saleCounter++;

        const acc = dayTotals.get(dayKey) || { cash: 0, card: 0, transfer: 0, total: 0, count: 0 };
        acc.cash += detail.cash;
        acc.card += detail.card;
        acc.transfer += detail.transfer;
        acc.total += total;
        acc.count += 1;
        dayTotals.set(dayKey, acc);
      });
    }
  }

  // Cierres de caja historicos (dias con ventas ya generadas, para el historial).
  // Se omite el dia de hoy para que la caja inicie abierta.
  const fund = Number(db.prepare('SELECT initial_fund FROM settings WHERE id = 1').get().initial_fund) || 100;
  const keys = [...dayTotals.keys()];
  const closeDays = [keyFor(keys, 1), keyFor(keys, 3), keyFor(keys, 5)].filter(Boolean);
  for (const dayKey of closeDays) {
    const totals = dayTotals.get(dayKey);
    const emp = empUsers[Math.floor(Math.random() * empUsers.length)];
    const sysTotal = +(totals.cash + totals.card + totals.transfer + fund).toFixed(2);
    run(
      `INSERT INTO cash_closes
         (user_id, turn, date, system_cash, system_card, system_transfer, system_initial_fund, system_total,
          declared_cash, declared_card, declared_transfer, declared_initial_fund, declared_total, difference, explanation)
       VALUES (?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?)`,
      [
        emp.id, 'Matutino (08:00 - 13:00)', dayKey,
        +totals.cash.toFixed(2), +totals.card.toFixed(2), +totals.transfer.toFixed(2), fund, sysTotal,
        +totals.cash.toFixed(2), +totals.card.toFixed(2), +totals.transfer.toFixed(2), fund, sysTotal,
        0, 'Cierre normal, caja cuadrada',
      ]
    );
  }

  console.log('Base de datos inicializada correctamente.');
  console.log('  Admin:    admin@tienda.com / admin123');
  console.log('  Empleado: empleado@tienda.com / empleado123');
}

// Devuelve el dayKey que corresponde a la i-esima fecha unica de ventas (0 = mas reciente con ventas)
function keyFor(keys, idx) {
  const sorted = [...keys].sort().reverse();
  return sorted[idx] ?? null;
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});