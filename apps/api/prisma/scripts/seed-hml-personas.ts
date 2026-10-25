import { PrismaClient, type PaletteColorToken, type Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const PREFIX = "[SEED-HML]";

// Exportada para testes unitários — sem side effects.
export function validateNeonHost(varName: string, urlOverride?: string): void {
  const raw = urlOverride ?? process.env[varName];
  if (!raw) throw new Error(`${varName} não está definida`);
  let hostname: string;
  try {
    hostname = new URL(raw).hostname;
  } catch {
    throw new Error(`${varName} não é uma URL válida`);
  }
  if (!hostname.endsWith("neon.tech")) {
    throw new Error(
      `${varName} deve apontar para um host neon.tech (recebido: ${hostname}). ` +
        "Recusando — nunca rodar seed HML contra Supabase ou banco local.",
    );
  }
}

// IDs determinísticos — re-executar o seed não duplica dados.
const IDS = {
  ORG_A: "shhml_org_clinica_a",
  ORG_B: "shhml_org_clinica_b",
  ORG_F: "shhml_org_freelancer",
  U_ADMIN_A: "shhml_u_admin_a",
  U_DENT_A: "shhml_u_dent_a",
  U_DENT_B_INATIVO: "shhml_u_dent_b_inativo",
  U_RECEP_A: "shhml_u_recep_a",
  U_ADMIN_DENT: "shhml_u_admin_dent",
  U_DENT_RECEP: "shhml_u_dent_recep",
  U_ADMIN_B: "shhml_u_admin_b",
  U_DENT_C: "shhml_u_dent_c",
  U_FREEL: "shhml_u_freelancer",
  C_DEMO_A: "shhml_c_demo_a",
  C_DEMO_B: "shhml_c_demo_b",
  C_BRAGANCA: "shhml_c_braganca",
  C_ATIBAIA: "shhml_c_atibaia",
  P_ATIVO_A: "shhml_p_ativo_a",
  P_INATIVO_A: "shhml_p_inativo_a",
  P_DEMO_B: "shhml_p_demo_b",
  P_FREEL: "shhml_p_freelancer",
  APT_SCHEDULED: "shhml_apt_scheduled",
  APT_DONE: "shhml_apt_done",
  APT_CANCELED: "shhml_apt_canceled",
  APT_NOSHOW: "shhml_apt_noshow",
  APT_HIST: "shhml_apt_hist_inativo",
} as const;

function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function endOf(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60 * 1000);
}

async function assertGuards(prisma: PrismaClient): Promise<void> {
  const appEnv = process.env.APP_ENV;
  if (appEnv !== "hml") {
    throw new Error(`APP_ENV deve ser "hml", mas é "${appEnv ?? "(não definido)"}"`);
  }

  const password = process.env.SEED_HML_PASSWORD;
  if (!password) {
    throw new Error("SEED_HML_PASSWORD não está definida. Configure no GitHub Environment hml.");
  }
  if (password.length < 12) {
    throw new Error("SEED_HML_PASSWORD deve ter no mínimo 12 caracteres.");
  }

  validateNeonHost("DATABASE_URL");
  validateNeonHost("DIRECT_URL");

  const nonSeedOrgs = await prisma.organization.findMany({
    where: { name: { not: { startsWith: PREFIX } } },
    select: { id: true, name: true },
  });
  if (nonSeedOrgs.length > 0) {
    const names = nonSeedOrgs.map((o) => `"${o.name}"`).join(", ");
    throw new Error(
      `Aborting: ${nonSeedOrgs.length} organização(ões) sem prefixo ${PREFIX}: ${names}. ` +
        "Verifique DATABASE_URL — este banco não é um banco HML limpo.",
    );
  }
}

// Deleta todos os dados das orgs [SEED-HML] na ordem correta para FKs RESTRICT.
export async function resetHmlSeed(prisma: PrismaClient): Promise<void> {
  const orgs = await prisma.organization.findMany({
    where: { name: { startsWith: PREFIX } },
    select: { id: true },
  });
  const orgIds = orgs.map((o) => o.id);
  if (orgIds.length === 0) return;

  // Ordem: mais dependente primeiro (FK RESTRICT em patientId e organizationId).
  await prisma.materialUsage.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.attendance.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.appointment.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.budgetItem.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.budget.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.patientShare.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.patientRevision.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.clinicalRecord.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.anamnesis.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.toothRecord.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.recall.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.patient.deleteMany({ where: { organizationId: { in: orgIds } } });
  // deleteMany na org faz CASCADE em: User → RefreshSession, Clinic → ClinicFinancialTerms,
  // ProcedureCatalog, Material → MaterialBatch.
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
}

