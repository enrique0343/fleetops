import { UserRole } from '@prisma/client';

// JWT Payload
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// Extended Express Request with authenticated user
export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}

// Pagination
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Notification
export interface NotificationPayload {
  tripId: string;
  driverName: string;
  vehiclePlate: string;
  origin: string;
  destination: string;
  startedAt: Date;
  finishedAt: Date;
  durationMinutes: number;
  comment?: string | null;
}

export interface NotificationResult {
  success: boolean;
  channel: string;
  messageId?: string;
  error?: string;
}

// API Response helpers
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
