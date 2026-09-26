import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
  createMaterialBatchSchema,
  createMaterialSchema,
  updateMaterialSchema,
  type CreateMaterialBatchInput,
  type CreateMaterialInput,
  type UpdateMaterialInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { MaterialsService } from "./materials.service";

@Controller("materials")
@Roles(...ACCESS["materials.manage"])
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  list() {
    return this.materialsService.list();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.materialsService.findOne(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createMaterialSchema)) body: CreateMaterialInput) {
    return this.materialsService.create(body);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateMaterialSchema)) body: UpdateMaterialInput,
  ) {
    return this.materialsService.update(id, body);
  }

  @Post(":id/batches")
  addBatch(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createMaterialBatchSchema)) body: CreateMaterialBatchInput,
  ) {
    return this.materialsService.addBatch(id, body);
  }
}
