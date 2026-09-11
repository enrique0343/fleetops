import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AdminShell } from '../src/pages/admin/AdminLayout';
import { DashboardView } from '../src/pages/admin/AdminDashboard';
import { Modal, Button } from '../src/components/ui';
import type { Trip } from '../src/types';
import { Monitor, Smartphone } from 'lucide-react';

const status: Trip['status'][] = ['IN_TRANSIT', 'IN_INCIDENT', 'IN_STOP', 'FINISHED', 'IN_TRANSIT', 'FINISHED'];
const names = ['Carlos Méndez', 'Ana García', 'Luis López', 'Marta Rivera', 'José Pérez', 'Diego Cruz'];
const destinations = ['Sucursal Santa Tecla', 'Centro de distribución', 'Sucursal San Salvador', 'Oficina central', 'Sucursal Escalón', 'Centro de distribución'];
const trips: Trip[] = names.map((name, i) => ({
  id: `viaje-demo-${i + 1}`, driverId: `driver-${i}`, vehicleId: `vehicle-${i}`, originBranchId: 'central', destinationId: `destination-${i}`,
  driver: { id: `driver-${i}`, fullName: name, email: '' }, vehicle: { id: `vehicle-${i}`, plate: `P-${204310 + i * 71}`, brand: 'Toyota', model: 'Hiace' },
  originBranch: { id: 'central', name: 'Oficina central' }, destination: { id: `destination-${i}`, name: destinations[i], type: 'DESTINATION' },
  status: status[i], startedAt: `2026-09-11T${String(14-i).padStart(2, '0')}:20:00-06:00`, correctionFlag: false, forcedCloseFlag: false,
  telegramDeliveryStatus: i === 1 ? 'FAILED' : 'SENT', createdAt: '2026-09-11T12:00:00-06:00',
}));

function Preview() {
  const [mobile, setMobile] = useState(false);
  const [notice, setNotice] = useState('');
  const [updated, setUpdated] = useState(new Date('2026-09-11T14:35:00-06:00'));
  return <><div className="preview-toolbar"><div><strong>FleetOps · Rediseño</strong><span>Vista previa con datos ficticios · sin conexión al sistema</span></div><div className="preview-device-controls"><button onClick={() => setMobile(false)} aria-pressed={!mobile}><Monitor size={16} /> Escritorio</button><button onClick={() => setMobile(true)} aria-pressed={mobile}><Smartphone size={16} /> Móvil</button></div></div>
    <div className={`preview-frame ${mobile ? 'preview-phone' : ''}`} onClickCapture={event => {
      const target = (event.target as HTMLElement).closest('a');
      if (target && target.getAttribute('href') !== '#main-content') {
        event.preventDefault(); event.stopPropagation();
        setNotice('Esta vista previa muestra el nuevo resumen. En la aplicación, este enlace abre el módulo correspondiente con los datos de tu operación.');
      }
    }}><MemoryRouter initialEntries={['/admin']}><AdminShell name="Equipo de operaciones" email="Administrador · vista previa" onLogout={() => setNotice('La vista previa no inicia ni cierra sesiones reales.')}><DashboardView stats={{ totalToday: 24, activeNow: 8, avgDurationMinutes: 42, fuelRecordsToday: 5, withIncident: 2, telegramFailed: 1 }} trips={trips} loading={false} error="" tripsError="" updatedAt={updated} onRefresh={() => { setUpdated(new Date()); setNotice('Diseño actualizado. Las cifras son ilustrativas y no representan la operación real.'); }} /></AdminShell></MemoryRouter></div>
    <Modal open={!!notice} onClose={() => setNotice('')} title="Vista previa del diseño" footer={<Button onClick={() => setNotice('')}>Entendido</Button>}><p className="text-sm text-slate-600">{notice}</p></Modal>
  </>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
