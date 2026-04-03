import OpenAI from "openai";
import { z } from "zod";

const difficultySchema = z.enum(["EASY", "MEDIUM", "HARD"]);

const chunkInsightSchema = z.object({
  chunkLabelHr: z.string().trim().min(3).max(140),
  summaryHr: z.string().trim().min(40).max(420),
  mainThemesHr: z.array(z.string().trim().min(2).max(120)).min(3).max(8),
  highYieldFactsHr: z.array(z.string().trim().min(12).max(220)).min(4).max(10),
  pitfallsHr: z.array(z.string().trim().min(12).max(220)).max(5).default([]),
  memoryHooksHr: z.array(z.string().trim().min(6).max(180)).max(4).default([]),
});

const flashcardDraftSchema = z.object({
  questionHr: z.string().trim().min(10).max(240),
  explanationHr: z.string().trim().min(20).max(360),
  difficulty: difficultySchema,
  correctAnswerHr: z.string().trim().min(2).max(200),
  distractorsHr: z.array(z.string().trim().min(2).max(200)).length(3),
});

const lessonDraftSchema = z.object({
  titleHr: z.string().trim().min(3).max(140),
  overviewHr: z.string().trim().min(70).max(540),
  topicDescriptionHr: z.string().trim().min(40).max(220),
  difficulty: difficultySchema,
  keyConceptsHr: z.array(z.string().trim().min(2).max(90)).min(3).max(6),
  studyPromptsHr: z.array(z.string().trim().min(8).max(180)).min(2).max(4),
  recallChecklistHr: z.array(z.string().trim().min(8).max(180)).min(3).max(5),
  flashcards: z.array(flashcardDraftSchema).min(2).max(4),
});

const aiStudyMaterialSchema = z.object({
  processingNotesHr: z.string().trim().min(20).max(320),
  lessons: z.array(lessonDraftSchema).min(1).max(10),
});

export type AiChunkInsight = z.infer<typeof chunkInsightSchema>;
export type AiStudyMaterial = z.infer<typeof aiStudyMaterialSchema>;

type GenerateAiStudyMaterialInput = {
  titleHr: string;
  payloadText: string;
  pdfFileData?: string;
  originalFileName?: string;
};

const DEFAULT_MODEL = process.env.OPENAI_STUDY_MODEL?.trim() || "gpt-4o-mini";
const TEXT_DIRECT_THRESHOLD = 48_000;
const CHUNK_TARGET_SIZE = 14_000;
const CHUNK_OVERLAP_SIZE = 1_200;
const CHUNK_CONCURRENCY = 2;

let openAiClient: OpenAI | null | undefined;

function getOpenAiClient() {
  if (openAiClient !== undefined) {
    return openAiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  openAiClient = apiKey ? new OpenAI({ apiKey }) : null;
  return openAiClient;
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripJsonFences(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function splitLargeParagraph(paragraph: string, limit: number) {
  if (paragraph.length <= limit) {
    return [paragraph];
  }

  const sentences = paragraph.split(/(?<=[.!?])\s+/u).filter(Boolean);
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) {
      parts.push(current.trim());
    }

    current = sentence;

    if (current.length > limit) {
      parts.push(current.slice(0, limit).trim());
      current = current.slice(limit).trim();
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function buildTextChunks(value: string, maxChars = CHUNK_TARGET_SIZE, overlap = CHUNK_OVERLAP_SIZE) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n\s*\n+/u)
    .flatMap((paragraph) => splitLargeParagraph(paragraph.trim(), maxChars))
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current.trim());
    }

    const overlapText =
      overlap > 0 && current.length > overlap ? current.slice(-overlap).trim() : "";
    current = overlapText ? `${overlapText}\n\n${paragraph}` : paragraph;

    if (current.length > maxChars) {
      chunks.push(current.slice(0, maxChars).trim());
      current = current.slice(maxChars - overlap).trim();
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

async function mapWithConcurrency<TInput, TOutput>(
  values: TInput[],
  concurrency: number,
  mapper: (value: TInput, index: number) => Promise<TOutput>,
) {
  const results = new Array<TOutput>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, values.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function requestJson<T>({
  systemPrompt,
  userContent,
  schema,
  maxCompletionTokens,
}: {
  systemPrompt: string;
  userContent: any;
  schema: z.ZodType<T>;
  maxCompletionTokens: number;
}) {
  const client = getOpenAiClient();

  if (!client) {
    return null;
  }

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    response_format: {
      type: "json_object",
    },
    store: false,
    temperature: 0.2,
    max_completion_tokens: maxCompletionTokens,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userContent,
      },
    ],
  } as any);

  const content = response.choices?.[0]?.message?.content;
  const jsonText = Array.isArray(content)
    ? content
        .map((item) => (typeof item === "string" ? item : ("text" in item ? item.text : "")))
        .join("")
    : content;

  if (!jsonText) {
    throw new Error("AI nije vratio strukturirani odgovor.");
  }

  const parsed = JSON.parse(stripJsonFences(jsonText));
  return schema.parse(parsed);
}

