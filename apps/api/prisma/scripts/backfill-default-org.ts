import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_ORG_NAME = "Consultório Padrão";

async function main() {
  let org = await prisma.organization.findFirst({ where: { name: DEFAULT_ORG_NAME } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: DEFAULT_ORG_NAME } });
    console.log(`Organização padrão criada: ${org.id}`);
  } else {
    console.log(`Organização padrão já existe: ${org.id}`);
  }

  const users = await prisma.user.findMany();
  for (const user of users) {
    const existing = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    });
    if (existing) {
      console.log(`Membership já existe para ${user.email}`);
      continue;
    }
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: user.role },
    });
    console.log(`Membership criada para ${user.email} (role ${user.role})`);
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
