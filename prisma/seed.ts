import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUPPLIERS = [
  { name: "COSMOS GROUP", country: "South Africa" },
  { name: "BASSTION FRUIT", country: "South Africa" },
  { name: "AGRO CITY IMPORT & EXPORT", country: "Egypt" },
  { name: "FRESHGOLD SA EXPORTS", country: "South Africa" },
  { name: "UNITED EXPORTS LIMITED", country: "South Africa" },
  { name: "DELTA AGRAR DOO", country: "Serbia" },
  { name: "QINGDAO BLUE BOAT", country: "China" },
  { name: "EVERFRESH AGRICULTURAL TECHNOLOGY", country: "China" },
  { name: "SNAZZY FRUIT COMPANY", country: "South Africa" },
];

async function main() {
  // Multi-tenant root.
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Aeden Fruits International Pvt Ltd",
      city: "Kochi",
      country: "India",
    },
  });

  for (const s of SUPPLIERS) {
    const existing = await prisma.supplier.findFirst({
      where: { orgId: org.id, name: s.name },
    });
    if (!existing) {
      await prisma.supplier.create({
        data: { orgId: org.id, name: s.name, country: s.country },
      });
    }
  }

  console.log(`Seeded org "${org.name}" with ${SUPPLIERS.length} suppliers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
