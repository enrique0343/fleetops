// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export type UserRole = 'DRIVER' | 'ADMIN';

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

export interface DashboardStats {
  totalToday: number;
  activeNow: number;
  withIncident: number;
  telegramFailed: number;
  avgDurationMinutes: number;
  fuelRecordsToday: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
