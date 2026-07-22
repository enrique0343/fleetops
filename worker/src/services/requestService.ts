import type { PrismaClient } from '@prisma/client';
import { AppError } from '../lib/http';
import { toJson } from '../lib/json';
import { makeCode } from '../lib/codes';
import { TripService } from './tripService';

// Request lifecycle state machine (mirrors APPOINTMENTS_MODULE_DESIGN §4).
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED', 'DISPATCHED'], // DISPATCHED only via emergency override
  APPROVED: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['DISPATCHED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'],
  RESCHEDULED: ['SCHEDULED', 'CANCELLED'],
  DISPATCHED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

interface CreateRequestInput {
  serviceType?: string;
  priority?: string;
  requesterId?: string;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  requesterDept?: string;
  originId: string;
  destinationId: string;
  scheduledAt: Date;
  windowMinutes?: number;
  estimatedMinutes?: number;
  passengerCount?: number;
  reason?: string;
  patientName?: string;
  patientCondition?: string;
  requiresStretcher?: boolean;
  requiresOxygen?: boolean;
  clinicalNotes?: string;
}

export class RequestService {
  constructor(private prisma: PrismaClient) {}

  private assertTransition(from: string, to: string) {
    if (!(VALID_TRANSITIONS[from] || []).includes(to)) {
      throw new AppError(`No se puede cambiar la solicitud de ${from} a ${to}`, 400);
    }
  }

  async create(input: CreateRequestInput) {
    const serviceType = input.serviceType === 'AMBULANCE' ? 'AMBULANCE' : 'STANDARD';
    const id = crypto.randomUUID();

    // SLA target: emergencies get a tight default; ambulances a softer one.
    const priority = input.priority || (serviceType === 'AMBULANCE' ? 'URGENT' : 'SCHEDULED');
    let slaTargetAt: Date | null = null;
    if (serviceType === 'AMBULANCE') {
      const minutes = priority === 'EMERGENCY' ? 15 : 60;
      slaTargetAt = new Date(Date.now() + minutes * 60000);
    }

    await this.prisma.$transaction([
      this.prisma.transportRequest.create({
        data: {
          id,
          code: makeCode('REQ'),
          serviceType,
          priority,
          status: 'PENDING',
          requesterId: input.requesterId,
          requesterName: input.requesterName,
          requesterEmail: input.requesterEmail,
          requesterPhone: input.requesterPhone,
          requesterDept: input.requesterDept,
          originId: input.originId,
          destinationId: input.destinationId,
          scheduledAt: input.scheduledAt,
          windowMinutes: input.windowMinutes ?? 30,
          estimatedMinutes: input.estimatedMinutes,
          passengerCount: input.passengerCount,
          reason: input.reason,
          patientName: serviceType === 'AMBULANCE' ? input.patientName : null,
          patientCondition: serviceType === 'AMBULANCE' ? input.patientCondition : null,
          requiresStretcher: input.requiresStretcher ?? false,
          requiresOxygen: input.requiresOxygen ?? false,
          clinicalNotes: serviceType === 'AMBULANCE' ? input.clinicalNotes : null,
          slaTargetAt,
        },
      }),
      this.prisma.requestEvent.create({
        data: { requestId: id, type: 'CREATED', userId: input.requesterId, comment: input.reason },
      }),
    ]);

    return this.getDetail(id);
  }

