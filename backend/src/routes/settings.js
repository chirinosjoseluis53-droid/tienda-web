import { Router } from 'express';
import { h, getDoc, setDoc } from '../fs.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

const FIELDS = ['store_name', 'currency', 'tax_rate', 'low_stock_alert', 'initial_fund', 'box_open_time', 'box_close_time'];

const DEFAULTS = { store_name: 'Mi Minimarket', currency: '$', tax_rate: 0, low_stock_alert: 1, initial_fund: 100, box_open_time: '08:00', box_close_time: '18:00' };

router.get(
  '/',
  authRequired,
  h(async (req, res) => {
    const s = (await getDoc('store_settings', String(req.user.store_id))) || {};
    res.json({ ...DEFAULTS, ...s });
  })
);

router.put(
  '/',
  authRequired,
  adminRequired,
  h(async (req, res) => {
    const body = req.body || {};
    const cur = (await getDoc('store_settings', String(req.user.store_id))) || {};
    const rate = Number(body.tax_rate);
    const fund = Number(body.initial_fund);
    const next = {
      store_name: body.store_name !== undefined ? String(body.store_name).trim() || cur.store_name : cur.store_name,
      currency: body.currency !== undefined ? String(body.currency).trim() || cur.currency : cur.currency,
      tax_rate: isNaN(rate) || rate < 0 ? cur.tax_rate : rate,
      low_stock_alert: body.low_stock_alert === undefined ? cur.low_stock_alert : body.low_stock_alert ? 1 : 0,
      initial_fund: isNaN(fund) || fund < 0 ? cur.initial_fund : fund,
      box_open_time: body.box_open_time !== undefined ? String(body.box_open_time) || cur.box_open_time : cur.box_open_time,
      box_close_time: body.box_close_time !== undefined ? String(body.box_close_time) || cur.box_close_time : cur.box_close_time,
    };
    const merged = { ...DEFAULTS, ...cur, ...next };
    await setDoc('store_settings', String(req.user.store_id), merged);
    res.json(merged);
  })
);

export default router;