import prisma from "../lib/prisma.js";

async function main() {
  try {
    const result = await prisma.$queryRaw`
      SELECT 1 AS connected
    `;

    console.log("Prisma -> NeonDB connection succeeded.");
    console.log(result);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();