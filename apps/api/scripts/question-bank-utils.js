import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import JSON5 from "json5";
import { z } from "zod";
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
export const DEFAULT_QUESTION_BANK_PATH = path.resolve(process.cwd(), "prisma/seedData.ts");
async function loadBankModule(filePath) {
    const moduleUrl = pathToFileURL(filePath).href;
    const imported = await import(moduleUrl);
    return imported.default ?? imported.questionBank;
}
async function loadBankJson(filePath) {
    const file = await readFile(filePath, "utf8");
    return JSON.parse(file);
}
function buildStoredTopicSlug(slug, sourceImportId) {
    return `${slug}-${sourceImportId.slice(-6)}`;
}
function extractArrayLiteral(payloadText) {
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
function detectSourceType(payloadText) {
    const trimmed = payloadText.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        return "JSON";
    }
    return "SCRIPT";
}
function parseQuestionBankFromText(payloadText) {
    const arrayLiteral = extractArrayLiteral(payloadText).replace(/\sas const/g, "");
    const parsed = JSON5.parse(arrayLiteral);
    return questionBankSchema.parse(parsed);
}
function uniqueStrings(values) {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function buildLessonPayload(topic, sortOrder) {
    const keyConceptsHr = uniqueStrings(topic.flashcards.map((flashcard) => flashcard.explanationHr.replace(/\s+/g, " ").trim())).slice(0, 4);
    const studyPromptsHr = topic.flashcards
        .map((flashcard) => flashcard.questionHr.replace(/\s+/g, " ").trim())
        .slice(0, 4);
    const recallChecklistHr = [
        `Prodji ${topic.flashcards.length} pitanja za temu ${topic.titleHr.toLowerCase()}.`,
        `Obrati paznju na razinu tezine: ${topic.difficulty.toLowerCase()}.`,
        "Ponovi objasnjenja i usporedi slicne odgovore prije kviza.",
    ];
    return {
        id: `preview-${sortOrder}`,
        titleHr: topic.titleHr,
        overviewHr: `${topic.descriptionHr} Ova verzija pretvara importirani materijal u jasne blokove za ucenje i brzu repeticiju prije kviza.`,
        keyConceptsHr,
        studyPromptsHr,
        recallChecklistHr,
        sortOrder,
    };
}
export function buildImportPreview(questionBank, titleHr, sourceType) {
    const topics = questionBank.map((topic) => ({
        slug: topic.slug,
        titleHr: topic.titleHr,
        descriptionHr: topic.descriptionHr,
        accent: topic.accent,
        difficulty: topic.difficulty,
        questionCount: topic.flashcards.length,
    }));
    const lessons = questionBank.map((topic, index) => buildLessonPayload(topic, index + 1));
    const questionCount = questionBank.reduce((sum, topic) => sum + topic.flashcards.length, 0);
    return {
        titleHr,
        sourceType,
        topicCount: topics.length,
        questionCount,
        topics,
        lessons,
    };
}
export async function loadQuestionBank(inputPath) {
    const resolvedPath = inputPath
        ? path.resolve(process.cwd(), inputPath)
        : DEFAULT_QUESTION_BANK_PATH;
    const extension = path.extname(resolvedPath).toLowerCase();
    const rawData = extension === ".json"
        ? await loadBankJson(resolvedPath)
        : await loadBankModule(resolvedPath);
    return questionBankSchema.parse(rawData);
}
export function previewQuestionBankImport(input) {
    const payload = importPayloadSchema.parse(input);
    const questionBank = parseQuestionBankFromText(payload.payloadText);
    const sourceType = detectSourceType(payload.payloadText);
    return buildImportPreview(questionBank, payload.titleHr, sourceType);
}
export async function createSourceImport(prisma, input) {
    const payload = importPayloadSchema.parse(input);
    const questionBank = parseQuestionBankFromText(payload.payloadText);
    const sourceType = detectSourceType(payload.payloadText);
    const preview = buildImportPreview(questionBank, payload.titleHr, sourceType);
    const sourceImport = await prisma.sourceImport.create({
        data: {
            titleHr: preview.titleHr,
            sourceType,
            status: input.status ?? "PUBLISHED",
            rawPayload: payload.payloadText,
            normalizedPayload: questionBank,
            improvedPayload: {
                lessons: preview.lessons,
                summary: {
                    topicCount: preview.topicCount,
                    questionCount: preview.questionCount,
                },
            },
        },
    });
    for (const [index, topic] of questionBank.entries()) {
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
    };
}
export async function replaceQuestionBank(prisma, questionBank, titleHr = "Demo farmakologija") {
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