  async getDetail(id: string) {
    const req = await this.prisma.transportRequest.findUnique({
      where: { id },
      include: {
        origin: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true } },
        assignedVehicle: { select: { id: true, plate: true, brand: true, model: true } },
        assignedDriver: { select: { id: true, fullName: true } },
        requester: { select: { id: true, fullName: true } },
        events: { orderBy: { createdAt: 'asc' }, include: { user: { select: { fullName: true } } } },
        referrals: true,
        trip: { select: { id: true, status: true } },
      },
    });
    if (!req) throw new AppError('Solicitud no encontrada', 404);
    return req;
  }

  async list(filters: {
    status?: string;
    statusIn?: string[];
    serviceType?: string;
    priority?: string;
    requesterId?: string;
    assignedDriverId?: string;
    dateFrom?: string;
    dateTo?: string;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.statusIn) where.status = { in: filters.statusIn };
    if (filters.serviceType) where.serviceType = filters.serviceType;
    if (filters.priority) where.priority = filters.priority;
    if (filters.requesterId) where.requesterId = filters.requesterId;
    if (filters.assignedDriverId) where.assignedDriverId = filters.assignedDriverId;
    if (filters.dateFrom || filters.dateTo) {
      where.scheduledAt = {};
      if (filters.dateFrom) where.scheduledAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.scheduledAt.lte = new Date(filters.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.transportRequest.findMany({
        where,
        include: {
          origin: { select: { name: true } },
          destination: { select: { name: true } },
          assignedVehicle: { select: { plate: true } },
          assignedDriver: { select: { fullName: true } },
        },
        orderBy: [{ priority: 'desc' }, { scheduledAt: 'asc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.transportRequest.count({ where }),
    ]);

    return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  }

  // Calendar feed for the dispatcher: all requests in a date range, plus
  // resource schedule blocks, with a light payload suited to a grid view.
  async calendar(from: Date, to: Date) {
    const [requests, blocks] = await Promise.all([
      this.prisma.transportRequest.findMany({
        where: {
          scheduledAt: { gte: from, lte: to },
          status: { notIn: ['CANCELLED', 'REJECTED'] },
        },
        select: {
          id: true,
          code: true,
          serviceType: true,
          priority: true,
          status: true,
          scheduledAt: true,
          estimatedMinutes: true,
          origin: { select: { name: true } },
          destination: { select: { name: true } },
          assignedVehicle: { select: { plate: true } },
          assignedDriver: { select: { fullName: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.scheduleBlock.findMany({
        where: { endAt: { gte: from }, startAt: { lte: to } },
        include: { vehicle: { select: { plate: true } }, driver: { select: { fullName: true } } },
        orderBy: { startAt: 'asc' },
      }),
    ]);
    return { requests, blocks };
  }

  // Driver starts an assigned appointment themselves (self-dispatch from the
  // driver app). Equivalent to dispatch() but the driver must own the request.
  async startByDriver(id: string, driverId: string) {
    const req = await this.prisma.transportRequest.findUnique({ where: { id } });
    if (!req) throw new AppError('Solicitud no encontrada', 404);
    if (req.assignedDriverId !== driverId) {
      throw new AppError('Esta cita no está asignada a ti', 403);
    }
    if (req.status !== 'SCHEDULED') {
      throw new AppError('Solo puedes iniciar citas programadas', 400);
    }
    return this.dispatch(id, driverId);
  }

  private async transition(
    id: string,
    to: string,
    eventType: string,
    userId: string | undefined,
    data: any,
    comment?: string,
    audit?: { action: string; old: any; new: any; reason?: string }
  ) {
    const req = await this.prisma.transportRequest.findUnique({ where: { id } });
    if (!req) throw new AppError('Solicitud no encontrada', 404);
    this.assertTransition(req.status, to);

    const ops: any[] = [
      this.prisma.transportRequest.update({ where: { id }, data: { status: to, ...data } }),
      this.prisma.requestEvent.create({ data: { requestId: id, type: eventType, userId, comment } }),
    ];
    if (audit && userId) {
      ops.push(
        this.prisma.auditLog.create({
          data: {
            entityName: 'TransportRequest',
            entityId: id,
            adminId: userId,
            action: audit.action,
            oldValue: toJson(audit.old),
            newValue: toJson(audit.new),
            reason: audit.reason,
          },
        })
      );
    }
    await this.prisma.$transaction(ops);
    return this.getDetail(id);
  }

  approve(id: string, adminId: string) {
    return this.transition(id, 'APPROVED', 'APPROVED', adminId, {
      approvedById: adminId,
      approvedAt: new Date(),
    }, 'Aprobada', { action: 'APPROVE', old: { status: 'PENDING' }, new: { status: 'APPROVED' } });
  }

  reject(id: string, adminId: string, reason: string) {
    return this.transition(id, 'REJECTED', 'REJECTED', adminId, { rejectionReason: reason }, reason, {
      action: 'REJECT',
      old: { status: 'PENDING' },
      new: { status: 'REJECTED' },
      reason,
    });
  }

  cancel(id: string, userId: string, reason?: string) {
    return this.transition(id, 'CANCELLED', 'CANCELLED', userId, {}, reason);
  }

  async assign(id: string, adminId: string, vehicleId: string, driverId: string) {
    const req = await this.prisma.transportRequest.findUnique({ where: { id } });
    if (!req) throw new AppError('Solicitud no encontrada', 404);
    if (!['PENDING', 'APPROVED', 'RESCHEDULED'].includes(req.status)) {
      throw new AppError(`No se puede asignar una solicitud en estado ${req.status}`, 400);
    }

    // Validate the vehicle matches the service type.
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new AppError('Vehículo no encontrado', 404);
    if (req.serviceType === 'AMBULANCE' && !vehicle.isAmbulance) {
      throw new AppError('El vehículo seleccionado no es una ambulancia', 400);
    }

    await this.prisma.$transaction([
      this.prisma.transportRequest.update({
        where: { id },
        data: {
          status: 'SCHEDULED',
          assignedVehicleId: vehicleId,
          assignedDriverId: driverId,
          approvedById: req.approvedById ?? adminId,
          approvedAt: req.approvedAt ?? new Date(),
        },
      }),
      this.prisma.requestEvent.create({
        data: { requestId: id, type: 'ASSIGNED', userId: adminId, comment: `Vehículo ${vehicle.plate}` },
      }),
      this.prisma.auditLog.create({
        data: {
          entityName: 'TransportRequest',
          entityId: id,
          adminId,
          action: 'ASSIGN',
          oldValue: toJson({ status: req.status }),
          newValue: toJson({ status: 'SCHEDULED', vehicleId, driverId }),
        },
      }),
    ]);
    return this.getDetail(id);
  }

  reschedule(id: string, adminId: string, scheduledAt: Date, reason?: string) {
    return this.transition(id, 'SCHEDULED', 'RESCHEDULED', adminId, { scheduledAt }, reason, {
      action: 'RESCHEDULE',
      old: {},
      new: { scheduledAt },
      reason,
    });
  }

  // Dispatch: create the Trip (reusing TripService) and link it.
  async dispatch(id: string, adminId: string) {
    const req = await this.prisma.transportRequest.findUnique({
      where: { id },
      include: { origin: true, destination: true },
    });
    if (!req) throw new AppError('Solicitud no encontrada', 404);
    if (req.status !== 'SCHEDULED') {
      throw new AppError('Solo se pueden despachar solicitudes programadas', 400);
    }
    if (!req.assignedVehicleId || !req.assignedDriverId) {
      throw new AppError('La solicitud no tiene vehículo o conductor asignado', 400);
    }

    const originBranchId = req.origin.branchId ?? (await this.resolveAnyBranch());

    const tripSvc = new TripService(this.prisma);
    const trip = await tripSvc.startTrip({
      driverId: req.assignedDriverId,
      vehicleId: req.assignedVehicleId,
      originBranchId,
      destinationId: req.destinationId,
      comment: req.reason ?? undefined,
      deviceTimestamp: new Date(),
      requestId: req.id,
      priority: req.priority === 'SCHEDULED' ? 'NORMAL' : req.priority,
    });

    await this.prisma.$transaction([
      this.prisma.transportRequest.update({
        where: { id },
        data: { status: 'DISPATCHED', tripId: trip.id, dispatchedAt: new Date() },
      }),
      this.prisma.requestEvent.create({
        data: { requestId: id, type: 'DISPATCHED', userId: adminId, comment: `Viaje ${trip.id}` },
      }),
    ]);

    return this.getDetail(id);
  }

  // Emergency override: ambulance dispatched immediately, skipping the agenda.
  async emergencyDispatch(id: string, adminId: string, vehicleId: string, driverId: string) {
    const req = await this.prisma.transportRequest.findUnique({
      where: { id },
      include: { origin: true, destination: true },
    });
    if (!req) throw new AppError('Solicitud no encontrada', 404);
    if (['DISPATCHED', 'COMPLETED', 'CANCELLED'].includes(req.status)) {
      throw new AppError(`La solicitud ya está en estado ${req.status}`, 400);
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new AppError('Vehículo no encontrado', 404);

    const slaMet = req.slaTargetAt ? new Date() <= req.slaTargetAt : null;
    const originBranchId = req.origin.branchId ?? (await this.resolveAnyBranch());

    const tripSvc = new TripService(this.prisma);
    const trip = await tripSvc.startTrip({
      driverId,
      vehicleId,
      originBranchId,
      destinationId: req.destinationId,
      comment: `EMERGENCIA: ${req.reason ?? req.patientCondition ?? ''}`.trim(),
      deviceTimestamp: new Date(),
      requestId: req.id,
      priority: 'EMERGENCY',
    });

    await this.prisma.$transaction([
      this.prisma.transportRequest.update({
        where: { id },
        data: {
          status: 'DISPATCHED',
          priority: 'EMERGENCY',
          assignedVehicleId: vehicleId,
          assignedDriverId: driverId,
          tripId: trip.id,
          dispatchedAt: new Date(),
          slaMetFlag: slaMet,
        },
      }),
      this.prisma.requestEvent.create({
        data: {
          requestId: id,
          type: 'EMERGENCY_OVERRIDE',
          userId: adminId,
          comment: `Despacho inmediato. SLA ${slaMet === null ? 'N/A' : slaMet ? 'cumplido' : 'excedido'}`,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          entityName: 'TransportRequest',
          entityId: id,
          adminId,
          action: 'EMERGENCY_DISPATCH',
          oldValue: toJson({ status: req.status }),
          newValue: toJson({ status: 'DISPATCHED', priority: 'EMERGENCY', slaMet }),
          reason: 'Despacho de emergencia',
        },
      }),
    ]);

    return this.getDetail(id);
  }

  private async resolveAnyBranch(): Promise<string> {
    const branch = await this.prisma.branch.findFirst({ where: { isActive: true } });
    if (!branch) throw new AppError('No hay sucursal configurada para el origen', 400);
    return branch.id;
  }

  async getStats() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [pending, scheduledToday, ambulanceActive, noShowWeek, slaTotal, slaMet] = await Promise.all([
      this.prisma.transportRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.transportRequest.count({ where: { status: 'SCHEDULED' } }),
      this.prisma.transportRequest.count({
        where: { serviceType: 'AMBULANCE', status: { in: ['SCHEDULED', 'DISPATCHED'] } },
      }),
      this.prisma.transportRequest.count({ where: { status: 'NO_SHOW', scheduledAt: { gte: weekAgo } } }),
      this.prisma.transportRequest.count({
        where: { serviceType: 'AMBULANCE', slaMetFlag: { not: null }, dispatchedAt: { gte: weekAgo } },
      }),
      this.prisma.transportRequest.count({
        where: { serviceType: 'AMBULANCE', slaMetFlag: true, dispatchedAt: { gte: weekAgo } },
      }),
    ]);

    return {
      pending,
      scheduledToday,
      ambulanceActive,
      noShowWeek,
      slaCompliance: slaTotal > 0 ? Math.round((slaMet / slaTotal) * 100) : null,
    };
  }
}
