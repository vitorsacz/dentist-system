import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
  createProcedureSchema,
  updateProcedureSchema,
  type CreateProcedureInput,
  type UpdateProcedureInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProceduresService } from "./procedures.service";

@Controller("procedures")
@Roles(...ACCESS["procedures.read"])
export class ProceduresController {
  constructor(private readonly proceduresService: ProceduresService) {}

  @Get()
  list() {
    return this.proceduresService.list();
  }

  @Roles(...ACCESS["procedures.write"])
  @Post()
  create(@Body(new ZodValidationPipe(createProcedureSchema)) body: CreateProcedureInput) {
    return this.proceduresService.create(body);
  }

  @Roles(...ACCESS["procedures.write"])
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateProcedureSchema)) body: UpdateProcedureInput,
  ) {
    return this.proceduresService.update(id, body);
  }
}
