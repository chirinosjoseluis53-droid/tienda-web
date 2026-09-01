import { Router } from 'express';
import { query, get } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

router.get('/', authRequired, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const now = new Date();
  const today = localDate(now);

  const scope = isAdmin ? '' : 'WHERE user_id = ?';
  const scopeParams = isAdmin ? [] : [req.user.id];

  const totalSales = get(`SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM sales ${scope}`, scopeParams);

  const todaySales = get(
    `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM sales ${scope ? scope + ' AND' : 'WHERE'} created_at >= ? AND created_at < ?`,
    [...scopeParams, `${today} 00:00:00`, `${today} 23:59:59`]
  );

  const lowStock = query('SELECT * FROM products WHERE stock <= min_stock ORDER BY stock ASC LIMIT 10');
  const inventory = get('SELECT COALESCE(SUM(cost * stock),0) AS value FROM products');
  const clientCount = get('SELECT COUNT(*) AS n FROM clients').n;

  const from30 = new Date(now.getTime() - 30 * 86400000);
  const from30Str = `${localDate(from30)} 00:00:00`;
  const from13 = new Date(now.getTime() - 13 * 86400000);
  const from13Str = `${localDate(from13)} 00:00:00`;

  const dailyRows = query(
    `SELECT substr(created_at,1,10) AS day, COUNT(*) AS sales, COALESCE(SUM(total),0) AS total
     FROM sales ${scope ? scope + ' AND' : 'WHERE'} created_at >= ? AND created_at < ?
     GROUP BY substr(created_at,1,10)`,
    [...scopeParams, from13Str, `${today} 23:59:59`]
  );
  const dailyMap = Object.fromEntries(dailyRows.map((d) => [d.day, d.total]));
  const labels = [];
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const key = localDate(new Date(now.getTime() - i * 86400000));
    labels.push(key);
    series.push(dailyMap[key] || 0);
  }

  const topProducts = query(
    `SELECT p.name, SUM(si.quantity) AS qty, SUM(si.quantity * si.unit_price) AS revenue
     FROM sale_items si
     JOIN products p ON p.id = si.product_id
     JOIN sales s ON s.id = si.sale_id
     WHERE s.created_at >= ? AND s.created_at < ?
     GROUP BY p.id ORDER BY qty DESC LIMIT 5`,
    [from30Str, `${today} 23:59:59`]
  );

  let byCategory = [];
  if (isAdmin) {
    byCategory = query(
      `SELECT COALESCE(c.name,'Sin categoria') AS name, COALESCE(SUM(si.quantity * si.unit_price),0) AS total
       FROM sale_items si
       JOIN products p ON p.id = si.product_id
       JOIN sales s ON s.id = si.sale_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE s.created_at >= ? AND s.created_at < ?
       GROUP BY c.id ORDER BY total DESC`,
      [from30Str, `${today} 23:59:59`]
    );
  }

  res.json({
    totalSales,
    todaySales,
    lowStock,
    inventory,
    clientCount,
    daily: { labels, series },
    topProducts,
    byCategory,
    isAdmin,
  });
});

export default router;