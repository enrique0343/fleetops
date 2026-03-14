import { useState, useEffect } from 'react';
import api, { getErrorMessage } from '../../services/api';
import { User, Vehicle, Branch, Location } from '../../types';
import { Button, Input, Select, Card, Alert, Modal, Textarea, StatusBadge } from '../../components/ui';
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { format } from 'date-fns';

// ════════════════════════════════════════
// USERS MANAGEMENT
// ════════════════════════════════════════

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [form, setForm] = useState({
    email: '', password: '', fullName: '', role: 'DRIVER',
    phone: '', branchId: '', isActive: true,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [uRes, bRes] = await Promise.all([
        api.get('/catalogs/users'),
        api.get('/catalogs/branches'),
      ]);
      setUsers(uRes.data.data || []);
      setBranches(bRes.data.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ email: '', password: '', fullName: '', role: 'DRIVER', phone: '', branchId: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({
      email: user.email, password: '', fullName: user.fullName,
      role: user.role, phone: user.phone || '', branchId: user.branchId || '',
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editUser) {
        const data: Record<string, unknown> = {
          fullName: form.fullName, role: form.role,
          phone: form.phone, branchId: form.branchId || null,
          isActive: form.isActive, reason: 'Edición desde admin',
        };
        if (form.password) data.password = form.password;
        await api.patch(`/catalogs/users/${editUser.id}`, data);
      } else {
        await api.post('/catalogs/users', {
          email: form.email, password: form.password,
          fullName: form.fullName, role: form.role,
          phone: form.phone, branchId: form.branchId || null,
        });
      }
      setSuccess(editUser ? 'Usuario actualizado' : 'Usuario creado');
      setShowModal(false);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: User) => {
    try {
      await api.patch(`/catalogs/users/${user.id}`, {
        isActive: !user.isActive,
        reason: `${user.isActive ? 'Desactivación' : 'Activación'} desde admin`,
      });
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-slate-400 text-sm">{users.length} usuarios registrados</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nuevo usuario</Button>
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Sucursal</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Cargando...</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="hover:bg-slate-750 transition-colors">
                  <td className="px-4 py-3 text-slate-200 font-medium">{user.fullName}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${user.role === 'ADMIN' ? 'bg-purple-900/40 text-purple-300' : 'bg-blue-900/40 text-blue-300'}`}>
                      {user.role === 'ADMIN' ? 'Admin' : 'Motorista'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{user.branch?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${user.isActive ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700 text-slate-500'}`}>
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => toggleActive(user)} className="text-slate-400 hover:text-amber-400 transition-colors" title={user.isActive ? 'Desactivar' : 'Activar'}>
                        {user.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEdit(user)} className="text-slate-400 hover:text-blue-400 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editUser ? 'Editar usuario' : 'Nuevo usuario'}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button fullWidth onClick={handleSave} loading={saving}>
              {editUser ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {!editUser && (
            <Input label="Email *" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          )}
          <Input label="Nombre completo *" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
          <Input
            label={editUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}
            type="password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
          />
          <Input label="Teléfono" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          <Select
            label="Rol"
            value={form.role}
            onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
            options={[{ value: 'DRIVER', label: 'Motorista' }, { value: 'ADMIN', label: 'Administrador' }]}
          />
          <Select
            label="Sucursal"
            value={form.branchId}
            onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
            placeholder="Sin sucursal asignada"
            options={branches.map(b => ({ value: b.id, label: b.name }))}
          />
          {editUser && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="accent-blue-500" />
              <label htmlFor="isActive" className="text-sm text-slate-300">Usuario activo</label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════
// LOCATIONS MANAGEMENT
// ════════════════════════════════════════

export function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editLoc, setEditLoc] = useState<Location | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', type: 'DESTINATION', branchId: '',
    description: '', addressRef: '', lat: '', lng: '', isActive: true,
  });

  const load = async () => {
    const [lRes, bRes] = await Promise.all([
      api.get('/catalogs/locations?active=false'),
      api.get('/catalogs/branches'),
    ]);
    setLocations(lRes.data.data || []);
    setBranches(bRes.data.data || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditLoc(null);
    setForm({ name: '', type: 'DESTINATION', branchId: '', description: '', addressRef: '', lat: '', lng: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (loc: Location) => {
    setEditLoc(loc);
    setForm({
      name: loc.name, type: loc.type, branchId: loc.branchId || '',
      description: loc.description || '', addressRef: loc.addressRef || '',
      lat: loc.lat?.toString() || '', lng: loc.lng?.toString() || '',
      isActive: loc.isActive,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const data = {
        name: form.name, type: form.type, branchId: form.branchId || null,
        description: form.description || null, addressRef: form.addressRef || null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        isActive: form.isActive,
        reason: 'Edición desde admin',
      };
      if (editLoc) {
        await api.patch(`/catalogs/locations/${editLoc.id}`, data);
      } else {
        await api.post('/catalogs/locations', data);
      }
      setSuccess(editLoc ? 'Ubicación actualizada' : 'Ubicación creada');
      setShowModal(false);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const typeLabels: Record<string, string> = {
    BRANCH: 'Sucursal', DESTINATION: 'Destino', OPERATIONAL: 'Operativa', OTHER: 'Otro',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Ubicaciones</h1>
          <p className="text-slate-400 text-sm">{locations.length} ubicaciones</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nueva ubicación</Button>
      </div>

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map(loc => (
          <Card key={loc.id} className={!loc.isActive ? 'opacity-50' : ''}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-slate-100 font-medium">{loc.name}</p>
                <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded mt-1 inline-block">
                  {typeLabels[loc.type]}
                </span>
              </div>
              <button onClick={() => openEdit(loc)} className="text-slate-500 hover:text-blue-400 transition-colors ml-2">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            {loc.description && <p className="text-slate-500 text-xs mt-2">{loc.description}</p>}
            {loc.addressRef && <p className="text-slate-600 text-xs mt-1">📍 {loc.addressRef}</p>}
            {loc.branch && <p className="text-slate-600 text-xs mt-1">🏢 {loc.branch.name}</p>}
            {!loc.isActive && <p className="text-red-500 text-xs mt-2">● Inactiva</p>}
          </Card>
        ))}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editLoc ? 'Editar ubicación' : 'Nueva ubicación'}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button fullWidth onClick={handleSave} loading={saving}>
              {editLoc ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Select
            label="Tipo"
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
            options={[
              { value: 'DESTINATION', label: 'Destino frecuente' },
              { value: 'BRANCH', label: 'Sucursal' },
              { value: 'OPERATIONAL', label: 'Operativa' },
              { value: 'OTHER', label: 'Otro' },
            ]}
          />
          <Select
            label="Sucursal relacionada"
            value={form.branchId}
            onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))}
            placeholder="Sin relación"
            options={branches.map(b => ({ value: b.id, label: b.name }))}
          />
          <Textarea
            label="Descripción"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={2}
          />
          <Input
            label="Dirección de referencia"
            value={form.addressRef}
            onChange={e => setForm(p => ({ ...p, addressRef: e.target.value }))}
            placeholder="Dirección legible"
          />
          <div className="flex gap-3">
            <Input label="Latitud" type="number" step="any" value={form.lat} onChange={e => setForm(p => ({ ...p, lat: e.target.value }))} placeholder="0.000000" />
            <Input label="Longitud" type="number" step="any" value={form.lng} onChange={e => setForm(p => ({ ...p, lng: e.target.value }))} placeholder="0.000000" />
          </div>
          {editLoc && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="locActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="accent-blue-500" />
              <label htmlFor="locActive" className="text-sm text-slate-300">Ubicación activa</label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════
// VEHICLES MANAGEMENT (simplified)
// ════════════════════════════════════════

export function AdminVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const emptyForm = { plate: '', model: '', brand: '', year: '', vehicleType: '', branchId: '', fuelType: '', color: '', isActive: true };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const [vRes, bRes] = await Promise.all([api.get('/catalogs/vehicles'), api.get('/catalogs/branches')]);
    setVehicles(vRes.data.data || []);
    setBranches(bRes.data.data || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditVehicle(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (v: Vehicle) => {
    setEditVehicle(v);
    setForm({ plate: v.plate, model: v.model, brand: v.brand, year: v.year?.toString() || '', vehicleType: v.vehicleType || '', branchId: v.branchId || '', fuelType: v.fuelType || '', color: v.color || '', isActive: v.isActive });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const data = { ...form, year: form.year ? parseInt(form.year) : null, branchId: form.branchId || null, reason: 'Edición desde admin' };
      if (editVehicle) await api.patch(`/catalogs/vehicles/${editVehicle.id}`, data);
      else await api.post('/catalogs/vehicles', data);
      setSuccess(editVehicle ? 'Vehículo actualizado' : 'Vehículo creado');
      setShowModal(false);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Vehículos</h1>
          <p className="text-slate-400 text-sm">{vehicles.length} vehículos</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nuevo vehículo</Button>
      </div>
      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map(v => (
          <Card key={v.id} className={!v.isActive ? 'opacity-50' : ''}>
            <div className="flex justify-between">
              <div>
                <p className="font-mono font-bold text-slate-100">{v.plate}</p>
                <p className="text-slate-400 text-sm">{v.brand} {v.model} {v.year && `(${v.year})`}</p>
              </div>
              <button onClick={() => openEdit(v)} className="text-slate-500 hover:text-blue-400 transition-colors"><Pencil className="w-4 h-4" /></button>
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              {v.vehicleType && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">{v.vehicleType}</span>}
              {v.fuelType && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">{v.fuelType}</span>}
              {v.currentTripId && <span className="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded">En uso</span>}
              {!v.isActive && <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded">Inactivo</span>}
            </div>
          </Card>
        ))}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editVehicle ? 'Editar vehículo' : 'Nuevo vehículo'}
        footer={<div className="flex gap-3"><Button variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancelar</Button><Button fullWidth onClick={handleSave} loading={saving}>{editVehicle ? 'Guardar' : 'Crear'}</Button></div>}
      >
        <div className="space-y-4">
          <Input label="Placa *" value={form.plate} onChange={e => setForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))} placeholder="P-123-456" />
          <div className="flex gap-3">
            <Input label="Marca *" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} />
            <Input label="Modelo *" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} />
          </div>
          <div className="flex gap-3">
            <Input label="Año" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: e.target.value }))} placeholder="2024" />
            <Input label="Color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))} />
          </div>
          <Select label="Tipo de combustible" value={form.fuelType} onChange={e => setForm(p => ({ ...p, fuelType: e.target.value }))} placeholder="Seleccionar..." options={[{ value: 'Gasolina', label: 'Gasolina' }, { value: 'Diesel', label: 'Diesel' }, { value: 'Gas LP', label: 'Gas LP' }]} />
          <Select label="Sucursal" value={form.branchId} onChange={e => setForm(p => ({ ...p, branchId: e.target.value }))} placeholder="Sin sucursal" options={branches.map(b => ({ value: b.id, label: b.name }))} />
          {editVehicle && (
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="accent-blue-500" id="vActive" />
              <label htmlFor="vActive" className="text-sm text-slate-300">Vehículo activo</label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════
// BRANCHES MANAGEMENT
// ════════════════════════════════════════

export function AdminBranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', isActive: true });

  const load = async () => {
    const res = await api.get('/catalogs/branches');
    setBranches(res.data.data || []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditBranch(null); setForm({ name: '', code: '', address: '', isActive: true }); setShowModal(true); };
  const openEdit = (b: Branch) => { setEditBranch(b); setForm({ name: b.name, code: b.code, address: b.address || '', isActive: b.isActive }); setShowModal(true); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editBranch) await api.patch(`/catalogs/branches/${editBranch.id}`, form);
      else await api.post('/catalogs/branches', form);
      setSuccess(editBranch ? 'Sucursal actualizada' : 'Sucursal creada');
      setShowModal(false);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div><h1 className="text-2xl font-bold text-white">Sucursales</h1></div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nueva sucursal</Button>
      </div>
      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map(b => (
          <Card key={b.id}>
            <div className="flex justify-between">
              <div>
                <p className="text-slate-100 font-semibold">{b.name}</p>
                <span className="text-xs font-mono bg-slate-700 text-slate-400 px-2 py-0.5 rounded">{b.code}</span>
              </div>
              <button onClick={() => openEdit(b)} className="text-slate-500 hover:text-blue-400 transition-colors"><Pencil className="w-4 h-4" /></button>
            </div>
            {b.address && <p className="text-slate-500 text-xs mt-2">{b.address}</p>}
          </Card>
        ))}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editBranch ? 'Editar sucursal' : 'Nueva sucursal'}
        footer={<div className="flex gap-3"><Button variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancelar</Button><Button fullWidth onClick={handleSave} loading={saving}>{editBranch ? 'Guardar' : 'Crear'}</Button></div>}
      >
        <div className="space-y-4">
          <Input label="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <Input label="Código (único) *" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} disabled={!!editBranch} />
          <Input label="Dirección" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
          {editBranch && (
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="accent-blue-500" id="brActive" />
              <label htmlFor="brActive" className="text-sm text-slate-300">Sucursal activa</label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════
// AUDIT LOG PAGE
// ════════════════════════════════════════

export function AdminAuditPage() {
  const [logs, setLogs] = useState<Array<{
    id: string; entityName: string; entityId: string;
    action: string; reason?: string; timestamp: string;
    admin?: { fullName: string };
    oldValue?: unknown; newValue?: unknown;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit?limit=50').then(res => setLogs(res.data.data || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Auditoría</h1>
        <p className="text-slate-400 text-sm">Registro de todas las mutaciones administrativas</p>
      </div>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Entidad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Acción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Administrador</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Motivo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Cargando...</td></tr>
              ) : logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-750 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{log.entityName}</span>
                    <p className="text-slate-600 text-xs font-mono mt-0.5">#{log.entityId.substring(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium">{log.action}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{log.admin?.fullName}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell text-xs">{log.reason || '—'}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
