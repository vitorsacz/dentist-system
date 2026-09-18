import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientsService } from "../patients/patients.service";
import { ClinicsService } from "../clinics/clinics.service";

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
    private readonly clinicsService: ClinicsService,
  ) {}

  list(query: ListAppointmentsQuery) {
    return this.prisma.appointment.findMany({
      where: {
        startsAt: { gte: query.from, lte: query.to },
        ...(query.clinicId ? { clinicId: query.clinicId } : {}),
      },
      include: { patient: true, clinic: true },
      orderBy: { startsAt: "asc" },
    });
  }

  async findOne(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: true, clinic: true },
    });
    if (!appointment) {
      throw new NotFoundException("Agendamento não encontrado");
    }
    return appointment;
  }

  async create(input: CreateAppointmentInput) {
    // A extension só carimba organizationId na linha criada — não sabe que
    // patientId/clinicId são FK pra outro model tenant-scoped. Reaproveita o
    // findOne() de cada service (tenant-safe de graça via o findUnique com
    // post-check) pra barrar referência cruzada entre organizações.
    await this.patientsService.findOne(input.patientId);
    await this.clinicsService.findOne(input.clinicId);
    const { organizationId } = getTenantContext();
    return this.prisma.appointment.create({ data: { ...input, organizationId } });
  }

  async update(id: string, input: UpdateAppointmentInput) {
    await this.findOne(id);
    return this.prisma.appointment.update({ where: { id }, data: input });
  }
}
