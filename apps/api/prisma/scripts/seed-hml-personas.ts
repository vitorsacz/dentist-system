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
  // Clinics Org A
  C_A1: "shhml_c_a1",
  C_A2: "shhml_c_a2",
  C_A3: "shhml_c_a3",
  // Clinic Org B
  C_B1: "shhml_c_b1",
  // Clinics Org F
  C_BRAGANCA: "shhml_c_braganca",
  C_ATIBAIA: "shhml_c_atibaia",
  // Patients Org A
  P_A_01: "shhml_p_a_01",
  P_A_02: "shhml_p_a_02",
  P_A_03: "shhml_p_a_03",
  P_A_04: "shhml_p_a_04",
  P_A_05: "shhml_p_a_05",
  P_A_06: "shhml_p_a_06",
  P_A_07: "shhml_p_a_07",
  P_A_08: "shhml_p_a_08",
  P_A_09: "shhml_p_a_09",
  P_A_10: "shhml_p_a_10",
  P_A_11: "shhml_p_a_11",
  P_A_12: "shhml_p_a_12",
  // Patients Org B
  P_B_01: "shhml_p_b_01",
  P_B_02: "shhml_p_b_02",
  P_B_03: "shhml_p_b_03",
  // Patients Org F
  P_F_01: "shhml_p_f_01",
  P_F_02: "shhml_p_f_02",
  P_F_03: "shhml_p_f_03",
  P_F_04: "shhml_p_f_04",
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

