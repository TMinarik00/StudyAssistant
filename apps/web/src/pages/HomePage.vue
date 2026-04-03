<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { ImportPayloadRequestSourceTypeHint, SourceImportSummary } from "../api/generated/model";
import { useFarmApp } from "../composables/useFarmApp";
import { readImportFile } from "../lib/import-file";

type SelectedDocument = {
  fileName: string;
  sourceTypeHint: ImportPayloadRequestSourceTypeHint;
  payloadText: string;
  pdfFileData?: string;
  pageCount?: number;
  byteSize: number;
  hasExtractableText: boolean;
};

const router = useRouter();
const farmApp = useFarmApp();

const composerOpen = ref(false);
const searchQuery = ref("");
const importTitle = ref("");
const importPayload = ref("");
const importSourceTypeHint = ref<ImportPayloadRequestSourceTypeHint>("SCRIPT");
const importPdfFileData = ref<string | undefined>();
const importPageCount = ref<number | undefined>();
const importByteSize = ref<number | undefined>();
const visibleCustomCount = ref(4);
const renameSubjectId = ref("");
const renameDraft = ref("");
const renaming = ref(false);
const pinningSubjectId = ref("");
const deletingSubjectId = ref("");
const readingFile = ref(false);
const selectedFileName = ref("");
const dragActive = ref(false);
const selectedDocument = ref<SelectedDocument | null>(null);

const systemSubject = computed(
  () => farmApp.imports.value.find((item) => item.isSystem) ?? null,
);

const filteredCustomSubjects = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();

  return [...farmApp.imports.value]
    .filter((item) => !item.isSystem)
    .filter((item) =>
      query ? item.titleHr.toLocaleLowerCase().includes(query) : true,
    )
    .sort((left, right) => {
      const leftPinned = left.isPinned ? 1 : 0;
      const rightPinned = right.isPinned ? 1 : 0;

      if (leftPinned !== rightPinned) {
        return rightPinned - leftPinned;
      }

      return left.titleHr.localeCompare(right.titleHr, "hr");
    });
});

const visibleCustomSubjects = computed(() => {
  if (searchQuery.value.trim()) {
    return filteredCustomSubjects.value;
  }

  return filteredCustomSubjects.value.slice(0, visibleCustomCount.value);
});

const shouldShowMore = computed(
  () =>
    !searchQuery.value.trim() &&
    filteredCustomSubjects.value.length > visibleCustomCount.value,
);

const subjectCountLabel = computed(() => {
  const customCount = farmApp.imports.value.filter((item) => !item.isSystem).length;
  return `${customCount} spremljenih predmeta`;
});

function resetComposer() {
  importTitle.value = "";
  importPayload.value = "";
  importSourceTypeHint.value = "SCRIPT";
  importPdfFileData.value = undefined;
  importPageCount.value = undefined;
  importByteSize.value = undefined;
  selectedFileName.value = "";
  selectedDocument.value = null;
  farmApp.previewState.value = null;
  farmApp.previewMessage.value = "";
}

function openComposer() {
  composerOpen.value = true;
}

function closeComposer() {
  composerOpen.value = false;
  resetComposer();
}

function openLearn(subject: SourceImportSummary) {
  router.push({
    name: "learn",
    params: {
      importId: subject.id,
    },
  });
}

function openTest(subject: SourceImportSummary) {
  router.push({
    name: "test",
    params: {
      importId: subject.id,
    },
  });
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  await importFile(file);
  input.value = "";
}

async function importFile(file: File) {
  selectedFileName.value = file.name;

  readingFile.value = true;
  farmApp.previewMessage.value = "";

  try {
    const parsed = await readImportFile(file);
    importPayload.value = parsed.payloadText;
    importSourceTypeHint.value = parsed.sourceTypeHint;
    importPdfFileData.value = parsed.pdfFileData;
    importPageCount.value = parsed.documentPageCount;
    importByteSize.value = parsed.documentByteSize;
    selectedDocument.value = {
      fileName: parsed.originalFileName,
      sourceTypeHint: parsed.sourceTypeHint,
      payloadText: parsed.payloadText,
      pdfFileData: parsed.pdfFileData,
      pageCount: parsed.documentPageCount,
      byteSize: parsed.documentByteSize,
      hasExtractableText: parsed.hasExtractableText,
    };

    if (!importTitle.value.trim()) {
      importTitle.value = parsed.suggestedTitle;
    }

    composerOpen.value = true;
  } catch (error) {
    farmApp.previewMessage.value =
      error instanceof Error ? error.message : "Dokument nije moguce procitati.";
  } finally {
    readingFile.value = false;
    dragActive.value = false;
  }
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragActive.value = false;

  const file = event.dataTransfer?.files?.[0];

  if (!file) {
    return;
  }

  await importFile(file);
}

