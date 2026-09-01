import { Router } from 'express';
import { get, run } from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', authRequired, (_req, res) => {
  res.json(get('SELECT store_name, currency, tax_rate, low_stock_alert, initial_fund, box_open_time, box_close_time FROM settings WHERE id = 1'));
});

router.put('/', authRequired, adminRequired, (req, res) => {
  const { store_name, currency, tax_rate, low_stock_alert, initial_fund, box_open_time, box_close_time } = req.body || {};
  const cur = get('SELECT * FROM settings WHERE id = 1');
  const rate = Number(tax_rate);
  const fund = Number(initial_fund);
  run(
    `UPDATE settings SET store_name = ?, currency = ?, tax_rate = ?, low_stock_alert = ?, initial_fund = ?, box_open_time = ?, box_close_time = ? WHERE id = 1`,
    [
      store_name !== undefined ? String(store_name).trim() || cur.store_name : cur.store_name,
      currency !== undefined ? String(currency).trim() || cur.currency : cur.currency,
      isNaN(rate) || rate < 0 ? cur.tax_rate : rate,
      low_stock_alert === undefined ? cur.low_stock_alert : low_stock_alert ? 1 : 0,
      isNaN(fund) || fund < 0 ? cur.initial_fund : fund,
      box_open_time !== undefined ? String(box_open_time) || cur.box_open_time : cur.box_open_time,
      box_close_time !== undefined ? String(box_close_time) || cur.box_close_time : cur.box_close_time,
    ]
  );
  res.json(get('SELECT store_name, currency, tax_rate, low_stock_alert, initial_fund, box_open_time, box_close_time FROM settings WHERE id = 1'));
});

export default router;