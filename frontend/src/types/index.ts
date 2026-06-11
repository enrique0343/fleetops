// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type UserRole = 'DRIVER' | 'ADMIN' | 'REQUESTER' | 'DISPATCHER';

export type TripStatus = 'IN_TRANSIT' | 'IN_STOP' | 'IN_INCIDENT' | 'FINISHED' | 'CANCELLED';

export type TripEventType =
  | 'START_TRIP'
  | 'ARRIVE_STOP'
  | 'RESUME_TRIP'
  | 'REPORT_INCIDENT'
  | 'FINISH_TRIP'
  | 'FORCE_CLOSE'
  | 'ADMIN_CORRECTION'
  | 'TELEGRAM_SENT'
  | 'TELEGRAM_FAILED'
  | 'FUEL_REGISTERED';

export type TelegramDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'NOT_CONFIGURED';

export type LocationType = 'BRANCH' | 'DESTINATION' | 'OPERATIONAL' | 'OTHER';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FuelUnit = 'LITERS' | 'GALLONS';

export type ClosureType = 'NORMAL' | 'FORCED' | 'ADMIN_CORRECTION';

// ─────────────────────────────────────────────
// ENTITIES
// ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  photoUrl?: string | null;
  isActive: boolean;
  branch?: Branch;
  branchId?: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  branchId?: string;
  branch?: Branch;
  description?: string;
  addressRef?: string;
  lat?: number;
  lng?: number;
  isActive: boolean;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year?: number;
  vehicleType?: string;
  branchId?: string;
  branch?: Branch;
  fuelType?: string;
  color?: string;
  isActive: boolean;
  currentTripId?: string;
  serviceClass?: string;
  isAmbulance?: boolean;
  hasStretcher?: boolean;
  hasOxygen?: boolean;
  photoUrl?: string | null;
}

export interface IncidentType {
  id: string;
  name: string;
  description?: string;
  severity: IncidentSeverity;
  isActive: boolean;
}

export interface TripEvent {
  id: string;
  tripId: string;
  type: TripEventType;
  userId: string;
  user?: Pick<User, 'id' | 'fullName' | 'role'>;
  deviceTimestamp: string;
  serverTimestamp: string;
  comment?: string;
  metadata?: Record<string, unknown>;
}

export interface Trip {
  id: string;
  driverId: string;
  driver?: Pick<User, 'id' | 'fullName' | 'email'>;
  vehicleId: string;
  vehicle?: Pick<Vehicle, 'id' | 'plate' | 'model' | 'brand'>;
  originBranchId: string;
  originBranch?: Pick<Branch, 'id' | 'name'>;
  destinationId: string;
  destination?: Pick<Location, 'id' | 'name' | 'type'>;
  closureBranchId?: string;
  closureBranch?: Pick<Branch, 'id' | 'name'>;
  status: TripStatus;
  closureType?: ClosureType;
  startedAt: string;
  finishedAt?: string;
  durationMinutes?: number;
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  lastLat?: number | null;
  lastLng?: number | null;
  lastPingAt?: string | null;
  comment?: string;
  correctionFlag: boolean;
  forcedCloseFlag: boolean;
  telegramDeliveryStatus: TelegramDeliveryStatus;
  telegramLastAttemptAt?: string;
  telegramLastResult?: string;
  events?: TripEvent[];
  createdAt: string;
}

export interface FuelRecord {
  id: string;
  vehicleId: string;
  vehicle?: Pick<Vehicle, 'id' | 'plate' | 'model'>;
  driverId: string;
  driver?: Pick<User, 'id' | 'fullName'>;
  tripId?: string;
  branchId?: string;
  branch?: Pick<Branch, 'id' | 'name'>;
  stationName: string;
  fuelType: string;
  quantity: number;
  unit: FuelUnit;
  totalAmount: number;
  currency: string;
  odometerKm?: number;
  paymentMethod?: string;
  receiptNumber?: string;
  isFullTank: boolean;
  observation?: string;
  receiptPhotoUrl?: string;
  correctedBy?: string;
  correctionNote?: string;
  recordedAt: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityName: string;
  entityId: string;
  adminId: string;
  admin?: Pick<User, 'id' | 'fullName' | 'email'>;
  action: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  timestamp: string;
}

