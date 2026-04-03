import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSON5 from "json5";
import { z } from "zod";
import type { PrismaClient, SourceType } from "../generated/prisma/client.js";
import { generateAiStudyMaterial } from "./ai-study-generator.js";

const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);
const sourceTypeSchema = z.enum(["SCRIPT", "JSON", "PDF"]);

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
  payloadText: z.string().trim().optional().default(""),
  sourceTypeHint: sourceTypeSchema.optional(),
  originalFileName: z.string().trim().min(1).max(240).optional(),
  pdfFileData: z.string().trim().min(1).optional(),
  documentPageCount: z.number().int().positive().max(5_000).optional(),
  documentByteSize: z.number().int().positive().max(100_000_000).optional(),
}).superRefine((value, context) => {
  const hasPayloadText = Boolean(value.payloadText?.trim());
  const hasPdfFileData = Boolean(value.pdfFileData?.trim());

  if (!hasPayloadText && !hasPdfFileData) {
    context.addIssue({
      code: "custom",
      message: "Dodaj TXT sadrzaj ili PDF datoteku prije importa.",
      path: ["payloadText"],
    });
  }

  if (value.sourceTypeHint === "PDF" && !hasPdfFileData && !hasPayloadText) {
    context.addIssue({
      code: "custom",
      message: "PDF import treba barem PDF datoteku ili citljiv tekst.",
      path: ["pdfFileData"],
    });
  }
});

export type QuestionBank = z.infer<typeof questionBankSchema>;
export type ProcessingMode = "AI" | "HEURISTIC";

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

type ImportSummaryPayload = {
  topicCount: number;
  questionCount: number;
  processingMode: ProcessingMode;
  processingNotesHr: string;
};

type ParsedImportPayload = {
  questionBank: QuestionBank;
  sourceType: SourceType;
  lessons?: LessonPayload[];
  processingMode: ProcessingMode;
  processingNotesHr: string;
};

type RawSection = {
  titleHr: string;
  bodyHr: string;
  facts: string[];
};

const ACCENT_PALETTE = [
  "#0f766e",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be185d",
  "#4d7c0f",
];

const GENERIC_DISTRACTORS = [
  "Opisuje suprotan mehanizam djelovanja od navedenog u skripti.",
  "Naglasak stavlja na laboratorijski detalj, a ne na klinicki ucinak.",
  "Tvrdnja vrijedi za drugu skupinu lijekova nego u ovoj temi.",
  "Odnosi se na izolirani tehnicki podatak koji nije istaknut u ovoj cjelini.",
  "Skripta ne povezuje ovaj pojam s navedenom terapijskom ulogom.",
  "Ova tvrdnja pojednostavljuje temu i mijenja njezin glavni klinicki smisao.",
];

const HEADING_SECTION_THRESHOLD = 3;
const MAX_SECTION_BODY_LENGTH = 4_800;
const MAX_FACTS_PER_SECTION = 12;
const MAX_FLASHCARDS_PER_SECTION = 6;
const MIN_FLASHCARDS_PER_SECTION = 3;
const PAGE_MARKER_PATTERN = /\[\[PAGE:(\d+)\]\]/u;

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

  if (limit <= 3) {
    return normalized.slice(0, limit);
  }

  return `${normalized.slice(0, limit - 3).trim()}...`;
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

