import { PrismaClient, type Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEFAULT_PROCEDURES = [
  { name: "Consulta / avaliação", defaultValue: 150 },
  { name: "Limpeza (profilaxia)", defaultValue: 180 },
  { name: "Restauração (resina)", defaultValue: 250 },
  { name: "Extração simples", defaultValue: 300 },
  { name: "Canal (endodontia)", defaultValue: 900 },
  { name: "Clareamento dental", defaultValue: 700 },
] as const;

async function seedUser(role: Role, emailVar: string, passwordVar: string, nameVar: string, defaultName: string) {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  const name = process.env[nameVar] ?? defaultName;

  if (!email || !password) {
    console.log(`Pulando seed de ${role}: defina ${emailVar} e ${passwordVar} no .env para criar este usuário`);
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { email, passwordHash, name, role } });
    console.log(`Usuário ${role} criado: ${email}`);
  } else {
    console.log(`Usuário ${role} já existe: ${email}`);
  }
}

async function main() {
  // ADMIN é a raiz de confiança: só ele cria/gerencia os demais usuários pelo painel.
  await seedUser("ADMIN", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD", "SEED_ADMIN_NAME", "Admin");
  await seedUser("DENTIST", "SEED_DENTIST_EMAIL", "SEED_DENTIST_PASSWORD", "SEED_DENTIST_NAME", "Dentista");

  for (const procedure of DEFAULT_PROCEDURES) {
    const existingProcedure = await prisma.procedureCatalog.findFirst({
      where: { name: procedure.name },
    });
    if (!existingProcedure) {
      await prisma.procedureCatalog.create({ data: procedure });
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
