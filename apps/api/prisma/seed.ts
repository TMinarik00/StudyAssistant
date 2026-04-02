import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { questionBank } from "./seedData.js";
import { questionBankSchema, replaceQuestionBank } from "../src/lib/question-bank-utils.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await replaceQuestionBank(prisma, questionBankSchema.parse(questionBank), "Demo farmakologija");
  await prisma.player.deleteMany({
    where: {
      nickname: {
        in: ["Ana", "Marko", "Lea"],
      },
    },
  });

  await prisma.player.createMany({
    data: [
      {
        nickname: "Ana",
        xp: 186,
        level: 4,
        streak: 6,
        hearts: 5,
        totalAnswered: 18,
        correctAnswers: 14,
      },
      {
        nickname: "Marko",
        xp: 144,
        level: 3,
        streak: 4,
        hearts: 4,
        totalAnswered: 16,
        correctAnswers: 11,
      },
      {
        nickname: "Lea",
        xp: 121,
        level: 3,
        streak: 3,
        hearts: 5,
        totalAnswered: 13,
        correctAnswers: 10,
      },
    ],
  });

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
