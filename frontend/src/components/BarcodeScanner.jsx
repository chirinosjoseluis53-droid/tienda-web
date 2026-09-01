import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Componente modal que abre la cámara del dispositivo para escanear códigos de barras.
 * Usa BarcodeDetector API nativa si está disponible, con fallback a @zxing/browser.
 *
 * Props:
 *   open        {boolean}  - Si el modal está abierto
 *   onClose     {() => void} - Callback al cerrar
 *   onScan      {(barcode: string) => void} - Callback con el código detectado
 *   title       {string}   - Título del modal (opcional)
 */
export default function BarcodeScanner({ open, onClose, onScan, title = 'Escanear Código' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const zxingRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle | loading | scanning | error
  const [errorMsg, setErrorMsg] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [detected, setDetected] = useState('');
  const [useNative, setUseNative] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (zxingRef.current) {
      try { zxingRef.current.reset(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Detectar cámaras disponibles
  useEffect(() => {
    if (!open) return;
    setDetected('');
    setErrorMsg('');
    setStatus('loading');

    async function initCameras() {
      try {
        // Pedir permiso primero
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        tempStream.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setCameras(videoDevices);

        // Preferir cámara trasera
        const back = videoDevices.find((d) => /back|rear|environment/i.test(d.label));
        setSelectedCamera(back?.deviceId || videoDevices[0]?.deviceId || '');

        // Verificar si BarcodeDetector nativo está disponible
        const native = 'BarcodeDetector' in window;
        setUseNative(native);
        setStatus('idle');
      } catch (err) {
        setErrorMsg(getCameraError(err));
        setStatus('error');
      }
    }

    initCameras();
  }, [open]);

  // Iniciar escaneo cuando hay cámara seleccionada
  useEffect(() => {
    if (!open || !selectedCamera || status === 'error') return;

    let cancelled = false;

    async function startScanning() {
      stopCamera();
      setStatus('loading');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ('BarcodeDetector' in window) {
          // Usar BarcodeDetector nativo (Chrome Android)
          detectorRef.current = new window.BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'itf', 'codabar', 'data_matrix'],
          });
          setStatus('scanning');
          scanFrameNative();
        } else {
          // Fallback: @zxing/browser y library
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');
          
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.ITF,
            BarcodeFormat.QR_CODE
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const reader = new BrowserMultiFormatReader(hints);
          zxingRef.current = reader;
          setStatus('scanning');

          reader.decodeFromStream(stream, videoRef.current, (result, err) => {
            if (cancelled) return;
            if (result) {
              const code = result.getText();
              handleDetected(code);
            }
          });
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(getCameraError(err));
          setStatus('error');
        }
      }
    }

    function scanFrameNative() {
      if (cancelled || !videoRef.current || !detectorRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(scanFrameNative);
        return;
      }
      detectorRef.current.detect(video).then((barcodes) => {
        if (cancelled) return;
        if (barcodes.length > 0) {
          handleDetected(barcodes[0].rawValue);
        } else {
          rafRef.current = requestAnimationFrame(scanFrameNative);
        }
      }).catch(() => {
        if (!cancelled) rafRef.current = requestAnimationFrame(scanFrameNative);
      });
    }

    startScanning();

    return () => {
      cancelled = true;
      stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCamera]);

  function handleDetected(code) {
    setDetected(code);
    setStatus('idle');
    stopCamera();
    // Pequeño delay para mostrar feedback visual antes de cerrar
    setTimeout(() => {
      onScan(code);
      onClose();
    }, 600);
  }

  function getCameraError(err) {
    if (err.name === 'NotAllowedError') return 'Permiso de cámara denegado. Habilítalo en la configuración del navegador.';
    if (err.name === 'NotFoundError') return 'No se encontró cámara en este dispositivo.';
    if (err.name === 'NotSupportedError') return 'Tu navegador no soporta acceso a la cámara. Usa Chrome o Edge.';
    return `Error de cámara: ${err.message}`;
  }

  if (!open) return null;

  return (
    <div className="scanner-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="scanner-modal">
        {/* Header */}
        <div className="scanner-header">
          <div className="scanner-header-left">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 5h2M7 5h1M12 5h1M17 5h1M21 5h-2M3 12h2M19 12h2M3 19h2M7 19h1M12 19h1M17 19h1M21 19h-2"/>
              <rect x="7" y="8" width="4" height="8" rx="1"/>
              <rect x="13" y="8" width="4" height="8" rx="1"/>
            </svg>
            <span>{title}</span>
          </div>
          <button className="scanner-close" onClick={onClose} aria-label="Cerrar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Camera selector */}
        {cameras.length > 1 && (
          <div className="scanner-cam-select">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3"/><path d="M20.4 15a8.4 8.4 0 01-.7 1.7l1.5 1.2-2 2-1.2-1.5a8.4 8.4 0 01-1.7.7V21h-3v-1.9a8.4 8.4 0 01-1.7-.7L10.3 19.9l-2-2 1.5-1.2A8.4 8.4 0 019 15H7v-3h1.9a8.4 8.4 0 01.7-1.7L8.1 9.1l2-2 1.2 1.5A8.4 8.4 0 0113 8.1V6h3v1.9a8.4 8.4 0 011.7.7l1.2-1.5 2 2-1.5 1.2a8.4 8.4 0 01.7 1.7H21v3h-1.9z"/>
            </svg>
            <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)}>
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Cámara ${cameras.indexOf(cam) + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Viewfinder */}
        <div className="scanner-viewfinder">
          <video
            ref={videoRef}
            className="scanner-video"
            autoPlay
            playsInline
            muted
          />

          {/* Overlay con guía de escaneo */}
          {status === 'scanning' && (
            <div className="scanner-guide">
              <div className="scanner-frame">
                <span className="scanner-corner tl" />
                <span className="scanner-corner tr" />
                <span className="scanner-corner bl" />
                <span className="scanner-corner br" />
                <div className="scanner-line" />
              </div>
              <p className="scanner-hint">Apunta al código de barras</p>
            </div>
          )}

          {/* Estado cargando */}
          {status === 'loading' && (
            <div className="scanner-state">
              <div className="scanner-spinner" />
              <p>Iniciando cámara...</p>
            </div>
          )}

          {/* Éxito */}
          {detected && (
            <div className="scanner-success">
              <div className="scanner-check">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <p>¡Código detectado!</p>
              <code>{detected}</code>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div className="scanner-state scanner-error-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <p>{errorMsg}</p>
              <button className="scanner-retry" onClick={() => { setStatus('idle'); setErrorMsg(''); }}>
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="scanner-footer">
          {!useNative && status === 'scanning' && (
            <span className="scanner-badge">Modo compatibilidad</span>
          )}
          {useNative && status === 'scanning' && (
            <span className="scanner-badge native">Detección nativa ⚡</span>
          )}
          <span className="scanner-tip">
            💡 También funciona con lector físico USB/Bluetooth
          </span>
        </div>
      </div>
    </div>
  );
}
