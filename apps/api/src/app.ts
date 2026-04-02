import cors from "cors";
import express from "express";
import { z } from "zod";
import {
  createSourceImport,
  importPayloadSchema,
  previewQuestionBankImport,
} from "./lib/question-bank-utils.js";
import { DAILY_MISSION_TARGET, MAX_HEARTS, XP_BY_DIFFICULTY, getLevelFromXp } from "./constants/game.js";
import { prisma } from "./lib/prisma.js";

type QuizOption = {
  id: string;
  textHr: string;
};

type LessonJson = {
  keyConceptsHr?: string[];
  studyPromptsHr?: string[];
  recallChecklistHr?: string[];
  sourceSnippetHr?: string;
};

const createPlayerSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(2, "Nadimak mora imati barem 2 znaka.")
    .max(24, "Nadimak moze imati najvise 24 znaka."),
});

const answerSchema = z.object({
  playerId: z.string().min(1),
  flashcardId: z.string().min(1),
  selectedOptionId: z.string().min(1),
});

const topicsQuerySchema = z.object({
  playerId: z.string().optional(),
  sourceImportId: z.string().optional(),
});

const quizQuerySchema = z.object({
  playerId: z.string().min(1),
  topicId: z.string().optional(),
  sourceImportId: z.string().optional(),
});

const importIdParamSchema = z.object({
  importId: z.string().min(1),
});

const serializePlayer = (player: {
  id: string;
  nickname: string;
  xp: number;
  level: number;
  streak: number;
  hearts: number;
  totalAnswered: number;
  correctAnswers: number;
}) => ({
  id: player.id,
  nickname: player.nickname,
  xp: player.xp,
  level: player.level,
  streak: player.streak,
  hearts: player.hearts,
  totalAnswered: player.totalAnswered,
  correctAnswers: player.correctAnswers,
  accuracy:
    player.totalAnswered === 0
      ? 0
      : Math.round((player.correctAnswers / player.totalAnswered) * 100),
});

function serializeLessonPayload(lessonJson: unknown) {
  const payload = (lessonJson ?? {}) as LessonJson;

  return {
    keyConceptsHr: Array.isArray(payload.keyConceptsHr) ? payload.keyConceptsHr : [],
    studyPromptsHr: Array.isArray(payload.studyPromptsHr) ? payload.studyPromptsHr : [],
    recallChecklistHr: Array.isArray(payload.recallChecklistHr) ? payload.recallChecklistHr : [],
    sourceSnippetHr:
      typeof payload.sourceSnippetHr === "string" ? payload.sourceSnippetHr : undefined,
  };
}

async function getTopicSnapshots(input?: z.infer<typeof topicsQuerySchema>) {
  const query = topicsQuerySchema.parse(input ?? {});

  const topics = await prisma.topic.findMany({
    where: query.sourceImportId
      ? {
          sourceImportId: query.sourceImportId,
        }
      : undefined,
    orderBy: [{ titleHr: "asc" }],
    include: {
      sourceImport: true,
      flashcards: {
        include: {
          attempts: query.playerId
            ? {
                where: {
                  playerId: query.playerId,
                },
                select: {
                  isCorrect: true,
                },
              }
            : false,
        },
      },
    },
  });

  return topics.map((topic) => {
    const attempts = topic.flashcards.flatMap((flashcard) =>
      Array.isArray(flashcard.attempts) ? flashcard.attempts : [],
    );
    const correctAnswers = attempts.filter((attempt) => attempt.isCorrect).length;
    const mastery =
      attempts.length === 0 ? 0 : Math.round((correctAnswers / attempts.length) * 100);

    return {
      id: topic.id,
      slug: topic.slug,
      titleHr: topic.titleHr,
      descriptionHr: topic.descriptionHr,
      accent: topic.accent,
      difficulty: topic.difficulty,
      questionCount: topic.flashcards.length,
      mastery,
      sourceLabelHr: topic.sourceImport?.titleHr ?? "Demo kolekcija",
    };
  });
}

