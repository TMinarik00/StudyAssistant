import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSON5 from "json5";
import { z } from "zod";
import type { PrismaClient, SourceType } from "../generated/prisma/client.js";

const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

const optionSchema = z.object({
  id: z.string().trim().min(1),
  textHr: z.string().trim().min(1),
});

const flashcardSchema = z
  .object({
    questionHr: z.string().trim().min(1),
    explanationHr: z.string().trim().min(1),
    correctOptionId: z.string().trim().min(1),
    difficulty: difficultySchema,
    options: z.array(optionSchema).min(2),
  })
  .superRefine((flashcard, context) => {
    const optionIds = new Set(flashcard.options.map((option) => option.id));

    if (!optionIds.has(flashcard.correctOptionId)) {
      context.addIssue({
        code: "custom",
        message: "correctOptionId mora postojati medu ponudjenim opcijama.",
      });
    }

    if (optionIds.size !== flashcard.options.length) {
      context.addIssue({
        code: "custom",
        message: "Svaka opcija mora imati jedinstveni id.",
      });
    }
  });

const topicSchema = z.object({
  slug: z.string().trim().min(1),
  titleHr: z.string().trim().min(1),
  descriptionHr: z.string().trim().min(1),
  accent: z.string().trim().min(1),
  difficulty: difficultySchema,
  flashcards: z.array(flashcardSchema).min(1),
});

export const questionBankSchema = z.array(topicSchema).min(1);
export const importPayloadSchema = z.object({
  titleHr: z.string().trim().min(2).max(120),
  payloadText: z.string().trim().min(2),
});

export type QuestionBank = z.infer<typeof questionBankSchema>;

type LessonPayload = {
  id: string;
  titleHr: string;
  overviewHr: string;
  sourceSnippetHr?: string;
  keyConceptsHr: string[];
  studyPromptsHr: string[];
  recallChecklistHr: string[];
  sortOrder: number;
};

type TopicPreview = {
  slug: string;
  titleHr: string;
  descriptionHr: string;
  accent: string;
  difficulty: QuestionBank[number]["difficulty"];
  questionCount: number;
};

type SampleQuestionPreview = {
  topicTitleHr: string;
  questionHr: string;
  correctAnswerHr: string;
  explanationHr: string;
};

type RawSection = {
  titleHr: string;
  bodyHr: string;
  facts: string[];
};

const ACCENT_PALETTE = [
  "#1c7c6d",
  "#8a5a34",
  "#2f5b89",
  "#6b7c45",
  "#8c4b4b",
  "#5f6b78",
];

const GENERIC_DISTRACTORS = [
  "Opisuje suprotan mehanizam djelovanja od navedenog u skripti.",
  "Naglasak stavlja na laboratorijski artefakt, a ne na klinicki ucinak.",
  "Tvrdnja vrijedi samo za potpuno drugu skupinu lijekova.",
  "Odnosi se na izolirani tehnicki detalj koji nije istaknut u ovoj cjelini.",
  "Skripta ne povezuje ovaj pojam s navedenim terapijskim ulogama.",
  "Ova tvrdnja pojednostavljuje temu i mijenja njezin glavni klinicki smisao.",
];

export const DEFAULT_QUESTION_BANK_PATH = path.resolve(process.cwd(), "prisma/seedData.ts");

async function loadBankModule(filePath: string) {
  const moduleUrl = pathToFileURL(filePath).href;
  const imported = await import(moduleUrl);

  return imported.default ?? imported.questionBank;
}

async function loadBankJson(filePath: string) {
  const file = await readFile(filePath, "utf8");
  return JSON.parse(file);
}

function buildStoredTopicSlug(slug: string, sourceImportId: string) {
  return `${slug}-${sourceImportId.slice(-6)}`;
}

