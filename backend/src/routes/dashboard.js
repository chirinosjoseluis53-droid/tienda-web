import { Router } from 'express';
import { h, listColl, listSub, getDoc, categoryMap } from '../fs.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const myStore = (req) => String(req.user.store_id);

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayRange() {
  const now = new Date();
  const today = localDate(now);
  const from30 = new Date(now.getTime() - 30 * 86400000);
  const from13 = new Date(now.getTime() - 13 * 86400000);
  return {
    today,
    todayStart: `${today} 00:00:00`,
    todayEnd: `${today} 23:59:59`,
    from30Str: `${localDate(from30)} 00:00:00`,
    from13Str: `${localDate(from13)} 00:00:00`,
  };
}

router.get(
  '/',
  authRequired,
  h(async (req, res) => {
    const sid = myStore(req);
    const isAdmin = req.user.role === 'admin';
    const { today, todayStart, todayEnd, from30Str, from13Str } = todayRange();

    let sales = (await listColl('sales')).filter((s) => String(s.store_id) === sid);
    if (!isAdmin) sales = sales.filter((s) => String(s.user_id) === String(req.user.id));

    const totalSales = { count: sales.length, total: +sales.reduce((a, s) => a + (+s.total || 0), 0).toFixed(2) };
    const todayRows = sales.filter((s) => s.created_at >= todayStart && s.created_at < todayEnd);
    const todaySales = { count: todayRows.length, total: +todayRows.reduce((a, s) => a + (+s.total || 0), 0).toFixed(2) };

    const allProducts = (await listColl('products')).filter((p) => String(p.store_id) === sid);
    const lowStock = allProducts.filter((p) => +p.stock <= +p.min_stock).sort((a, b) => a.stock - b.stock).slice(0, 10);
    const inventory = +allProducts.reduce((a, p) => a + (+p.cost || 0) * (+p.stock || 0), 0).toFixed(2);
    const clientCount = (await listColl('clients')).filter((c) => String(c.store_id) === sid).length;

    const last13 = sales.filter((s) => s.created_at >= from13Str && s.created_at < todayEnd);
    const dailyMap = {};
    for (const s of last13) {
      const day = s.created_at.slice(0, 10);
      dailyMap[day] = (dailyMap[day] || 0) + (+s.total || 0);
    }
    const now = new Date();
    const labels = [];
    const series = [];
    for (let i = 13; i >= 0; i--) {
      const key = localDate(new Date(now.getTime() - i * 86400000));
      labels.push(key);
      series.push(dailyMap[key] || 0);
    }

    // Top productos (últimos 30 días)
    const last30 = sales.filter((s) => s.created_at >= from30Str && s.created_at < todayEnd);
    const products = Object.fromEntries(allProducts.map((p) => [String(p.id), p]));
    const qtyMap = {};
    for (const s of last30) {
      const items = await listSub('sales', s.id, 'items');
      for (const it of items) {
        const pid = String(it.product_id);
        const p = products[pid];
        const nm = p?.name || it.name || `P${pid}`;
        if (!qtyMap[nm]) qtyMap[nm] = { qty: 0, revenue: 0 };
        qtyMap[nm].qty += it.quantity || 0;
        qtyMap[nm].revenue += (it.quantity || 0) * (it.unit_price || 0);
      }
    }
    const topProducts = Object.entries(qtyMap)
      .map(([name, v]) => ({ name, qty: v.qty, revenue: +v.revenue.toFixed(2) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    let byCategory = [];
    if (isAdmin) {
      const cats = await categoryMap();
      const catTotals = {};
      for (const s of last30) {
        const items = await listSub('sales', s.id, 'items');
        for (const it of items) {
          const p = products[String(it.product_id)];
          const catId = p?.category_id;
          const key = catId != null ? cats[String(catId)]?.name || 'Sin categoria' : 'Sin categoria';
          catTotals[key] = (catTotals[key] || 0) + (it.quantity || 0) * (it.unit_price || 0);
        }
      }
      byCategory = Object.entries(catTotals)
        .map(([name, total]) => ({ name, total: +total.toFixed(2) }))
        .sort((a, b) => b.total - a.total);
    }

    res.json({ totalSales, todaySales, lowStock, inventory, clientCount, daily: { labels, series }, topProducts, byCategory, isAdmin });
  })
);

export default router;