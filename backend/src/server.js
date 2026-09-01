import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import clientRoutes from './routes/clients.js';
import saleRoutes from './routes/sales.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';
import settingRoutes from './routes/settings.js';
import cashCloseRoutes from './routes/cash_closes.js';
import superRoutes from './routes/super.js';
import reportRoutes from './routes/reports.js';
import { get } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', '..', 'frontend', 'dist');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/cash-closes', cashCloseRoutes);
app.use('/api/super', superRoutes);
app.use('/api/reports', reportRoutes);

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api).*/i, (_req, res) => {
    res.sendFile(join(DIST_DIR, 'index.html'));
  });
} else {
  app.use((_req, res) => res.status(404).json({ error: 'Frontend no construido' }));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function seedIfEmpty() {
  const users = get('SELECT COUNT(*) AS n FROM users');
  if (users && Number(users.n) === 0) {
    console.log('Base vacia, ejecutando seed inicial...');
    const { default: seed } = await import('./seed.js');
    await seed();
  }
}

seedIfEmpty()
  .catch((e) => {
    console.error('Error al inicializar la base de datos:', e);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`API del minimarket corriendo en http://localhost:${PORT}`);
    });
  });