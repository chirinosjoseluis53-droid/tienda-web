import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import clientRoutes from './routes/clients.js';
import saleRoutes from './routes/sales.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';
import settingRoutes from './routes/settings.js';
import cashCloseRoutes from './routes/cash_closes.js';
import { get } from './db.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => res.json({ name: 'API Minimarket', status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/cash-closes', cashCloseRoutes);

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