import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
  createPatientSchema,
  sharePatientSchema,
  updatePatientSchema,
  type CreatePatientInput,
  type SharePatientInput,
  type UpdatePatientInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PatientsService } from "./patients.service";

@Controller("patients")
@Roles(...ACCESS["patients.read"])
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.list(user);
  }

  // Deve vir ANTES de :id para não ser capturado como id="unassigned"
  @Roles(...ACCESS["patients.claim"])
  @Get("unassigned")
  listUnassigned() {
    return this.patientsService.listUnassigned();
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.findOneWithAccess(id, user);
  }

  @Get(":id/revisions")
  findRevisions(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.findRevisions(id, user);
  }

  @Get(":id/access")
  getAccess(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.getAccess(id, user);
  }

  @Roles(...ACCESS["patients.write"])
  @Post()
  create(
    @Body(new ZodValidationPipe(createPatientSchema)) body: CreatePatientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.create(body, user);
  }

  @Roles(...ACCESS["patients.write"])
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePatientSchema)) body: UpdatePatientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.update(id, body, user);
  }

  @Roles(...ACCESS["patients.share"])
  @Post(":id/shares")
  share(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(sharePatientSchema)) body: SharePatientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.share(id, body, user);
  }

  @Roles(...ACCESS["patients.share"])
  @Delete(":id/shares/:dentistId")
  revoke(
    @Param("id") id: string,
    @Param("dentistId") dentistId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.revoke(id, dentistId, user);
  }

  @Roles(...ACCESS["patients.claim"])
  @Post(":id/claim")
  claim(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.patientsService.claim(id, user);
  }
}