function detectSourceType(
  payloadText: string,
  sourceTypeHint?: z.infer<typeof sourceTypeSchema>,
): SourceType {
  if (sourceTypeHint === "PDF") {
    return "PDF";
  }

  if (sourceTypeHint === "SCRIPT" || sourceTypeHint === "JSON") {
    return sourceTypeHint;
  }

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
    .replace(/[:\-]\s*$/u, "")
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

function extractPdfPageBodies(payloadText: string) {
  const normalized = normalizeScriptText(payloadText);
  const matches = normalized.matchAll(
    /\[\[PAGE:(\d+)\]\]\s*([\s\S]*?)(?=\n\s*\[\[PAGE:\d+\]\]|$)/gu,
  );
  const pages = [...matches]
    .map((match) => match[2]?.trim() ?? "")
    .filter(Boolean);

  return pages;
}

function resolveChunkHeading(bodyHr: string, titleHr: string, index: number) {
  const lines = bodyHr
    .split("\n")
    .map((line) => line.replace(PAGE_MARKER_PATTERN, "").trim())
    .filter(Boolean)
    .slice(0, 6);
  const headingLine = lines.find((line) => isLikelyHeading(line));

  if (headingLine) {
    return cleanHeadingCandidate(headingLine);
  }

  const firstSentence = extractSentences(bodyHr)[0];

  if (firstSentence) {
    const concept = extractConceptLabel(firstSentence, "");

    if (concept && concept.length >= 4 && concept.toLowerCase() !== titleHr.toLowerCase()) {
      return truncateText(concept, 72);
    }
  }

  return `${titleHr} cjelina ${index}`;
}

function chunkParagraphsIntoSections(paragraphs: string[], titleHr: string) {
  const sections: RawSection[] = [];
  let currentParagraphs: string[] = [];
  let currentLength = 0;

  const pushCurrent = () => {
    if (!currentParagraphs.length) {
      return;
    }

    const bodyHr = currentParagraphs.join("\n\n").trim();

    if (!bodyHr) {
      currentParagraphs = [];
      currentLength = 0;
      return;
    }

    sections.push({
      titleHr: resolveChunkHeading(bodyHr, titleHr, sections.length + 1),
      bodyHr,
      facts: [],
    });
    currentParagraphs = [];
    currentLength = 0;
  };

  for (const paragraph of paragraphs) {
    const paragraphLength = paragraph.length;

    if (currentLength > 0 && currentLength + paragraphLength > MAX_SECTION_BODY_LENGTH) {
      pushCurrent();
    }

    currentParagraphs.push(paragraph);
    currentLength += paragraphLength;
  }

  pushCurrent();

  return sections;
}

function buildChunkedSections(payloadText: string, titleHr: string) {
  const pageBodies = extractPdfPageBodies(payloadText);

  if (pageBodies.length >= 2) {
    const targetSectionCount = Math.min(14, Math.max(6, Math.ceil(pageBodies.length / 12)));
    const pagesPerSection = Math.max(1, Math.ceil(pageBodies.length / targetSectionCount));
    const sections: RawSection[] = [];

    for (let index = 0; index < pageBodies.length; index += pagesPerSection) {
      const bodyHr = pageBodies.slice(index, index + pagesPerSection).join("\n\n").trim();

      if (!bodyHr) {
        continue;
      }

      sections.push({
        titleHr: resolveChunkHeading(bodyHr, titleHr, sections.length + 1),
        bodyHr,
        facts: [],
      });
    }

    if (sections.length > 1) {
      return sections;
    }
  }

  const normalized = normalizeScriptText(payloadText)
    .replace(/\[\[PAGE:\d+\]\]/gu, "")
    .trim();
  const paragraphs = normalized
    .split(/\n\s*\n+/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length >= 2) {
    return chunkParagraphsIntoSections(paragraphs, titleHr);
  }

  const sentences = extractSentences(normalized);

  if (sentences.length >= 6) {
    const syntheticParagraphs: string[] = [];

    for (let index = 0; index < sentences.length; index += 8) {
      syntheticParagraphs.push(sentences.slice(index, index + 8).join(" "));
    }

    return chunkParagraphsIntoSections(syntheticParagraphs, titleHr);
  }

  return [
    {
      titleHr,
      bodyHr: normalized,
      facts: [],
    },
  ];
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
    const isPageMarker = PAGE_MARKER_PATTERN.test(firstLine);
    const heading = cleanHeadingCandidate(firstLine);
    const isHeadingOnly = lines.length === 1 && !isPageMarker && isLikelyHeading(firstLine);
    const isTitledBlock =
      !isPageMarker &&
      lines.length > 1 &&
      (isLikelyHeading(firstLine) || /^[A-Za-z0-9][^.!?]{3,80}:\s*$/u.test(firstLine));

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

    const blockBody = isPageMarker ? lines.slice(1).join("\n") : block;

    if (blockBody.trim()) {
      current.bodyParts.push(blockBody);
    }
  }

  pushCurrent();

  const resolvedSections = sections.map((section) => ({
    titleHr: section.titleHr,
    bodyHr: section.bodyParts[0],
    facts: [],
  }));

  const needsChunking =
    resolvedSections.length === 0 ||
    resolvedSections.length < HEADING_SECTION_THRESHOLD ||
    resolvedSections.some((section) => section.bodyHr.length > MAX_SECTION_BODY_LENGTH) ||
    (extractPdfPageBodies(payloadText).length >= 6 && resolvedSections.length <= 2);

  if (needsChunking) {
    return buildChunkedSections(payloadText, titleHr);
  }

  return resolvedSections;
}

