import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (const user of users) {
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      console.log(`Sem membership: ${user.email} — pulando (deve virar Super Admin manualmente se for o caso)`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { organizationId: membership.organizationId, role: membership.role },
    });
    console.log(`${user.email} -> organizationId ${membership.organizationId}, role ${membership.role}`);
  }

  const organizations = await prisma.organization.findMany();
  for (const organization of organizations) {
    if (organization.foundingAdminUserId) continue;
    const founding = await prisma.membership.findFirst({
      where: { organizationId: organization.id, role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });
    if (!founding) {
      console.log(`Organização "${organization.name}" sem nenhum ADMIN — sem founding admin definido`);
      continue;
    }
    await prisma.organization.update({
      where: { id: organization.id },
      data: { foundingAdminUserId: founding.userId },
    });
    console.log(`Organização "${organization.name}" -> foundingAdminUserId ${founding.userId}`);
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
