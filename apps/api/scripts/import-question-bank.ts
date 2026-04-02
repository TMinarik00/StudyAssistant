import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { loadQuestionBank, replaceQuestionBank } from "../src/lib/question-bank-utils.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function readInputPath() {
  const args = process.argv.slice(2);
  return args.find((arg) => !arg.startsWith("--"));
}

async function main() {
  const inputPath = readInputPath();
  const questionBank = await loadQuestionBank(inputPath);
  const result = await replaceQuestionBank(prisma, questionBank, "CLI import kolekcija");

  console.log(
    `Imported ${result.topicCount} topics and ${result.questionCount} questions from ${
      inputPath ?? "prisma/seedData.ts"
    }.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