// ─────────────────────────────────────────────
// TRANSPORT REQUESTS (Appointments)
// ─────────────────────────────────────────────

export type ServiceType = 'STANDARD' | 'AMBULANCE';
export type RequestPriority = 'SCHEDULED' | 'URGENT' | 'EMERGENCY';
export type RequestStatus =
  | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SCHEDULED' | 'RESCHEDULED'
  | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface TransportRequest {
  id: string;
  code: string;
  serviceType: ServiceType;
  priority: RequestPriority;
  status: RequestStatus;
  requesterId?: string;
  requesterName: string;
  requesterPhone?: string;
  requesterDept?: string;
  originId: string;
  origin?: { id: string; name: string };
  destinationId: string;
  destination?: { id: string; name: string };
  scheduledAt: string;
  windowMinutes: number;
  estimatedMinutes?: number;
  passengerCount?: number;
  reason?: string;
  patientName?: string;
  patientCondition?: string;
  requiresStretcher: boolean;
  requiresOxygen: boolean;
  clinicalNotes?: string;
  assignedVehicleId?: string;
  assignedVehicle?: { id: string; plate: string; brand?: string; model?: string };
  assignedDriverId?: string;
  assignedDriver?: { id: string; fullName: string };
  approvedAt?: string;
  rejectionReason?: string;
  tripId?: string;
  dispatchedAt?: string;
  completedAt?: string;
  slaTargetAt?: string;
  slaMetFlag?: boolean | null;
  events?: { id: string; type: string; comment?: string; createdAt: string; user?: { fullName: string } }[];
  createdAt: string;
}

export interface AvailabilitySummary {
  level: 'GREEN' | 'YELLOW' | 'RED';
  withinHours: boolean;
  availableVehicles: number;
  availableDrivers: number;
  canFallbackExternal: boolean;
  nextSlots: { at: string; vehicles: number }[];
}

export interface AvailableResources {
  vehicles: (Vehicle & { isAmbulance?: boolean })[];
  drivers: { id: string; fullName: string; role: string }[];
  counts: { vehicles: number; drivers: number };
}

export interface ExternalProvider {
  id: string;
  name: string;
  serviceType: string;
  phone?: string;
  contactName?: string;
  coverageNote?: string;
  isActive: boolean;
}

export interface RequestStats {
  pending: number;
  scheduledToday: number;
  ambulanceActive: number;
  noShowWeek: number;
  slaCompliance: number | null;
}

export interface TransportTask {
  id: string;
  code: string;
  type: string;
  requesterName: string;
  locationId?: string;
  location?: { name: string };
  addressText?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  priority: string;
  status: string;
  sortOrder?: number;
  serviceTimeMin: number;
  createdAt: string;
}

export interface RoutePlan {
  id: string;
  code: string;
  status: string;
  plannedDate: string;
  totalDistanceKm?: number;
  totalDurationMin?: number;
  optimizedOrder?: string[];
  optimizerMeta?: { engine: string; stops: number; serviceMin: number };
  driverId?: string;
  driver?: { id: string; fullName: string };
  vehicleId?: string;
  vehicle?: { id: string; plate: string };
  tripId?: string;
  tasks?: TransportTask[];
}

// ─────────────────────────────────────────────
// API
// ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ActiveTripSummary {
  id: string;
  status: TripStatus;
  startedAt: string;
  driver?: { fullName: string };
  vehicle?: { plate: string };
  destination?: { name: string };
}

export interface DashboardStats {
  totalToday: number;
  activeNow: number;
  withIncident: number;
  telegramFailed: number;
  avgDurationMinutes: number;
  fuelRecordsToday: number;
  // Extensiones ejecutivas (opcionales: el backend legacy no las envía)
  finishedToday?: number;
  forcedWeek?: number;
  weekTrips?: number;
  weekIncidents?: number;
  manualVehicleWeek?: number;
  fleet?: { total: number; inUse: number };
  trend7d?: { date: string; trips: number }[];
  topDrivers?: { name: string; trips: number }[];
  activeTrips?: ActiveTripSummary[];
  fuelWeek?: { records: number; quantity: number; amount: number };
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
