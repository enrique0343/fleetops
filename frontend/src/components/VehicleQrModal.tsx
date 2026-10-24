import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Modal, Button } from './ui';
import { Printer } from 'lucide-react';
import { vehicleQrPayload } from './vehicleQr';

interface Props {
  open: boolean;
  onClose: () => void;
  vehicle: { id: string; plate: string; brand: string; model: string } | null;
}

// Muestra (y permite imprimir) el QR de identificación de un vehículo.
// El conductor lo escanea al iniciar el viaje. El QR codifica:
//   fleetops:vehicle:<id>:<plate>
export function VehicleQrModal({ open, onClose, vehicle }: Props) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!open || !vehicle) return;
    const payload = vehicleQrPayload(vehicle.id, vehicle.plate);
    QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [open, vehicle]);

  if (!vehicle) return null;

  const print = () => {
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return;
    w.document.write(`
      <html><head><title>QR ${vehicle.plate}</title>
      <style>
        body{font-family:system-ui,sans-serif;text-align:center;padding:32px;}
        h1{font-size:28px;margin:8px 0;} p{color:#555;margin:0 0 16px;}
        img{width:320px;height:320px;}
        .frame{border:2px solid #111;border-radius:16px;padding:24px;display:inline-block;}
      </style></head>
      <body>
        <div class="frame">
          <h1>${vehicle.plate}</h1>
          <p>${vehicle.brand} ${vehicle.model}</p>
          <img src="${dataUrl}" />
          <p style="margin-top:16px;font-size:12px;">FleetOps · escanear para iniciar viaje</p>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Código QR — ${vehicle.plate}`}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>Cerrar</Button>
          <Button fullWidth icon={<Printer className="w-4 h-4" />} onClick={print} disabled={!dataUrl}>
            Imprimir
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-3">
        {dataUrl ? (
          <img src={dataUrl} alt={`QR ${vehicle.plate}`} className="w-56 h-56 rounded-xl bg-white p-2" />
        ) : (
          <div className="w-56 h-56 rounded-xl bg-slate-700 animate-pulse" />
        )}
        <div className="text-center">
          <p className="text-white font-semibold">{vehicle.plate}</p>
          <p className="text-slate-400 text-sm">{vehicle.brand} {vehicle.model}</p>
        </div>
        <p className="text-xs text-slate-500 text-center">
          Imprime y pega este código en el vehículo. El conductor lo escanea para iniciar el viaje.
        </p>
      </div>
    </Modal>
  );
}