function extractFactsFromSection(section: RawSection) {
  const bulletFacts = section.bodyHr
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        /^[\-\*\u2022]/u.test(line) || /^[A-Za-z0-9][^.!?]{3,80}:\s+/u.test(line),
    )
    .map(cleanInlineText);

  const sentences = extractSentences(section.bodyHr)
    .map((sentence) => truncateText(sentence.replace(/\.$/, ""), 180))
    .filter((sentence) => sentence.length >= 25);

  const facts = uniqueStrings([...bulletFacts, ...sentences]).slice(0, MAX_FACTS_PER_SECTION);

  return facts.length > 0
    ? facts
    : [truncateText(section.bodyHr.replace(/\n/g, " "), 180)];
}

function extractConceptLabel(statementHr: string, fallbackTitleHr: string) {
  const normalized = statementHr
    .replace(/^Tocno prema importiranoj skripti:\s*/u, "")
    .replace(/\.$/, "")
    .trim();
  const separatorMatch = normalized.match(/^([^:-]{3,60})[:-]\s+/u);

  if (separatorMatch?.[1]) {
    return separatorMatch[1].trim();
  }

  const definitionMatch = normalized.match(/^([A-Za-z0-9][^,]{3,60})\s+(je|su)\b/u);

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

function buildOptionsFromAnswers(
  correctAnswerHr: string,
  distractorsHr: string[],
  seed: number,
) {
  return buildOptions(correctAnswerHr, distractorsHr, seed);
}

function inferDifficulty(
  questionCount: number,
  bodyLength: number,
): QuestionBank[number]["difficulty"] {
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

function buildLessonPayload(
  topic: QuestionBank[number],
  sortOrder: number,
  sourceSnippetHr?: string,
): LessonPayload {
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
    "Povezi kljucne pojmove s objasnjenjima prije nego otvoris test.",
    `Provjeri razumijes li zasto je razina tezine oznacena kao ${topic.difficulty.toLowerCase()}.`,
  ];

  return {
    id: `preview-${sortOrder}`,
    titleHr: topic.titleHr,
    overviewHr: `${topic.descriptionHr} Ova verzija pretvara importirani materijal u jasne blokove za ucenje i brzu repeticiju prije testa.`,
    sourceSnippetHr,
    keyConceptsHr,
    studyPromptsHr,
    recallChecklistHr,
    sortOrder,
  };
}

function buildLessonPayloadsFromQuestionBank(
  questionBank: QuestionBank,
  sourceSnippets?: string[],
) {
  return questionBank.map((topic, index) =>
    buildLessonPayload(topic, index + 1, sourceSnippets?.[index]),
  );
}

function buildQuestionBankFromAiMaterial(
  material: NonNullable<Awaited<ReturnType<typeof generateAiStudyMaterial>>>,
): QuestionBank {
  const topics = material.lessons.map((lesson, lessonIndex) => ({
    slug: `${slugify(lesson.titleHr)}-${lessonIndex + 1}`,
    titleHr: lesson.titleHr,
    descriptionHr: lesson.topicDescriptionHr,
    accent: ACCENT_PALETTE[lessonIndex % ACCENT_PALETTE.length],
    difficulty: lesson.difficulty,
    flashcards: lesson.flashcards.map((flashcard, flashcardIndex) => {
      const { options, correctOptionId } = buildOptionsFromAnswers(
        flashcard.correctAnswerHr,
        flashcard.distractorsHr,
        lessonIndex + flashcardIndex + 1,
      );

      return {
        questionHr: flashcard.questionHr,
        explanationHr: flashcard.explanationHr,
        correctOptionId,
        difficulty: flashcard.difficulty,
        options,
      };
    }),
  }));

  return questionBankSchema.parse(topics);
}

function buildLessonPayloadsFromAiMaterial(
  material: NonNullable<Awaited<ReturnType<typeof generateAiStudyMaterial>>>,
) {
  return material.lessons.map((lesson, index) => ({
    id: `preview-${index + 1}`,
    titleHr: lesson.titleHr,
    overviewHr: lesson.overviewHr,
    keyConceptsHr: uniqueStrings(lesson.keyConceptsHr).slice(0, 6),
    studyPromptsHr: uniqueStrings(lesson.studyPromptsHr).slice(0, 4),
    recallChecklistHr: uniqueStrings(lesson.recallChecklistHr).slice(0, 5),
    sortOrder: index + 1,
  }));
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
    const flashcardLimit = Math.max(
      Math.min(MIN_FLASHCARDS_PER_SECTION, facts.length),
      Math.min(MAX_FLASHCARDS_PER_SECTION, Math.ceil(facts.length * 0.6)),
    );
    const flashcards = facts
      .slice(0, Math.max(1, flashcardLimit))
      .map((fact, factIndex) => {
        const distractorPool = factPool.filter((candidate) => candidate !== fact);
        const { options, correctOptionId } = buildOptions(
          fact,
          distractorPool,
          index + factIndex + 1,
        );

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

async function parseImportedPayload(
  input: z.infer<typeof importPayloadSchema>,
): Promise<ParsedImportPayload> {
  const payloadText = input.payloadText ?? "";
  const sourceType = detectSourceType(payloadText, input.sourceTypeHint);

  if (sourceType === "JSON") {
    const questionBank = parseQuestionBankFromText(payloadText);

    return {
      questionBank,
      sourceType,
      lessons: buildLessonPayloadsFromQuestionBank(questionBank),
      processingMode: "HEURISTIC",
      processingNotesHr:
        "Strukturirani question bank je procitan izravno i pretvoren u Learn i Test sadrzaj.",
    };
  }

  if (looksLikeStructuredQuestionBank(payloadText)) {
    try {
      const questionBank = parseQuestionBankFromText(payloadText);

      return {
        questionBank,
        sourceType,
        lessons: buildLessonPayloadsFromQuestionBank(questionBank),
        processingMode: "HEURISTIC",
        processingNotesHr:
          "Strukturirani question bank je pronaden u skripti pa nije trebala dodatna AI obrada.",
      };
    } catch {
      // Continue into the document-processing path.
    }
  }

  try {
    const aiMaterial = await generateAiStudyMaterial({
      titleHr: input.titleHr,
      payloadText,
      pdfFileData: input.pdfFileData,
      originalFileName: input.originalFileName,
    });

    if (aiMaterial) {
      return {
        questionBank: buildQuestionBankFromAiMaterial(aiMaterial),
        sourceType,
        lessons: buildLessonPayloadsFromAiMaterial(aiMaterial),
        processingMode: "AI",
        processingNotesHr: aiMaterial.processingNotesHr,
      };
    }
  } catch (error) {
    console.warn("AI import processing failed, falling back to heuristic mode.", error);
  }

  if (!payloadText.trim()) {
    throw new Error(
      "PDF je ucitan, ali nema lokalno izdvojen tekst, a AI obrada nije dostupna. Dodaj OPENAI_API_KEY ili probaj PDF s tekstualnim slojem.",
    );
  }

  const questionBank = buildQuestionBankFromScript(payloadText, input.titleHr);
  const sourceSnippets =
    sourceType === "SCRIPT" || sourceType === "PDF"
      ? splitScriptIntoSections(payloadText, input.titleHr).map((section) =>
          truncateText(section.bodyHr, 220),
        )
      : undefined;

  return {
    questionBank,
    sourceType,
    lessons: buildLessonPayloadsFromQuestionBank(questionBank, sourceSnippets),
    processingMode: "HEURISTIC",
    processingNotesHr:
      "Skripta je obradena lokalnim parserom jer AI nije konfiguriran ili obrada nije uspjela.",
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
  options?: {
    lessons?: LessonPayload[];
    processingMode?: ProcessingMode;
    processingNotesHr?: string;
    sourceSnippets?: string[];
  },
) {
  const topics: TopicPreview[] = questionBank.map((topic) => ({
    slug: topic.slug,
    titleHr: topic.titleHr,
    descriptionHr: topic.descriptionHr,
    accent: topic.accent,
    difficulty: topic.difficulty,
    questionCount: topic.flashcards.length,
  }));

  const lessons =
    options?.lessons ??
    buildLessonPayloadsFromQuestionBank(questionBank, options?.sourceSnippets);
  const questionCount = questionBank.reduce(
    (sum, topic) => sum + topic.flashcards.length,
    0,
  );

  return {
    titleHr,
    sourceType,
    processingMode: options?.processingMode ?? "HEURISTIC",
    processingNotesHr:
      options?.processingNotesHr ?? "Sadrzaj je pripremljen za Learn i Test prikaz.",
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

export async function previewQuestionBankImport(input: z.infer<typeof importPayloadSchema>) {
  const payload = importPayloadSchema.parse(input);
  const parsed = await parseImportedPayload(payload);
  const sourceSnippets =
    !parsed.lessons &&
    (parsed.sourceType === "SCRIPT" || parsed.sourceType === "PDF") &&
    payload.payloadText
      ? splitScriptIntoSections(payload.payloadText, payload.titleHr).map((section) =>
          truncateText(section.bodyHr, 260),
        )
      : undefined;

  return buildImportPreview(parsed.questionBank, payload.titleHr, parsed.sourceType, {
    lessons: parsed.lessons,
    processingMode: parsed.processingMode,
    processingNotesHr: parsed.processingNotesHr,
    sourceSnippets,
  });
}

export async function createSourceImport(
  prisma: PrismaClient,
  input: {
    titleHr: string;
    payloadText?: string;
    sourceTypeHint?: z.infer<typeof sourceTypeSchema>;
    originalFileName?: string;
    pdfFileData?: string;
    documentPageCount?: number;
    documentByteSize?: number;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    isPinned?: boolean;
    isSystem?: boolean;
  },
) {
  const payload = importPayloadSchema.parse(input);
  const parsed = await parseImportedPayload(payload);
  const sourceSnippets =
    !parsed.lessons &&
    (parsed.sourceType === "SCRIPT" || parsed.sourceType === "PDF") &&
    payload.payloadText
      ? splitScriptIntoSections(payload.payloadText, payload.titleHr).map((section) =>
          truncateText(section.bodyHr, 260),
        )
      : undefined;
  const preview = buildImportPreview(parsed.questionBank, payload.titleHr, parsed.sourceType, {
    lessons: parsed.lessons,
    processingMode: parsed.processingMode,
    processingNotesHr: parsed.processingNotesHr,
    sourceSnippets,
  });
  const rawPayload =
    payload.payloadText?.trim() ||
    `[PDF import bez lokalnog teksta] ${payload.originalFileName ?? payload.titleHr}`;

  const sourceImport = await prisma.sourceImport.create({
    data: {
      titleHr: preview.titleHr,
      sourceType: parsed.sourceType,
      status: input.status ?? "PUBLISHED",
      isPinned: input.isPinned ?? false,
      isSystem: input.isSystem ?? false,
      rawPayload,
      normalizedPayload: parsed.questionBank,
      improvedPayload: {
        lessons: preview.lessons,
        summary: {
          topicCount: preview.topicCount,
          questionCount: preview.questionCount,
          processingMode: parsed.processingMode,
          processingNotesHr: parsed.processingNotesHr,
          documentPageCount: payload.documentPageCount,
          documentByteSize: payload.documentByteSize,
          originalFileName: payload.originalFileName,
        },
        sampleQuestions: preview.sampleQuestions,
      },
    },
  });

  for (const [index, topic] of parsed.questionBank.entries()) {
    const createdTopic = await prisma.topic.create({
      data: {
        slug: buildStoredTopicSlug(topic.slug, sourceImport.id),
        sourceImport: {
          connect: {
            id: sourceImport.id,
          },
        },
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
        sourceImport: {
          connect: {
            id: sourceImport.id,
          },
        },
        topic: {
          connect: {
            id: createdTopic.id,
          },
        },
        titleHr: lesson.titleHr,
        overviewHr: lesson.overviewHr,
        lessonJson: lesson,
        sortOrder: lesson.sortOrder,
      },
    });
  }

  const linkedTopics = await prisma.topic.findMany({
    where: {
      sourceImportId: sourceImport.id,
    },
    select: {
      id: true,
      titleHr: true,
      descriptionHr: true,
    },
  });

  for (const topic of parsed.questionBank) {
    const linkedTopic = linkedTopics.find(
      (candidate) =>
        candidate.titleHr === topic.titleHr &&
        candidate.descriptionHr === topic.descriptionHr,
    );

    if (!linkedTopic) {
      await prisma.topic.updateMany({
        where: {
          sourceImportId: null,
          titleHr: topic.titleHr,
          descriptionHr: topic.descriptionHr,
        },
        data: {
          sourceImportId: sourceImport.id,
        },
      });
    }
  }

  const repairedTopics = await prisma.topic.findMany({
    where: {
      sourceImportId: sourceImport.id,
    },
    select: {
      id: true,
      titleHr: true,
      descriptionHr: true,
    },
  });

  for (const lesson of preview.lessons) {
    const matchingTopic = repairedTopics.find((topic) => topic.titleHr === lesson.titleHr);

    if (!matchingTopic) {
      continue;
    }

    await prisma.studyLesson.updateMany({
      where: {
        sourceImportId: sourceImport.id,
        titleHr: lesson.titleHr,
        topicId: null,
      },
      data: {
        topicId: matchingTopic.id,
      },
    });
  }

  return {
    importId: sourceImport.id,
    titleHr: sourceImport.titleHr,
    sourceType: sourceImport.sourceType,
    status: sourceImport.status,
    isPinned: sourceImport.isPinned,
    isSystem: sourceImport.isSystem,
    processingMode: parsed.processingMode,
    processingNotesHr: parsed.processingNotesHr,
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
  titleHr = "Training",
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
    sourceTypeHint: "JSON",
    status: "PUBLISHED",
    isPinned: true,
    isSystem: true,
  });
}
