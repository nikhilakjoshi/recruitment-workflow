import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const email = process.env.AUTH_USER_EMAIL;
  const passwordHash = process.env.AUTH_USER_PASSWORD_HASH;

  if (!email || !passwordHash) {
    throw new Error(
      "Seed requires AUTH_USER_EMAIL and AUTH_USER_PASSWORD_HASH to be set in the environment.",
    );
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  const existing = await prisma.candidate.findUnique({ where: { userId: user.id } });
  if (!existing) {
    await prisma.candidate.create({ data: { userId: user.id } });
  }

  console.log(`Seeded user ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
