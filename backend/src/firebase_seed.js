import bcrypt from 'bcryptjs';
import { firestore, ts, autoId } from './firebase.js';

const COL = {
  settings: 'settings',
  categories: 'categories',
  users: 'users',
  clients: 'clients',
  products: 'products',
  sales: 'sales',
  cashCloses: 'cash_closes',
};

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

function flushBatch(all) {
  if (all.batchOps >= 450) {
    all.batchOps = 0;
    return all.batch.commit().then(() => {
      all.batch = firestore.batch();
    });
  }
  return Promise.resolve();
}

async function run() {
  console.log('⏳ Creando la base de datos en Firebase (Firestore)...');
  const container = { batch: firestore.batch(), batchOps: 0 };
  const write = (ref, data) => {
    container.batch.set(ref, data);
    container.batchOps += 1;
    return flushBatch(container);
  };

  // Settings (doc fijo)
  await write(firestore.doc(`${COL.settings}/main`), {
    store_name: 'Mi Minimarket',
    currency: '$',
    tax_rate: 0,
    low_stock_alert: 1,
    initial_fund: 100,
    box_open_time: '08:00',
    box_close_time: '18:00',
  });

  // Categorias
  for (let i = 0; i < cats.length; i++) {
    await write(firestore.doc(`${COL.categories}/${i + 1}`), { name: cats[i], created_at: ts() });
  }

  // Productos
  for (let i = 0; i < products.length; i++) {
    const [name, description, barcode, price, cost, stock, min_stock, category_id] = products[i];
    await write(firestore.doc(`${COL.products}/${i + 1}`), {
      name, description, barcode,
      price, cost, stock, min_stock, category_id,
      image: '', serial: '', expiration_date: '',
      created_at: ts(),
    });
  }

  // Clientes
  for (let i = 0; i < clients.length; i++) {
    const [name, cedula, phone, email, address] = clients[i];
    await write(firestore.doc(`${COL.clients}/${i + 1}`), { name, cedula, phone, email, address, created_at: ts() });
  }

  // Usuarios (mismas claves que el seed local)
  const adminHash = await bcrypt.hash('admin123', 10);
  const empHash = await bcrypt.hash('empleado123', 10);
  await write(firestore.doc(`${COL.users}/1`), {
    name: 'Administrador', email: 'admin@tienda.com', password_hash: adminHash, role: 'admin', active: 1, created_at: ts(),
  });
  await write(firestore.doc(`${COL.users}/2`), {
    name: 'Empleado Demo', email: 'empleado@tienda.com', password_hash: empHash, role: 'empleado', active: 1, created_at: ts(),
  });
  await write(firestore.doc(`${COL.users}/3`), {
    name: 'Empleado 2', email: 'pedro@tienda.com', password_hash: empHash, role: 'empleado', active: 1, created_at: ts(),
  });

  // Ventas de los últimos 7 días (para que el dashboard no esté vacío)
  const empIds = ['2', '3'];
  const prodIds = products.map((_, i) => String(i + 1));
  const cliIds = clients.map((_, i) => String(i + 1));
  const now = Date.now();
  let saleId = 1;
  for (let day = 6; day >= 0; day--) {
    const salesToday = 3 + Math.floor(Math.random() * 3); // 3 a 5
    for (let i = 0; i < salesToday; i++) {
      const date = new Date(now - day * 86400000 - (i * 60 + Math.floor(Math.random() * 50)) * 60000);
      const dateStr = date.toISOString();
      const emp = empIds[Math.floor(Math.random() * empIds.length)];
      const client = Math.random() < 0.6 ? cliIds[Math.floor(Math.random() * cliIds.length)] : null;
      const nItems = 1 + Math.floor(Math.random() * 4);
      const items = [];
      let total = 0;
      for (let k = 0; k < nItems; k++) {
        const pid = prodIds[Math.floor(Math.random() * prodIds.length)];
        const p = products[Number(pid) - 1];
        const qty = 1 + Math.floor(Math.random() * 3);
        items.push({ product_id: pid, quantity: qty, unit_price: p[3] });
        total += p[3] * qty;
      }
      total = +total.toFixed(2);
      const r = Math.random();
      let method = 'efectivo';
      if (r > 0.6) method = 'tarjeta';
      if (r > 0.85) method = 'transferencia';
      const detail = {
        cash: method === 'efectivo' ? total : 0,
        card: method === 'tarjeta' ? total : 0,
        transfer: method === 'transferencia' ? total : 0,
      };
      const saleRef = firestore.doc(`${COL.sales}/${saleId}`);
      await write(saleRef, {
        user_id: emp,
        client_id: client,
        total,
        payment_method: method,
        payment_detail: JSON.stringify(detail),
        created_at: dateStr,
      });
      if (client) {
        await write(firestore.doc(`${COL.clients}/${client}/sales/${saleId}`), { sale_id: saleId, total, created_at: dateStr });
      }
      for (let it = 0; it < items.length; it++) {
        await write(saleRef.collection('items').doc(`${it + 1}`), items[it]);
      }
      saleId += 1;
    }
  }

  // Cierres de caja historicos
  const fund = 100;
  for (let i = 1; i <= 3; i++) {
    const day = dateOnly(now - (i * 2) * 86400000);
    const totals = { cash: 80 + i * 10, card: 40 + i * 5, transfer: 20 + i * 3 };
    const sysTotal = +(totals.cash + totals.card + totals.transfer + fund).toFixed(2);
    await write(firestore.doc(`${COL.cashCloses}/${i}`), {
      user_id: empIds[Math.floor(Math.random() * empIds.length)],
      turn: 'Matutino (08:00 - 13:00)',
      date: day,
      system_cash: totals.cash, system_card: totals.card, system_transfer: totals.transfer,
      system_initial_fund: fund, system_total: sysTotal,
      declared_cash: totals.cash, declared_card: totals.card, declared_transfer: totals.transfer,
      declared_initial_fund: fund, declared_total: sysTotal,
      difference: 0,
      explanation: 'Cierre normal, caja cuadrada',
      created_at: ts(),
    });
  }

  await container.batch.commit();
  console.log('✅ Base de datos creada en Firestore.');
  console.log('   Colecciones: categories, users, clients, products, sales, cash_closes, settings');
  console.log('   Usuarios:    admin@tienda.com / admin123 | empleado@tienda.com / empleado123');
}

function dateOnly(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

run().catch((e) => {
  console.error('✗ Error creando la base de datos:', e.message);
  process.exit(1);
});