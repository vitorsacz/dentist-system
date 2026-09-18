import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ORG_NAME = "Consultório Padrão";

async function main() {
  const org = await prisma.organization.findFirst({ where: { name: DEFAULT_ORG_NAME } });
  if (!org) {
    throw new Error(
      `Organização padrão ("${DEFAULT_ORG_NAME}") não encontrada — rode backfill-default-org.ts primeiro.`,
    );
  }

  const where = { organizationId: null };
  const data = { organizationId: org.id };

  const results = await Promise.all([
    prisma.clinic.updateMany({ where, data }),
    prisma.patient.updateMany({ where, data }),
    prisma.anamnesis.updateMany({ where, data }),
    prisma.clinicalRecord.updateMany({ where, data }),
    prisma.toothRecord.updateMany({ where, data }),
    prisma.procedureCatalog.updateMany({ where, data }),
    prisma.budget.updateMany({ where, data }),
    prisma.budgetItem.updateMany({ where, data }),
    prisma.appointment.updateMany({ where, data }),
    prisma.attendance.updateMany({ where, data }),
    prisma.material.updateMany({ where, data }),
    prisma.materialBatch.updateMany({ where, data }),
    prisma.materialUsage.updateMany({ where, data }),
    prisma.recall.updateMany({ where, data }),
  ] as const);

  const names = [
    "Clinic", "Patient", "Anamnesis", "ClinicalRecord", "ToothRecord",
    "ProcedureCatalog", "Budget", "BudgetItem", "Appointment", "Attendance",
    "Material", "MaterialBatch", "MaterialUsage", "Recall",
  ];
  results.forEach((result, i) => console.log(`${names[i]}: ${result.count} linha(s) atualizadas`));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
