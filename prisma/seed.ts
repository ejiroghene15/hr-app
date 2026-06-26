import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { env } from 'prisma/config';
import { exit } from '@nestjs/cli/actions';

const connectionString = `${env('DATABASE_URL')}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const company = await prisma.company.create({
    data: {
      name: 'Test Company',
    },
  });

  await prisma.employee.createMany({
    data: [
      { firstname: 'John', lastname: 'Doe', tenantId: company.id },
      { firstname: 'Sarah', lastname: 'Johnson', tenantId: company.id },
      { firstname: 'James', lastname: 'Connor', tenantId: company.id },
    ],
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    exit();
  });
