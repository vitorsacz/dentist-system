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
  // Extra patients Org A (13–24)
  P_A_13: "shhml_p_a_13", P_A_14: "shhml_p_a_14", P_A_15: "shhml_p_a_15",
  P_A_16: "shhml_p_a_16", P_A_17: "shhml_p_a_17", P_A_18: "shhml_p_a_18",
  P_A_19: "shhml_p_a_19", P_A_20: "shhml_p_a_20", P_A_21: "shhml_p_a_21",
  P_A_22: "shhml_p_a_22", P_A_23: "shhml_p_a_23", P_A_24: "shhml_p_a_24",
  // Extra patients Org F (05–12)
  P_F_05: "shhml_p_f_05", P_F_06: "shhml_p_f_06", P_F_07: "shhml_p_f_07",
  P_F_08: "shhml_p_f_08", P_F_09: "shhml_p_f_09", P_F_10: "shhml_p_f_10",
  P_F_11: "shhml_p_f_11", P_F_12: "shhml_p_f_12",
  // Procedures Org A
  PROC_A_01: "shhml_proc_a_01", PROC_A_02: "shhml_proc_a_02", PROC_A_03: "shhml_proc_a_03",
  PROC_A_04: "shhml_proc_a_04", PROC_A_05: "shhml_proc_a_05", PROC_A_06: "shhml_proc_a_06",
  PROC_A_07: "shhml_proc_a_07", PROC_A_08: "shhml_proc_a_08", PROC_A_09: "shhml_proc_a_09",
  PROC_A_10: "shhml_proc_a_10",
  // Procedures Org F
  PROC_F_01: "shhml_proc_f_01", PROC_F_02: "shhml_proc_f_02", PROC_F_03: "shhml_proc_f_03",
  PROC_F_04: "shhml_proc_f_04", PROC_F_05: "shhml_proc_f_05", PROC_F_06: "shhml_proc_f_06",
  PROC_F_07: "shhml_proc_f_07", PROC_F_08: "shhml_proc_f_08", PROC_F_09: "shhml_proc_f_09",
  PROC_F_10: "shhml_proc_f_10",
  // Materials Org A
  MAT_A_01: "shhml_mat_a_01", MAT_A_02: "shhml_mat_a_02", MAT_A_03: "shhml_mat_a_03",
  MAT_A_04: "shhml_mat_a_04", MAT_A_05: "shhml_mat_a_05", MAT_A_06: "shhml_mat_a_06",
  MAT_A_07: "shhml_mat_a_07", MAT_A_08: "shhml_mat_a_08", MAT_A_09: "shhml_mat_a_09",
  MAT_A_10: "shhml_mat_a_10",
  // Materials Org F
  MAT_F_01: "shhml_mat_f_01", MAT_F_02: "shhml_mat_f_02", MAT_F_03: "shhml_mat_f_03",
  MAT_F_04: "shhml_mat_f_04", MAT_F_05: "shhml_mat_f_05",
  // Attendances Org A
  ATT_A_01: "shhml_att_a_01", ATT_A_02: "shhml_att_a_02", ATT_A_03: "shhml_att_a_03",
  ATT_A_04: "shhml_att_a_04", ATT_A_05: "shhml_att_a_05", ATT_A_06: "shhml_att_a_06",
  ATT_A_07: "shhml_att_a_07", ATT_A_08: "shhml_att_a_08", ATT_A_09: "shhml_att_a_09",
  ATT_A_10: "shhml_att_a_10",
  // Attendances Org F
  ATT_F_01: "shhml_att_f_01", ATT_F_02: "shhml_att_f_02", ATT_F_03: "shhml_att_f_03",
  ATT_F_04: "shhml_att_f_04", ATT_F_05: "shhml_att_f_05",
  // ClinicFinancialTerms Org F
  CFT_BRAGANCA: "shhml_cft_braganca",
  CFT_ATIBAIA: "shhml_cft_atibaia",
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

  await seedHmlAgendaExtras(prisma);

  // ── Resumo ─────────────────────────────────────────────────────────────────
  const [orgCount, patientCount, appointmentCount, clinicCount, procedureCount, materialCount, attendanceCount] =
    await Promise.all([
      prisma.organization.count({ where: { name: { startsWith: PREFIX } } }),
      prisma.patient.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
      prisma.appointment.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
      prisma.clinic.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
      prisma.procedureCatalog.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
      prisma.material.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
      prisma.attendance.count({ where: { organizationId: { in: [IDS.ORG_A, IDS.ORG_B, IDS.ORG_F] } } }),
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
  console.log(
    `  Orgs: ${orgCount}  Clínicas: ${clinicCount}  Pacientes: ${patientCount}  Agendamentos: ${appointmentCount}`,
  );
  console.log(
    `  Procedimentos: ${procedureCount}  Materiais: ${materialCount}  Atendimentos: ${attendanceCount}`,
  );
  for (const org of breakdown) {
    console.log(
      `  ${org.name}: ${org._count.users} usuários, ${org._count.clinics} clínicas, ${org._count.patients} pacientes, ${org._count.appointments} agendamentos`,
    );
  }
}

async function seedHmlAgendaExtras(prisma: PrismaClient): Promise<void> {
  // ── Pacientes novos Org A (13–24) com anamnese ─────────────────────────────
  await Promise.all([
    prisma.patient.create({
      data: {
        id: IDS.P_A_13, organizationId: IDS.ORG_A, name: "Beatriz Carvalho",
        phone: "11901300001", active: true,
        ownerDentistId: IDS.U_DENT_A, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, chiefComplaint: "Dor ao mastigar" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_14, organizationId: IDS.ORG_A, name: "Carlos Medeiros",
        phone: "11901400001", active: true,
        ownerDentistId: IDS.U_DENT_A, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, healthConditions: "Hipertensão, tabagista", medications: "Losartana 50 mg" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_15, organizationId: IDS.ORG_A, name: "Daniela Ferreira",
        phone: "11901500001", active: true,
        ownerDentistId: IDS.U_DENT_A, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, allergies: "Penicilina", chiefComplaint: "Consulta de rotina" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_16, organizationId: IDS.ORG_A, name: "Eduardo Nunes",
        phone: "11901600001", active: true,
        ownerDentistId: IDS.U_ADMIN_DENT, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, healthConditions: "Diabetes tipo 2, hipertensão", medications: "Metformina, Enalapril" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_17, organizationId: IDS.ORG_A, name: "Fernanda Lima",
        phone: "11901700001", active: true,
        ownerDentistId: IDS.U_DENT_A, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, chiefComplaint: "Limpeza semestral" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_18, organizationId: IDS.ORG_A, name: "Gabriel Ramos",
        phone: "11901800001", active: true,
        ownerDentistId: IDS.U_ADMIN_DENT, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, allergies: "Dipirona", chiefComplaint: "Dor de dente" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_19, organizationId: IDS.ORG_A, name: "Helena Costa",
        phone: "11901900001", active: true,
        ownerDentistId: IDS.U_DENT_A, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, healthConditions: "Cardiopatia", medications: "AAS 100 mg, Atenolol" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_20, organizationId: IDS.ORG_A, name: "Igor Martins",
        phone: "11902000001", active: true,
        ownerDentistId: IDS.U_ADMIN_DENT, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, chiefComplaint: "Clareamento" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_21, organizationId: IDS.ORG_A, name: "Juliana Alves",
        phone: "11902100001", active: true,
        ownerDentistId: IDS.U_DENT_A, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, healthConditions: "Gestante (2º trimestre)", chiefComplaint: "Gengivite gestacional" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_22, organizationId: IDS.ORG_A, name: "Kevin Santos",
        phone: "11902200001", active: true,
        ownerDentistId: IDS.U_ADMIN_DENT, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, healthConditions: "Diabetes tipo 1", medications: "Insulina glargina" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_23, organizationId: IDS.ORG_A, name: "Laura Oliveira",
        phone: "11902300001", active: true,
        ownerDentistId: IDS.U_DENT_A, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, allergies: "Amoxicilina, sulfonamidas", chiefComplaint: "Restauração" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_A_24, organizationId: IDS.ORG_A, name: "Marco Souza",
        phone: "11902400001", active: true,
        ownerDentistId: IDS.U_ADMIN_DENT, createdByUserId: IDS.U_ADMIN_A,
        anamnesis: { create: { organizationId: IDS.ORG_A, healthConditions: "Portador de marcapasso", medications: "Varfarina 5 mg" } },
      },
    }),
  ]);

  // ── Pacientes novos Org F (05–12) com anamnese ────────────────────────────
  await Promise.all([
    prisma.patient.create({
      data: {
        id: IDS.P_F_05, organizationId: IDS.ORG_F, name: "Natalia Pereira",
        phone: "11902500001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, allergies: "Látex", chiefComplaint: "Canal" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_F_06, organizationId: IDS.ORG_F, name: "Otávio Rodrigues",
        phone: "11902600001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, chiefComplaint: "Consulta inicial" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_F_07, organizationId: IDS.ORG_F, name: "Patricia Gomes",
        phone: "11902700001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, chiefComplaint: "Restauração" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_F_08, organizationId: IDS.ORG_F, name: "Ricardo Barbosa",
        phone: "11902800001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, healthConditions: "Hipertensão", medications: "Hidroclorotiazida 25 mg" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_F_09, organizationId: IDS.ORG_F, name: "Sandra Melo",
        phone: "11902900001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, healthConditions: "Portadora de marcapasso", chiefComplaint: "Limpeza" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_F_10, organizationId: IDS.ORG_F, name: "Thiago Dias",
        phone: "11903000001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, healthConditions: "Tabagista (20 cigarros/dia)", chiefComplaint: "Manchas nos dentes" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_F_11, organizationId: IDS.ORG_F, name: "Ursula Cardoso",
        phone: "11903100001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, chiefComplaint: "Dor aguda" } },
      },
    }),
    prisma.patient.create({
      data: {
        id: IDS.P_F_12, organizationId: IDS.ORG_F, name: "Victor Freitas",
        phone: "11903200001", active: true,
        ownerDentistId: IDS.U_FREEL, createdByUserId: IDS.U_FREEL,
        anamnesis: { create: { organizationId: IDS.ORG_F, medications: "Varfarina 5 mg", chiefComplaint: "Extração" } },
      },
    }),
  ]);

  // ── Procedimentos Org A (10) ───────────────────────────────────────────────
  await prisma.procedureCatalog.createMany({
    data: [
      { id: IDS.PROC_A_01, name: "Consulta inicial", defaultValue: 150, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_02, name: "Restauração composta (1 face)", defaultValue: 180, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_03, name: "Restauração composta (2 faces)", defaultValue: 250, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_04, name: "Extração simples", defaultValue: 200, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_05, name: "Limpeza (profilaxia)", defaultValue: 120, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_06, name: "Canal (dente anterior)", defaultValue: 600, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_07, name: "Canal (dente posterior)", defaultValue: 850, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_08, name: "Clareamento (sessão)", defaultValue: 300, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_09, name: "Prótese parcial removível", defaultValue: 2500, active: true, organizationId: IDS.ORG_A },
      { id: IDS.PROC_A_10, name: "Implante (consulta)", defaultValue: 400, active: true, organizationId: IDS.ORG_A },
    ],
  });

  // ── Procedimentos Org F (10) ───────────────────────────────────────────────
  await prisma.procedureCatalog.createMany({
    data: [
      { id: IDS.PROC_F_01, name: "Avaliação clínica", defaultValue: 100, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_02, name: "Restauração resina (1 face)", defaultValue: 200, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_03, name: "Restauração resina (2 faces)", defaultValue: 280, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_04, name: "Extração dentária", defaultValue: 220, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_05, name: "Profilaxia + aplicação de flúor", defaultValue: 130, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_06, name: "Tratamento de canal", defaultValue: 700, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_07, name: "Clareamento (sessão)", defaultValue: 320, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_08, name: "Placa de bruxismo", defaultValue: 450, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_09, name: "Ortodontia (manutenção)", defaultValue: 200, active: true, organizationId: IDS.ORG_F },
      { id: IDS.PROC_F_10, name: "Consulta de urgência", defaultValue: 180, active: true, organizationId: IDS.ORG_F },
    ],
  });

  // ── Termos financeiros Org F ──────────────────────────────────────────────
  await prisma.clinicFinancialTerms.create({
    data: {
      id: IDS.CFT_BRAGANCA,
      clinicId: IDS.C_BRAGANCA,
      organizationId: IDS.ORG_F,
      relationshipType: "COMMISSION",
      commissionPercentage: 30,
      ownerLabel: "Clínica parceira Bragança Demo",
    },
  });
  await prisma.clinicFinancialTerms.create({
    data: {
      id: IDS.CFT_ATIBAIA,
      clinicId: IDS.C_ATIBAIA,
      organizationId: IDS.ORG_F,
      relationshipType: "RENTED_FIXED",
      rentValue: 500,
      rentPeriodicity: "MONTHLY",
      ownerLabel: "Proprietário Atibaia Demo",
    },
  });

  // ── Materiais Org A (10) com lotes ──────────────────────────────────────────
  // ⚠ MAT_A_02: qty 8 < min 10 + expira em +15 d
  // ⚠ MAT_A_03: qty 30 < min 50
  // ⚠ MAT_A_06: qty 50 < min 100 + expira em +20 d
  // ⚠ MAT_A_08: expira em +25 d (qty ok)
  await Promise.all([
    prisma.material.create({
      data: {
        id: IDS.MAT_A_01, name: "Resina composta A2", unit: "un",
        minimumStock: 5, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 20, organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_02, name: "Anestésico lidocaína 2%", unit: "ampola",
        minimumStock: 10, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 8, expiryDate: daysFromNow(15), organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_03, name: "Luvas de látex P", unit: "cx",
        minimumStock: 50, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 30, organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_04, name: "Papel articular azul", unit: "cx",
        minimumStock: 2, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 5, organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_05, name: "Dique de borracha", unit: "cx",
        minimumStock: 2, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 4, organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_06, name: "Fio retrator #1", unit: "un",
        minimumStock: 100, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 50, expiryDate: daysFromNow(20), organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_07, name: "Eugenol", unit: "ml",
        minimumStock: 20, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 50, organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_08, name: "Gel de flúor", unit: "un",
        minimumStock: 5, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 25, expiryDate: daysFromNow(25), organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_09, name: "Broca diamantada 1012", unit: "un",
        minimumStock: 10, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 15, organizationId: IDS.ORG_A }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_A_10, name: "Luvas de vinil M", unit: "cx",
        minimumStock: 10, organizationId: IDS.ORG_A,
        batches: { create: [{ quantity: 20, organizationId: IDS.ORG_A }] },
      },
    }),
  ]);

  // ── Materiais Org F (5) com lotes ────────────────────────────────────────
  // ⚠ MAT_F_01: qty 2 < min 5 + expira em +7 d
  // ⚠ MAT_F_02: qty 12 < min 15
  await Promise.all([
    prisma.material.create({
      data: {
        id: IDS.MAT_F_01, name: "Resina B1", unit: "un",
        minimumStock: 5, organizationId: IDS.ORG_F,
        batches: { create: [{ quantity: 2, expiryDate: daysFromNow(7), organizationId: IDS.ORG_F }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_F_02, name: "Articaína 4% (carpule)", unit: "caixa",
        minimumStock: 15, organizationId: IDS.ORG_F,
        batches: { create: [{ quantity: 12, organizationId: IDS.ORG_F }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_F_03, name: "Luvas procedimento M", unit: "cx",
        minimumStock: 3, organizationId: IDS.ORG_F,
        batches: { create: [{ quantity: 10, organizationId: IDS.ORG_F }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_F_04, name: "Ácido fosfórico 37%", unit: "ml",
        minimumStock: 20, organizationId: IDS.ORG_F,
        batches: { create: [{ quantity: 50, organizationId: IDS.ORG_F }] },
      },
    }),
    prisma.material.create({
      data: {
        id: IDS.MAT_F_05, name: "Verniz fluoretado", unit: "un",
        minimumStock: 5, organizationId: IDS.ORG_F,
        batches: { create: [{ quantity: 8, organizationId: IDS.ORG_F }] },
      },
    }),
  ]);

  // ── Agendamentos Org A (20) dias +1..+14 ───────────────────────────────────
  await prisma.appointment.createMany({
    data: [
      { id: "shhml_apt_ae_a_01", organizationId: IDS.ORG_A, patientId: IDS.P_A_13, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(1, 8), endsAt: endOf(daysFromNow(1, 8), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_02", organizationId: IDS.ORG_A, patientId: IDS.P_A_14, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(1, 14), endsAt: endOf(daysFromNow(1, 14), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_03", organizationId: IDS.ORG_A, patientId: IDS.P_A_15, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(2, 9), endsAt: endOf(daysFromNow(2, 9), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_04", organizationId: IDS.ORG_A, patientId: IDS.P_A_16, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(2, 15), endsAt: endOf(daysFromNow(2, 15), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_05", organizationId: IDS.ORG_A, patientId: IDS.P_A_17, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(3, 8, 30), endsAt: endOf(daysFromNow(3, 8, 30), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_06", organizationId: IDS.ORG_A, patientId: IDS.P_A_18, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(3, 11), endsAt: endOf(daysFromNow(3, 11), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_07", organizationId: IDS.ORG_A, patientId: IDS.P_A_19, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(4, 9), endsAt: endOf(daysFromNow(4, 9), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_08", organizationId: IDS.ORG_A, patientId: IDS.P_A_20, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(4, 14), endsAt: endOf(daysFromNow(4, 14), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_09", organizationId: IDS.ORG_A, patientId: IDS.P_A_21, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(5, 10), endsAt: endOf(daysFromNow(5, 10), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_10", organizationId: IDS.ORG_A, patientId: IDS.P_A_22, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(6, 9), endsAt: endOf(daysFromNow(6, 9), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_11", organizationId: IDS.ORG_A, patientId: IDS.P_A_23, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(6, 14), endsAt: endOf(daysFromNow(6, 14), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_12", organizationId: IDS.ORG_A, patientId: IDS.P_A_24, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(7, 8), endsAt: endOf(daysFromNow(7, 8), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_13", organizationId: IDS.ORG_A, patientId: IDS.P_A_13, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(8, 9), endsAt: endOf(daysFromNow(8, 9), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_14", organizationId: IDS.ORG_A, patientId: IDS.P_A_14, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(8, 14), endsAt: endOf(daysFromNow(8, 14), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_15", organizationId: IDS.ORG_A, patientId: IDS.P_A_15, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(9, 10), endsAt: endOf(daysFromNow(9, 10), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_16", organizationId: IDS.ORG_A, patientId: IDS.P_A_16, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(9, 15), endsAt: endOf(daysFromNow(9, 15), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_17", organizationId: IDS.ORG_A, patientId: IDS.P_A_17, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(11, 9), endsAt: endOf(daysFromNow(11, 9), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_18", organizationId: IDS.ORG_A, patientId: IDS.P_A_18, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(11, 14), endsAt: endOf(daysFromNow(11, 14), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_19", organizationId: IDS.ORG_A, patientId: IDS.P_A_19, clinicId: IDS.C_A1, dentistUserId: IDS.U_DENT_A, startsAt: daysFromNow(13, 8), endsAt: endOf(daysFromNow(13, 8), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_a_20", organizationId: IDS.ORG_A, patientId: IDS.P_A_20, clinicId: IDS.C_A2, dentistUserId: IDS.U_ADMIN_DENT, startsAt: daysFromNow(13, 11), endsAt: endOf(daysFromNow(13, 11), 60), status: "SCHEDULED" },
    ],
  });

  // ── Agendamentos Org F (10) dias +1..+14 ───────────────────────────────────
  await prisma.appointment.createMany({
    data: [
      { id: "shhml_apt_ae_f_01", organizationId: IDS.ORG_F, patientId: IDS.P_F_05, clinicId: IDS.C_BRAGANCA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(1, 9), endsAt: endOf(daysFromNow(1, 9), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_02", organizationId: IDS.ORG_F, patientId: IDS.P_F_06, clinicId: IDS.C_ATIBAIA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(2, 10), endsAt: endOf(daysFromNow(2, 10), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_03", organizationId: IDS.ORG_F, patientId: IDS.P_F_07, clinicId: IDS.C_BRAGANCA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(3, 9), endsAt: endOf(daysFromNow(3, 9), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_04", organizationId: IDS.ORG_F, patientId: IDS.P_F_08, clinicId: IDS.C_ATIBAIA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(5, 10), endsAt: endOf(daysFromNow(5, 10), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_05", organizationId: IDS.ORG_F, patientId: IDS.P_F_09, clinicId: IDS.C_BRAGANCA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(6, 9), endsAt: endOf(daysFromNow(6, 9), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_06", organizationId: IDS.ORG_F, patientId: IDS.P_F_10, clinicId: IDS.C_ATIBAIA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(7, 11), endsAt: endOf(daysFromNow(7, 11), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_07", organizationId: IDS.ORG_F, patientId: IDS.P_F_11, clinicId: IDS.C_BRAGANCA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(9, 9), endsAt: endOf(daysFromNow(9, 9), 45), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_08", organizationId: IDS.ORG_F, patientId: IDS.P_F_12, clinicId: IDS.C_ATIBAIA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(10, 10), endsAt: endOf(daysFromNow(10, 10), 30), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_09", organizationId: IDS.ORG_F, patientId: IDS.P_F_05, clinicId: IDS.C_BRAGANCA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(12, 9), endsAt: endOf(daysFromNow(12, 9), 60), status: "SCHEDULED" },
      { id: "shhml_apt_ae_f_10", organizationId: IDS.ORG_F, patientId: IDS.P_F_06, clinicId: IDS.C_ATIBAIA, dentistUserId: IDS.U_FREEL, startsAt: daysFromNow(14, 10), endsAt: endOf(daysFromNow(14, 10), 45), status: "SCHEDULED" },
    ],
  });

  // ── Atendimentos Org A (10) com repasse e material ─────────────────────────
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_01, organizationId: IDS.ORG_A, patientId: IDS.P_A_01,
      clinicId: IDS.C_A1, procedureId: IDS.PROC_A_05, dentistUserId: IDS.U_DENT_A,
      date: daysFromNow(-1, 10), grossValue: 120, repassePercentage: 30, materialCost: 12,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: { create: [{ materialId: IDS.MAT_A_03, quantity: 0.5, organizationId: IDS.ORG_A }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_02, organizationId: IDS.ORG_A, patientId: IDS.P_A_02,
      clinicId: IDS.C_A1, procedureId: IDS.PROC_A_02, dentistUserId: IDS.U_DENT_A,
      date: daysFromNow(-2, 9), grossValue: 180, repassePercentage: 40, materialCost: 22,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: {
        create: [
          { materialId: IDS.MAT_A_01, quantity: 1, organizationId: IDS.ORG_A },
          { materialId: IDS.MAT_A_02, quantity: 1, organizationId: IDS.ORG_A },
        ],
      },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_03, organizationId: IDS.ORG_A, patientId: IDS.P_A_03,
      clinicId: IDS.C_A1, procedureId: IDS.PROC_A_06, dentistUserId: IDS.U_DENT_A,
      date: daysFromNow(-3, 14), grossValue: 600, repassePercentage: 50, materialCost: 38,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: {
        create: [
          { materialId: IDS.MAT_A_02, quantity: 2, organizationId: IDS.ORG_A },
          { materialId: IDS.MAT_A_07, quantity: 5, organizationId: IDS.ORG_A },
        ],
      },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_04, organizationId: IDS.ORG_A, patientId: IDS.P_A_05,
      clinicId: IDS.C_A2, procedureId: IDS.PROC_A_01, dentistUserId: IDS.U_ADMIN_DENT,
      date: daysFromNow(-4, 10), grossValue: 150, repassePercentage: 30, materialCost: 10,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: { create: [{ materialId: IDS.MAT_A_03, quantity: 0.5, organizationId: IDS.ORG_A }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_05, organizationId: IDS.ORG_A, patientId: IDS.P_A_06,
      clinicId: IDS.C_A2, procedureId: IDS.PROC_A_03, dentistUserId: IDS.U_ADMIN_DENT,
      date: daysFromNow(-4, 14), grossValue: 250, repassePercentage: 40, materialCost: 28,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: {
        create: [
          { materialId: IDS.MAT_A_01, quantity: 2, organizationId: IDS.ORG_A },
          { materialId: IDS.MAT_A_06, quantity: 2, organizationId: IDS.ORG_A },
        ],
      },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_06, organizationId: IDS.ORG_A, patientId: IDS.P_A_07,
      clinicId: IDS.C_A1, procedureId: IDS.PROC_A_04, dentistUserId: IDS.U_DENT_A,
      date: daysFromNow(-5, 9), grossValue: 200, repassePercentage: 35, materialCost: 15,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: { create: [{ materialId: IDS.MAT_A_02, quantity: 2, organizationId: IDS.ORG_A }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_07, organizationId: IDS.ORG_A, patientId: IDS.P_A_08,
      clinicId: IDS.C_A2, procedureId: IDS.PROC_A_08, dentistUserId: IDS.U_ADMIN_DENT,
      date: daysFromNow(-6, 10), grossValue: 300, repassePercentage: 40, materialCost: 20,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: { create: [{ materialId: IDS.MAT_A_09, quantity: 2, organizationId: IDS.ORG_A }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_08, organizationId: IDS.ORG_A, patientId: IDS.P_A_09,
      clinicId: IDS.C_A1, procedureId: IDS.PROC_A_02, dentistUserId: IDS.U_DENT_A,
      date: daysFromNow(-7, 9), grossValue: 180, repassePercentage: 30, materialCost: 18,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: { create: [{ materialId: IDS.MAT_A_01, quantity: 1, organizationId: IDS.ORG_A }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_09, organizationId: IDS.ORG_A, patientId: IDS.P_A_01,
      clinicId: IDS.C_A1, procedureId: IDS.PROC_A_05, dentistUserId: IDS.U_DENT_A,
      date: daysFromNow(-8, 10), grossValue: 120, repassePercentage: 30, materialCost: 14,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: { create: [{ materialId: IDS.MAT_A_08, quantity: 1, organizationId: IDS.ORG_A }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_A_10, organizationId: IDS.ORG_A, patientId: IDS.P_A_13,
      clinicId: IDS.C_A1, procedureId: IDS.PROC_A_01, dentistUserId: IDS.U_DENT_A,
      date: daysFromNow(-10, 9), grossValue: 150, repassePercentage: 30, materialCost: 10,
      createdByUserId: IDS.U_ADMIN_A,
      materialUsages: { create: [{ materialId: IDS.MAT_A_03, quantity: 0.5, organizationId: IDS.ORG_A }] },
    },
  });

  // ── Atendimentos Org F (5) com repasse e material ─────────────────────────
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_F_01, organizationId: IDS.ORG_F, patientId: IDS.P_F_01,
      clinicId: IDS.C_BRAGANCA, procedureId: IDS.PROC_F_01, dentistUserId: IDS.U_FREEL,
      date: daysFromNow(-1, 9), grossValue: 100, repassePercentage: 30, materialCost: 10,
      createdByUserId: IDS.U_FREEL,
      materialUsages: { create: [{ materialId: IDS.MAT_F_03, quantity: 0.5, organizationId: IDS.ORG_F }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_F_02, organizationId: IDS.ORG_F, patientId: IDS.P_F_02,
      clinicId: IDS.C_BRAGANCA, procedureId: IDS.PROC_F_02, dentistUserId: IDS.U_FREEL,
      date: daysFromNow(-3, 10), grossValue: 200, repassePercentage: 30, materialCost: 22,
      createdByUserId: IDS.U_FREEL,
      materialUsages: {
        create: [
          { materialId: IDS.MAT_F_01, quantity: 1, organizationId: IDS.ORG_F },
          { materialId: IDS.MAT_F_02, quantity: 1, organizationId: IDS.ORG_F },
        ],
      },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_F_03, organizationId: IDS.ORG_F, patientId: IDS.P_F_01,
      clinicId: IDS.C_ATIBAIA, procedureId: IDS.PROC_F_05, dentistUserId: IDS.U_FREEL,
      date: daysFromNow(-5, 11), grossValue: 130, repassePercentage: 30, materialCost: 12,
      createdByUserId: IDS.U_FREEL,
      materialUsages: { create: [{ materialId: IDS.MAT_F_05, quantity: 1, organizationId: IDS.ORG_F }] },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_F_04, organizationId: IDS.ORG_F, patientId: IDS.P_F_05,
      clinicId: IDS.C_BRAGANCA, procedureId: IDS.PROC_F_06, dentistUserId: IDS.U_FREEL,
      date: daysFromNow(-8, 9), grossValue: 700, repassePercentage: 30, materialCost: 32,
      createdByUserId: IDS.U_FREEL,
      materialUsages: {
        create: [
          { materialId: IDS.MAT_F_02, quantity: 2, organizationId: IDS.ORG_F },
          { materialId: IDS.MAT_F_04, quantity: 5, organizationId: IDS.ORG_F },
        ],
      },
    },
  });
  await prisma.attendance.create({
    data: {
      id: IDS.ATT_F_05, organizationId: IDS.ORG_F, patientId: IDS.P_F_06,
      clinicId: IDS.C_ATIBAIA, procedureId: IDS.PROC_F_01, dentistUserId: IDS.U_FREEL,
      date: daysFromNow(-12, 10), grossValue: 100, repassePercentage: 30, materialCost: 8,
      createdByUserId: IDS.U_FREEL,
      materialUsages: { create: [{ materialId: IDS.MAT_F_03, quantity: 0.5, organizationId: IDS.ORG_F }] },
    },
  });
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
