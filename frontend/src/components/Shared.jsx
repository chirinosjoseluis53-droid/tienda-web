import { useState, useEffect } from 'react';
import { api, fmtMoney } from '../api.js';
import Modal from '../components/Modal.jsx';

export function useSettings() {
  const [settings, setSettings] = useState({ store_name: 'Mi Minimarket', currency: '$', tax_rate: 0 });
  useEffect(() => {
    api.get('/settings').then(setSettings).catch(() => {});
  }, []);
  return settings;
}

export function useData(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  return { data, error, loading, reload: () => setReloadKey((k) => k + 1) };
}

export function EmptyState({ message }) {
  return <div className="empty">{message}</div>;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, text }) {
  return (
    <Modal open={open} onClose={onClose} title={title || 'Confirmar'}>
      <p>{text || '¿Seguro que deseas continuar?'}</p>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-danger" onClick={onConfirm}>Eliminar</button>
      </div>
    </Modal>
  );
}

export function Money({ value, currency }) {
  return <span className="money">{fmtMoney(value, currency)}</span>;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <input
      className="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export function ProductImg({ src, name, className = '' }) {
  if (src) {
    return <img className={'pimg ' + className} src={src} alt={name} onError={(e) => (e.currentTarget.style.display = 'none')} />;
  }
  const hue = hashHue(name || '?');
  return (
    <div
      className={'pimg ph ' + className}
      style={{ background: `linear-gradient(140deg, hsl(${hue},62%,88%), hsl(${hue},58%,72%))`, color: `hsl(${hue},45%,28%)` }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export function fileToDataUrl(file, max = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}