import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

function loadLocalEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    process.env[key] ??= value;
  }
}

loadLocalEnv();
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.document.findMany({
    where: {
      deletedAt: null,
      filePath: null,
      fileUrl: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      containerNo: true,
      blNo: true,
      type: true,
      fileUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    console.log("No legacy public-url-only documents found.");
    return;
  }

  console.log(`Found ${rows.length} legacy public-url-only document(s):`);
  for (const row of rows) {
    console.log(
      [
        row.id,
        row.orgId,
        row.containerNo ?? "-",
        row.blNo ?? "-",
        row.type,
        row.createdAt.toISOString(),
        row.fileUrl,
      ].join("\t")
    );
  }

  process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error("Legacy document audit failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