async function handlePreview() {
  if (!importTitle.value.trim() || (!importPayload.value.trim() && !importPdfFileData.value)) {
    farmApp.previewMessage.value =
      "Dodaj naziv predmeta i ucitaj TXT ili PDF prije pregleda.";
    return;
  }

  await farmApp.previewSubject({
    titleHr: importTitle.value.trim(),
    payloadText: importPayload.value.trim(),
    sourceTypeHint: importSourceTypeHint.value,
    pdfFileData: importPdfFileData.value,
    originalFileName: selectedDocument.value?.fileName,
    documentPageCount: importPageCount.value,
    documentByteSize: importByteSize.value,
  });
}

async function handleCreateSubject() {
  if (!importTitle.value.trim() || (!importPayload.value.trim() && !importPdfFileData.value)) {
    farmApp.previewMessage.value =
      "Dodaj naziv predmeta i ucitaj TXT ili PDF prije spremanja.";
    return;
  }

  const created = await farmApp.createSubject({
    titleHr: importTitle.value.trim(),
    payloadText: importPayload.value.trim(),
    sourceTypeHint: importSourceTypeHint.value,
    pdfFileData: importPdfFileData.value,
    originalFileName: selectedDocument.value?.fileName,
    documentPageCount: importPageCount.value,
    documentByteSize: importByteSize.value,
  });

  if (!created?.importId) {
    return;
  }

  visibleCustomCount.value = Math.max(visibleCustomCount.value, 4);
  closeComposer();
}

function startRename(subject: SourceImportSummary) {
  renameSubjectId.value = subject.id;
  renameDraft.value = subject.titleHr;
}

function cancelRename() {
  renameSubjectId.value = "";
  renameDraft.value = "";
}

async function saveRename(subjectId: string) {
  const titleHr = renameDraft.value.trim();

  if (!titleHr) {
    return;
  }

  renaming.value = true;

  try {
    await farmApp.renameSubject(subjectId, titleHr);
    cancelRename();
  } catch (error) {
    farmApp.libraryMessage.value =
      error instanceof Error ? error.message : "Predmet nije moguce preimenovati.";
  } finally {
    renaming.value = false;
  }
}

