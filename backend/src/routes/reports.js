import { Router } from 'express';
import { h, listColl, listSub, getDoc, whereEq } from '../fs.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.use(authRequired, adminRequired);

const sid = (req) => String(req.user.store_id);

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n;\t]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) lines.push(r.map(csvEscape).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

function setCsv(res, filename) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
}

function parseDates(from, to) {
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  if (from && to && from > to) return null;
  return { from, to };
}

async function loadEmployees(req) {
  const users = await listColl('users');
  return users.filter((u) => String(u.store_id) === sid(req) && u.role === 'empleado');
}

async function assertEmployee(req, employeeId) {
  if (!employeeId) return null;
  const u = await getDoc('users', String(employeeId));
  if (!u || String(u.store_id) !== sid(req) || u.role !== 'empleado') return false;
  return u;
}

// Reporte de ventas por empleado
router.get(
  '/employee-sales.csv',
  h(async (req, res) => {
    const { from, to } = parseDates(req.query.from, req.query.to) || {};
    if (!parseDates(req.query.from, req.query.to)) {
      return res.status(400).json({ error: 'Rango de fechas invalido (formato YYYY-MM-DD)' });
    }
    const emp = await assertEmployee(req, req.query.employee_id);
    if (emp === false) return res.status(404).json({ error: 'Empleado no encontrado en tu tienda' });

    let sales = (await listColl('sales')).filter((s) => String(s.store_id) === sid(req));
    if (emp) sales = sales.filter((s) => String(s.user_id) === String(emp.id));
    if (from) sales = sales.filter((s) => s.created_at >= `${from} 00:00:00`);
    if (to) sales = sales.filter((s) => s.created_at <= `${to} 23:59:59`);
    sales.sort((a, b) => (a.created_at > b.created_at ? 1 : -1));

    const clients = Object.fromEntries((await listColl('clients')).map((c) => [String(c.id), c]));
    const employees = Object.fromEntries((await listColl('users')).map((u) => [String(u.id), u]));

    const headers = ['Fecha', 'Hora', 'Venta', 'Empleado', 'Cliente', 'Productos', 'Metodo de pago', 'Total'];
    const rows = [];
    let total = 0;
    for (const s of sales) {
      const items = await listSub('sales', s.id, 'items');
      const qty = items.reduce((a, i) => a + (Number(i.quantity) || 0), 0);
      total += Number(s.total) || 0;
      rows.push([
        s.created_at.slice(0, 10),
        s.created_at.slice(11, 19),
        String(s.id),
        employees[s.user_id]?.name || '?',
        s.client_id ? clients[s.client_id]?.name || '' : '',
        qty,
        s.payment_method || 'efectivo',
        (Number(s.total) || 0).toFixed(2),
      ]);
    }
    rows.push([]);
    rows.push(['TOTAL', '', '', '', '', sales.length, '', total.toFixed(2)]);

    setCsv(res, `ventas-${emp ? emp.name.replace(/\s+/g, '_') : 'todos'}${from || to ? `-${from || 'ini'}_${to || 'fin'}` : ''}`);
    res.send(buildCsv(headers, rows));
  })
);

// Reporte de cierres de caja por empleado y fecha
router.get(
  '/cash-closes.csv',
  h(async (req, res) => {
    const { from, to } = parseDates(req.query.from, req.query.to) || {};
    if (!parseDates(req.query.from, req.query.to)) {
      return res.status(400).json({ error: 'Rango de fechas invalido (formato YYYY-MM-DD)' });
    }
    const emp = await assertEmployee(req, req.query.employee_id);
    if (emp === false) return res.status(404).json({ error: 'Empleado no encontrado en tu tienda' });

    let closes = (await listColl('cash_closes')).filter((c) => String(c.store_id) === sid(req));
    if (emp) closes = closes.filter((c) => String(c.user_id) === String(emp.id));
    if (from) closes = closes.filter((c) => c.date >= from);
    if (to) closes = closes.filter((c) => c.date <= to);
    closes.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date > b.date ? 1 : -1));

    const employees = Object.fromEntries((await listColl('users')).map((u) => [String(u.id), u]));

    const headers = ['Fecha', 'Turno', 'Empleado', 'Efectivo sist.', 'Tarjeta sist.', 'Transf. sist.', 'Fondo sist.', 'Total sist.', 'Efectivo decl.', 'Tarjeta decl.', 'Transf. decl.', 'Fondo decl.', 'Total decl.', 'Diferencia', 'Explicacion'];
    const rows = [];
    let totalSys = 0;
    let totalDecl = 0;
    let totalDiff = 0;
    for (const c of closes) {
      totalSys += Number(c.system_total) || 0;
      totalDecl += Number(c.declared_total) || 0;
      totalDiff += Number(c.difference) || 0;
      rows.push([
        c.date,
        c.turn,
        employees[c.user_id]?.name || '?',
        (Number(c.system_cash) || 0).toFixed(2),
        (Number(c.system_card) || 0).toFixed(2),
        (Number(c.system_transfer) || 0).toFixed(2),
        (Number(c.system_initial_fund) || 0).toFixed(2),
        (Number(c.system_total) || 0).toFixed(2),
        (Number(c.declared_cash) || 0).toFixed(2),
        (Number(c.declared_card) || 0).toFixed(2),
        (Number(c.declared_transfer) || 0).toFixed(2),
        (Number(c.declared_initial_fund) || 0).toFixed(2),
        (Number(c.declared_total) || 0).toFixed(2),
        (Number(c.difference) || 0).toFixed(2),
        c.explanation || '',
      ]);
    }
    rows.push([]);
    rows.push(['TOTAL', '', closes.length, '', '', '', '', totalSys.toFixed(2), '', '', '', '', totalDecl.toFixed(2), totalDiff.toFixed(2), '']);

    setCsv(res, `cierres-${emp ? emp.name.replace(/\s+/g, '_') : 'todos'}${from || to ? `-${from || 'ini'}_${to || 'fin'}` : ''}`);
    res.send(buildCsv(headers, rows));
  })
);

export default router;