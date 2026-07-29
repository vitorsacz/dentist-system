import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { createAttendanceSchema, type CreateAttendanceInput } from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AttendancesService } from "./attendances.service";

@Controller("attendances")
@Roles("DENTIST")
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Get()
  listByPatient(@Query("patientId") patientId: string) {
    return this.attendancesService.listByPatient(patientId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createAttendanceSchema)) body: CreateAttendanceInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendancesService.create(body, user.id);
  }
}
