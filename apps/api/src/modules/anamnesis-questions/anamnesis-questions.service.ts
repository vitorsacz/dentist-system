import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateAnamnesisQuestionInput,
  UpdateAnamnesisQuestionInput,
  ReorderAnamnesisQuestionsInput,
} from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { QUESTION_LIBRARY } from "./anamnesis-questions.library";

@Injectable()
export class AnamnesisQuestionsService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.anamnesisQuestion.findMany({
      where: { deletedAt: null },
      orderBy: { order: "asc" },
    });
  }

  library() {
    return QUESTION_LIBRARY;
  }

  async seedLibrary() {
    const { organizationId } = getTenantContext();
    const existing = await this.prisma.anamnesisQuestion.findMany({
      where: { deletedAt: null },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((q) => q.key));

    const toCreate = QUESTION_LIBRARY.filter((q) => !existingKeys.has(q.key)).map((q) => ({
      organizationId,
      key: q.key,
      label: q.label,
      kind: q.kind,
      detailRequiredWhenYes: q.detailRequiredWhenYes,
      alertWhenYes: q.alertWhenYes,
      sensitive: q.sensitive,
      active: q.defaultActive,
      order: q.order,
    }));

    if (toCreate.length === 0) return { created: 0 };

    await this.prisma.anamnesisQuestion.createMany({ data: toCreate });
    return { created: toCreate.length };
  }

  async create(input: CreateAnamnesisQuestionInput) {
    const { organizationId } = getTenantContext();
    const maxOrder = await this.prisma.anamnesisQuestion.findFirst({
      where: { deletedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    try {
      return await this.prisma.anamnesisQuestion.create({
        data: { organizationId, ...input, order: (maxOrder?.order ?? 0) + 1 },
      });
    } catch (e: unknown) {
      if (isUniqueViolation(e)) throw new ConflictException("Já existe uma pergunta com este key nesta organização");
      throw e;
    }
  }

  async update(id: string, input: UpdateAnamnesisQuestionInput) {
    await this.assertExists(id);
    return this.prisma.anamnesisQuestion.update({ where: { id }, data: input });
  }

  async toggleActive(id: string) {
    const q = await this.assertExists(id);
    return this.prisma.anamnesisQuestion.update({ where: { id }, data: { active: !q.active } });
  }

  async softDelete(id: string) {
    await this.assertExists(id);
    return this.prisma.anamnesisQuestion.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  }

  async reorder(input: ReorderAnamnesisQuestionsInput) {
    const { organizationId } = getTenantContext();
    const existing = await this.prisma.anamnesisQuestion.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });
    const ownIds = new Set(existing.map((q) => q.id));
    const invalid = input.ids.filter((id) => !ownIds.has(id));
    if (invalid.length > 0) throw new NotFoundException(`IDs não pertencem a esta organização: ${invalid.join(", ")}`);

    await this.prisma.$transaction(
      input.ids.map((id: string, index: number) =>
        this.prisma.anamnesisQuestion.update({
          where: { id, organizationId },
          data: { order: index + 1 },
        }),
      ),
    );
    return this.list();
  }

  private async assertExists(id: string) {
    const q = await this.prisma.anamnesisQuestion.findUnique({ where: { id } });
    if (!q || q.deletedAt !== null) throw new NotFoundException("Pergunta não encontrada");
    return q;
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}
