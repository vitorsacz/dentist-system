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
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AppointmentsService } from "./appointments.service";

@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Roles(...ACCESS["appointments.read"])
  @Get()
  list(
    @Query(new ZodValidationPipe(listAppointmentsQuerySchema)) query: ListAppointmentsQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.list(query, user);
  }

  @Roles(...ACCESS["appointments.read"])
  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.appointmentsService.findOne(id, user);
  }

  @Roles(...ACCESS["appointments.manage"])
  @Post()
  create(
    @Body(new ZodValidationPipe(createAppointmentSchema)) body: CreateAppointmentInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.create(body, user);
  }

  @Roles(...ACCESS["appointments.manage"])
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAppointmentSchema)) body: UpdateAppointmentInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.appointmentsService.update(id, body, user);
  }
}
