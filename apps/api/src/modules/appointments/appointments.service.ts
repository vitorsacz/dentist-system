import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(input: CreateAppointmentInput) {
    return this.prisma.appointment.create({ data: input });
  }

  async update(id: string, input: UpdateAppointmentInput) {
    await this.findOne(id);
    return this.prisma.appointment.update({ where: { id }, data: input });
  }
}