function truncateText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 1).trim()}…`;
}

function cleanInlineText(value: string) {
  return value
    .replace(/^[\-\*\u2022]\s*/u, "")
    .replace(/^\d+[\.\)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function slugify(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "cjelina";
}

function extractArrayLiteral(payloadText: string) {
  const cleaned = payloadText.replace(/^\uFEFF/, "").trim();

  if (cleaned.startsWith("[")) {
    return cleaned;
  }

  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return cleaned.slice(firstBracket, lastBracket + 1);
  }

  return cleaned;
}

function looksLikeStructuredQuestionBank(payloadText: string) {
  return /\bquestionBank\b/.test(payloadText) || /\bflashcards\b/.test(payloadText);
}

function detectSourceType(payloadText: string): SourceType {
  const trimmed = payloadText.trim();

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return "JSON";
  }

  return "SCRIPT";
}

function parseQuestionBankFromText(payloadText: string): QuestionBank {
  const arrayLiteral = extractArrayLiteral(payloadText).replace(/\sas const/g, "");
  const parsed = JSON5.parse(arrayLiteral);

  return questionBankSchema.parse(parsed);
}

function normalizeScriptText(payloadText: string) {
  return payloadText
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanHeadingCandidate(value: string) {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\d+[\.\)]\s*/, "")
    .replace(/[:\-–]\s*$/u, "")
    .trim();
}

function isLikelyHeading(value: string) {
  const cleaned = cleanHeadingCandidate(value);

  if (!cleaned || cleaned.length < 3 || cleaned.length > 90) {
    return false;
  }

  if (/^[\-\*\u2022]/u.test(value)) {
    return false;
  }

  if (/[.!?]$/u.test(cleaned)) {
    return false;
  }

  return cleaned.split(/\s+/).length <= 12;
}

function extractSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map(cleanInlineText)
    .filter((sentence) => sentence.length >= 35);
}

function splitScriptIntoSections(payloadText: string, titleHr: string): RawSection[] {
  const normalized = normalizeScriptText(payloadText);
  const blocks = normalized.split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
  const sections: Array<{ titleHr: string; bodyParts: string[] }> = [];
  let current: { titleHr: string; bodyParts: string[] } | null = null;

  const pushCurrent = () => {
    if (!current) {
      return;
    }

    const bodyHr = current.bodyParts.join("\n\n").trim();

    if (bodyHr) {
      sections.push({
        titleHr: current.titleHr,
        bodyParts: [bodyHr],
      });
    }

    current = null;
  };

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);

    if (!lines.length) {
      continue;
    }

    const firstLine = lines[0];
    const heading = cleanHeadingCandidate(firstLine);
    const isHeadingOnly = lines.length === 1 && isLikelyHeading(firstLine);
    const isTitledBlock =
      lines.length > 1 &&
      (isLikelyHeading(firstLine) || /^[A-ZČĆŽŠĐa-zčćžšđ0-9][^.!?]{3,80}:\s*$/u.test(firstLine));

    if (isHeadingOnly) {
      pushCurrent();
      current = {
        titleHr: heading,
        bodyParts: [],
      };
      continue;
    }

    if (isTitledBlock) {
      pushCurrent();
      current = {
        titleHr: heading,
        bodyParts: [lines.slice(1).join("\n")],
      };
      continue;
    }

    if (!current) {
      current = {
        titleHr: sections.length === 0 ? titleHr : `${titleHr} cjelina ${sections.length + 1}`,
        bodyParts: [],
      };
    }

    current.bodyParts.push(block);
  }

  pushCurrent();

  if (sections.length === 0) {
    return [
      {
        titleHr,
        bodyHr: normalized,
        facts: [],
      },
    ];
  }

  return sections.map((section) => ({
    titleHr: section.titleHr,
    bodyHr: section.bodyParts[0],
    facts: [],
  }));
}

function extractFactsFromSection(section: RawSection) {
  const bulletFacts = section.bodyHr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[\-\*\u2022]/u.test(line) || /^[A-ZČĆŽŠĐa-zčćžšđ0-9][^.!?]{3,80}:\s+/u.test(line))
    .map(cleanInlineText);

  const sentences = extractSentences(section.bodyHr)
    .map((sentence) => truncateText(sentence.replace(/\.$/, ""), 180))
    .filter((sentence) => sentence.length >= 25);

  const facts = uniqueStrings([...bulletFacts, ...sentences]).slice(0, 8);

  return facts.length > 0
    ? facts
    : [truncateText(section.bodyHr.replace(/\n/g, " "), 180)];
}

function extractConceptLabel(statementHr: string, fallbackTitleHr: string) {
  const normalized = statementHr
    .replace(/^Tocno prema importiranoj skripti:\s*/u, "")
    .replace(/\.$/, "")
    .trim();
  const separatorMatch = normalized.match(/^([^:–-]{3,60})[:–-]\s+/u);

  if (separatorMatch?.[1]) {
    return separatorMatch[1].trim();
  }

  const definitionMatch = normalized.match(/^([A-ZČĆŽŠĐa-zčćžšđ0-9][^,]{3,60})\s+(je|su)\b/u);

  if (definitionMatch?.[1]) {
    return definitionMatch[1].trim();
  }

  return fallbackTitleHr;
}

function buildQuestionStem(statementHr: string, sectionTitleHr: string) {
  const conceptLabel = extractConceptLabel(statementHr, sectionTitleHr);

  if (conceptLabel && conceptLabel !== sectionTitleHr) {
    return `Koja tvrdnja najbolje opisuje ${conceptLabel.toLowerCase()}?`;
  }

  return `Koja tvrdnja je u skladu sa skriptom za temu ${sectionTitleHr.toLowerCase()}?`;
}

function buildOptions(correctAnswerHr: string, distractorPool: string[], seed: number) {
  const optionIds = ["a", "b", "c", "d"];
  const distractors = uniqueStrings([...distractorPool, ...GENERIC_DISTRACTORS])
    .filter((value) => value !== correctAnswerHr)
    .slice(0, 3);
  const texts = [...distractors];
  const correctIndex = seed % 4;

  texts.splice(correctIndex, 0, correctAnswerHr);

  while (texts.length < 4) {
    texts.push(
      GENERIC_DISTRACTORS[(seed + texts.length) % GENERIC_DISTRACTORS.length],
    );
  }

  return {
    correctOptionId: optionIds[correctIndex],
    options: texts.slice(0, 4).map((textHr, index) => ({
      id: optionIds[index],
      textHr,
    })),
  };
}

function inferDifficulty(questionCount: number, bodyLength: number): QuestionBank[number]["difficulty"] {
  if (questionCount >= 4 || bodyLength > 1100) {
    return "HARD";
  }

  if (questionCount >= 2 || bodyLength > 500) {
    return "MEDIUM";
  }

  return "EASY";
}

function buildTopicDescription(section: RawSection) {
  const sentence = extractSentences(section.bodyHr)[0];

  if (sentence) {
    return truncateText(sentence, 180);
  }

  return truncateText(
    `${section.titleHr} je pretvoren u preglednu cjelinu za ucenje i kviz.`,
    180,
  );
}

function buildLessonPayload(topic: QuestionBank[number], sortOrder: number, sourceSnippetHr?: string): LessonPayload {
  const keyConceptsHr = uniqueStrings(
    topic.flashcards.map((flashcard) =>
      extractConceptLabel(flashcard.explanationHr, topic.titleHr),
    ),
  ).slice(0, 4);

  const studyPromptsHr = topic.flashcards
    .map((flashcard) => flashcard.questionHr.replace(/\s+/g, " ").trim())
    .slice(0, 4);

  const recallChecklistHr = [
    `Prodji ${topic.flashcards.length} pitanja za temu ${topic.titleHr.toLowerCase()}.`,
    `Povezi kljucne pojmove s objasnjenjima prije nego otvoris kviz.`,
    `Provjeri razumijes li zasto je razina tezine oznacena kao ${topic.difficulty.toLowerCase()}.`,
  ];

  return {
    id: `preview-${sortOrder}`,
    titleHr: topic.titleHr,
    overviewHr: `${topic.descriptionHr} Ova verzija pretvara importirani materijal u jasne blokove za ucenje i brzu repeticiju prije kviza.`,
    sourceSnippetHr,
    keyConceptsHr,
    studyPromptsHr,
    recallChecklistHr,
    sortOrder,
  };
}

function buildQuestionBankFromScript(payloadText: string, titleHr: string): QuestionBank {
  const baseSections = splitScriptIntoSections(payloadText, titleHr);
  const sections = baseSections.map((section) => ({
    ...section,
    facts: extractFactsFromSection(section),
  }));
  const factPool = sections.flatMap((section) => section.facts);

  const topics = sections.map((section, index) => {
    const facts = section.facts;
    const difficulty = inferDifficulty(facts.length, section.bodyHr.length);
    const flashcards = facts.slice(0, Math.max(1, Math.min(4, facts.length))).map((fact, factIndex) => {
      const distractorPool = factPool.filter((candidate) => candidate !== fact);
      const { options, correctOptionId } = buildOptions(fact, distractorPool, index + factIndex + 1);

      return {
        questionHr: buildQuestionStem(fact, section.titleHr),
        explanationHr: `Tocno prema importiranoj skripti: ${fact}`,
        correctOptionId,
        difficulty,
        options,
      };
    });

    return {
      slug: `${slugify(section.titleHr)}-${index + 1}`,
      titleHr: section.titleHr,
      descriptionHr: buildTopicDescription(section),
      accent: ACCENT_PALETTE[index % ACCENT_PALETTE.length],
      difficulty,
      flashcards,
    };
  });

  return questionBankSchema.parse(topics);
}

function parseImportedPayload(payloadText: string, titleHr: string) {
  const sourceType = detectSourceType(payloadText);

  if (sourceType === "JSON") {
    return {
      questionBank: parseQuestionBankFromText(payloadText),
      sourceType,
    };
  }

  if (looksLikeStructuredQuestionBank(payloadText)) {
    try {
      return {
        questionBank: parseQuestionBankFromText(payloadText),
        sourceType,
      };
    } catch {
      return {
        questionBank: buildQuestionBankFromScript(payloadText, titleHr),
        sourceType: "SCRIPT" as const,
      };
    }
  }

  return {
    questionBank: buildQuestionBankFromScript(payloadText, titleHr),
    sourceType: "SCRIPT" as const,
  };
}

function buildSampleQuestions(questionBank: QuestionBank): SampleQuestionPreview[] {
  return questionBank
    .flatMap((topic) =>
      topic.flashcards.slice(0, 1).map((flashcard) => {
        const correctOption = flashcard.options.find(
          (option) => option.id === flashcard.correctOptionId,
        );

        return {
          topicTitleHr: topic.titleHr,
          questionHr: flashcard.questionHr,
          correctAnswerHr: correctOption?.textHr ?? "",
          explanationHr: flashcard.explanationHr,
        };
      }),
    )
    .slice(0, 4);
}

export function buildImportPreview(
  questionBank: QuestionBank,
  titleHr: string,
  sourceType: SourceType,
  sourceSnippets?: string[],
) {
  const topics: TopicPreview[] = questionBank.map((topic) => ({
    slug: topic.slug,
    titleHr: topic.titleHr,
    descriptionHr: topic.descriptionHr,
    accent: topic.accent,
    difficulty: topic.difficulty,
    questionCount: topic.flashcards.length,
  }));

  const lessons = questionBank.map((topic, index) =>
    buildLessonPayload(topic, index + 1, sourceSnippets?.[index]),
  );
  const questionCount = questionBank.reduce((sum, topic) => sum + topic.flashcards.length, 0);

  return {
    titleHr,
    sourceType,
    topicCount: topics.length,
    questionCount,
    topics,
    lessons,
    sampleQuestions: buildSampleQuestions(questionBank),
  };
}

export async function loadQuestionBank(inputPath?: string): Promise<QuestionBank> {
  const resolvedPath = inputPath
    ? path.resolve(process.cwd(), inputPath)
    : DEFAULT_QUESTION_BANK_PATH;
  const extension = path.extname(resolvedPath).toLowerCase();

  const rawData =
    extension === ".json"
      ? await loadBankJson(resolvedPath)
      : await loadBankModule(resolvedPath);

  return questionBankSchema.parse(rawData);
}

export function previewQuestionBankImport(input: z.infer<typeof importPayloadSchema>) {
  const payload = importPayloadSchema.parse(input);
  const parsed = parseImportedPayload(payload.payloadText, payload.titleHr);
  const sourceSnippets =
    parsed.sourceType === "SCRIPT"
      ? splitScriptIntoSections(payload.payloadText, payload.titleHr).map((section) =>
          truncateText(section.bodyHr, 260),
        )
      : undefined;

  return buildImportPreview(
    parsed.questionBank,
    payload.titleHr,
    parsed.sourceType,
    sourceSnippets,
  );
}

export async function createSourceImport(
  prisma: PrismaClient,
  input: {
    titleHr: string;
    payloadText: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  },
) {
  const payload = importPayloadSchema.parse(input);
  const parsed = parseImportedPayload(payload.payloadText, payload.titleHr);
  const sourceSnippets =
    parsed.sourceType === "SCRIPT"
      ? splitScriptIntoSections(payload.payloadText, payload.titleHr).map((section) =>
          truncateText(section.bodyHr, 260),
        )
      : undefined;
  const preview = buildImportPreview(
    parsed.questionBank,
    payload.titleHr,
    parsed.sourceType,
    sourceSnippets,
  );

  const sourceImport = await prisma.sourceImport.create({
    data: {
      titleHr: preview.titleHr,
      sourceType: parsed.sourceType,
      status: input.status ?? "PUBLISHED",
      rawPayload: payload.payloadText,
      normalizedPayload: parsed.questionBank,
      improvedPayload: {
        lessons: preview.lessons,
        summary: {
          topicCount: preview.topicCount,
          questionCount: preview.questionCount,
        },
        sampleQuestions: preview.sampleQuestions,
      },
    },
  });

  for (const [index, topic] of parsed.questionBank.entries()) {
    const createdTopic = await prisma.topic.create({
      data: {
        slug: buildStoredTopicSlug(topic.slug, sourceImport.id),
        sourceImportId: sourceImport.id,
        titleHr: topic.titleHr,
        descriptionHr: topic.descriptionHr,
        accent: topic.accent,
        difficulty: topic.difficulty,
        flashcards: {
          create: topic.flashcards.map((flashcard, flashcardIndex) => ({
            questionHr: flashcard.questionHr,
            explanationHr: flashcard.explanationHr,
            correctOptionId: flashcard.correctOptionId,
            difficulty: flashcard.difficulty,
            sortOrder: flashcardIndex + 1,
            options: flashcard.options,
          })),
        },
      },
    });

    const lesson = preview.lessons[index];

    await prisma.studyLesson.create({
      data: {
        sourceImportId: sourceImport.id,
        topicId: createdTopic.id,
        titleHr: lesson.titleHr,
        overviewHr: lesson.overviewHr,
        lessonJson: lesson,
        sortOrder: lesson.sortOrder,
      },
    });
  }

  return {
    importId: sourceImport.id,
    titleHr: sourceImport.titleHr,
    sourceType: sourceImport.sourceType,
    status: sourceImport.status,
    topicCount: preview.topicCount,
    questionCount: preview.questionCount,
    lessons: preview.lessons,
    topics: preview.topics,
    sampleQuestions: preview.sampleQuestions,
  };
}

export async function replaceQuestionBank(
  prisma: PrismaClient,
  questionBank: QuestionBank,
  titleHr = "Demo farmakologija",
) {
  await prisma.$transaction([
    prisma.attempt.deleteMany(),
    prisma.flashcard.deleteMany(),
    prisma.studyLesson.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.sourceImport.deleteMany(),
    prisma.player.updateMany({
      data: {
        xp: 0,
        level: 1,
        streak: 0,
        hearts: 5,
        totalAnswered: 0,
        correctAnswers: 0,
        lastAnsweredAt: null,
      },
    }),
  ]);

  return createSourceImport(prisma, {
    titleHr,
    payloadText: JSON.stringify(questionBank, null, 2),
    status: "PUBLISHED",
  });
}
