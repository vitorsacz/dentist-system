import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type { RentPeriodicity, UpsertClinicFinancialTermsInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { ClinicsService } from "../clinics/clinics.service";

// Só os campos do relationshipType ativo ficam preenchidos — os das outras
// duas variantes são zerados explicitamente, pra trocar de tipo (ex.:
// RENTED_FIXED -> COMMISSION) limpar de verdade o que não se aplica mais em
// vez de deixar lixo de um estado anterior.
function toPersistedFields(input: UpsertClinicFinancialTermsInput) {
  const base = {
    relationshipType: input.relationshipType,
    ownerLabel: input.ownerLabel ?? null,
    rentValue: null as number | null,
    rentPeriodicity: null as RentPeriodicity | null,
    commissionPercentage: null as number | null,
    defaultServiceRate: null as number | null,
  };

  switch (input.relationshipType) {
    case "RENTED_FIXED":
      return { ...base, rentValue: input.rentValue, rentPeriodicity: input.rentPeriodicity };
    case "COMMISSION":
      return { ...base, commissionPercentage: input.commissionPercentage };
    case "PER_SERVICE":
      return { ...base, defaultServiceRate: input.defaultServiceRate };
  }
}

@Injectable()
export class ClinicFinancialTermsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly clinicsService: ClinicsService,
  ) {}

  // Sem termos definidos ainda é um estado válido (cadastro do consultório
  // não bloqueia por isso) — devolve null, não 404.
  findByClinic(clinicId: string) {
    return this.prisma.clinicFinancialTerms.findUnique({ where: { clinicId } });
  }

  async upsert(clinicId: string, input: UpsertClinicFinancialTermsInput) {
    const { organizationId } = getTenantContext();

    // Regra de negócio, não só escondida na UI: só tenant Freelancer tem
    // relação financeira própria com um consultório — ver vault
    // "Relação Financeira do Freelancer por Consultório — Plano Técnico".
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (organization?.type !== "FREELANCER") {
      throw new ForbiddenException(
        "Relação financeira por consultório só existe pra tenant tipo Freelancer.",
      );
    }

    // 404 se o consultório não existir ou não for deste tenant.
    await this.clinicsService.findOne(clinicId);

    const fields = toPersistedFields(input);
    return this.prisma.clinicFinancialTerms.upsert({
      where: { clinicId },
      create: { clinicId, organizationId, ...fields },
      update: fields,
    });
  }
}
