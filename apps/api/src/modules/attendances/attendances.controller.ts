import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ACCESS, createAttendanceSchema, type CreateAttendanceInput } from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AttendancesService } from "./attendances.service";

@Controller("attendances")
export class AttendancesController {
  constructor(private readonly attendancesService: AttendancesService) {}

  @Roles(...ACCESS["attendances.read"])
  @Get()
  listByPatient(
    @Query("patientId") patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendancesService.listByPatient(patientId, user);
  }

  @Roles(...ACCESS["attendances.write"])
  @Post()
  create(
    @Body(new ZodValidationPipe(createAttendanceSchema)) body: CreateAttendanceInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendancesService.create(body, user);
  }
}
