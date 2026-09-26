import { PrismaClient, type Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();
const PASSWORD = "senha123456";

async function findOrCreateOrg(name: string, type: "CLINIC" | "FREELANCER") {
  const existing = await prisma.organization.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.organization.create({ data: { name, type } });
}

async function findOrCreateUser(organizationId: string, email: string, name: string, role: Role) {
  const existing = await prisma.user.findFirst({ where: { organizationId, email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.create({ data: { organizationId, email, passwordHash, name, roles: [role] } });
}

async function main() {
  // Freelancer: tenant próprio, usuário único, gerencia os próprios
  // consultórios (multi-local).
  const freelancerOrg = await findOrCreateOrg("Dra. Freelancer Teste", "FREELANCER");
  const freelancerUser = await findOrCreateUser(
    freelancerOrg.id,
    "freelancer@example.com",
    "Dra. Freelancer Teste",
    "DENTIST",
  );
  const freelancerClinicCount = await prisma.clinic.count({ where: { organizationId: freelancerOrg.id } });
  if (freelancerClinicCount === 0) {
    await prisma.clinic.createMany({
      data: [
        { organizationId: freelancerOrg.id, name: "Consultório Bragança", type: "OWN" },
        { organizationId: freelancerOrg.id, name: "Consultório Atibaia", type: "RENTED", dailyRentValue: 150 },
      ],
    });
  }

  // Clínica: tenant com admin fundador + dentista de equipe + recepcionista,
  // consultório fixo (não pode adicionar novos — ver Roadmap/Arquitetura).
  const clinicOrg = await findOrCreateOrg("Clínica Teste RBAC", "CLINIC");
  const adminUser = await findOrCreateUser(clinicOrg.id, "admin-clinica@example.com", "Admin Clínica Teste", "ADMIN");
  await findOrCreateUser(clinicOrg.id, "dentista-clinica@example.com", "Dr. Dentista Clínica Teste", "DENTIST");
  await findOrCreateUser(
    clinicOrg.id,
    "recepcao-clinica@example.com",
    "Recepcionista Clínica Teste",
    "RECEPTIONIST",
  );
  if (!clinicOrg.foundingAdminUserId) {
    await prisma.organization.update({
      where: { id: clinicOrg.id },
      data: { foundingAdminUserId: adminUser.id },
    });
  }
  const clinicClinicCount = await prisma.clinic.count({ where: { organizationId: clinicOrg.id } });
  if (clinicClinicCount === 0) {
    await prisma.clinic.create({
      data: { organizationId: clinicOrg.id, name: "Consultório Principal", type: "OWN" },
    });
  }

  console.log("Personas de teste prontas (senha padrão: senha123456):");
  console.log(`  Freelancer (DENTIST): ${freelancerUser.email}`);
  console.log(`  Clínica ADMIN:        admin-clinica@example.com`);
  console.log(`  Clínica DENTIST:      dentista-clinica@example.com`);
  console.log(`  Clínica RECEPTIONIST: recepcao-clinica@example.com`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
