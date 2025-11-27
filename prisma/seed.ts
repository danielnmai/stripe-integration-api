import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding products...');

  const product = await prisma.product.upsert({
    where: { stripeId: 'prod_TUrnEqRRgTx9Gz' },
    update: {
      name: 'Astrology Time Zone',
      price: 50.00,
      stripeActive: true,
    },
    create: {
      name: 'Astrology Time Zone',
      price: 50.00,
      stripeId: 'prod_TUrnEqRRgTx9Gz',
      stripeActive: true,
    },
  });

  console.log('Product seeded:', product);

  console.log('Seeding users...');

  // Seed 4 users for each user type
  const userTypes = ['Free', 'GreatAwakener', 'VirtualOracle', 'NonMember'] as const;
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown'];

  for (const userType of userTypes) {
    for (let i = 0; i < 4; i++) {
      const email = `${userType.toLowerCase()}.user${i + 1}@example.com`;
      const firstName = firstNames[i];
      const lastName = lastNames[i];
      const hasAstrology = i % 2 === 0; // Alternate between true and false

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          firstName,
          lastName,
          hasAstrology,
          userType,
        },
        create: {
          firstName,
          lastName,
          email,
          hasAstrology,
          userType,
        },
      });

      console.log(`User seeded (${userType}):`, user.email);
    }
  }

  console.log('All users seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

