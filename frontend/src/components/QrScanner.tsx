import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
  title?: string;
  hint?: string;
}

// Modal de escaneo de QR usando la cámara del dispositivo.
// Devuelve el texto crudo del QR vía onScan; quien lo use decide cómo parsearlo.
export function QrScanner({ open, onClose, onScan, title = 'Escanear código', hint }: QrScannerProps) {
  const containerId = 'qr-reader-region';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    setStarting(true);

    const scanner = new Html5Qrcode(containerId, { verbose: false });
    scannerRef.current = scanner;

    const stop = async () => {
      try {
        if (scanner.isScanning) await scanner.stop();
        await scanner.clear();
      } catch {
        /* noop */
      }
    };

    scanner
      .start(
        { facingMode: 'environment' }, // cámara trasera en móvil
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (cancelled) return;
          cancelled = true;
          stop().finally(() => onScan(decodedText));
        },
        () => {
          /* fallos de frame: ignorar */
        }
      )
      .then(() => !cancelled && setStarting(false))
      .catch((err) => {
        if (cancelled) return;
        setStarting(false);
        setError(
          err?.toString().includes('NotAllowed') || err?.toString().includes('Permission')
            ? 'Permiso de cámara denegado. Habilítalo en el navegador.'
            : 'No se pudo iniciar la cámara en este dispositivo.'
        );
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-400" /> {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-red-800 bg-red-900/30">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : (
            <>
              <div id={containerId} className="w-full rounded-xl overflow-hidden bg-black min-h-[240px]" />
              {starting && (
                <p className="text-center text-sm text-slate-400 mt-3 animate-pulse">Iniciando cámara…</p>
              )}
            </>
          )}
          {hint && !error && <p className="text-xs text-slate-500 text-center mt-3">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

export { vehicleQrPayload, parseVehicleQr } from './vehicleQr';