// 23:00 BRT = UTC-3 → 02:00 UTC do dia seguinte
function at23BRT(daysOffset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setUTCHours(2, 0, 0, 0);
  return d;
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
    upsertUser(IDS.U_ADMIN_A, IDS.ORG_A, "admin-a@hml.demo", "Ana Admin Demo A", ["ADMIN"], "BRAND"),
    upsertUser(IDS.U_DENT_A, IDS.ORG_A, "dentista-a@hml.demo", "Dr. Dentista Demo A", ["DENTIST"], "SUCCESS"),
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
      "INFO",
    ),
    upsertUser(
      IDS.U_DENT_RECEP,
      IDS.ORG_A,
      "dentista-recepcao@hml.demo",
      "Dentista+Recep Demo",
      ["DENTIST", "RECEPTIONIST"],
      "ERROR",
    ),
  ]);

  await prisma.organization.updateMany({
    where: { id: IDS.ORG_A, foundingAdminUserId: null },
    data: { foundingAdminUserId: adminA.id },
  });

  // 3 clinics for Org A (2 active with distinct colors, 1 inactive)
  await prisma.clinic.upsert({
    where: { id: IDS.C_A1 },
    create: {
      id: IDS.C_A1,
      organizationId: IDS.ORG_A,
      name: "Consultório A1",
      type: "OWN",
      colorToken: "BRAND",
      active: true,
    },
    update: {},
  });

  await prisma.clinic.upsert({
    where: { id: IDS.C_A2 },
    create: {
      id: IDS.C_A2,
      organizationId: IDS.ORG_A,
      name: "Consultório A2",
      type: "OWN",
      colorToken: "SUCCESS",
      active: true,
    },
    update: {},
  });

  await prisma.clinic.upsert({
    where: { id: IDS.C_A3 },
    create: {
      id: IDS.C_A3,
      organizationId: IDS.ORG_A,
      name: "Consultório A3 (inativo)",
      type: "RENTED",
      colorToken: "ERROR",
      active: false,
    },
    update: {},
  });

  // 12 patients for Org A (after reset, use create)
  await prisma.patient.create({
    data: {
      id: IDS.P_A_01,
      organizationId: IDS.ORG_A,
      name: "Paciente 01 Demo A",
      phone: "11900001001",
      active: true,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_02,
      organizationId: IDS.ORG_A,
      name: "Paciente 02 Demo A",
      phone: "11900002001",
      active: true,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_03,
      organizationId: IDS.ORG_A,
      name: "Paciente 03 Demo A",
      phone: "11900003001",
      active: true,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_04,
      organizationId: IDS.ORG_A,
      name: "Paciente 04 Demo A",
      phone: "11900004001",
      active: true,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  // PatientShare: p04 compartilhado com admin-dentista
  await prisma.patientShare.create({
    data: {
      patientId: IDS.P_A_04,
      dentistId: IDS.U_ADMIN_DENT,
      organizationId: IDS.ORG_A,
      sharedById: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_05,
      organizationId: IDS.ORG_A,
      name: "Paciente 05 Demo A",
      phone: "11900005001",
      active: true,
      ownerDentistId: IDS.U_ADMIN_DENT,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_06,
      organizationId: IDS.ORG_A,
      name: "Paciente 06 Demo A",
      phone: "11900006001",
      active: true,
      ownerDentistId: IDS.U_ADMIN_DENT,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_07,
      organizationId: IDS.ORG_A,
      name: "Paciente 07 Demo A",
      phone: "11900007001",
      active: true,
      ownerDentistId: IDS.U_ADMIN_DENT,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_08,
      organizationId: IDS.ORG_A,
      name: "Paciente 08 Demo A",
      phone: "11900008001",
      active: true,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_09,
      organizationId: IDS.ORG_A,
      name: "Paciente 09 Demo A",
      phone: "11900009001",
      active: true,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  // p10: sem dono (para testes de claim)
  await prisma.patient.create({
    data: {
      id: IDS.P_A_10,
      organizationId: IDS.ORG_A,
      name: "Paciente 10 Demo A (sem dono)",
      phone: "11900010001",
      active: true,
      ownerDentistId: null,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  // p11 e p12: inativos
  await prisma.patient.create({
    data: {
      id: IDS.P_A_11,
      organizationId: IDS.ORG_A,
      name: "Paciente 11 Demo A (inativo)",
      phone: "11900011001",
      active: false,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_A_12,
      organizationId: IDS.ORG_A,
      name: "Paciente 12 Demo A (inativo)",
      phone: "11900012001",
      active: false,
      ownerDentistId: IDS.U_DENT_A,
      createdByUserId: IDS.U_ADMIN_A,
    },
  });

  // Appointments Org A — espalhados por ±35 dias dentro da janela de 42 dias
  // Passado
  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p35",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_01,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-35, 10),
      endsAt: endOf(daysFromNow(-35, 10), 60),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p28",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_02,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-28, 9),
      endsAt: endOf(daysFromNow(-28, 9), 45),
      status: "DONE",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p30_inativo",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_03,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_B_INATIVO,
      startsAt: daysFromNow(-30, 14),
      endsAt: endOf(daysFromNow(-30, 14), 90),
      status: "DONE",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p21",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_03,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-21, 14),
      endsAt: endOf(daysFromNow(-21, 14), 30),
      status: "DONE",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p14",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_01,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-14, 11),
      endsAt: endOf(daysFromNow(-14, 11), 30),
      status: "NO_SHOW",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p7",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_02,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(-7, 15),
      endsAt: endOf(daysFromNow(-7, 15), 45),
      status: "CANCELED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p5_inativo",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_01,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_B_INATIVO,
      startsAt: daysFromNow(-5, 10),
      endsAt: endOf(daysFromNow(-5, 10), 60),
      status: "DONE",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_p3_admindent",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_05,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_ADMIN_DENT,
      startsAt: daysFromNow(-3, 10),
      endsAt: endOf(daysFromNow(-3, 10), 30),
      status: "SCHEDULED",
    },
  });

  // Futuro
  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_f3",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_01,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(3, 9),
      endsAt: endOf(daysFromNow(3, 9), 30),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_f7",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_02,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(7, 10),
      endsAt: endOf(daysFromNow(7, 10), 60),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_f14",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_03,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(14, 11),
      endsAt: endOf(daysFromNow(14, 11), 45),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_f21",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_04,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(21, 14),
      endsAt: endOf(daysFromNow(21, 14), 30),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_f28_admindent",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_05,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_ADMIN_DENT,
      startsAt: daysFromNow(28, 9),
      endsAt: endOf(daysFromNow(28, 9), 60),
      status: "SCHEDULED",
    },
  });

  // Par sobreposto intencional (mesmo dentista, dia +10, 10:00–11:00 e 10:30–11:30)
  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_overlap_a",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_01,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(10, 10),
      endsAt: endOf(daysFromNow(10, 10), 60),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_overlap_b",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_02,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(10, 10, 30),
      endsAt: endOf(daysFromNow(10, 10, 30), 60),
      status: "SCHEDULED",
    },
  });

  // Par que só encosta (fim_A == início_B, dia +12, 09:00–10:00 e 10:00–11:00)
  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_touch_a",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_03,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(12, 9),
      endsAt: endOf(daysFromNow(12, 9), 60),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_touch_b",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_04,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: daysFromNow(12, 10),
      endsAt: endOf(daysFromNow(12, 10), 60),
      status: "SCHEDULED",
    },
  });

  // Agendamento às 23:00 BRT (amanhã)
  const brtNightStart = at23BRT(1);
  await prisma.appointment.create({
    data: {
      id: "shhml_apt_a_brt_night",
      organizationId: IDS.ORG_A,
      patientId: IDS.P_A_05,
      clinicId: IDS.C_A1,
      dentistUserId: IDS.U_DENT_A,
      startsAt: brtNightStart,
      endsAt: endOf(brtNightStart, 30),
      status: "SCHEDULED",
    },
  });

  // ── Org B: Clínica Demo B ──────────────────────────────────────────────────
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
    where: { id: IDS.C_B1 },
    create: {
      id: IDS.C_B1,
      organizationId: IDS.ORG_B,
      name: "Consultório B1",
      type: "OWN",
      colorToken: "INFO",
      active: true,
    },
    update: {},
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_B_01,
      organizationId: IDS.ORG_B,
      name: "Paciente B1 Demo",
      phone: "11900101001",
      active: true,
      ownerDentistId: IDS.U_DENT_C,
      createdByUserId: IDS.U_ADMIN_B,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_B_02,
      organizationId: IDS.ORG_B,
      name: "Paciente B2 Demo",
      phone: "11900102001",
      active: true,
      ownerDentistId: IDS.U_DENT_C,
      createdByUserId: IDS.U_ADMIN_B,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_B_03,
      organizationId: IDS.ORG_B,
      name: "Paciente B3 Demo",
      phone: "11900103001",
      active: true,
      ownerDentistId: IDS.U_DENT_C,
      createdByUserId: IDS.U_ADMIN_B,
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_b_f5",
      organizationId: IDS.ORG_B,
      patientId: IDS.P_B_01,
      clinicId: IDS.C_B1,
      dentistUserId: IDS.U_DENT_C,
      startsAt: daysFromNow(5, 9),
      endsAt: endOf(daysFromNow(5, 9), 30),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_b_p10",
      organizationId: IDS.ORG_B,
      patientId: IDS.P_B_02,
      clinicId: IDS.C_B1,
      dentistUserId: IDS.U_DENT_C,
      startsAt: daysFromNow(-10, 14),
      endsAt: endOf(daysFromNow(-10, 14), 45),
      status: "DONE",
    },
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
      active: true,
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
      active: true,
    },
    update: {},
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_F_01,
      organizationId: IDS.ORG_F,
      name: "Paciente F1 Demo",
      phone: "11900201001",
      active: true,
      ownerDentistId: IDS.U_FREEL,
      createdByUserId: IDS.U_FREEL,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_F_02,
      organizationId: IDS.ORG_F,
      name: "Paciente F2 Demo",
      phone: "11900202001",
      active: true,
      ownerDentistId: IDS.U_FREEL,
      createdByUserId: IDS.U_FREEL,
    },
  });

  // p03 e p04: sem dono (para testes de claim em org FREELANCER)
  await prisma.patient.create({
    data: {
      id: IDS.P_F_03,
      organizationId: IDS.ORG_F,
      name: "Paciente F3 Demo (sem dono)",
      phone: "11900203001",
      active: true,
      ownerDentistId: null,
      createdByUserId: IDS.U_FREEL,
    },
  });

  await prisma.patient.create({
    data: {
      id: IDS.P_F_04,
      organizationId: IDS.ORG_F,
      name: "Paciente F4 Demo (sem dono)",
      phone: "11900204001",
      active: true,
      ownerDentistId: null,
      createdByUserId: IDS.U_FREEL,
    },
  });

  // Appointments Org F — em consultórios distintos
  await prisma.appointment.create({
    data: {
      id: "shhml_apt_f_brag_f4",
      organizationId: IDS.ORG_F,
      patientId: IDS.P_F_01,
      clinicId: IDS.C_BRAGANCA,
      dentistUserId: IDS.U_FREEL,
      startsAt: daysFromNow(4, 9),
      endsAt: endOf(daysFromNow(4, 9), 30),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_f_atibi_f8",
      organizationId: IDS.ORG_F,
      patientId: IDS.P_F_02,
      clinicId: IDS.C_ATIBAIA,
      dentistUserId: IDS.U_FREEL,
      startsAt: daysFromNow(8, 11),
      endsAt: endOf(daysFromNow(8, 11), 45),
      status: "SCHEDULED",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_f_brag_p5",
      organizationId: IDS.ORG_F,
      patientId: IDS.P_F_01,
      clinicId: IDS.C_BRAGANCA,
      dentistUserId: IDS.U_FREEL,
      startsAt: daysFromNow(-5, 10),
      endsAt: endOf(daysFromNow(-5, 10), 60),
      status: "DONE",
    },
  });

  await prisma.appointment.create({
    data: {
      id: "shhml_apt_f_atibi_p12",
      organizationId: IDS.ORG_F,
      patientId: IDS.P_F_02,
      clinicId: IDS.C_ATIBAIA,
      dentistUserId: IDS.U_FREEL,
      startsAt: daysFromNow(-12, 14),
      endsAt: endOf(daysFromNow(-12, 14), 30),
      status: "CANCELED",
    },
  });

  // ── Resumo ─────────────────────────────────────────────────────────────────
  const [orgCount, patientCount, appointmentCount, clinicCount] = await Promise.all([
    prisma.organization.count({ where: { name: { startsWith: PREFIX } } }),
    prisma.patient.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
    prisma.appointment.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
    prisma.clinic.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
  ]);

  const breakdown = await prisma.organization.findMany({
    where: { name: { startsWith: PREFIX } },
    select: {
      name: true,
      _count: {
        select: {
          users: true,
          clinics: true,
          patients: true,
          appointments: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  console.log(`\n✔ Seed HML concluído. Senha: variável SEED_HML_PASSWORD do environment.`);
  console.log(`\n📊 Resumo do seed HML:`);
  console.log(`  Orgs: ${orgCount}  Clínicas: ${clinicCount}  Pacientes: ${patientCount}  Agendamentos: ${appointmentCount}`);
  for (const org of breakdown) {
    console.log(
      `  ${org.name}: ${org._count.users} usuários, ${org._count.clinics} clínicas, ${org._count.patients} pacientes, ${org._count.appointments} agendamentos`,
    );
  }
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
