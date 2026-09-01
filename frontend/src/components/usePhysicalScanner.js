import { useEffect, useRef } from 'react';

/**
 * Hook que detecta entrada de un lector de código de barras físico (USB/Bluetooth).
 * Los lectores físicos envían caracteres muy rápido (< 50ms entre teclas) + Enter al final.
 *
 * @param {(barcode: string) => void} onScan - Callback cuando se detecta un escaneo
 * @param {boolean} enabled - Si el hook está activo (default: true)
 */
export function usePhysicalScanner(onScan, enabled = true) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e) {
      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Si pasó más de 100ms desde la última tecla, resetear buffer
      // (humano escribiendo vs lector físico que escribe en ~5-20ms por tecla)
      if (delta > 100) {
        bufferRef.current = '';
      }

      // Enter = fin del escaneo
      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        // Solo considerar escaneo si tiene al menos 4 caracteres (evitar falsos positivos)
        if (code.length >= 4) {
          e.preventDefault();
          e.stopPropagation();
          onScan(code);
        }
        bufferRef.current = '';
        return;
      }

      // Acumular caracteres alfanuméricos y guiones
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }

      // Auto-limpiar buffer si no termina con Enter en 300ms
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, 300);
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onScan, enabled]);
}