async function getLeaderboard(limit = 5) {
  const players = await prisma.player.findMany({
    orderBy: [{ xp: "desc" }, { streak: "desc" }, { nickname: "asc" }],
    take: limit,
  });

  return players.map((player) => ({
    nickname: player.nickname,
    level: player.level,
    xp: player.xp,
    streak: player.streak,
  }));
}

async function getImportSummaries() {
  const imports = await prisma.sourceImport.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      topics: {
        select: {
          id: true,
          flashcards: {
            select: {
              id: true,
            },
          },
        },
      },
      lessons: {
        select: {
          id: true,
        },
      },
    },
  });

  return imports.map((sourceImport) => ({
    id: sourceImport.id,
    titleHr: sourceImport.titleHr,
    sourceType: sourceImport.sourceType,
    status: sourceImport.status,
    createdAt: sourceImport.createdAt.toISOString(),
    topicCount: sourceImport.topics.length,
    lessonCount: sourceImport.lessons.length,
    questionCount: sourceImport.topics.reduce(
      (sum, topic) => sum + topic.flashcards.length,
      0,
    ),
  }));
}

async function getImportDetail(importId: string) {
  const sourceImport = await prisma.sourceImport.findUnique({
    where: {
      id: importId,
    },
    include: {
      lessons: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      topics: {
        orderBy: {
          titleHr: "asc",
        },
        include: {
          flashcards: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!sourceImport) {
    return null;
  }

  return {
    import: {
      id: sourceImport.id,
      titleHr: sourceImport.titleHr,
      sourceType: sourceImport.sourceType,
      status: sourceImport.status,
      createdAt: sourceImport.createdAt.toISOString(),
      topicCount: sourceImport.topics.length,
      lessonCount: sourceImport.lessons.length,
      questionCount: sourceImport.topics.reduce(
        (sum, topic) => sum + topic.flashcards.length,
        0,
      ),
    },
    lessons: sourceImport.lessons.map((lesson) => ({
      id: lesson.id,
      topicId: lesson.topicId,
      titleHr: lesson.titleHr,
      overviewHr: lesson.overviewHr,
      sortOrder: lesson.sortOrder,
      ...serializeLessonPayload(lesson.lessonJson),
    })),
    topics: sourceImport.topics.map((topic) => ({
      id: topic.id,
      slug: topic.slug,
      titleHr: topic.titleHr,
      descriptionHr: topic.descriptionHr,
      accent: topic.accent,
      difficulty: topic.difficulty,
      questionCount: topic.flashcards.length,
      mastery: 0,
      sourceLabelHr: sourceImport.titleHr,
    })),
  };
}

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "farmapp-api",
    });
  });

  app.post("/api/players", async (request, response) => {
    try {
      const payload = createPlayerSchema.parse(request.body);
      const nickname = payload.nickname.replace(/\s+/g, " ");

      const existingPlayer = await prisma.player.findUnique({
        where: {
          nickname,
        },
      });

      const player =
        existingPlayer ??
        (await prisma.player.create({
          data: {
            nickname,
          },
        }));

      response.status(existingPlayer ? 200 : 201).json(serializePlayer(player));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          message: error.issues[0]?.message ?? "Neispravan zahtjev.",
        });
      }

      console.error(error);
      response.status(500).json({
        message: "Ne mogu otvoriti profil.",
      });
    }
  });

  app.get("/api/topics", async (request, response) => {
    try {
      const topics = await getTopicSnapshots({
        playerId:
          typeof request.query.playerId === "string" ? request.query.playerId : undefined,
        sourceImportId:
          typeof request.query.sourceImportId === "string"
            ? request.query.sourceImportId
            : undefined,
      });

      response.json(topics);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          message: "Neispravan query za teme.",
        });
      }

      console.error(error);
      response.status(500).json({
        message: "Ne mogu dohvatiti teme.",
      });
    }
  });

  app.get("/api/dashboard/:playerId", async (request, response) => {
    const { playerId } = request.params;

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      return response.status(404).json({
        message: "Igrac nije pronaden.",
      });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [topics, leaderboard, todayAttempts, imports] = await Promise.all([
      getTopicSnapshots({ playerId }),
      getLeaderboard(),
      prisma.attempt.findMany({
        where: {
          playerId,
          answeredAt: {
            gte: startOfToday,
          },
        },
      }),
      getImportSummaries(),
    ]);

    const weakTopic = [...topics]
      .filter((topic) => topic.mastery > 0)
      .sort((left, right) => left.mastery - right.mastery)[0];

    const currentMissionScore = todayAttempts.filter((attempt) => attempt.isCorrect).length;

    response.json({
      player: serializePlayer(player),
      topics,
      leaderboard,
      imports,
      dailyMission: {
        titleHr: "Dnevna serija",
        descriptionHr: "Skupi 5 tocnih odgovora danas i osvoji bonus iskustva.",
        target: DAILY_MISSION_TARGET,
        current: currentMissionScore,
        rewardXp: 40,
      },
      weakTopic: weakTopic
        ? {
            titleHr: weakTopic.titleHr,
            accuracy: weakTopic.mastery,
            tipHr: "Ponovi ovu cjelinu prije sljedeceg izazova za sigurniji streak.",
          }
        : {
            titleHr: "Jos nema slabih tocaka",
            accuracy: 0,
            tipHr: "Odaberi prvi kviz i sustav ce poceti pratiti tvoje jace i slabije teme.",
          },
    });
  });

  app.get("/api/quiz/next", async (request, response) => {
    try {
      const query = quizQuerySchema.parse({
        playerId: request.query.playerId,
        topicId: request.query.topicId,
        sourceImportId: request.query.sourceImportId,
      });

      const [player, flashcards] = await Promise.all([
        prisma.player.findUnique({
          where: {
            id: query.playerId,
          },
        }),
        prisma.flashcard.findMany({
          where: query.topicId
            ? {
                topicId: query.topicId,
              }
            : query.sourceImportId
              ? {
                  topic: {
                    sourceImportId: query.sourceImportId,
                  },
                }
              : undefined,
          include: {
            topic: true,
            attempts: {
              where: {
                playerId: query.playerId,
              },
              select: {
                isCorrect: true,
                answeredAt: true,
              },
            },
          },
        }),
      ]);

      if (!player) {
        return response.status(404).json({
          message: "Igrac nije pronaden.",
        });
      }

      if (flashcards.length === 0) {
        return response.status(404).json({
          message: "Nema pitanja za odabranu temu.",
        });
      }

      const nextCard = [...flashcards]
        .map((flashcard) => {
          const attempts = flashcard.attempts;
          const correctAnswers = attempts.filter((attempt) => attempt.isCorrect).length;
          const lastAttempt = attempts[attempts.length - 1];
          const mastery = attempts.length === 0 ? 0 : correctAnswers / attempts.length;
          const wasLastWrong = lastAttempt ? (lastAttempt.isCorrect ? 0 : -0.35) : -0.2;
          const unseenBonus = attempts.length === 0 ? -0.7 : 0;

          return {
            flashcard,
            priority: attempts.length + mastery + wasLastWrong + unseenBonus,
          };
        })
        .sort((left, right) => left.priority - right.priority)[0]?.flashcard;

      if (!nextCard) {
        return response.status(404).json({
          message: "Trenutno nema dostupnog pitanja.",
        });
      }

      response.json({
        flashcardId: nextCard.id,
        topicId: nextCard.topicId,
        topicTitleHr: nextCard.topic.titleHr,
        questionHr: nextCard.questionHr,
        options: nextCard.options as QuizOption[],
        progressLabel:
          nextCard.attempts.length === 0 ? "Novi izazov" : "Pametna repeticija",
        difficulty: nextCard.difficulty,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          message: "Nedostaje identifikator igraca.",
        });
      }

      console.error(error);
      response.status(500).json({
        message: "Ne mogu dohvatiti sljedece pitanje.",
      });
    }
  });

  app.post("/api/quiz/answer", async (request, response) => {
    try {
      const payload = answerSchema.parse(request.body);

      const [player, flashcard] = await Promise.all([
        prisma.player.findUnique({
          where: {
            id: payload.playerId,
          },
        }),
        prisma.flashcard.findUnique({
          where: {
            id: payload.flashcardId,
          },
          include: {
            topic: true,
          },
        }),
      ]);

      if (!player || !flashcard) {
        return response.status(404).json({
          message: "Igrac ili kartica nisu pronadeni.",
        });
      }

      const isCorrect = payload.selectedOptionId === flashcard.correctOptionId;
      const xpBase = XP_BY_DIFFICULTY[flashcard.difficulty] ?? 12;
      const streakBonus = isCorrect ? Math.min(player.streak, 5) * 2 : 0;
      const xpEarned = isCorrect ? xpBase + streakBonus : 3;
      const nextXp = player.xp + xpEarned;
      const nextLevel = getLevelFromXp(nextXp);
      const nextStreak = isCorrect ? player.streak + 1 : 0;
      const nextHearts = isCorrect
        ? Math.min(MAX_HEARTS, player.hearts + (nextStreak % 4 === 0 ? 1 : 0))
        : Math.max(0, player.hearts - 1);

      await prisma.$transaction([
        prisma.attempt.create({
          data: {
            playerId: player.id,
            flashcardId: flashcard.id,
            selectedOptionId: payload.selectedOptionId,
            isCorrect,
            xpEarned,
          },
        }),
        prisma.player.update({
          where: {
            id: player.id,
          },
          data: {
            xp: nextXp,
            level: nextLevel,
            streak: nextStreak,
            hearts: nextHearts,
            totalAnswered: player.totalAnswered + 1,
            correctAnswers: player.correctAnswers + (isCorrect ? 1 : 0),
            lastAnsweredAt: new Date(),
          },
        }),
      ]);

      const topicAttempts = await prisma.attempt.findMany({
        where: {
          playerId: player.id,
          flashcard: {
            topicId: flashcard.topicId,
          },
        },
      });

      const topicCorrect = topicAttempts.filter((attempt) => attempt.isCorrect).length;
      const topicMastery =
        topicAttempts.length === 0
          ? 0
          : Math.round((topicCorrect / topicAttempts.length) * 100);

      response.json({
        isCorrect,
        correctOptionId: flashcard.correctOptionId,
        explanationHr: flashcard.explanationHr,
        xpEarned,
        level: nextLevel,
        xp: nextXp,
        streak: nextStreak,
        hearts: nextHearts,
        nextUnlockHr: isCorrect
          ? `Tema ${flashcard.topic.titleHr} sada ima ${topicMastery}% savladanosti.`
          : "Krivi odgovor nije kraj price. Ponovi pitanje i vrati energiju sljedecom tocnom serijom.",
        topicMastery,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          message: "Odgovor nije valjan.",
        });
      }

      console.error(error);
      response.status(500).json({
        message: "Ne mogu obraditi odgovor.",
      });
    }
  });

  app.get("/api/leaderboard", async (_request, response) => {
    response.json(await getLeaderboard(10));
  });

  app.get("/api/imports", async (_request, response) => {
    response.json(await getImportSummaries());
  });

  app.get("/api/imports/:importId", async (request, response) => {
    const { importId } = importIdParamSchema.parse(request.params);
    const detail = await getImportDetail(importId);

    if (!detail) {
      return response.status(404).json({
        message: "Import nije pronaden.",
      });
    }

    response.json(detail);
  });

  app.post("/api/imports/preview", async (request, response) => {
    try {
      const preview = previewQuestionBankImport(importPayloadSchema.parse(request.body));
      response.json(preview);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          message: error.issues[0]?.message ?? "Import nije valjan.",
        });
      }

      console.error(error);
      response.status(500).json({
        message: "Ne mogu pregledati import.",
      });
    }
  });

  app.post("/api/imports", async (request, response) => {
    try {
      const createdImport = await createSourceImport(
        prisma,
        importPayloadSchema.parse(request.body),
      );

      response.status(201).json(createdImport);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          message: error.issues[0]?.message ?? "Import nije valjan.",
        });
      }

      console.error(error);
      response.status(500).json({
        message: "Ne mogu objaviti import.",
      });
    }
  });

  return app;
}
