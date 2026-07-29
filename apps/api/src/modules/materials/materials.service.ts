import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateMaterialBatchInput,
  CreateMaterialInput,
  UpdateMaterialInput,
} from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

const EXPIRY_ALERT_DAYS = 30;

function withAlerts<T extends { minimumStock: unknown; batches: { quantity: unknown; expiryDate: Date | null }[] }>(
  material: T,
) {
  const currentStock = material.batches.reduce((sum, batch) => sum + Number(batch.quantity), 0);
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + EXPIRY_ALERT_DAYS);

  const expiringBatches = material.batches.filter(
    (batch) => batch.expiryDate && batch.expiryDate <= expiryThreshold && Number(batch.quantity) > 0,
  );

  return {
    ...material,
    currentStock,
    lowStock: currentStock < Number(material.minimumStock),
    expiringSoon: expiringBatches.length > 0,
  };
}

@Injectable()
export class MaterialsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const materials = await this.prisma.material.findMany({
      include: { batches: true },
      orderBy: { name: "asc" },
    });
    return materials.map(withAlerts);
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id }, include: { batches: true } });
    if (!material) {
      throw new NotFoundException("Material não encontrado");
    }
    return withAlerts(material);
  }

  create(input: CreateMaterialInput) {
    return this.prisma.material.create({ data: input });
  }

  async update(id: string, input: UpdateMaterialInput) {
    await this.findOne(id);
    return this.prisma.material.update({ where: { id }, data: input });
  }

  async addBatch(materialId: string, input: CreateMaterialBatchInput) {
    await this.findOne(materialId);
    return this.prisma.materialBatch.create({ data: { ...input, materialId } });
  }
}