export async function seedHmlPersonas(prisma: PrismaClient): Promise<void> {
  await assertGuards(prisma);
  await resetHmlSeed(prisma);

  const password = process.env.SEED_HML_PASSWORD!;
  const passwordHash = await bcrypt.hash(password, 10);

  function upsertUser(
    id: string,
    orgId: string,
    email: string,
    name: string,
    roles: Role[],
    colorToken?: PaletteColorToken,
    active = true,
  ) {
    return prisma.user.upsert({
      where: { id },
      create: { id, organizationId: orgId, email, passwordHash, name, roles, colorToken, active },
      update: {},
    });
  }

  // ── Org A: Clínica Demo A ──────────────────────────────────────────────────
  await prisma.organization.upsert({
    where: { id: IDS.ORG_A },
    create: { id: IDS.ORG_A, name: `${PREFIX} Clínica Demo A`, type: "CLINIC" },
    update: {},
  });

  const [adminA] = await Promise.all([
    upsertUser(IDS.U_ADMIN_A, IDS.ORG_A, "admin-a@hml.demo", "Admin Demo A", ["ADMIN"], "BRAND"),
    upsertUser(IDS.U_DENT_A, IDS.ORG_A, "dentista-a@hml.demo", "Dr. Dentista Demo A", ["DENTIST"], "BRAND"),
    upsertUser(
      IDS.U_DENT_B_INATIVO,
      IDS.ORG_A,
      "dentista-b-inativo@hml.demo",
      "Dra. Dentista B (Inativa)",
      ["DENTIST"],
      "WARNING",
      false,
    ),
    upsertUser(IDS.U_RECEP_A, IDS.ORG_A, "recepcao-a@hml.demo", "Recepcionista Demo A", ["RECEPTIONIST"]),
    upsertUser(
      IDS.U_ADMIN_DENT,
      IDS.ORG_A,
      "admin-dentista@hml.demo",
      "Admin+Dentista Demo",
      ["ADMIN", "DENTIST"],
      "SUCCESS",
    ),
    upsertUser(
      IDS.U_DENT_RECEP,
      IDS.ORG_A,
      "dentista-recepcao@hml.demo",
      "Dentista+Recep Demo",
      ["DENTIST", "RECEPTIONIST"],
      "INFO",
    ),
  ]);

  await prisma.organization.updateMany({
    where: { id: IDS.ORG_A, foundingAdminUserId: null },
    data: { foundingAdminUserId: adminA.id },
  });

  await prisma.clinic.upsert({
    where: { id: IDS.C_DEMO_A },
    create: {
      id: IDS.C_DEMO_A,
      organizationId: IDS.ORG_A,
      name: "Consultório Demo A",
      type: "OWN",
      colorToken: "BRAND",
    },
    update: {},
  });

  await prisma.patient.upsert({
    where: { id: IDS.P_ATIVO_A },
    create: {
      id: IDS.P_ATIVO_A,
      organizationId: IDS.ORG_A,
      name: "Paciente Ativo Demo",
      phone: "11999990001",
      active: true,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
    update: {},
  });

  await prisma.patient.upsert({
    where: { id: IDS.P_INATIVO_A },
    create: {
      id: IDS.P_INATIVO_A,
      organizationId: IDS.ORG_A,
      name: "Paciente Inativo Demo",
      phone: "11999990002",
      active: false,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
    update: {},
  });

  await prisma.appointment.upsert({
    where: { id: IDS.APT_SCHEDULED },
    create: {
      id: IDS.APT_SCHEDULED,
      organizationId: IDS.ORG_A,
      patientId: IDS.P_ATIVO_A,
      clinicId: IDS.C_DEMO_A,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(2, 9),
      endsAt: endOf(daysFromNow(2, 9), 30),
      status: "SCHEDULED",
    },
    update: {},
  });

  await prisma.appointment.upsert({
    where: { id: IDS.APT_DONE },
    create: {
      id: IDS.APT_DONE,
      organizationId: IDS.ORG_A,
      patientId: IDS.P_ATIVO_A,
      clinicId: IDS.C_DEMO_A,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-7, 10),
      endsAt: endOf(daysFromNow(-7, 10), 30),
      status: "DONE",
    },
    update: {},
  });

  await prisma.appointment.upsert({
    where: { id: IDS.APT_CANCELED },
    create: {
      id: IDS.APT_CANCELED,
      organizationId: IDS.ORG_A,
      patientId: IDS.P_ATIVO_A,
      clinicId: IDS.C_DEMO_A,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-3, 14),
      endsAt: endOf(daysFromNow(-3, 14), 45),
      status: "CANCELED",
    },
    update: {},
  });

  await prisma.appointment.upsert({
    where: { id: IDS.APT_NOSHOW },
    create: {
      id: IDS.APT_NOSHOW,
      organizationId: IDS.ORG_A,
      patientId: IDS.P_ATIVO_A,
      clinicId: IDS.C_DEMO_A,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-1, 11),
      endsAt: endOf(daysFromNow(-1, 11), 30),
      status: "NO_SHOW",
    },
    update: {},
  });

  // Agendamento histórico com dentista inativo — testa leitura de histórico.
  await prisma.appointment.upsert({
    where: { id: IDS.APT_HIST },
    create: {
      id: IDS.APT_HIST,
      organizationId: IDS.ORG_A,
      patientId: IDS.P_ATIVO_A,
      clinicId: IDS.C_DEMO_A,
      dentistUserId: IDS.U_DENT_B_INATIVO,
      startsAt: daysFromNow(-14, 15),
      endsAt: endOf(daysFromNow(-14, 15), 60),
      status: "DONE",
    },
    update: {},
  });

  // ── Org B: Clínica Demo B (isolamento cross-org) ───────────────────────────
  await prisma.organization.upsert({
    where: { id: IDS.ORG_B },
    create: { id: IDS.ORG_B, name: `${PREFIX} Clínica Demo B`, type: "CLINIC" },
    update: {},
  });

  const [adminB] = await Promise.all([
    upsertUser(IDS.U_ADMIN_B, IDS.ORG_B, "admin-b@hml.demo", "Admin Demo B", ["ADMIN"], "SUCCESS"),
    upsertUser(IDS.U_DENT_C, IDS.ORG_B, "dentista-c@hml.demo", "Dr. Dentista Demo C", ["DENTIST"], "INFO"),
  ]);

  await prisma.organization.updateMany({
    where: { id: IDS.ORG_B, foundingAdminUserId: null },
    data: { foundingAdminUserId: adminB.id },
  });

  await prisma.clinic.upsert({
    where: { id: IDS.C_DEMO_B },
    create: {
      id: IDS.C_DEMO_B,
      organizationId: IDS.ORG_B,
      name: "Consultório Demo B",
      type: "OWN",
      colorToken: "INFO",
    },
    update: {},
  });

  await prisma.patient.upsert({
    where: { id: IDS.P_DEMO_B },
    create: {
      id: IDS.P_DEMO_B,
      organizationId: IDS.ORG_B,
      name: "Paciente Demo B (isolamento)",
      phone: "11999990003",
      active: true,
      ownerDentistId: IDS.U_DENT_C,
      createdByUserId: IDS.U_ADMIN_B,
    },
    update: {},
  });

  // ── Org F: Freelancer Demo ─────────────────────────────────────────────────
  await prisma.organization.upsert({
    where: { id: IDS.ORG_F },
    create: { id: IDS.ORG_F, name: `${PREFIX} Freelancer Demo`, type: "FREELANCER" },
    update: {},
  });

  const freel = await upsertUser(
    IDS.U_FREEL,
    IDS.ORG_F,
    "freelancer@hml.demo",
    "Dra. Freelancer Demo",
    ["ADMIN", "DENTIST"],
    "SUCCESS",
  );

  await prisma.organization.updateMany({
    where: { id: IDS.ORG_F, foundingAdminUserId: null },
    data: { foundingAdminUserId: freel.id },
  });

  await prisma.clinic.upsert({
    where: { id: IDS.C_BRAGANCA },
    create: {
      id: IDS.C_BRAGANCA,
      organizationId: IDS.ORG_F,
      name: "Consultório Bragança Demo",
      type: "OWN",
      colorToken: "BRAND",
    },
    update: {},
  });

  await prisma.clinic.upsert({
    where: { id: IDS.C_ATIBAIA },
    create: {
      id: IDS.C_ATIBAIA,
      organizationId: IDS.ORG_F,
      name: "Consultório Atibaia Demo",
      type: "RENTED",
      dailyRentValue: 150,
      colorToken: "WARNING",
    },
    update: {},
  });

  await prisma.patient.upsert({
    where: { id: IDS.P_FREEL },
    create: {
      id: IDS.P_FREEL,
      organizationId: IDS.ORG_F,
      name: "Paciente Freelancer Demo",
      phone: "11999990004",
      active: true,
      ownerDentistId: IDS.U_FREEL,
      createdByUserId: IDS.U_FREEL,
    },
    update: {},
  });

  console.log(`\n✔ Seed HML concluído (${PREFIX}). Senha: variável SEED_HML_PASSWORD do environment.`);
  console.log(`  Org A — Clínica Demo A:`);
  console.log(`    ADMIN:               admin-a@hml.demo`);
  console.log(`    DENTIST A:           dentista-a@hml.demo`);
  console.log(`    DENTIST B (inativo): dentista-b-inativo@hml.demo`);
  console.log(`    RECEPTIONIST:        recepcao-a@hml.demo`);
  console.log(`    ADMIN+DENTIST:       admin-dentista@hml.demo`);
  console.log(`    DENTIST+RECEP:       dentista-recepcao@hml.demo`);
  console.log(`  Org B — Clínica Demo B:`);
  console.log(`    ADMIN:               admin-b@hml.demo`);
  console.log(`    DENTIST:             dentista-c@hml.demo`);
  console.log(`  Org F — Freelancer Demo:`);
  console.log(`    ADMIN+DENTIST:       freelancer@hml.demo`);
}

// Permite rodar diretamente: tsx seed-hml-personas.ts
if (require.main === module || process.argv[1]?.endsWith("seed-hml-personas.ts")) {
  const prisma = new PrismaClient();
  seedHmlPersonas(prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