function formatBytes(value?: number) {
  if (!value) {
    return "Nepoznato";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function togglePinned(subject: SourceImportSummary) {
  pinningSubjectId.value = subject.id;

  try {
    await farmApp.setPinnedSubject(subject.id, !subject.isPinned);
  } catch (error) {
    farmApp.libraryMessage.value =
      error instanceof Error ? error.message : "Zvjezdica se ne moze spremiti.";
  } finally {
    pinningSubjectId.value = "";
  }
}

async function removeSubject(subject: SourceImportSummary) {
  if (!window.confirm(`Obrisati predmet "${subject.titleHr}" iz libraryja?`)) {
    return;
  }

  deletingSubjectId.value = subject.id;

  try {
    await farmApp.archiveSubject(subject.id);
  } catch (error) {
    farmApp.libraryMessage.value =
      error instanceof Error ? error.message : "Predmet nije moguce ukloniti.";
  } finally {
    deletingSubjectId.value = "";
  }
}

onMounted(() => {
  farmApp.initialize();
});
</script>

<template>
  <div class="space-y-8">
    <section class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article class="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-7 text-white shadow-[0_30px_100px_rgba(19,18,31,0.18)] sm:px-8 sm:py-8">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,124,92,0.32),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(62,214,194,0.26),_transparent_30%)]" />

        <div class="relative z-10 flex h-full flex-col justify-between gap-8">
          <div class="space-y-5">
            <p class="text-[0.72rem] uppercase tracking-[0.36em] text-white/70">
              Home Library
            </p>
            <h2 class="max-w-3xl font-display text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl">
              Jedna pocetna stranica za sve predmete koje student sprema.
            </h2>
            <p class="max-w-2xl text-base leading-7 text-white/72">
              Uvezi TXT ili PDF, pretvori ga u predmet za ucenje i odmah odaberi
              zelis li ici u Learn ili u Test flow.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
              @click="openComposer"
            >
              Dodaj novi predmet
            </button>
            <label
              class="inline-flex cursor-pointer items-center gap-3 rounded-full border border-white/18 bg-white/8 px-5 py-3 text-sm text-white/82 transition hover:bg-white/12"
            >
              <span>{{ readingFile ? "Citam dokument..." : "Ucitaj TXT ili PDF" }}</span>
              <input
                type="file"
                accept=".txt,.pdf"
                class="hidden"
                @change="handleFileChange"
              />
            </label>
          </div>

          <div
            class="rounded-[1.5rem] border border-white/18 bg-white/8 p-5 backdrop-blur transition"
            :class="dragActive ? 'ring-2 ring-white/55' : ''"
            @dragover.prevent="dragActive = true"
            @dragleave.prevent="dragActive = false"
            @drop="handleDrop"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-sm font-medium text-white">PDF ili TXT import</p>
                <p class="mt-2 text-sm leading-6 text-white/68">
                  Povuci dokument ovdje ili klikni na upload. Nakon ucitavanja odmah
                  otvaramo formu za spremanje predmeta.
                </p>
              </div>
              <label class="inline-flex cursor-pointer items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5">
                <span>{{ readingFile ? "Citam..." : "Odaberi dokument" }}</span>
                <input
                  type="file"
                  accept=".txt,.pdf"
                  class="hidden"
                  @change="handleFileChange"
                />
              </label>
            </div>

            <p v-if="selectedFileName" class="mt-4 text-sm text-white/78">
              Odabrano: {{ selectedFileName }}
            </p>
          </div>
        </div>
      </article>

      <article class="glass-panel rounded-[2rem] px-6 py-7 sm:px-7">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-[0.72rem] uppercase tracking-[0.28em] text-ink/45">
              Studio snapshot
            </p>
            <h3 class="font-display text-4xl leading-none text-ink">Predmeti, search i brzi ulaz.</h3>
          </div>
          <span class="rounded-full bg-white px-4 py-2 text-sm text-ink/70">
            {{ subjectCountLabel }}
          </span>
        </div>

        <div class="mt-8 grid gap-4 sm:grid-cols-2">
          <div class="rounded-[1.5rem] bg-white px-5 py-5 shadow-sm">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/45">Training</p>
            <p class="mt-3 text-3xl font-semibold text-ink">
              {{ systemSubject?.questionCount ?? 0 }}
            </p>
            <p class="mt-2 text-sm leading-6 text-ink/55">ugradjenih pitanja za prvi start</p>
          </div>

          <div class="rounded-[1.5rem] bg-white px-5 py-5 shadow-sm">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/45">Favoriti</p>
            <p class="mt-3 text-3xl font-semibold text-ink">
              {{ farmApp.imports.value.filter((item) => item.isPinned && !item.isSystem).length }}
            </p>
            <p class="mt-2 text-sm leading-6 text-ink/55">predmeta mozes drzati na vrhu sa zvjezdicom</p>
          </div>
        </div>

        <label class="mt-6 block">
          <span class="sr-only">Pretrazi predmet</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Pretrazi po nazivu predmeta"
            class="w-full rounded-full border border-white/70 bg-white/80 px-5 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-ink/30"
          />
        </label>
      </article>
    </section>

    <Teleport to="body">
      <div
        v-if="composerOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(17,14,12,0.42)] px-4 py-6 backdrop-blur-md"
        @click.self="closeComposer"
      >
        <section
          class="grid max-h-[92vh] w-full max-w-7xl gap-6 overflow-auto rounded-[2.2rem] border border-white/55 bg-[rgba(255,252,248,0.94)] p-6 shadow-[0_40px_140px_rgba(20,16,12,0.26)] backdrop-blur xl:grid-cols-[1.08fr_0.92fr]"
        >
          <article class="space-y-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-[0.72rem] uppercase tracking-[0.28em] text-ink/45">Novi predmet</p>
            <h3 class="font-display text-4xl leading-none text-ink">Dodaj skriptu, imenuj je i spremi.</h3>
          </div>
          <button
            type="button"
            class="rounded-full border border-ink/12 px-4 py-2 text-sm text-ink/55 transition hover:border-ink/30 hover:text-ink"
            @click="closeComposer"
          >
            Zatvori
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <label class="space-y-2">
            <span class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/45">Naziv predmeta</span>
            <input
              v-model="importTitle"
              type="text"
              placeholder="npr. Antibiotici i rezistencija"
              class="w-full rounded-[1.2rem] border border-ink/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-ink/30"
            />
          </label>

          <div class="rounded-[1.2rem] border border-dashed border-ink/14 bg-[#fff8f2] p-4 text-sm text-ink/58">
            <p class="font-medium text-ink">AI import</p>
            <p class="mt-2 leading-6">
              Dokument se vise ne prikazuje kao sirovi tekst. Nakon importa AI ga pretvara u lekcije i test pitanja.
            </p>
            <p class="mt-2 leading-6">
              Podrzani su TXT i PDF. Ako PDF nema izdvojiv tekst, AI i dalje moze preuzeti cijeli dokument kad je konfiguriran backend kljuc.
            </p>
          </div>
        </div>

        <div
          class="rounded-[1.35rem] border border-dashed border-ink/14 bg-[#fff8f2] p-5 transition"
          :class="dragActive ? 'border-ink/32 bg-[#fff1e6]' : ''"
          @dragover.prevent="dragActive = true"
          @dragleave.prevent="dragActive = false"
          @drop="handleDrop"
        >
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="text-sm font-medium text-ink">Ucitavanje dokumenta</p>
              <p class="mt-2 text-sm leading-6 text-ink/58">
                Klikni ispod za PDF ili TXT, ili ga jednostavno prevuci u ovaj blok.
              </p>
            </div>
            <label class="inline-flex cursor-pointer items-center justify-center rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink/92">
              <span>{{ readingFile ? "Citam dokument..." : "Odaberi PDF ili TXT" }}</span>
              <input
                type="file"
                accept=".txt,.pdf"
                class="hidden"
                @change="handleFileChange"
              />
            </label>
          </div>

          <div
            v-if="selectedDocument"
            class="mt-5 grid gap-3 rounded-[1.25rem] border border-white/70 bg-white/80 p-4 md:grid-cols-4"
          >
            <div class="rounded-[1rem] bg-[#fff8f2] px-4 py-3">
              <p class="text-[0.7rem] uppercase tracking-[0.22em] text-ink/38">Datoteka</p>
              <p class="mt-2 text-sm font-medium text-ink">{{ selectedDocument.fileName }}</p>
            </div>
            <div class="rounded-[1rem] bg-[#f7fbff] px-4 py-3">
              <p class="text-[0.7rem] uppercase tracking-[0.22em] text-ink/38">Tip</p>
              <p class="mt-2 text-sm font-medium text-ink">{{ selectedDocument.sourceTypeHint }}</p>
            </div>
            <div class="rounded-[1rem] bg-[#f5fff9] px-4 py-3">
              <p class="text-[0.7rem] uppercase tracking-[0.22em] text-ink/38">Velicina</p>
              <p class="mt-2 text-sm font-medium text-ink">{{ formatBytes(selectedDocument.byteSize) }}</p>
            </div>
            <div class="rounded-[1rem] bg-[#f9f6ff] px-4 py-3">
              <p class="text-[0.7rem] uppercase tracking-[0.22em] text-ink/38">Stranice</p>
              <p class="mt-2 text-sm font-medium text-ink">
                {{ selectedDocument.pageCount ?? "TXT dokument" }}
              </p>
            </div>

            <div class="rounded-[1rem] border border-dashed border-ink/10 bg-white px-4 py-3 md:col-span-4">
              <p class="text-[0.7rem] uppercase tracking-[0.22em] text-ink/38">Status obrade</p>
              <p class="mt-2 text-sm leading-6 text-ink/66">
                <template v-if="selectedDocument.sourceTypeHint === 'PDF' && !selectedDocument.hasExtractableText">
                  Lokalni parser nije izvukao tekst, pa backend AI moze obraditi cijeli PDF direktno kada je konfiguriran.
                </template>
                <template v-else-if="selectedDocument.sourceTypeHint === 'PDF'">
                  Tekst je procitan iz cijelog PDF-a i ne prikazuje se u UI-ju. Sljedeci korak je AI obrada cijelog dokumenta u lekcije i pitanja.
                </template>
                <template v-else>
                  TXT je ucitan i sakriven iz prikaza. AI ce iz cijelog dokumenta sloziti Learn i Test sadrzaj.
                </template>
              </p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="rounded-full border border-ink/14 px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/30 hover:bg-ink/3 disabled:opacity-60"
            :disabled="farmApp.previewingImport.value"
            @click="handlePreview"
          >
            {{ farmApp.previewingImport.value ? "Pregledavam..." : "Pregled prije spremanja" }}
          </button>
          <button
            type="button"
            class="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink/92 disabled:opacity-60"
            :disabled="farmApp.creatingImport.value"
            @click="handleCreateSubject"
          >
            {{ farmApp.creatingImport.value ? "Spremam..." : "Spremi predmet" }}
          </button>
        </div>

        <p v-if="farmApp.previewMessage.value" class="text-sm text-rose-700">
          {{ farmApp.previewMessage.value }}
        </p>
          </article>

          <article class="rounded-[1.6rem] bg-[#fff4ea] p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/45">Preview</p>
            <h3 class="font-display text-3xl leading-none text-ink">
              {{ farmApp.previewState.value ? "Kako ce predmet izgledati" : "Predmet jos nije pregledan" }}
            </h3>
          </div>
          <div v-if="farmApp.previewState.value" class="flex flex-wrap gap-2">
            <span class="rounded-full bg-white px-4 py-2 text-sm text-ink/68">
              {{ farmApp.previewState.value.sourceType }}
            </span>
            <span class="rounded-full px-4 py-2 text-sm"
              :class="farmApp.previewState.value.processingMode === 'AI'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'"
            >
              {{ farmApp.previewState.value.processingMode === "AI" ? "AI obrada" : "Fallback parser" }}
            </span>
          </div>
        </div>

        <template v-if="farmApp.previewState.value">
          <div class="mt-5 rounded-[1.25rem] border border-white/65 bg-white/88 p-4 text-sm leading-6 text-ink/66">
            {{ farmApp.previewState.value.processingNotesHr }}
          </div>

          <div class="mt-6 grid gap-4 sm:grid-cols-3">
            <div class="rounded-[1.2rem] bg-white p-4 shadow-sm">
              <p class="text-[0.72rem] uppercase tracking-[0.2em] text-ink/40">Teme</p>
              <p class="mt-3 text-3xl font-semibold text-ink">{{ farmApp.previewState.value.topicCount }}</p>
            </div>
            <div class="rounded-[1.2rem] bg-white p-4 shadow-sm">
              <p class="text-[0.72rem] uppercase tracking-[0.2em] text-ink/40">Pitanja</p>
              <p class="mt-3 text-3xl font-semibold text-ink">{{ farmApp.previewState.value.questionCount }}</p>
            </div>
            <div class="rounded-[1.2rem] bg-white p-4 shadow-sm">
              <p class="text-[0.72rem] uppercase tracking-[0.2em] text-ink/40">Learn blokovi</p>
              <p class="mt-3 text-3xl font-semibold text-ink">{{ farmApp.previewState.value.lessons.length }}</p>
            </div>
          </div>

          <div class="mt-6 grid gap-3">
            <article
              v-for="lesson in farmApp.previewState.value.lessons.slice(0, 4)"
              :key="lesson.id"
              class="rounded-[1.2rem] border border-white/55 bg-white/90 p-4"
            >
              <p class="text-[0.72rem] uppercase tracking-[0.22em] text-ink/42">
                Lekcija {{ lesson.sortOrder }}
              </p>
              <p class="mt-3 text-lg font-medium text-ink">{{ lesson.titleHr }}</p>
              <p class="mt-2 text-sm leading-6 text-ink/62">{{ lesson.overviewHr }}</p>
            </article>
          </div>

          <div class="mt-6 space-y-4">
            <article
              v-for="sample in farmApp.previewState.value.sampleQuestions"
              :key="`${sample.topicTitleHr}-${sample.questionHr}`"
              class="rounded-[1.25rem] border border-white/55 bg-white/90 p-4"
            >
              <p class="text-[0.72rem] uppercase tracking-[0.22em] text-ink/42">
                {{ sample.topicTitleHr }}
              </p>
              <p class="mt-3 text-base font-medium text-ink">{{ sample.questionHr }}</p>
              <p class="mt-3 text-sm leading-6 text-emerald-700">
                Tocan odgovor: {{ sample.correctAnswerHr }}
              </p>
            </article>
          </div>
        </template>

        <div v-else class="mt-8 rounded-[1.25rem] border border-dashed border-ink/12 bg-white/70 p-5 text-sm leading-7 text-ink/58">
          Klikni pregled i vidjet ces koliko tema, Learn blokova i uzornih pitanja ce nastati iz dokumenta.
        </div>
          </article>
        </section>
      </div>
    </Teleport>

    <p v-if="farmApp.libraryMessage.value" class="text-sm text-rose-700">
      {{ farmApp.libraryMessage.value }}
    </p>

    <section v-if="systemSubject" class="space-y-4">
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-[0.72rem] uppercase tracking-[0.28em] text-ink/45">Ready now</p>
          <h2 class="mt-2 font-display text-4xl leading-none text-ink">Training</h2>
        </div>
      </div>

      <article class="subject-card relative overflow-hidden rounded-[2rem] bg-[#13131f] px-6 py-6 text-white shadow-[0_35px_110px_rgba(16,17,27,0.18)] sm:px-8">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,145,101,0.26),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(55,216,194,0.24),_transparent_32%)]" />
        <div class="relative z-10 grid gap-7 lg:grid-cols-[1.15fr_0.85fr]">
          <div class="space-y-5">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-white/10 px-4 py-2 text-[0.72rem] uppercase tracking-[0.22em] text-white/70">
                System subject
              </span>
              <span class="rounded-full bg-white/10 px-4 py-2 text-[0.72rem] uppercase tracking-[0.22em] text-white/70">
                {{ systemSubject.sourceType }}
              </span>
            </div>

            <div class="space-y-3">
              <h3 class="font-display text-5xl leading-[0.94] tracking-[-0.04em]">
                {{ systemSubject.titleHr }}
              </h3>
              <p class="max-w-2xl text-base leading-7 text-white/72">
                Ugradeni predmet za prvi start. Student moze odmah kliknuti uci ili uradi test bez prethodnog importa.
              </p>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5"
                @click="openLearn(systemSubject)"
              >
                Uci
              </button>
              <button
                type="button"
                class="rounded-full border border-white/18 bg-white/8 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/12"
                @click="openTest(systemSubject)"
              >
                Uradi test
              </button>
            </div>
          </div>

          <div class="grid gap-3 self-end sm:grid-cols-3 lg:grid-cols-1">
            <div class="rounded-[1.4rem] bg-white/10 px-5 py-5">
              <p class="text-[0.72rem] uppercase tracking-[0.2em] text-white/55">Teme</p>
              <p class="mt-3 text-4xl font-semibold">{{ systemSubject.topicCount }}</p>
            </div>
            <div class="rounded-[1.4rem] bg-white/10 px-5 py-5">
              <p class="text-[0.72rem] uppercase tracking-[0.2em] text-white/55">Pitanja</p>
              <p class="mt-3 text-4xl font-semibold">{{ systemSubject.questionCount }}</p>
            </div>
            <div class="rounded-[1.4rem] bg-white/10 px-5 py-5">
              <p class="text-[0.72rem] uppercase tracking-[0.2em] text-white/55">Status</p>
              <p class="mt-3 text-2xl font-semibold">Uvijek spreman</p>
            </div>
          </div>
        </div>
      </article>
    </section>

    <section class="space-y-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="space-y-2">
          <p class="text-[0.72rem] uppercase tracking-[0.28em] text-ink/45">My subjects</p>
          <h2 class="font-display text-4xl leading-none text-ink">Kartice predmeta za Learn i Test.</h2>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-full border border-ink/14 bg-white/70 px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/30 hover:bg-white"
          @click="openComposer"
        >
          Dodaj novi predmet
        </button>
      </div>

      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="subject in visibleCustomSubjects"
          :key="subject.id"
          class="subject-card group relative overflow-hidden rounded-[1.8rem] border border-white/55 bg-white/86 p-5 shadow-[0_24px_70px_rgba(24,19,15,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_35px_90px_rgba(24,19,15,0.12)]"
        >
          <div class="subject-sheen absolute inset-x-0 top-0 h-28" />

          <div class="relative z-10 flex h-full flex-col">
            <div class="flex items-start justify-between gap-4">
              <div class="flex flex-wrap gap-2">
                <span class="rounded-full bg-white/90 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.22em] text-ink/45">
                  {{ subject.sourceType }}
                </span>
                <span class="rounded-full bg-white/90 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.22em] text-ink/45">
                  {{ subject.topicCount }} tema
                </span>
                <span
                  class="rounded-full px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.22em]"
                  :class="subject.processingMode === 'AI'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'"
                >
                  {{ subject.processingMode === "AI" ? "AI" : "Parser" }}
                </span>
              </div>

              <button
                type="button"
                class="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-ink/10 bg-white/88 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-ink transition hover:border-ink/28 hover:bg-white"
                :disabled="pinningSubjectId === subject.id"
                @click="togglePinned(subject)"
              >
                {{ subject.isPinned ? "Top" : "Pin" }}
              </button>
            </div>

            <div class="mt-6 flex-1">
              <template v-if="renameSubjectId === subject.id">
                <div class="space-y-3">
                  <input
                    v-model="renameDraft"
                    type="text"
                    class="w-full rounded-[1rem] border border-ink/12 bg-white px-4 py-3 text-lg font-semibold text-ink outline-none focus:border-ink/30"
                  />
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ink/92"
                      :disabled="renaming"
                      @click="saveRename(subject.id)"
                    >
                      {{ renaming ? "Spremam..." : "Spremi" }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full border border-ink/14 px-4 py-2.5 text-sm text-ink/64 transition hover:border-ink/28 hover:text-ink"
                      @click="cancelRename"
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <h3 class="max-w-[14ch] font-display text-4xl leading-[0.95] tracking-[-0.04em] text-ink">
                  {{ subject.titleHr }}
                </h3>
                <p class="mt-4 max-w-md text-sm leading-6 text-ink/58">
                  {{ subject.questionCount }} pitanja spremnih za test i {{ subject.lessonCount }} Learn blokova za repeticiju.
                </p>
                <p class="mt-3 max-w-md text-xs leading-6 text-ink/45">
                  {{ subject.processingNotesHr }}
                </p>
              </template>
            </div>

            <div class="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                class="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink/92"
                @click="openLearn(subject)"
              >
                Uci
              </button>
              <button
                type="button"
                class="rounded-full border border-ink/14 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5 hover:border-ink/30"
                @click="openTest(subject)"
              >
                Uradi test
              </button>
            </div>

            <div class="mt-6 flex items-center justify-between border-t border-ink/8 pt-4 text-sm text-ink/55">
              <button
                type="button"
                class="transition hover:text-ink"
                @click="startRename(subject)"
              >
                Preimenuj
              </button>
              <button
                type="button"
                class="transition hover:text-rose-700"
                :disabled="deletingSubjectId === subject.id"
                @click="removeSubject(subject)"
              >
                {{ deletingSubjectId === subject.id ? "Brisem..." : "Obrisi" }}
              </button>
            </div>
          </div>
        </article>

        <button
          type="button"
          class="group flex min-h-[22rem] flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-ink/18 bg-white/56 p-6 text-center transition hover:-translate-y-1 hover:border-ink/28 hover:bg-white/70"
          @click="openComposer"
        >
          <span class="inline-flex h-20 w-20 items-center justify-center rounded-full bg-ink text-5xl leading-none text-white transition group-hover:scale-105">
            +
          </span>
          <p class="mt-6 font-display text-3xl leading-none text-ink">Dodaj novi predmet</p>
          <p class="mt-3 max-w-xs text-sm leading-6 text-ink/55">
            TXT ili PDF pretvori u novu karticu koja odmah dobiva Learn i Test akcije.
          </p>
        </button>
      </div>

      <div v-if="shouldShowMore" class="flex justify-center pt-2">
        <button
          type="button"
          class="rounded-full border border-ink/14 bg-white/78 px-6 py-3 text-sm font-medium text-ink transition hover:border-ink/28 hover:bg-white"
          @click="visibleCustomCount += 4"
        >
          Show more
        </button>
      </div>

      <div
        v-if="!farmApp.loadingImports.value && !visibleCustomSubjects.length && !systemSubject"
        class="rounded-[1.8rem] border border-dashed border-ink/14 bg-white/72 p-10 text-center"
      >
        <p class="font-display text-4xl leading-none text-ink">Library je jos prazan.</p>
        <p class="mt-4 text-sm leading-7 text-ink/58">
          Klikni gornji button i spremi prvi predmet iz TXT ili PDF skripte.
        </p>
      </div>
    </section>
  </div>
</template>
