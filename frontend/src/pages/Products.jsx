import { useEffect, useMemo, useState } from 'react';
import { api, fmtMoney } from '../api.js';
import { ConfirmDialog, ProductImg, fileToDataUrl, useSettings } from '../components/Shared.jsx';
import { useAuth } from '../AuthContext.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';

const EMPTY = { name: '', description: '', barcode: '', serial: '', expiration_date: '', price: '', cost: '', stock: '', min_stock: 5, category_id: '', image: '' };

// Icono de escáner inline reutilizable
function ScanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M3 5h2M7 5h1M12 5h1M17 5h1M21 5h-2M3 12h18M3 19h2M7 19h1M12 19h1M17 19h1M21 19h-2"/>
    </svg>
  );
}

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const settings = useSettings();
  const cur = settings.currency;

  const [rows, setRows] = useState(null);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Scanner
  const [showScanner, setShowScanner] = useState(false); // 'search' | 'barcode' | 'serial' | 'smart' | false
  const [scanLookupMsg, setScanLookupMsg] = useState(''); // feedback de detección de producto
  const [activeTab, setActiveTab] = useState('basic'); // 'basic' | 'codes' | 'pricing'

  async function load() {
    setError('');
    try {
      const data = await api.get('/products');
      setRows(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    api.get('/categories').then(setCats).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    let list = rows;
    if (category) list = list.filter((p) => p.category_name === category);
    if (lowStock) list = list.filter((p) => p.stock <= p.min_stock);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.includes(s)) || (p.serial && p.serial.includes(s))
      );
    }
    return list;
  }, [rows, search, category, lowStock]);

  function openAdd() { setForm(EMPTY); setEditing('new'); setError(''); setScanLookupMsg(''); setActiveTab('basic'); }
  function openEdit(p) { setForm({ ...p, serial: p.serial || '', expiration_date: p.expiration_date || '' }); setEditing(p.id); setError(''); setScanLookupMsg(''); setActiveTab('basic'); }
  function openAdjust(p) { setAdjusting({ id: p.id, name: p.name, current: p.stock, add: 0 }); setError(''); }

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const b64 = await fileToDataUrl(f);
      setForm((prev) => ({ ...prev, image: b64 }));
    } catch {
      setError('Error al procesar la imagen.');
    }
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editing === 'new') await api.post('/products', form);
      else await api.put(`/products/${editing}`, form);
      setEditing(null);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjust(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.patch(`/products/${adjusting.id}/stock`, { quantity: adjusting.add });
      setAdjusting(null);
      load();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  }

  // ── SCAN HANDLERS ────────────────────────────────────────────────────────────

  /** Scan para buscar en la tabla */
  function handleScanForSearch(code) {
    setSearch(code);
  }

  /** Scan para campo código de barras del formulario */
  function handleScanForBarcode(code) {
    setForm((prev) => ({ ...prev, barcode: code }));
  }

  /** Scan para campo serial del formulario */
  function handleScanForSerial(code) {
    setForm((prev) => ({ ...prev, serial: code }));
  }

  /**
   * Scan "inteligente" al inicio del formulario:
   * – Busca el producto por barcode/serial en la BD.
   * – Si lo encuentra → pre-llena el formulario para editar.
   * – Si no → rellena solo el campo barcode con el código escaneado.
   */
  async function handleSmartScan(code) {
    setScanLookupMsg('⏳ Buscando producto...');
    try {
      const product = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
      setScanLookupMsg(
        `✅ Producto detectado: "${product.name}" (${product.match_type === 'serial' ? 'por número de serie' : 'por código de barras'})`
      );
      // Pre-llenar el formulario con el producto encontrado
      setForm({ ...product, serial: product.serial || '', expiration_date: product.expiration_date || '' });
      setEditing(product.id); // cambiar a modo edición
    } catch {
      // No encontrado → solo rellenar el campo barcode
      setScanLookupMsg(`ℹ️ Código "${code}" no registrado. Rellena los datos para crear el producto.`);
      setForm((prev) => ({ ...prev, barcode: code }));
    }
    setTimeout(() => setScanLookupMsg(''), 5000);
  }

  // ── RENDER ───────────────────────────────────────────────────────────────────

  return (
    <div className="unified-view">
      <div className="unified-header">
        <h2 className="unified-title">Gestión de Productos</h2>
        <div className="unified-filters">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              placeholder="Buscar por nombre, código o serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="scan-btn" onClick={() => setShowScanner('search')} title="Escanear para buscar">
              <ScanIcon /> Buscar
            </button>
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {cats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
            Stock bajo
          </label>
        </div>
        {isAdmin && (
          <button className="unified-btn-green" onClick={openAdd}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg>
            Nuevo Producto
          </button>
        )}
      </div>

      <div className="unified-body">
        {error && !editing && !adjusting && <div className="alert alert-error">{error}</div>}

        {!rows ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No se encontraron productos.</div>
        ) : (
          <table className="unified-table">
            <thead>
              <tr>
                <th>Barcode / Serial</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Vencimiento</th>
                <th>Costo</th>
                <th>Precio Venta</th>
                <th>Stock</th>
                <th>Estado</th>
                {isAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td style={{ color: '#64748b', fontSize: '12px' }}>
                    {p.barcode && <div><span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>BC</span> {p.barcode}</div>}
                    {p.serial && <div><span style={{ color: '#94a3b8', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>SN</span> {p.serial}</div>}
                    {!p.barcode && !p.serial && <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td>{p.category_name || 'Sin categoría'}</td>
                  <td>
                    {p.expiration_date ? (
                      <span style={{ 
                        color: new Date(p.expiration_date) < new Date() ? '#dc2626' : '#64748b',
                        fontWeight: new Date(p.expiration_date) < new Date() ? 'bold' : 'normal',
                        fontSize: '13px'
                      }}>
                        {new Date(p.expiration_date).toLocaleDateString()}
                      </span>
                    ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td>{fmtMoney(p.cost, cur)}</td>
                  <td>{fmtMoney(p.price, cur)}</td>
                  <td>
                    <span style={{ fontWeight: 'bold', color: p.stock <= p.min_stock ? '#dc2626' : '#1e293b' }}>
                      {p.stock}
                    </span>
                  </td>
                  <td>
                    {p.stock <= 0 ? (
                      <span className="unified-badge red">Sin Stock</span>
                    ) : p.stock <= p.min_stock ? (
                      <span className="unified-badge gray" style={{ background: '#f59e0b' }}>Bajo</span>
                    ) : (
                      <span className="unified-badge green">Activo</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="unified-btn-gray" style={{ background: '#3b82f6' }} onClick={() => openAdjust(p)}>Ajustar</button>
                        <button className="unified-btn-gray" onClick={() => openEdit(p)}>Editar</button>
                        <button className="unified-btn-gray" style={{ background: '#dc2626' }} onClick={() => setDeleting(p.id)}>Eliminar</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL NUEVO / EDITAR PRODUCTO ─────────────────────────────────── */}
      {editing && (
        <div className="pmodal-overlay" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="pmodal">

            {/* Header del modal */}
            <div className="pmodal-header">
              <div className="pmodal-header-left">
                <div className="pmodal-header-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <path d="M8 21h8M12 17v4"/>
                  </svg>
                </div>
                <div>
                  <h3 className="pmodal-title">
                    {editing === 'new' ? 'Nuevo Producto' : 'Editar Producto'}
                  </h3>
                  <p className="pmodal-subtitle">
                    {editing === 'new' ? 'Agrega un producto al inventario' : `Editando producto #${editing}`}
                  </p>
                </div>
              </div>
              <button className="pmodal-close" onClick={() => setEditing(null)} aria-label="Cerrar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Banner de escaneo inteligente */}
            <div className="pmodal-scan-banner">
              <div className="pmodal-scan-banner-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 5h2M7 5h1M12 5h1M17 5h1M21 5h-2M3 12h18M3 19h2M7 19h1M12 19h1M17 19h1M21 19h-2"/>
                </svg>
                <span>Escanea el código del producto para buscarlo o pre-llenar el formulario</span>
              </div>
              <button
                type="button"
                className="pmodal-scan-cta"
                onClick={() => setShowScanner('smart')}
              >
                <ScanIcon /> Escanear Producto
              </button>
            </div>

            {/* Mensaje de resultado de escaneo inteligente */}
            {scanLookupMsg && (
              <div className={`pmodal-scan-result ${
                scanLookupMsg.startsWith('✅') ? 'success' : scanLookupMsg.startsWith('ℹ️') ? 'info' : 'loading'
              }`}>
                {scanLookupMsg}
              </div>
            )}

            {/* Tabs de navegación */}
            <div className="pmodal-tabs">
              {[
                { key: 'basic', label: 'Información', icon: '📋' },
                { key: 'codes', label: 'Códigos', icon: '🔢' },
                { key: 'pricing', label: 'Precios & Stock', icon: '💰' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`pmodal-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            {/* Formulario */}
            <form onSubmit={save} className="pmodal-form">
              {error && <div className="alert alert-error" style={{ margin: '0 0 12px' }}>{error}</div>}

              {/* TAB: Información básica */}
              {activeTab === 'basic' && (
                <div className="pmodal-section">
                  {/* Imagen */}
                  <div className="pmodal-img-row">
                    <ProductImg src={form.image} name={form.name || '?'} className="pmodal-product-img" />
                    <div className="pmodal-img-controls">
                      <p className="pmodal-img-label">Imagen del producto</p>
                      <label className="pmodal-file-btn">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                        </svg>
                        Subir imagen
                        <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
                      </label>
                      {form.image && (
                        <button type="button" className="pmodal-img-remove" onClick={() => setForm(f => ({ ...f, image: '' }))}>
                          Quitar imagen
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pmodal-field-grid">
                    <div className="pmodal-field full">
                      <label>Nombre del producto <span className="required">*</span></label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Ej: Leche Entera 1L"
                        required
                      />
                    </div>
                    <div className="pmodal-field full">
                      <label>Descripción</label>
                      <input
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Descripción opcional del producto"
                      />
                    </div>
                    <div className="pmodal-field">
                      <label>Categoría</label>
                      <select
                        value={form.category_id || ''}
                        onChange={(e) => setForm({ ...form, category_id: e.target.value ? Number(e.target.value) : '' })}
                      >
                        <option value="">Sin categoría</option>
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="pmodal-field">
                      <label>Fecha de Venc.</label>
                      <input
                        type="date"
                        value={form.expiration_date || ''}
                        onChange={(e) => setForm({ ...form, expiration_date: e.target.value })}
                        style={{ colorScheme: 'light' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: Códigos */}
              {activeTab === 'codes' && (
                <div className="pmodal-section">
                  <div className="pmodal-codes-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                    </svg>
                    El <strong>código de barras</strong> se usa en el POS para agregar al carrito. El <strong>número de serie</strong> identifica individualmente cada unidad.
                  </div>

                  {/* Código de barras */}
                  <div className="pmodal-field-grid">
                    <div className="pmodal-field full">
                      <label>
                        <span className="pmodal-code-icon bc">BC</span>
                        Código de Barras (EAN/UPC)
                      </label>
                      <div className="pmodal-scan-field">
                        <input
                          value={form.barcode}
                          onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                          placeholder="Ej: 7501031307798"
                          className="pmodal-code-input"
                        />
                        <button
                          type="button"
                          className="pmodal-scan-field-btn"
                          onClick={() => setShowScanner('barcode')}
                          title="Escanear código de barras"
                        >
                          <ScanIcon />
                          <span>Escanear</span>
                        </button>
                      </div>
                      <span className="pmodal-field-hint">Escanea físicamente el empaque o ingrésalo manualmente</span>
                    </div>

                    {/* Número de serie */}
                    <div className="pmodal-field full">
                      <label>
                        <span className="pmodal-code-icon sn">SN</span>
                        Número de Serie
                      </label>
                      <div className="pmodal-scan-field">
                        <input
                          value={form.serial || ''}
                          onChange={(e) => setForm({ ...form, serial: e.target.value })}
                          placeholder="Ej: SN-2024-ABC-001"
                          className="pmodal-code-input"
                        />
                        <button
                          type="button"
                          className="pmodal-scan-field-btn"
                          onClick={() => setShowScanner('serial')}
                          title="Escanear número de serie"
                        >
                          <ScanIcon />
                          <span>Escanear</span>
                        </button>
                      </div>
                      <span className="pmodal-field-hint">Identificador único del producto individual (opcional)</span>
                    </div>
                  </div>

                  {/* Preview visual de códigos */}
                  {(form.barcode || form.serial) && (
                    <div className="pmodal-codes-preview">
                      {form.barcode && (
                        <div className="pmodal-code-chip bc">
                          <span className="chip-label">Barcode</span>
                          <span className="chip-value">{form.barcode}</span>
                        </div>
                      )}
                      {form.serial && (
                        <div className="pmodal-code-chip sn">
                          <span className="chip-label">Serial</span>
                          <span className="chip-value">{form.serial}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: Precios & Stock */}
              {activeTab === 'pricing' && (
                <div className="pmodal-section">
                  <div className="pmodal-field-grid">
                    <div className="pmodal-field">
                      <label>Costo <span className="required">*</span></label>
                      <div className="pmodal-money-input">
                        <span className="pmodal-currency">{cur}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.cost}
                          onChange={(e) => setForm({ ...form, cost: e.target.value })}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    <div className="pmodal-field">
                      <label>Precio de Venta <span className="required">*</span></label>
                      <div className="pmodal-money-input">
                        <span className="pmodal-currency">{cur}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.price}
                          onChange={(e) => setForm({ ...form, price: e.target.value })}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      {form.cost > 0 && form.price > 0 && (
                        <span className="pmodal-margin-hint">
                          Margen: {(((form.price - form.cost) / form.cost) * 100).toFixed(1)}%
                          {' '}({cur}{(form.price - form.cost).toFixed(2)} por unidad)
                        </span>
                      )}
                    </div>

                    {editing === 'new' && (
                      <div className="pmodal-field">
                        <label>Stock Inicial <span className="required">*</span></label>
                        <input
                          type="number"
                          min="0"
                          value={form.stock}
                          onChange={(e) => setForm({ ...form, stock: e.target.value })}
                          placeholder="0"
                          required
                        />
                      </div>
                    )}
                    <div className="pmodal-field">
                      <label>Stock Mínimo (Alerta) <span className="required">*</span></label>
                      <input
                        type="number"
                        min="0"
                        value={form.min_stock}
                        onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                        placeholder="5"
                        required
                      />
                      <span className="pmodal-field-hint">Se mostrará alerta cuando el stock baje de este valor</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer con acciones */}
              <div className="pmodal-footer">
                <div className="pmodal-tab-nav">
                  {activeTab !== 'basic' && (
                    <button
                      type="button"
                      className="pmodal-nav-btn"
                      onClick={() => setActiveTab(activeTab === 'pricing' ? 'codes' : 'basic')}
                    >
                      ← Anterior
                    </button>
                  )}
                  {activeTab !== 'pricing' && (
                    <button
                      type="button"
                      className="pmodal-nav-btn primary"
                      onClick={() => setActiveTab(activeTab === 'basic' ? 'codes' : 'pricing')}
                    >
                      Siguiente →
                    </button>
                  )}
                </div>
                <div className="pmodal-actions">
                  <button type="button" className="pmodal-btn-cancel" onClick={() => setEditing(null)}>
                    Cancelar
                  </button>
                  <button type="submit" className="pmodal-btn-save" disabled={saving}>
                    {saving ? (
                      <><span className="pmodal-spinner" /> Guardando...</>
                    ) : (
                      <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
                      {editing === 'new' ? 'Crear Producto' : 'Guardar Cambios'}</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL AJUSTE DE INVENTARIO ────────────────────────────────────── */}
      {adjusting && (
        <div className="pmodal-overlay" onClick={(e) => e.target === e.currentTarget && setAdjusting(null)}>
          <div className="pmodal" style={{ maxWidth: '420px' }}>
            <div className="pmodal-header">
              <div className="pmodal-header-left">
                <div className="pmodal-header-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                  </svg>
                </div>
                <div>
                  <h3 className="pmodal-title">Ajuste de Inventario</h3>
                  <p className="pmodal-subtitle">{adjusting.name}</p>
                </div>
              </div>
              <button className="pmodal-close" onClick={() => setAdjusting(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={saveAdjust} className="pmodal-form">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="pmodal-section">
                <div className="pmodal-stock-display">
                  <div className="pmodal-stock-current">
                    <span className="pmodal-stock-label">Stock actual</span>
                    <span className="pmodal-stock-value">{adjusting.current}</span>
                  </div>
                  {adjusting.add !== 0 && (
                    <>
                      <div className="pmodal-stock-arrow">{adjusting.add > 0 ? '→' : '→'}</div>
                      <div className="pmodal-stock-new">
                        <span className="pmodal-stock-label">Nuevo stock</span>
                        <span className={`pmodal-stock-value ${(adjusting.current + adjusting.add) < 0 ? 'danger' : 'success'}`}>
                          {Math.max(0, adjusting.current + (adjusting.add || 0))}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="pmodal-field">
                  <label>Cantidad a ajustar</label>
                  <input
                    type="number"
                    value={adjusting.add}
                    onChange={(e) => setAdjusting({ ...adjusting, add: Number(e.target.value) })}
                    placeholder="Ej: +5 para agregar, -2 para restar"
                    required
                    autoFocus
                  />
                  <span className="pmodal-field-hint">Usa valores positivos para entradas y negativos para salidas</span>
                </div>

                {/* Botones rápidos */}
                <div className="pmodal-quick-btns">
                  {[1, 5, 10, 25, 50].map(n => (
                    <button key={n} type="button" className="pmodal-quick-btn plus"
                      onClick={() => setAdjusting(a => ({ ...a, add: a.add + n }))}>+{n}</button>
                  ))}
                  {[1, 5, 10].map(n => (
                    <button key={-n} type="button" className="pmodal-quick-btn minus"
                      onClick={() => setAdjusting(a => ({ ...a, add: a.add - n }))}>-{n}</button>
                  ))}
                </div>
              </div>

              <div className="pmodal-footer">
                <div />
                <div className="pmodal-actions">
                  <button type="button" className="pmodal-btn-cancel" onClick={() => setAdjusting(null)}>Cancelar</button>
                  <button type="submit" className="pmodal-btn-save" disabled={saving || adjusting.add === 0}>
                    {saving ? 'Guardando...' : 'Confirmar Ajuste'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONFIRMACIÓN ELIMINAR ─────────────────────────────────────────── */}
      {deleting && (
        <ConfirmDialog
          title="Eliminar Producto"
          message="¿Seguro que deseas eliminar este producto? Esta acción no se puede deshacer."
          onConfirm={async () => {
            await api.del(`/products/${deleting}`);
            setDeleting(null);
            load();
          }}
          onCancel={() => setDeleting(null)}
        />
      )}

      {/* ── BARCODE SCANNER MODAL ─────────────────────────────────────────── */}
      <BarcodeScanner
        open={!!showScanner}
        onClose={() => setShowScanner(false)}
        onScan={
          showScanner === 'smart'   ? handleSmartScan :
          showScanner === 'barcode' ? handleScanForBarcode :
          showScanner === 'serial'  ? handleScanForSerial :
          handleScanForSearch
        }
        title={
          showScanner === 'smart'   ? '🔍 Escanear para identificar producto' :
          showScanner === 'barcode' ? '📦 Escanear Código de Barras' :
          showScanner === 'serial'  ? '🔢 Escanear Número de Serie' :
          '🔎 Buscar por Código'
        }
      />
    </div>
  );
}