import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtMoney } from '../api.js';
import { useData, useSettings } from '../components/Shared.jsx';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../AuthContext.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import { usePhysicalScanner } from '../components/usePhysicalScanner.js';

// Tasa de cambio simulada
const TASA_BS = 36.00;

export default function POS() {
  const { user } = useAuth();
  const { data: products, loading, reload } = useData(() => api.get('/products'));
  const settings = useSettings();
  const cur = settings.currency;

  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  
  // Client state
  const [clientFound, setClientFound] = useState(null);
  const [cedulaInput, setCedulaInput] = useState('');
  const [clientState, setClientState] = useState('idle');
  const [showRegister, setShowRegister] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '', address: '' });
  
  const [error, setError] = useState('');
  const [lastSale, setLastSale] = useState(null);
  const [saving, setSaving] = useState(false);
  const [discount, setDiscount] = useState(0);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  // Focus tracking for keypad
  const [activeInput, setActiveInput] = useState('search');

  // Search filtering
  const filteredProducts = useMemo(() => {
    if (!search || !products) return [];
    const s = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(s) || p.barcode?.toLowerCase().includes(s) || p.serial?.toLowerCase().includes(s));
  }, [products, search]);

  function addToCart(product) {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const found = prev.find((c) => c.product_id === product.id);
      if (found) {
        if (found.quantity >= product.stock) return prev;
        return prev.map((c) => (c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, barcode: product.barcode, stock: product.stock, quantity: 1 }];
    });
    setSearch('');
  }

  // Handler for both camera scan and physical reader scan
  const handleBarcodeScan = useCallback(async (code) => {
    setScanMsg('');
    try {
      const product = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      if (product.stock <= 0) {
        setScanMsg(`⚠️ "${product.name}" sin stock`);
      } else {
        addToCart(product);
        setScanMsg(`✅ ${product.name} agregado`);
      }
    } catch {
      setScanMsg(`❌ Código "${code}" no registrado`);
    }
    setTimeout(() => setScanMsg(''), 3500);
  }, [products]); // eslint-disable-line react-hooks/exhaustive-deps

  // Physical scanner hook (USB/Bluetooth)
  usePhysicalScanner(handleBarcodeScan, true);

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && filteredProducts.length > 0) {
      e.preventDefault();
      const exact = filteredProducts.find(p => p.barcode === search || p.serial === search);
      addToCart(exact || filteredProducts[0]);
    }
  }

  function setQty(productId, qty) {
    const p = (products || []).find((x) => x.id === productId);
    const q = Math.max(1, Math.min(qty, p?.stock || qty));
    setCart((prev) => prev.map((c) => (c.product_id === productId ? { ...c, quantity: q } : c)));
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }

  function handleKeypad(val) {
    if (activeInput === 'search') {
      if (val === 'C') setSearch('');
      else setSearch(prev => prev + val);
    } else if (activeInput === 'client') {
      if (val === 'C') setCedulaInput('');
      else setCedulaInput(prev => prev + val);
    }
  }

  async function searchClient() {
    const ced = cedulaInput.trim();
    if (!ced) return;
    setError('');
    setClientState('searching');
    try {
      const res = await api.get(`/clients?cedula=${encodeURIComponent(ced)}`);
      if (res.length > 0) {
        setClientFound(res[0]);
        setClientState('found');
      } else {
        setClientFound(null);
        setClientState('notfound');
        setShowRegister(true); // Automatically open register modal if not found
      }
    } catch (e) {
      setClientFound(null);
      setClientState('notfound');
      setError(e.message);
    }
  }

  function clearClient() {
    setClientFound(null);
    setCedulaInput('');
    setClientState('idle');
  }

  async function registerClient(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const c = await api.post('/clients', { ...newClient, cedula: cedulaInput.trim() });
      setClientFound(c);
      setClientState('found');
      setShowRegister(false);
      setNewClient({ name: '', phone: '', email: '', address: '' });
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const discountAmount = subtotal * (discount / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = cart.length ? subtotalAfterDiscount * (settings.tax_rate / 100) : 0;
  const total = subtotalAfterDiscount + tax;

  function applyDiscount() {
    const val = window.prompt('Ingrese el porcentaje de descuento (0-100):', discount.toString());
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        setDiscount(num);
      }
    }
  }

  function changeClient() {
    clearClient();
    setActiveInput('client');
    document.querySelector('.pos-client-input')?.focus();
  }

  function pauseSale() {
    if (cart.length === 0) return;
    const paused = JSON.parse(localStorage.getItem('pausedSales') || '[]');
    paused.push({ date: new Date().toISOString(), cart, clientFound, discount });
    localStorage.setItem('pausedSales', JSON.stringify(paused));
    alert('Venta pausada exitosamente.');
    setCart([]);
    setDiscount(0);
    clearClient();
  }

  // Payment Modal State
  const [showPayment, setShowPayment] = useState(false);
  const [payments, setPayments] = useState({ usd: '', transfer: '', debit: '', bs: '' });
  const [lastPaymentBreakdown, setLastPaymentBreakdown] = useState(null);

  // Bloqueo por cierre de caja
  const [checkingClose, setCheckingClose] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [latestClose, setLatestClose] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const latest = await api.get('/cash-closes/latest');
        const today = new Date().toISOString().slice(0, 10);
        if (latest && latest.date === today) {
          setLatestClose(latest);
          setBlocked(true);
        }
      } catch {
        /* sin bloqueo si falla la consulta */
      } finally {
        setCheckingClose(false);
      }
    })();
  }, []);

  async function reopenBox() {
    if (!latestClose?.id) return;
    try {
      await api.del('/cash-closes/' + latestClose.id);
      setBlocked(false);
    } catch (e) {
      setError(e.message);
    }
  }

  const totalIngresado = 
    (Number(payments.usd) || 0) + 
    (Number(payments.transfer) || 0) + 
    (Number(payments.debit) || 0) + 
    ((Number(payments.bs) || 0) / TASA_BS);

  const restante = Math.max(0, total - totalIngresado);
  const vuelto = totalIngresado > total ? totalIngresado - total : 0;
  const isCovered = totalIngresado >= total - 0.001; // small tolerance for floating point

  function handlePaymentChange(field, val) {
    setPayments(prev => ({ ...prev, [field]: val }));
  }

  function openPayment() {
    if (cart.length === 0) return;
    setPayments({ usd: '', transfer: '', debit: '', bs: '' });
    setShowPayment(true);
  }

  async function sell() {
    if (cart.length === 0 || !isCovered) return;
    setError('');
    setSaving(true);
    try {
      const cash = +((Number(payments.usd) || 0) + (Number(payments.bs) || 0) / TASA_BS).toFixed(2);
      const card = +(Number(payments.debit) || 0).toFixed(2);
      const transfer = +(Number(payments.transfer) || 0).toFixed(2);
      const parts = [];
      if (cash > 0) parts.push('efectivo');
      if (card > 0) parts.push('tarjeta');
      if (transfer > 0) parts.push('transferencia');

      const res = await api.post('/sales', {
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity })),
        client_id: clientFound?.id || undefined,
        payment_method: parts.length === 1 ? parts[0] : 'mixto',
        payment_detail: { cash, card, transfer },
      });
      setLastPaymentBreakdown({
        usd: Number(payments.usd) || 0,
        transferRaw: Number(payments.transfer) || 0,
        debit: Number(payments.debit) || 0,
        bs: Number(payments.bs) || 0,
        cash,
        card,
        transfer,
        vuelto: vuelto,
      });
      setLastSale({ ...res.sale, clientName: clientFound?.name });
      setCart([]);
      setDiscount(0);
      setClientFound(null);
      setCedulaInput('');
      setShowPayment(false);
      reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (checkingClose) {
    return (
      <div className="page-center" style={{ background: '#f0fdf4', flex: 1 }}>
        <div className="spinner" />
        <p>Verificando estado de la caja...</p>
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="cashclose-wrapper" style={{ maxWidth: 520, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🔒</div>
        <h2>Caja cerrada</h2>
        <p style={{ color: '#475569' }}>
          El arqueo de caja de hoy ya fue registrado. No se pueden hacer ventas hasta reabrir la caja.
        </p>
        {latestClose && (
          <p style={{ color: '#64748b', fontSize: 13 }}>
            Cierre <strong>#{latestClose.id}</strong> registrado por{' '}
            <strong>{latestClose.user_name || 'un empleado'}</strong> — {latestClose.turn}
          </p>
        )}
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
          <a className="btn" href="/cash-close" onClick={(e) => { e.preventDefault(); window.location.href = '/cash-close'; }}>
            Ver detalles del cierre
          </a>
          {user.role === 'admin' && (
            <button className="btn btn-primary" onClick={reopenBox}>Reabrir caja</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pos-new-layout">
      
      {/* LEFT SIDE: Ticket & Search */}
      <div className="pos-left">
        <div className="pos-ticket-header">
          Ticket de Venta #{lastSale ? lastSale.id + 1 : 'N/A'}
        </div>

        {/* CLIENT SEARCH BAR */}
        <form className="pos-client-bar" onSubmit={(e) => { e.preventDefault(); searchClient(); }}>
          <div className="pos-client-search-wrap">
            <span className="pos-client-icon">🔍</span>
            <input 
              className="pos-client-input" 
              placeholder="Cédula / RIF del Cliente" 
              value={cedulaInput} 
              onChange={e => setCedulaInput(e.target.value)}
              onFocus={() => setActiveInput('client')}
            />
          </div>
          <button type="submit" className="pos-client-btn" disabled={clientState === 'searching'}>
            {clientState === 'searching' ? '...' : 'Buscar'}
          </button>
        </form>

        <div className="pos-client-status">
          {clientFound ? (
            <>
              <span>Asignado a: <span className="pos-client-status-name">{clientFound.name} ({clientFound.cedula})</span></span>
              <button type="button" className="pos-client-remove" onClick={clearClient}>Quitar</button>
            </>
          ) : (
            <span>Asignado a: <span className="pos-client-status-name">[Consumidor Final]</span></span>
          )}
        </div>
        
        <div className="pos-ticket-scroll">
          <table className="pos-ticket-table">
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>Precio Unit.</th>
                <th>Total</th>
                <th style={{ width: '100px' }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    Agrega productos a la venta buscando abajo...
                  </td>
                </tr>
              )}
              {cart.map((c) => (
                <tr key={c.product_id}>
                  <td>{c.barcode || c.product_id}</td>
                  <td>{c.name}</td>
                  <td>{c.quantity}</td>
                  <td>{fmtMoney(c.price, cur)}</td>
                  <td>{fmtMoney(c.price * c.quantity, cur)}</td>
                  <td>
                    <div className="pos-action-cell">
                      <button className="pos-btn-small minus" onClick={() => setQty(c.product_id, c.quantity - 1)}>-</button>
                      <button className="pos-btn-small plus" onClick={() => setQty(c.product_id, c.quantity + 1)}>+</button>
                      <button className="pos-btn-small delete" onClick={() => removeItem(c.product_id)}>x</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Search Results Dropdown (Floating) */}
        {search && filteredProducts.length > 0 && (
          <div style={{ background: '#fff', borderTop: '1px solid #e2e8f0', maxHeight: '150px', overflowY: 'auto' }}>
            {filteredProducts.map(p => (
              <div 
                key={p.id} 
                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}
                onClick={() => addToCart(p)}
              >
                <span>
                  <strong>{p.name}</strong>{' '}
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {p.barcode ? `BC: #${p.barcode}` : ''}
                    {p.barcode && p.serial ? ' | ' : ''}
                    {p.serial ? `SN: #${p.serial}` : ''}
                  </span>
                </span>
                <span>{fmtMoney(p.price, cur)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pos-search-bar" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            className="pos-search-input"
            placeholder="🔍 Buscar producto (Enter para agregar)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => setActiveInput('search')}
            autoFocus
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="scan-btn"
            onClick={() => setShowScanner(true)}
            title="Escanear código de barras"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 5h2M7 5h1M12 5h1M17 5h1M21 5h-2M3 12h18M3 19h2M7 19h1M12 19h1M17 19h1M21 19h-2"/>
            </svg>
            Escanear
          </button>
        </div>
        {scanMsg && (
          <div style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            color: scanMsg.startsWith('✅') ? '#16a34a' : scanMsg.startsWith('⚠️') ? '#d97706' : '#dc2626',
            background: scanMsg.startsWith('✅') ? '#f0fdf4' : scanMsg.startsWith('⚠️') ? '#fffbeb' : '#fef2f2',
            borderTop: '1px solid',
            borderColor: scanMsg.startsWith('✅') ? '#bbf7d0' : scanMsg.startsWith('⚠️') ? '#fde68a' : '#fecaca',
          }}>
            {scanMsg}
          </div>
        )}

        {/* Barcode Scanner Modal */}
        <BarcodeScanner
          open={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleBarcodeScan}
          title="Escanear producto — POS"
        />
      </div>

      {/* RIGHT SIDE: Summary & Actions */}
      <div className="pos-right">
        
        <div className="pos-summary">
          <div className="pos-summary-title">Resumen de Venta</div>
          <div className="pos-summary-row">
            <span>Subtotal:</span>
            <span>{fmtMoney(subtotal, cur)}</span>
          </div>
          {discount > 0 && (
            <div className="pos-summary-row" style={{ color: '#dc2626' }}>
              <span>Descuento ({discount}%):</span>
              <span>-{fmtMoney(discountAmount, cur)}</span>
            </div>
          )}
          <div className="pos-summary-row">
            <span>Impuestos (IVA):</span>
            <span>{fmtMoney(tax, cur)}</span>
          </div>
          
          <div className="pos-summary-total">
            **TOTAL A PAGAR: {fmtMoney(total, cur)}
          </div>
        </div>

        <div className="pos-controls">
          {/* Keypad */}
          <div className="pos-keypad">
            {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
              <button key={n} type="button" className="pos-key-btn" onClick={() => handleKeypad(n.toString())}>{n}</button>
            ))}
            <button type="button" className="pos-key-btn" onClick={() => handleKeypad('.')}>.</button>
            <button type="button" className="pos-key-btn" onClick={() => handleKeypad('0')}>0</button>
            <button type="button" className="pos-key-btn gray" onClick={() => handleKeypad('C')}>C</button>
          </div>

          {/* Action Buttons */}
          <div className="pos-actions">
            <button className="pos-action-button purple" onClick={applyDiscount}>
              <span>%</span>
              Aplicar Descuento
            </button>
            <button className="pos-action-button teal" onClick={changeClient}>
              <span>👤</span>
              Cambiar Cliente
            </button>
            <button className="pos-action-button blue" onClick={pauseSale}>
              <span>🕒</span>
              Pausar Venta
            </button>
            <button className="pos-action-button red" onClick={() => { setCart([]); setDiscount(0); clearClient(); }}>
              <span>❌</span>
              Cancelar Venta
            </button>
          </div>
        </div>

        {error && <div style={{ color: 'red', textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}

        <button 
          className="pos-pay-btn" 
          disabled={cart.length === 0 || saving} 
          onClick={openPayment}
        >
          COBRAR (Enter)
        </button>

      </div>

      {/* PAYMENT MODAL */}
      {showPayment && (
        <div className="pay-modal-overlay">
          <div className="pay-modal-content">
            
            <div className="pay-modal-header">
              <h2 className="pay-modal-title">Total a Pagar: {fmtMoney(total, cur)}</h2>
              <div className={`pay-modal-subtitle ${isCovered ? 'covered' : ''}`}>
                {isCovered ? 'Total cubierto ✅' : `Restante por cubrir: ${fmtMoney(restante, cur)}`}
              </div>
            </div>

            <div className="pay-modal-body">
              <div className="pay-modal-row">
                <div className="pay-modal-label"><span className="pay-modal-icon">💵</span> Efectivo (USD)</div>
                <div className="pay-modal-input-wrap">
                  <span>$ [</span>
                  <input type="number" step="0.01" className="pay-modal-input" value={payments.usd} onChange={e => handlePaymentChange('usd', e.target.value)} autoFocus />
                  <span>]</span>
                </div>
              </div>
              <div className="pay-modal-row">
                <div className="pay-modal-label"><span className="pay-modal-icon">📱</span> Pago Móvil / Transferencia</div>
                <div className="pay-modal-input-wrap">
                  <span>$ [</span>
                  <input type="number" step="0.01" className="pay-modal-input" value={payments.transfer} onChange={e => handlePaymentChange('transfer', e.target.value)} />
                  <span>]</span>
                </div>
              </div>
              <div className="pay-modal-row">
                <div className="pay-modal-label"><span className="pay-modal-icon">💳</span> Tarjeta de Débito</div>
                <div className="pay-modal-input-wrap">
                  <span>$ [</span>
                  <input type="number" step="0.01" className="pay-modal-input" value={payments.debit} onChange={e => handlePaymentChange('debit', e.target.value)} />
                  <span>]</span>
                </div>
              </div>
              <div className="pay-modal-row">
                <div className="pay-modal-label">
                  <span className="pay-modal-icon">🪙</span>
                  <div>
                    Efectivo (Moneda Local/Bs)
                    <span className="pay-modal-hint">Tasa de cambio: 1 USD = {TASA_BS.toFixed(2)} Bs</span>
                  </div>
                </div>
                <div className="pay-modal-input-wrap">
                  <span>Bs [</span>
                  <input type="number" step="0.01" className="pay-modal-input" value={payments.bs} onChange={e => handlePaymentChange('bs', e.target.value)} />
                  <span>]</span>
                </div>
              </div>
            </div>

            <div className="pay-modal-summary">
              <div className="pay-summary-line">
                <span>Total Ingresado</span>
                <span>{fmtMoney(totalIngresado, cur)}</span>
              </div>
              <div className="pay-summary-line vuelto" style={{ color: vuelto > 0 ? '#16a34a' : '#1e293b' }}>
                <span>Vuelto a entregar</span>
                <span>{fmtMoney(vuelto, cur)}</span>
              </div>
              <span className="pay-summary-note">El Vuelto se calcula automáticamente si el efectivo excede el restante.</span>
            </div>

            <div className="pay-modal-actions">
              <button className="pay-btn-cancel" onClick={() => setShowPayment(false)} disabled={saving}>
                ❌ Cancelar
              </button>
              <button className="pay-btn-confirm" onClick={sell} disabled={!isCovered || saving}>
                🖨️ Confirmar e Imprimir Ticket
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PROFESSIONAL INVOICE MODAL */}
      {lastSale && (() => {
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const invoiceNum = String(lastSale.id).padStart(6, '0');
        const subtotalVal = lastSale.total / (1 + (settings.tax_rate || 0) / 100);
        const taxVal = lastSale.total - subtotalVal;
        const pay = lastPaymentBreakdown || { usd: 0, transferRaw: 0, debit: 0, bs: 0, vuelto: 0 };

        return (
          <div className="invoice-overlay">
            <div className="invoice-modal">

              {/* Toolbar */}
              <div className="invoice-toolbar">
                <span className="invoice-toolbar-title">🧾 Vista previa de factura</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="invoice-btn-print" onClick={() => window.print()}>
                    🖨️ Imprimir
                  </button>
                  <button className="invoice-btn-new" onClick={() => setLastSale(null)}>
                    ➕ Nueva Venta
                  </button>
                </div>
              </div>

              {/* Scrollable paper area */}
              <div className="invoice-scroll">
                <div className="invoice-paper" id="invoice-print-area">

                  {/* Store Header */}
                  <div className="invoice-head">
                    <div className="invoice-store-name">🏪 {settings.store_name || 'Mi Minimarket'}</div>
                    <div className="invoice-store-tag">Sistema de Ventas Profesional</div>
                    <span className="invoice-type-badge">Factura de Venta</span>
                  </div>

                  {/* Meta data */}
                  <div className="invoice-meta">
                    <div className="invoice-meta-item">
                      <span className="invoice-meta-label">N° Factura</span>
                      <span className="invoice-meta-value">F-{invoiceNum}</span>
                    </div>
                    <div className="invoice-meta-item">
                      <span className="invoice-meta-label">Fecha</span>
                      <span className="invoice-meta-value">{dateStr}</span>
                    </div>
                    <div className="invoice-meta-item">
                      <span className="invoice-meta-label">Hora</span>
                      <span className="invoice-meta-value">{timeStr}</span>
                    </div>
                    <div className="invoice-meta-item">
                      <span className="invoice-meta-label">Cajero</span>
                      <span className="invoice-meta-value">{user?.name?.split(' ')[0]}</span>
                    </div>
                  </div>

                  {/* Client */}
                  <div className="invoice-client-strip">
                    👤 Cliente: <strong>{lastSale.clientName || 'Consumidor Final'}</strong>
                  </div>

                  {/* Items header */}
                  <div className="invoice-items-head">
                    <span>Descripción</span>
                    <span style={{ textAlign: 'right' }}>Cant.</span>
                    <span style={{ textAlign: 'right' }}>P.Unit</span>
                    <span style={{ textAlign: 'right' }}>Total</span>
                  </div>

                  {/* Items */}
                  {(lastSale.details || []).map((d) => (
                    <div key={d.product_id} className="invoice-item-row">
                      <div>
                        <div className="invoice-item-name">{d.name}</div>
                      </div>
                      <div className="invoice-item-qty">{d.quantity}</div>
                      <div className="invoice-item-price">{fmtMoney(d.unit_price, cur)}</div>
                      <div className="invoice-item-total">{fmtMoney(d.quantity * d.unit_price, cur)}</div>
                    </div>
                  ))}

                  {/* Totals */}
                  <div className="invoice-totals">
                    <div className="invoice-totals-row">
                      <span>Subtotal</span>
                      <span>{fmtMoney(subtotalVal, cur)}</span>
                    </div>
                    {settings.tax_rate > 0 && (
                      <div className="invoice-totals-row tax">
                        <span>IVA ({settings.tax_rate}%)</span>
                        <span>{fmtMoney(taxVal, cur)}</span>
                      </div>
                    )}
                    <div className="invoice-totals-row grand">
                      <span>TOTAL</span>
                      <span>{fmtMoney(lastSale.total, cur)}</span>
                    </div>
                  </div>

                  {/* Payment info */}
                  <div className="invoice-payment">
                    {pay.usd > 0 && (
                      <div className="invoice-payment-row">
                        <span>💵 Efectivo (USD)</span>
                        <span>{fmtMoney(Number(pay.usd), cur)}</span>
                      </div>
                    )}
                    {pay.transferRaw > 0 && (
                      <div className="invoice-payment-row">
                        <span>📱 Pago Móvil</span>
                        <span>{fmtMoney(Number(pay.transferRaw), cur)}</span>
                      </div>
                    )}
                    {pay.debit > 0 && (
                      <div className="invoice-payment-row">
                        <span>💳 Tarjeta</span>
                        <span>{fmtMoney(Number(pay.debit), cur)}</span>
                      </div>
                    )}
                    {pay.bs > 0 && (
                      <div className="invoice-payment-row">
                        <span>🪙 Bs ({TASA_BS} Bs/USD)</span>
                        <span>{fmtMoney(Number(pay.bs) / TASA_BS, cur)}</span>
                      </div>
                    )}
                    {pay.vuelto > 0 && (
                      <div className="invoice-payment-row change">
                        <span>Vuelto entregado</span>
                        <span>{fmtMoney(Number(pay.vuelto), cur)}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="invoice-footer">
                    <div className="invoice-barcode">||||| {invoiceNum} |||||</div>
                    <div className="invoice-footer-msg">Gracias por su compra</div>
                    <div className="invoice-footer-thanks">¡Vuelva pronto! 🛍️</div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* REGISTER CLIENT MODAL */}
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Registrar cliente no encontrado">
        <form onSubmit={registerClient} className="form form-grid">
          {error && <div className="alert alert-error">{error}</div>}
          <label className="field span-2">
            <span>Nombre completo</span>
            <input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Nombre completo" required />
          </label>
          <label className="field">
            <span>Cédula / DNI / RIF</span>
            <input value={cedulaInput} onChange={(e) => setCedulaInput(e.target.value)} placeholder="Cédula" required />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="Teléfono" />
          </label>
          <label className="field">
            <span>Correo (opcional)</span>
            <input type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
          </label>
          <label className="field">
            <span>Dirección (opcional)</span>
            <input value={newClient.address} onChange={(e) => setNewClient({ ...newClient, address: e.target.value })} />
          </label>
          <div className="modal-actions span-2">
            <button type="button" className="btn" onClick={() => setShowRegister(false)}>Cancelar</button>
            <button type="submit" className="unified-btn-green" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar cliente'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}