async function summarizeChunk(titleHr: string, chunkText: string, chunkIndex: number) {
  return requestJson({
    systemPrompt:
      "Ti si medicinski urednik koji priprema hrvatske materijale za ucenje farmakologije. Sa svakim ulomkom radi sazet, pregledan i visoko-vrijedan sazetak. Nemoj prepisivati originalni tekst, nemoj vracati markdown i nemoj izmisljati informacije koje nisu prisutne u ulomku.",
    userContent: [
      {
        type: "text",
        text: [
          `Naslov predmeta: ${titleHr}`,
          `Ulomak broj: ${chunkIndex + 1}`,
          "Vrati strogo JSON sa sazetkom ulomka, glavnim temama, high-yield cinjenicama, zamkama i memory hookovima za brzo ponavljanje.",
          "Svi tekstovi moraju biti na hrvatskom jeziku.",
          "",
          chunkText,
        ].join("\n"),
      },
    ],
    schema: chunkInsightSchema,
    maxCompletionTokens: 1800,
  });
}

async function synthesizeFromText(titleHr: string, payloadText: string) {
  return requestJson({
    systemPrompt:
      "Ti si senior edukator za farmakologiju koji stvara premium materijale za ucenje na hrvatskom jeziku. Cilj je od cijelog dokumenta napraviti uredne lekcije za ucenje i kvalitetna pitanja za test. Nemoj prepisivati sirovi tekst dokumenta. Umjesto toga, sintetiziraj gradivo u jasne cjeline, klinicki korisne sazetke i provjere znanja. Pitanja moraju imati jedan tocan odgovor i tri uvjerljiva distraktora.",
    userContent: [
      {
        type: "text",
        text: [
          `Naslov predmeta: ${titleHr}`,
          "Na temelju cijelog dokumenta vrati strogo JSON koji sadrzi processingNotesHr i lessons.",
          "Svaka lekcija mora imati overviewHr, topicDescriptionHr, difficulty, keyConceptsHr, studyPromptsHr, recallChecklistHr i 2 do 4 flashcards.",
          "Nemoj citirati dokument doslovno duljim odlomcima i nemoj vracati sirove isjecke.",
          "",
          payloadText,
        ].join("\n"),
      },
    ],
    schema: aiStudyMaterialSchema,
    maxCompletionTokens: 5200,
  });
}

async function synthesizeFromChunkInsights(titleHr: string, chunkInsights: AiChunkInsight[]) {
  return requestJson({
    systemPrompt:
      "Ti si senior edukator za farmakologiju. Iz niza sazetih ulomaka sastavi jednu konzistentnu, logicki poredanu mapu ucenja na hrvatskom jeziku. Ne prepisuj ulomke, nego ih spajaj u uredne lekcije i provjere znanja. Pokrij cijeli dokument, sacuvaj redoslijed kada ima smisla i fokusiraj se na ono sto student mora razumjeti prije testa.",
    userContent: [
      {
        type: "text",
        text: [
          `Naslov predmeta: ${titleHr}`,
          "Iz ovih sazetaka cijelog dokumenta vrati strogo JSON sa processingNotesHr i lessons.",
          "Slozi 3 do 10 lekcija ovisno o sirini materijala. Svaka lekcija mora imati 2 do 4 pitanja.",
          "Ne vracaj raw tekst dokumenta.",
          "",
          JSON.stringify(chunkInsights),
        ].join("\n"),
      },
    ],
    schema: aiStudyMaterialSchema,
    maxCompletionTokens: 5200,
  });
}

async function synthesizeDirectlyFromPdf(
  titleHr: string,
  pdfFileData: string,
  originalFileName?: string,
) {
  return requestJson({
    systemPrompt:
      "Ti si senior edukator za farmakologiju koji cita cijeli PDF i iz njega pravi uredne hrvatske materijale za ucenje. Nemoj prepisivati sirovi PDF. Vrati pregledne lekcije i kvalitetna pitanja za test. Ako dokument sadrzi puno stranica, pokrij najvaznije cjeline i sacuvaj logicki tok gradiva.",
    userContent: [
      {
        type: "text",
        text: [
          `Naslov predmeta: ${titleHr}`,
          "Procitaj cijeli PDF i vrati strogo JSON sa processingNotesHr i lessons.",
          "Nemoj ispisivati sirove odlomke PDF-a u odgovoru.",
        ].join("\n"),
      },
      {
        type: "file",
        file: {
          filename: originalFileName ?? `${titleHr}.pdf`,
          file_data: pdfFileData,
        },
      },
    ],
    schema: aiStudyMaterialSchema,
    maxCompletionTokens: 5200,
  });
}

export async function generateAiStudyMaterial(
  input: GenerateAiStudyMaterialInput,
): Promise<AiStudyMaterial | null> {
  const client = getOpenAiClient();

  if (!client) {
    return null;
  }

  const normalizedText = normalizeText(input.payloadText);

  if (normalizedText.length > 0 && normalizedText.length <= TEXT_DIRECT_THRESHOLD) {
    return synthesizeFromText(input.titleHr, normalizedText);
  }

  if (normalizedText.length > TEXT_DIRECT_THRESHOLD) {
    const chunks = buildTextChunks(normalizedText);
    const chunkInsights = await mapWithConcurrency(
      chunks,
      CHUNK_CONCURRENCY,
      async (chunk, index) => {
        const summary = await summarizeChunk(input.titleHr, chunk, index);

        if (!summary) {
          throw new Error("AI chunk obrada nije dostupna.");
        }

        return summary;
      },
    );

    return synthesizeFromChunkInsights(input.titleHr, chunkInsights);
  }

  if (input.pdfFileData) {
    return synthesizeDirectlyFromPdf(
      input.titleHr,
      input.pdfFileData,
      input.originalFileName,
    );
  }

  return null;
}
