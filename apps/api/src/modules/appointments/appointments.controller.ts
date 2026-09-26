import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  ACCESS,
  createAppointmentSchema,
  listAppointmentsQuerySchema,
  updateAppointmentSchema,
  type CreateAppointmentInput,
  type ListAppointmentsQuery,
  type UpdateAppointmentInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { AppointmentsService } from "./appointments.service";

@Controller("appointments")
@Roles(...ACCESS["appointments.manage"])
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listAppointmentsQuerySchema)) query: ListAppointmentsQuery) {
    return this.appointmentsService.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentInput) {
    return this.appointmentsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentInput,
  ) {
    return this.appointmentsService.update(id, body);
  }
}
