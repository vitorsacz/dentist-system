import { PrismaClient, type Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEFAULT_ORG_NAME = "Consultório Padrão";

const DEFAULT_PROCEDURES = [
  { name: "Consulta / avaliação", defaultValue: 150 },
  { name: "Limpeza (profilaxia)", defaultValue: 180 },
  { name: "Restauração (resina)", defaultValue: 250 },
  { name: "Extração simples", defaultValue: 300 },
  { name: "Canal (endodontia)", defaultValue: 900 },
  { name: "Clareamento dental", defaultValue: 700 },
] as const;

// Super Admin não pertence a nenhuma organização (organizationId null) — é a
// identidade da plataforma, separada de qualquer clínica. Nunca é o mesmo
// usuário que administra uma clínica de teste.
async function seedSuperAdmin() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";

  if (!email || !password) {
    console.log("Pulando seed do Super Admin: defina SEED_SUPER_ADMIN_EMAIL e SEED_SUPER_ADMIN_PASSWORD no .env");
    return;
  }

  const existing = await prisma.user.findFirst({ where: { email, isSuperAdmin: true } });
  if (existing) {
    console.log(`Super Admin já existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, passwordHash, name, isSuperAdmin: true, organizationId: null, role: null },
  });
  console.log(`Super Admin criado: ${email}`);
}

async function seedTenantUser(
  organizationId: string,
  role: Role,
  emailVar: string,
  passwordVar: string,
  nameVar: string,
  defaultName: string,
) {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  const name = process.env[nameVar] ?? defaultName;

  if (!email || !password) {
    console.log(`Pulando seed de ${role}: defina ${emailVar} e ${passwordVar} no .env para criar este usuário`);
    return null;
  }

  const existing = await prisma.user.findFirst({ where: { organizationId, email } });
  if (existing) {
    console.log(`Usuário ${role} já existe: ${email}`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { organizationId, email, passwordHash, name, role } });
  console.log(`Usuário ${role} criado: ${email}`);
  return user;
}

async function main() {
  await seedSuperAdmin();

  let org = await prisma.organization.findFirst({ where: { name: DEFAULT_ORG_NAME } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: DEFAULT_ORG_NAME } });
    console.log(`Organização padrão criada: ${org.id}`);
  }

  // ADMIN seedado vira o admin fundador da organização padrão (capitania).
  const admin = await seedTenantUser(org.id, "ADMIN", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD", "SEED_ADMIN_NAME", "Admin");
  if (admin && !org.foundingAdminUserId) {
    await prisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: admin.id } });
  }

  await seedTenantUser(org.id, "DENTIST", "SEED_DENTIST_EMAIL", "SEED_DENTIST_PASSWORD", "SEED_DENTIST_NAME", "Dentista");

  for (const procedure of DEFAULT_PROCEDURES) {
    const existingProcedure = await prisma.procedureCatalog.findFirst({
      where: { name: procedure.name, organizationId: org.id },
    });
    if (!existingProcedure) {
      await prisma.procedureCatalog.create({ data: { ...procedure, organizationId: org.id } });
    }
  }
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
