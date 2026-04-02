<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  createImport,
  createPlayer,
  getDashboard,
  getImportDetail,
  getImports,
  getNextQuizCard,
  getTopics,
  previewImport,
  submitQuizAnswer,
} from "./api/generated/farmapp";
import type {
  Dashboard,
  ImportDetail,
  ImportPreview,
  NextQuizCard,
  PlayerProfile,
  QuizAnswerResult,
  SourceImportSummary,
  TopicSummary,
} from "./api/generated/model";

const STORAGE_KEY = "farmapp-player";

const nicknameInput = ref("");
const player = ref<PlayerProfile | null>(null);
const dashboard = ref<Dashboard | null>(null);
const catalog = ref<TopicSummary[]>([]);
const imports = ref<SourceImportSummary[]>([]);
const importDetail = ref<ImportDetail | null>(null);
const currentCard = ref<NextQuizCard | null>(null);
const selectedTopicId = ref<string | undefined>();
const sessionImportId = ref<string | undefined>();
const selectedOptionId = ref<string | null>(null);
const selectedImportId = ref("");
const feedback = ref<QuizAnswerResult | null>(null);
const activeView = ref<"session" | "learn" | "imports">("session");
const booting = ref(true);
const loadingProfile = ref(false);
const loadingCard = ref(false);
const loadingImportDetail = ref(false);
const previewingImport = ref(false);
const publishingImport = ref(false);
const submitting = ref(false);
const message = ref("");
const importMessage = ref("");
const importTitleInput = ref("");
const importPayloadText = ref("");
const importPreviewState = ref<ImportPreview | null>(null);

const difficultyLabel: Record<string, string> = {
  EASY: "Osnovna razina",
  MEDIUM: "Srednja razina",
  HARD: "Napredna razina",
};

function getMessageFromError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Dogodila se neocekivana greska.";
}

function ensureOk<T>(response: { status: number; data: T | { message?: string } }) {
  if (response.status >= 400) {
    const data = response.data as { message?: string };
    throw new Error(data.message ?? "API trenutno nije dostupan.");
  }

  return response.data as T;
}

const topics = computed(() => dashboard.value?.topics ?? catalog.value);

const sessionTopics = computed(() => {
  if (!sessionImportId.value) {
    return topics.value;
  }

  if (importDetail.value?.import.id === sessionImportId.value) {
    return importDetail.value.topics;
  }

  const scopedImport = imports.value.find((item) => item.id === sessionImportId.value);

  if (!scopedImport) {
    return topics.value;
  }

  return topics.value.filter((topic) => topic.sourceLabelHr === scopedImport.titleHr);
});

const showcaseTopics = computed(() => topics.value.slice(0, 4));

const totalQuestionCount = computed(() =>
  topics.value.reduce((sum, topic) => sum + topic.questionCount, 0),
);

const activeTopic = computed<TopicSummary | null>(() => {
  const topicId = currentCard.value?.topicId ?? selectedTopicId.value;
  return (
    sessionTopics.value.find((topic) => topic.id === topicId) ??
    topics.value.find((topic) => topic.id === topicId) ??
    sessionTopics.value[0] ??
    topics.value[0] ??
    null
  );
});

const activeAccent = computed(() => activeTopic.value?.accent ?? "#1c7c6d");

const levelProgress = computed(() => {
  if (!player.value) {
    return 0;
  }

  return Math.round(((player.value.xp % 60) / 60) * 100);
});

const missionProgress = computed(() => {
  if (!dashboard.value) {
    return 0;
  }

  return Math.min(
    100,
    Math.round((dashboard.value.dailyMission.current / dashboard.value.dailyMission.target) * 100),
  );
});

const canSubmit = computed(
  () => Boolean(player.value && currentCard.value && selectedOptionId.value && !feedback.value) && !submitting.value,
);

const currentImport = computed(
  () => imports.value.find((item) => item.id === selectedImportId.value) ?? null,
);

const sessionImport = computed(
  () => imports.value.find((item) => item.id === sessionImportId.value) ?? null,
);

const selectedImportTopicCount = computed(() => importDetail.value?.topics.length ?? 0);

const selectedImportQuestionCount = computed(
  () => importDetail.value?.topics.reduce((sum, topic) => sum + topic.questionCount, 0) ?? 0,
);

const currentQuestionCountLabel = computed(() => {
  if (!selectedTopicId.value && sessionImportId.value && sessionTopics.value.length > 0) {
    return `${sessionTopics.value.length} tema u kolekciji`;
  }

  if (!activeTopic.value) {
    return "Bez aktivne teme";
  }

  return `${activeTopic.value.questionCount} pitanja`;
});

const sessionLabel = computed(() => {
  if (feedback.value?.isCorrect) {
    return "Odigrano tocno";
  }

  if (feedback.value && !feedback.value.isCorrect) {
    return "Vrijeme za repeticiju";
  }

  return currentCard.value?.progressLabel ?? "Aktivna sesija";
});

const sessionScopeLabel = computed(() => {
  if (selectedTopicId.value && activeTopic.value) {
    return activeTopic.value.titleHr;
  }

  if (sessionImport.value) {
    return sessionImport.value.titleHr;
  }

  return "Sve kolekcije";
});

const sessionScopeHint = computed(() => {
  if (selectedTopicId.value && activeTopic.value) {
    return "Fokus na jednu temu iz odabrane kolekcije.";
  }

  if (sessionImport.value) {
    return "Adaptivni mix ostaje unutar ove importirane skripte.";
  }

  return "Sustav bira pitanje preko svih dostupnih kolekcija.";
});

function optionState(optionId: string) {
  if (!feedback.value) {
    return selectedOptionId.value === optionId
      ? "border-stone-900 bg-stone-900 text-stone-50"
      : "border-stone-200 bg-white text-stone-900 hover:-translate-y-0.5 hover:border-stone-400";
  }

  if (feedback.value.correctOptionId === optionId) {
    return "border-emerald-300 bg-emerald-50 text-emerald-950";
  }

  if (selectedOptionId.value === optionId) {
    return "border-rose-300 bg-rose-50 text-rose-950";
  }

  return "border-stone-200 bg-stone-50 text-stone-400";
}

async function loadCatalog() {
  try {
    const response = await getTopics();
    catalog.value = ensureOk(response);
  } catch (error) {
    message.value = getMessageFromError(error);
  }
}

async function loadImportsCatalog() {
  try {
    const response = await getImports();
    imports.value = ensureOk(response);

    if (!selectedImportId.value && imports.value[0]) {
      await selectImport(imports.value[0].id);
      return;
    }

    if (selectedImportId.value) {
      const exists = imports.value.some((item) => item.id === selectedImportId.value);

      if (exists) {
        await selectImport(selectedImportId.value);
      } else if (imports.value[0]) {
        await selectImport(imports.value[0].id);
      } else {
        importDetail.value = null;
      }
    }
  } catch (error) {
    importMessage.value = getMessageFromError(error);
  }
}

async function selectImport(importId: string) {
  if (!importId) {
    selectedImportId.value = "";
    importDetail.value = null;
    return;
  }

  loadingImportDetail.value = true;
  selectedImportId.value = importId;

  try {
    const response = await getImportDetail(importId);
    importDetail.value = ensureOk(response);
  } catch (error) {
    importMessage.value = getMessageFromError(error);
  } finally {
    loadingImportDetail.value = false;
  }
}

async function refreshDashboard() {
  if (!player.value) {
    return;
  }

  const response = await getDashboard(player.value.id);
  const data = ensureOk(response);

  dashboard.value = data;
  player.value = data.player;
  catalog.value = data.topics;
  imports.value = data.imports;

  if (!selectedImportId.value && data.imports[0]) {
    await selectImport(data.imports[0].id);
  }
}

async function loadNextQuestion(
  topicId = selectedTopicId.value,
  sourceImportId = sessionImportId.value,
) {
  if (!player.value) {
    return;
  }

  loadingCard.value = true;
  message.value = "";

  try {
    const response = await getNextQuizCard({
      playerId: player.value.id,
      topicId,
      sourceImportId,
    });

    currentCard.value = ensureOk(response);
    selectedOptionId.value = null;
    feedback.value = null;
  } catch (error) {
    currentCard.value = null;
    feedback.value = null;
    message.value = getMessageFromError(error);
  } finally {
    loadingCard.value = false;
  }
}

async function openProfile(nicknameOverride?: string) {
  const nickname = (nicknameOverride ?? nicknameInput.value).trim();

  if (!nickname) {
    message.value = "Upisi nadimak kako bi otvorio ili otvorila svoj profil.";
    booting.value = false;
    return;
  }

  loadingProfile.value = true;
  message.value = "";

  try {
    const response = await createPlayer({ nickname });
    const data = ensureOk(response);

    player.value = data;
    nicknameInput.value = data.nickname;
    window.localStorage.setItem(STORAGE_KEY, data.nickname);

    await refreshDashboard();
    await loadImportsCatalog();
    await loadNextQuestion(selectedTopicId.value);
  } catch (error) {
    message.value = getMessageFromError(error);
  } finally {
    loadingProfile.value = false;
    booting.value = false;
  }
}

async function chooseTopic(
  topicId?: string,
  sourceImportId = sessionImportId.value,
) {
  selectedTopicId.value = topicId;
  sessionImportId.value = sourceImportId;
  activeView.value = "session";
  await loadNextQuestion(topicId, sourceImportId);
}

async function clearSessionScope() {
  sessionImportId.value = undefined;
  selectedTopicId.value = undefined;
  activeView.value = "session";
  await loadNextQuestion(undefined, undefined);
}

async function submitCurrentAnswer() {
  if (!player.value || !currentCard.value || !selectedOptionId.value || feedback.value) {
    return;
  }

  submitting.value = true;
  message.value = "";

  try {
    const response = await submitQuizAnswer({
      playerId: player.value.id,
      flashcardId: currentCard.value.flashcardId,
      selectedOptionId: selectedOptionId.value,
    });

    feedback.value = ensureOk(response);
    await refreshDashboard();
  } catch (error) {
    message.value = getMessageFromError(error);
  } finally {
    submitting.value = false;
  }
}

async function continueRun() {
  await loadNextQuestion(selectedTopicId.value, sessionImportId.value);
}

function resetProfile() {
  window.localStorage.removeItem(STORAGE_KEY);
  player.value = null;
  dashboard.value = null;
  imports.value = [];
  importDetail.value = null;
  currentCard.value = null;
  feedback.value = null;
  selectedTopicId.value = undefined;
  sessionImportId.value = undefined;
  selectedOptionId.value = null;
  selectedImportId.value = "";
  nicknameInput.value = "";
  message.value = "";
}

async function handleImportPreview() {
  if (!importTitleInput.value.trim() || !importPayloadText.value.trim()) {
    importMessage.value = "Upisi naslov i zalijepi skriptu ili JSON prije pregleda.";
    return;
  }

  previewingImport.value = true;
  importMessage.value = "";

  try {
    const response = await previewImport({
      titleHr: importTitleInput.value.trim(),
      payloadText: importPayloadText.value,
    });

    importPreviewState.value = ensureOk(response);
  } catch (error) {
    importPreviewState.value = null;
    importMessage.value = getMessageFromError(error);
  } finally {
    previewingImport.value = false;
  }
}

async function handleImportPublish() {
  if (!importTitleInput.value.trim() || !importPayloadText.value.trim()) {
    importMessage.value = "Upisi naslov i sadrzaj prije objave.";
    return;
  }

  publishingImport.value = true;
  importMessage.value = "";

  try {
    const response = await createImport({
      titleHr: importTitleInput.value.trim(),
      payloadText: importPayloadText.value,
    });

    const created = ensureOk(response);

    importPreviewState.value = created;
    importMessage.value = "Import je objavljen i spreman za ucenje i kviz.";

    await refreshDashboard();
    await loadImportsCatalog();

    if (created.importId) {
      await selectImport(created.importId);
    }

    activeView.value = "learn";
  } catch (error) {
    importMessage.value = getMessageFromError(error);
  } finally {
    publishingImport.value = false;
  }
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  importPayloadText.value = await file.text();

  if (!importTitleInput.value.trim()) {
    importTitleInput.value = file.name.replace(/\.[^.]+$/, "");
  }
}

function loadExampleScript() {
  importTitleInput.value = "Farmakologija autonomnog zivcanog sustava";
  importPayloadText.value = `Adrenergicni agonisti

Adrenergicni agonisti stimuliraju alfa i beta receptore. Najcesce se koriste kada zelimo brzo povecati tlak, bronhodilataciju ili stimulaciju srca.

- Adrenalin djeluje na alfa i beta receptore te se koristi kod anafilaksije.
- Noradrenalin dominantno povecava periferni vaskularni otpor i arterijski tlak.
- Salbutamol je selektivni beta-2 agonist i koristi se za bronhodilataciju kod bronhospazma.

Adrenergicni antagonisti

Adrenergicni antagonisti blokiraju adrenergicne receptore i smanjuju simpaticni odgovor.

- Beta blokatori smanjuju frekvenciju srca i kontraktilnost.
- Neselektivni beta blokatori mogu pogorsati bronhospazam kod osjetljivih bolesnika.
- Alfa-1 blokatori smanjuju periferni vaskularni otpor i mogu uzrokovati ortostatsku hipotenziju.

Klinicke napomene

Kod ucenja je vazno povezati receptor, glavni ucinak i tipicne nuspojave. Posebno treba razlikovati hitnu primjenu adrenalina od kronicke terapije beta blokatorima.`;
}

function loadQuestionBankExample() {
  importTitleInput.value = "Nova farmakologija";
  importPayloadText.value = `export const questionBank = [
  {
    slug: "primjer-modula",
    titleHr: "Primjer modula",
    descriptionHr: "Kratki opis cjeline koju zelis uciti.",
    accent: "#4c7a6a",
    difficulty: "EASY",
    flashcards: [
      {
        questionHr: "Koja tvrdnja je tocna?",
        explanationHr: "Ovdje napisi kratko objasnjenje zasto je odgovor tocan.",
        correctOptionId: "b",
        difficulty: "EASY",
        options: [
          { id: "a", textHr: "Prva tvrdnja" },
          { id: "b", textHr: "Druga tvrdnja" },
          { id: "c", textHr: "Treca tvrdnja" },
          { id: "d", textHr: "Cetvrta tvrdnja" }
        ]
      }
    ]
  }
] as const;`;
}

async function startQuizFromImport() {
  if (!selectedImportId.value) {
    return;
  }

  sessionImportId.value = selectedImportId.value;
  selectedTopicId.value = undefined;
  activeView.value = "session";
  await loadNextQuestion(undefined, selectedImportId.value);
}

onMounted(async () => {
  await loadCatalog();
  await loadImportsCatalog();

  const savedNickname = window.localStorage.getItem(STORAGE_KEY);

  if (savedNickname) {
    nicknameInput.value = savedNickname;
    await openProfile(savedNickname);
    return;
  }

  booting.value = false;
});
</script>

<template>
  <main
    class="relative min-h-screen overflow-hidden bg-paper text-ink"
    :style="{ '--topic-accent': activeAccent }"
  >
    <div class="pointer-events-none absolute inset-0 opacity-80">
      <div class="absolute left-[-12rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,_rgba(28,124,109,0.18),_transparent_64%)] blur-2xl" />
      <div class="absolute bottom-[-14rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(205,182,116,0.18),_transparent_66%)] blur-2xl" />
      <div class="grain absolute inset-0" />
    </div>

    <section
      v-if="!player"
      class="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-10 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10"
    >
      <div class="flex flex-col justify-between border-b border-stone-200 pb-10 lg:border-b-0 lg:border-r lg:pr-12">
        <div class="space-y-10">
          <div class="flex items-center justify-between border-b border-stone-200 pb-4">
            <div>
              <p class="text-[0.72rem] uppercase tracking-[0.3em] text-stone-500">Doza Znanja</p>
              <p class="mt-2 text-sm text-stone-500">Farmakologija za poslijediplomsko ucenje</p>
            </div>
            <p class="text-sm text-stone-500">Premium learning studio</p>
          </div>

          <div class="space-y-6">
            <p class="text-[0.72rem] uppercase tracking-[0.34em] text-stone-500">Minimalno. Jasno. Adaptivno.</p>
            <h1 class="max-w-4xl font-serif text-5xl leading-none tracking-[-0.04em] text-stone-950 sm:text-6xl lg:text-7xl">
              Ucenje farmakologije koje izgleda smireno, a radi ozbiljno.
            </h1>
            <p class="max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
              Aplikacija vodi studenta kroz tematske cjeline, pamti napredak, bira
              sljedece pitanje prema izvedbi i pretvara suhoparnu repeticiju u
              elegantnu dnevnu rutinu.
            </p>
          </div>

          <div class="grid gap-4 border-t border-stone-200 pt-6 sm:grid-cols-3">
            <div class="space-y-1">
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Moduli</p>
              <p class="text-2xl font-semibold text-stone-950">{{ topics.length }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Pitanja</p>
              <p class="text-2xl font-semibold text-stone-950">{{ totalQuestionCount }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Model rada</p>
              <p class="text-2xl font-semibold text-stone-950">Adaptivni kviz</p>
            </div>
          </div>
        </div>

        <div class="mt-10 border-t border-stone-200 pt-6">
          <div class="mb-4 flex items-center justify-between">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Sadrzaj koji je spreman</p>
            <p class="text-sm text-stone-500">{{ totalQuestionCount }} kartica</p>
          </div>

          <div class="divide-y divide-stone-200">
            <div
              v-for="topic in showcaseTopics"
              :key="topic.id"
              class="flex items-start justify-between gap-4 py-4"
            >
              <div class="flex items-start gap-3">
                <span class="mt-2 h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: topic.accent }" />
                <div>
                  <p class="text-base font-medium text-stone-900">{{ topic.titleHr }}</p>
                  <p class="mt-1 text-sm leading-6 text-stone-500">{{ topic.descriptionHr }}</p>
                </div>
              </div>
              <span class="text-sm text-stone-500">{{ topic.questionCount }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex items-end">
        <form
          class="w-full border border-stone-200 bg-white/85 p-8 shadow-[0_20px_80px_rgba(34,29,22,0.06)] backdrop-blur"
          @submit.prevent="openProfile()"
        >
          <p class="text-[0.72rem] uppercase tracking-[0.26em] text-stone-500">Ulaz u sesiju</p>
          <h2 class="mt-4 font-serif text-4xl leading-none tracking-[-0.03em] text-stone-950">
            Odaberi nadimak i zapocni rad.
          </h2>
          <p class="mt-4 max-w-md text-sm leading-6 text-stone-600">
            Profil se pamti lokalno, pa se pri sljedecem otvaranju vracas ravno u svoju
            aktivnu sesiju bez dodatnih koraka.
          </p>

          <label class="mt-8 block space-y-3">
            <span class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Nadimak</span>
            <input
              v-model="nicknameInput"
              type="text"
              maxlength="24"
              placeholder="npr. Lara"
              autocomplete="nickname"
              class="w-full border-b border-stone-300 bg-transparent px-0 py-4 text-lg text-stone-950 outline-none placeholder:text-stone-400 focus:border-stone-950"
            />
          </label>

          <button
            type="submit"
            class="mt-8 inline-flex items-center gap-3 border border-stone-950 bg-stone-950 px-6 py-3 text-sm font-medium text-stone-50 transition hover:-translate-y-0.5 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loadingProfile"
          >
            <span>{{ loadingProfile ? "Otvaram profil..." : "Zapocni ucenje" }}</span>
          </button>

          <p class="mt-5 text-sm leading-6 text-stone-500">
            Sustav je vec podijeljen na vise cjelina: kurikulum, aktivna sesija,
            dnevna misija i analiza slabijih podrucja.
          </p>
          <p v-if="message" class="mt-4 text-sm text-rose-700">{{ message }}</p>
        </form>
      </div>
    </section>

    <section v-else class="relative z-10 mx-auto max-w-7xl px-6 py-6 lg:px-10">
      <header class="flex flex-col gap-6 border-b border-stone-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="space-y-2">
          <p class="text-[0.72rem] uppercase tracking-[0.3em] text-stone-500">Doza Znanja</p>
          <div class="flex flex-col gap-2 lg:flex-row lg:items-end lg:gap-4">
            <h1 class="font-serif text-4xl leading-none tracking-[-0.04em] text-stone-950 sm:text-5xl">
              {{ player.nickname }}, dobrodosla natrag.
            </h1>
            <p class="text-sm text-stone-500">Session, learn i import workflow u jednoj aplikaciji.</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 text-sm text-stone-500">
          <span class="border border-stone-200 px-3 py-2">Razina {{ player.level }}</span>
          <span class="border border-stone-200 px-3 py-2">{{ player.xp }} XP</span>
          <button
            type="button"
            class="border border-stone-950 px-3 py-2 text-stone-950 transition hover:-translate-y-0.5 hover:bg-stone-950 hover:text-stone-50"
            @click="resetProfile"
          >
            Promijeni profil
          </button>
        </div>
      </header>

      <nav class="flex flex-wrap gap-3 border-b border-stone-200 py-5">
        <button
          type="button"
          class="px-4 py-2 text-sm transition"
          :class="activeView === 'session' ? 'bg-stone-950 text-stone-50' : 'border border-stone-200 text-stone-700 hover:border-stone-400'"
          @click="activeView = 'session'"
        >
          Sesija
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm transition"
          :class="activeView === 'learn' ? 'bg-stone-950 text-stone-50' : 'border border-stone-200 text-stone-700 hover:border-stone-400'"
          @click="activeView = 'learn'"
        >
          Uci
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm transition"
          :class="activeView === 'imports' ? 'bg-stone-950 text-stone-50' : 'border border-stone-200 text-stone-700 hover:border-stone-400'"
          @click="activeView = 'imports'"
        >
          Import Center
        </button>
      </nav>

      <section v-if="activeView === 'session'" class="grid gap-8 border-b border-stone-200 py-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div class="space-y-6">
          <p class="text-[0.72rem] uppercase tracking-[0.28em] text-stone-500">{{ sessionLabel }}</p>
          <h2 class="max-w-4xl font-serif text-4xl leading-none tracking-[-0.04em] text-stone-950 sm:text-5xl">
            {{ activeTopic?.titleHr ?? sessionScopeLabel }}
          </h2>
          <p class="max-w-2xl text-base leading-7 text-stone-600">
            {{
              activeTopic?.descriptionHr ??
              "Sustav bira iduci najkorisniji izazov prema tvom napretku i trenutno odabranom izvoru."
            }}
          </p>
          <div class="flex flex-wrap items-center gap-3 text-sm text-stone-500">
            <span class="border border-stone-200 px-3 py-2">Scope: {{ sessionScopeLabel }}</span>
            <span class="border border-stone-200 px-3 py-2">{{ sessionScopeHint }}</span>
            <button
              v-if="sessionImportId"
              type="button"
              class="border border-stone-200 px-3 py-2 text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              @click="clearSessionScope"
            >
              Vrati sve kolekcije
            </button>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="border border-stone-200 bg-white/70 p-5">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Napredak prema novoj razini</p>
            <p class="mt-3 text-3xl font-semibold text-stone-950">{{ levelProgress }}%</p>
            <div class="mt-4 h-1.5 bg-stone-200">
              <div class="h-full transition-all" :style="{ width: `${levelProgress}%`, backgroundColor: activeAccent }" />
            </div>
          </div>
          <div class="border border-stone-200 bg-white/70 p-5">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Savladanost teme</p>
            <p class="mt-3 text-3xl font-semibold text-stone-950">{{ activeTopic?.mastery ?? 0 }}%</p>
            <p class="mt-3 text-sm leading-6 text-stone-500">
              {{ activeTopic?.questionCount ?? 0 }} pitanja u ovoj cjelini
            </p>
          </div>
          <div class="border border-stone-200 bg-white/70 p-5">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Streak</p>
            <p class="mt-3 text-3xl font-semibold text-stone-950">{{ player.streak }}</p>
            <p class="mt-3 text-sm leading-6 text-stone-500">Svaki tocni odgovor gradi ritam ucenja.</p>
          </div>
          <div class="border border-stone-200 bg-white/70 p-5">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Tocnost</p>
            <p class="mt-3 text-3xl font-semibold text-stone-950">{{ player.accuracy }}%</p>
            <p class="mt-3 text-sm leading-6 text-stone-500">
              {{ player.correctAnswers }}/{{ player.totalAnswered }} tocnih odgovora
            </p>
          </div>
        </div>
      </section>

      <section class="grid gap-8 border-b border-stone-200 py-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside class="space-y-6">
          <div class="space-y-2">
            <p class="text-[0.72rem] uppercase tracking-[0.28em] text-stone-500">Kurikulum</p>
            <h3 class="font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
              Teme su razdvojene u jasne cjeline.
            </h3>
          </div>

          <div class="border-y border-stone-200">
            <button
              type="button"
              class="flex w-full items-start justify-between gap-4 border-b border-stone-200 py-4 text-left transition hover:translate-x-1"
              :class="!selectedTopicId ? 'text-stone-950' : 'text-stone-500'"
              @click="chooseTopic(undefined)"
            >
              <div class="flex items-start gap-3">
                <span class="mt-2 h-2.5 w-2.5 rounded-full bg-stone-950" />
                <div>
                  <p class="text-base font-medium">
                    {{ sessionImportId ? "Mix unutar kolekcije" : "Adaptivni mix" }}
                  </p>
                  <p class="mt-1 text-sm leading-6 text-stone-500">
                    {{
                      sessionImportId
                        ? "Sustav bira ono sto ti najvise treba, ali ostaje unutar odabrane skripte."
                        : "Sustav bira ono sto ti sada najvise treba preko svih kolekcija."
                    }}
                  </p>
                </div>
              </div>
            </button>

            <button
              v-for="topic in sessionTopics"
              :key="topic.id"
              type="button"
              class="flex w-full items-start justify-between gap-4 border-b border-stone-200 py-4 text-left transition hover:translate-x-1"
              :class="selectedTopicId === topic.id ? 'text-stone-950' : 'text-stone-500'"
              @click="chooseTopic(topic.id, sessionImportId)"
            >
              <div class="flex items-start gap-3">
                <span class="mt-2 h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: topic.accent }" />
                <div>
                  <p class="text-base font-medium text-stone-900">{{ topic.titleHr }}</p>
                  <p class="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-stone-400">
                    {{ topic.sourceLabelHr }}
                  </p>
                  <p class="mt-1 text-sm leading-6 text-stone-500">{{ topic.descriptionHr }}</p>
                </div>
              </div>
              <span class="pt-0.5 text-sm text-stone-400">{{ topic.mastery }}%</span>
            </button>
          </div>
        </aside>

        <section class="space-y-6">
          <div class="flex flex-col justify-between gap-4 border-b border-stone-200 pb-4 sm:flex-row sm:items-end">
            <div>
              <p class="text-[0.72rem] uppercase tracking-[0.26em] text-stone-500">Aktivna sesija</p>
              <h3 class="mt-2 font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
                Velika radna povrsina za jedno pitanje odjednom.
              </h3>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm text-stone-500">
              <span class="border border-stone-200 px-3 py-2">{{ currentCard?.progressLabel ?? "Cekanje" }}</span>
              <span class="border border-stone-200 px-3 py-2">{{ currentQuestionCountLabel }}</span>
              <span class="border border-stone-200 px-3 py-2">
                {{ currentCard ? difficultyLabel[currentCard.difficulty] : "Bez kartice" }}
              </span>
            </div>
          </div>

          <article
            class="border border-stone-200 bg-white/90 p-6 shadow-[0_30px_100px_rgba(34,29,22,0.05)] sm:p-8"
            :style="{ borderTopWidth: '4px', borderTopColor: activeAccent }"
          >
            <div v-if="loadingCard || booting" class="space-y-4 animate-pulse">
              <div class="h-3 w-36 bg-stone-200" />
              <div class="h-10 w-3/4 bg-stone-200" />
              <div class="grid gap-3 pt-4">
                <div class="h-16 bg-stone-100" />
                <div class="h-16 bg-stone-100" />
                <div class="h-16 bg-stone-100" />
              </div>
            </div>

            <template v-else-if="currentCard">
              <div class="flex flex-col gap-5">
                <div class="flex flex-col gap-3 border-b border-stone-200 pb-6">
                  <p class="text-[0.72rem] uppercase tracking-[0.28em] text-stone-500">
                    {{ currentCard.topicTitleHr }}
                  </p>
                  <h4 class="max-w-4xl font-serif text-4xl leading-none tracking-[-0.03em] text-stone-950">
                    {{ currentCard.questionHr }}
                  </h4>
                </div>

                <div class="grid gap-3">
                  <button
                    v-for="option in currentCard.options"
                    :key="option.id"
                    type="button"
                    :disabled="Boolean(feedback)"
                    class="group flex w-full items-center gap-4 border px-4 py-4 text-left text-base transition"
                    :class="optionState(option.id)"
                    @click="selectedOptionId = option.id"
                  >
                    <span
                      class="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-current text-sm uppercase"
                    >
                      {{ option.id }}
                    </span>
                    <span class="leading-7">{{ option.textHr }}</span>
                  </button>
                </div>

                <div class="flex flex-col gap-4 border-t border-stone-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    class="inline-flex items-center justify-center border border-stone-950 bg-stone-950 px-6 py-3 text-sm font-medium text-stone-50 transition hover:-translate-y-0.5 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="!canSubmit"
                    @click="submitCurrentAnswer"
                  >
                    {{ submitting ? "Provjeravam..." : "Provjeri odgovor" }}
                  </button>
                  <p class="max-w-xl text-sm leading-6 text-stone-500">
                    {{ feedback ? "Objasnjenje je spremno. Nakon toga nastavljas u novu karticu." : "Odaberi jednu tvrdnju i potvrdi odgovor kada budes spremna." }}
                  </p>
                </div>

                <transition name="fade-rise">
                  <section
                    v-if="feedback"
                    class="grid gap-5 border-t border-stone-200 pt-6 lg:grid-cols-[1fr_auto]"
                  >
                    <div class="space-y-3">
                      <p class="text-[0.72rem] uppercase tracking-[0.26em]" :style="{ color: feedback.isCorrect ? '#157347' : '#b42318' }">
                        {{ feedback.isCorrect ? "Odgovor je tocan" : "Potrebna je repeticija" }}
                      </p>
                      <h5 class="font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
                        {{ feedback.isCorrect ? `+${feedback.xpEarned} XP za ovaj korak` : "Procitaj objasnjenje i vrati ritam" }}
                      </h5>
                      <p class="max-w-3xl text-base leading-7 text-stone-600">
                        {{ feedback.explanationHr }}
                      </p>
                      <p class="text-sm leading-6 text-stone-500">{{ feedback.nextUnlockHr }}</p>
                    </div>

                    <div class="flex items-end">
                      <button
                        type="button"
                        class="inline-flex items-center justify-center border border-stone-950 px-6 py-3 text-sm font-medium text-stone-950 transition hover:-translate-y-0.5 hover:bg-stone-950 hover:text-stone-50"
                        @click="continueRun"
                      >
                        Sljedeci izazov
                      </button>
                    </div>
                  </section>
                </transition>
              </div>
            </template>

            <div v-else class="space-y-3">
              <p class="text-[0.72rem] uppercase tracking-[0.26em] text-stone-500">Bez kartice</p>
              <h4 class="font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
                Trenutno nema dostupnog pitanja.
              </h4>
              <p class="max-w-2xl text-base leading-7 text-stone-600">
                Promijeni temu ili osvjezi profil kako bismo nastavili sesiju.
              </p>
            </div>
          </article>

          <p v-if="message" class="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ message }}
          </p>
        </section>
      </section>

      <section v-if="activeView === 'session'" class="grid gap-6 py-8 lg:grid-cols-3">
        <article class="border border-stone-200 bg-white/70 p-6">
          <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Dnevna misija</p>
          <h3 class="mt-3 font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
            {{ dashboard?.dailyMission.titleHr }}
          </h3>
          <p class="mt-3 text-sm leading-6 text-stone-600">
            {{ dashboard?.dailyMission.descriptionHr }}
          </p>
          <div class="mt-5 h-1.5 bg-stone-200">
            <div class="h-full transition-all" :style="{ width: `${missionProgress}%`, backgroundColor: activeAccent }" />
          </div>
          <div class="mt-5 flex items-end justify-between gap-3">
            <p class="text-3xl font-semibold text-stone-950">
              {{ dashboard?.dailyMission.current }}/{{ dashboard?.dailyMission.target }}
            </p>
            <p class="text-sm text-stone-500">+{{ dashboard?.dailyMission.rewardXp }} XP</p>
          </div>
        </article>

        <article class="border border-stone-200 bg-white/70 p-6">
          <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Slabija tocka</p>
          <h3 class="mt-3 font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
            {{ dashboard?.weakTopic.titleHr }}
          </h3>
          <p class="mt-5 text-5xl font-semibold text-stone-950">{{ dashboard?.weakTopic.accuracy }}%</p>
          <p class="mt-4 text-sm leading-6 text-stone-600">
            {{ dashboard?.weakTopic.tipHr }}
          </p>
        </article>

        <article class="border border-stone-200 bg-white/70 p-6">
          <div class="flex items-end justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Leaderboard</p>
              <h3 class="mt-3 font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">Vrh ljestvice</h3>
            </div>
            <p class="text-sm text-stone-500">Top {{ dashboard?.leaderboard.length ?? 0 }}</p>
          </div>

          <div class="divide-y divide-stone-200">
            <div
              v-for="(entry, index) in dashboard?.leaderboard ?? []"
              :key="`${entry.nickname}-${index}`"
              class="flex items-start justify-between gap-4 py-4"
            >
              <div class="flex items-start gap-3">
                <span class="mt-0.5 text-sm text-stone-400">#{{ index + 1 }}</span>
                <div>
                  <p class="text-base font-medium text-stone-900">{{ entry.nickname }}</p>
                  <p class="mt-1 text-sm text-stone-500">Lv {{ entry.level }} · {{ entry.streak }} streak</p>
                </div>
              </div>
              <span class="text-sm text-stone-500">{{ entry.xp }} XP</span>
            </div>
          </div>
        </article>
      </section>

      <section v-else-if="activeView === 'learn'" class="grid gap-8 py-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside class="space-y-6">
          <div class="space-y-2">
            <p class="text-[0.72rem] uppercase tracking-[0.28em] text-stone-500">Learn collections</p>
            <h2 class="font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
              Uci iz poboljsane skripte.
            </h2>
          </div>

          <div class="border-y border-stone-200">
            <button
              v-for="item in imports"
              :key="item.id"
              type="button"
              class="flex w-full items-start justify-between gap-4 border-b border-stone-200 py-4 text-left transition hover:translate-x-1"
              :class="selectedImportId === item.id ? 'text-stone-950' : 'text-stone-500'"
              @click="selectImport(item.id)"
            >
              <div class="space-y-1">
                <p class="text-base font-medium text-stone-900">{{ item.titleHr }}</p>
                <p class="text-sm leading-6 text-stone-500">
                  {{ item.topicCount }} tema · {{ item.questionCount }} pitanja
                </p>
              </div>
              <span class="pt-0.5 text-xs uppercase tracking-[0.2em] text-stone-400">{{ item.sourceType }}</span>
            </button>
          </div>
        </aside>

        <section class="space-y-6">
          <div v-if="loadingImportDetail" class="space-y-4 animate-pulse border border-stone-200 bg-white/80 p-8">
            <div class="h-3 w-32 bg-stone-200" />
            <div class="h-10 w-3/4 bg-stone-200" />
            <div class="h-32 bg-stone-100" />
          </div>

          <template v-else-if="importDetail">
            <div class="flex flex-col gap-5 border-b border-stone-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div class="space-y-3">
                <p class="text-[0.72rem] uppercase tracking-[0.28em] text-stone-500">Poboljsani materijal</p>
                <h2 class="font-serif text-4xl leading-none tracking-[-0.03em] text-stone-950">
                  {{ importDetail.import.titleHr }}
                </h2>
                <p class="max-w-2xl text-base leading-7 text-stone-600">
                  Ovdje aplikacija pretvara importiranu skriptu u pregledne lekcije,
                  kljucne koncepte i pripremu za kviz.
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-3 text-sm text-stone-500">
                <span class="border border-stone-200 px-3 py-2">{{ selectedImportTopicCount }} tema</span>
                <span class="border border-stone-200 px-3 py-2">{{ selectedImportQuestionCount }} pitanja</span>
                <button
                  type="button"
                  class="border border-stone-950 px-3 py-2 text-stone-950 transition hover:-translate-y-0.5 hover:bg-stone-950 hover:text-stone-50"
                  @click="startQuizFromImport"
                >
                  Pokreni kviz iz kolekcije
                </button>
              </div>
            </div>

            <div class="grid gap-6">
              <article
                v-for="lesson in importDetail.lessons"
                :key="lesson.id"
                class="border border-stone-200 bg-white/85 p-6 shadow-[0_16px_50px_rgba(34,29,22,0.04)]"
              >
                <div class="flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Lekcija {{ lesson.sortOrder }}</p>
                    <h3 class="mt-2 font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
                      {{ lesson.titleHr }}
                    </h3>
                  </div>
                  <button
                    v-if="lesson.topicId"
                    type="button"
                    class="border border-stone-200 px-3 py-2 text-sm text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    @click="chooseTopic(lesson.topicId ?? undefined, selectedImportId || undefined)"
                  >
                    Kreni na pitanja teme
                  </button>
                </div>

                <p class="mt-5 max-w-3xl text-base leading-7 text-stone-600">
                  {{ lesson.overviewHr }}
                </p>

                <div
                  v-if="lesson.sourceSnippetHr"
                  class="mt-5 border-l border-stone-300 pl-4 text-sm leading-6 text-stone-500"
                >
                  <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-400">
                    Izvorni ulomak skripte
                  </p>
                  <p class="mt-3">{{ lesson.sourceSnippetHr }}</p>
                </div>

                <div class="mt-6 grid gap-5 lg:grid-cols-3">
                  <div>
                    <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Kljucni koncepti</p>
                    <ul class="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                      <li v-for="concept in lesson.keyConceptsHr" :key="concept" class="border-t border-stone-200 pt-3">
                        {{ concept }}
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Promptovi za ucenje</p>
                    <ul class="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                      <li v-for="prompt in lesson.studyPromptsHr" :key="prompt" class="border-t border-stone-200 pt-3">
                        {{ prompt }}
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Checklist prije kviza</p>
                    <ul class="mt-4 space-y-3 text-sm leading-6 text-stone-700">
                      <li v-for="check in lesson.recallChecklistHr" :key="check" class="border-t border-stone-200 pt-3">
                        {{ check }}
                      </li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          </template>

          <div v-else class="border border-stone-200 bg-white/80 p-8">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Nema importa</p>
            <h3 class="mt-3 font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
              Objavi prvu skriptu kroz Import Center.
            </h3>
            <p class="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              Nakon objave importa ovdje ce se prikazati poboljsane lekcije za ucenje i ulaz u kviz dio.
            </p>
          </div>
        </section>
      </section>

      <section v-else class="grid gap-8 py-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside class="space-y-6">
          <div class="space-y-2">
            <p class="text-[0.72rem] uppercase tracking-[0.28em] text-stone-500">Import Center</p>
            <h2 class="font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
              Uvezi skriptu i pregledaj je prije objave.
            </h2>
          </div>

          <div class="border border-stone-200 bg-white/80 p-5">
            <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Sto mozes zalijepiti</p>
            <div class="mt-4 space-y-3 text-sm leading-6 text-stone-600">
              <p>Podrzana je obicna skripta, markdown ili vec gotov JSON / TS question bank.</p>
              <p>Aplikacija cita tekst, dijeli ga po cjelinama, slaze Learn lekcije i priprema prva kviz pitanja prije objave.</p>
            </div>
            <div class="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                class="border border-stone-950 px-3 py-2 text-sm text-stone-950 transition hover:-translate-y-0.5 hover:bg-stone-950 hover:text-stone-50"
                @click="loadExampleScript"
              >
                Primjer skripte
              </button>
              <button
                type="button"
                class="border border-stone-200 px-3 py-2 text-sm text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                @click="loadQuestionBankExample"
              >
                Primjer question banka
              </button>
            </div>
          </div>

          <div class="border-y border-stone-200">
            <button
              v-for="item in imports"
              :key="item.id"
              type="button"
              class="flex w-full items-start justify-between gap-4 border-b border-stone-200 py-4 text-left transition hover:translate-x-1"
              :class="selectedImportId === item.id ? 'text-stone-950' : 'text-stone-500'"
              @click="selectImport(item.id)"
            >
              <div>
                <p class="text-base font-medium text-stone-900">{{ item.titleHr }}</p>
                <p class="mt-1 text-sm leading-6 text-stone-500">{{ item.topicCount }} tema · {{ item.questionCount }} pitanja</p>
              </div>
              <span class="pt-0.5 text-xs uppercase tracking-[0.2em] text-stone-400">{{ item.sourceType }}</span>
            </button>
          </div>
        </aside>

        <section class="space-y-6">
          <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <article class="border border-stone-200 bg-white/85 p-6">
              <div class="flex flex-col gap-3 border-b border-stone-200 pb-5">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Novi import</p>
                <h3 class="font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
                  Zalijepi skriptu ili ucitaj datoteku.
                </h3>
              </div>

              <label class="mt-5 block space-y-2">
                <span class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Naslov kolekcije</span>
                <input
                  v-model="importTitleInput"
                  type="text"
                  placeholder="npr. Kardiologija skripta"
                  class="w-full border border-stone-200 bg-transparent px-4 py-3 text-sm text-stone-950 outline-none placeholder:text-stone-400 focus:border-stone-950"
                />
              </label>

              <label class="mt-4 block space-y-2">
                <span class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Ucitaj datoteku</span>
                <input
                  type="file"
                  accept=".json,.ts,.js,.mjs,.txt,.md"
                  class="block w-full text-sm text-stone-600 file:mr-4 file:border-0 file:bg-stone-950 file:px-4 file:py-2 file:text-stone-50"
                  @change="handleFileChange"
                />
              </label>

              <label class="mt-4 block space-y-2">
                <span class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Sadrzaj skripte</span>
                <textarea
                  v-model="importPayloadText"
                  rows="18"
                  class="w-full border border-stone-200 bg-transparent px-4 py-3 text-sm leading-6 text-stone-900 outline-none placeholder:text-stone-400 focus:border-stone-950"
                  placeholder="Zalijepi obicnu skriptu, markdown ili questionBank format ovdje."
                />
              </label>

              <div class="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  class="border border-stone-200 px-4 py-3 text-sm text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:opacity-60"
                  :disabled="previewingImport"
                  @click="handleImportPreview"
                >
                  {{ previewingImport ? "Pregledavam..." : "Pregled importa" }}
                </button>
                <button
                  type="button"
                  class="border border-stone-950 bg-stone-950 px-4 py-3 text-sm text-stone-50 transition hover:-translate-y-0.5 hover:bg-stone-800 disabled:opacity-60"
                  :disabled="publishingImport"
                  @click="handleImportPublish"
                >
                  {{ publishingImport ? "Objavljujem..." : "Objavi kolekciju" }}
                </button>
              </div>

              <p v-if="importMessage" class="mt-4 text-sm text-rose-700">{{ importMessage }}</p>
            </article>

            <article class="border border-stone-200 bg-white/85 p-6">
              <div class="flex flex-col gap-3 border-b border-stone-200 pb-5">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Pregled prije objave</p>
                <h3 class="font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
                  Aplikacija cita i normalizira skriptu.
                </h3>
              </div>

              <template v-if="importPreviewState">
                <div class="mt-5 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                  <span class="border border-stone-200 px-3 py-2">{{ importPreviewState.sourceType }}</span>
                  <span class="border border-stone-200 px-3 py-2">{{ importPreviewState.topicCount }} tema</span>
                  <span class="border border-stone-200 px-3 py-2">{{ importPreviewState.questionCount }} pitanja</span>
                </div>

                <div class="mt-6 space-y-6">
                  <div>
                    <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Teme</p>
                    <div class="mt-4 divide-y divide-stone-200">
                      <div
                        v-for="topic in importPreviewState.topics"
                        :key="`${topic.slug}-${topic.titleHr}`"
                        class="flex items-start justify-between gap-4 py-4"
                      >
                        <div class="flex items-start gap-3">
                          <span class="mt-2 h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: topic.accent }" />
                          <div>
                            <p class="text-base font-medium text-stone-900">{{ topic.titleHr }}</p>
                            <p class="mt-1 text-sm leading-6 text-stone-500">{{ topic.descriptionHr }}</p>
                          </div>
                        </div>
                        <span class="text-sm text-stone-500">{{ topic.questionCount }}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Learn preview</p>
                    <div class="mt-4 grid gap-4">
                      <article
                        v-for="lesson in importPreviewState.lessons"
                        :key="lesson.id"
                        class="border border-stone-200 p-4"
                      >
                        <p class="text-sm font-medium text-stone-900">{{ lesson.titleHr }}</p>
                        <p class="mt-2 text-sm leading-6 text-stone-500">{{ lesson.overviewHr }}</p>
                      </article>
                    </div>
                  </div>

                  <div>
                    <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Quiz preview</p>
                    <div class="mt-4 grid gap-4">
                      <article
                        v-for="sampleQuestion in importPreviewState.sampleQuestions"
                        :key="`${sampleQuestion.topicTitleHr}-${sampleQuestion.questionHr}`"
                        class="border border-stone-200 p-4"
                      >
                        <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-400">
                          {{ sampleQuestion.topicTitleHr }}
                        </p>
                        <p class="mt-3 text-base font-medium text-stone-900">
                          {{ sampleQuestion.questionHr }}
                        </p>
                        <p class="mt-3 text-sm leading-6 text-emerald-700">
                          Tocan odgovor: {{ sampleQuestion.correctAnswerHr }}
                        </p>
                        <p class="mt-2 text-sm leading-6 text-stone-500">
                          {{ sampleQuestion.explanationHr }}
                        </p>
                      </article>
                    </div>
                  </div>
                </div>
              </template>

              <div v-else class="mt-5 space-y-3">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Nema pregleda</p>
                <p class="text-sm leading-6 text-stone-600">
                  Klikni "Pregled importa" da vidis kako ce aplikacija pretvoriti tvoju skriptu u learn i quiz kolekciju.
                </p>
              </div>
            </article>
          </div>

          <article v-if="currentImport" class="border border-stone-200 bg-white/80 p-6">
            <div class="flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Odabrana kolekcija</p>
                <h3 class="mt-2 font-serif text-3xl leading-none tracking-[-0.03em] text-stone-950">
                  {{ currentImport.titleHr }}
                </h3>
              </div>
              <button
                type="button"
                class="border border-stone-950 px-3 py-2 text-sm text-stone-950 transition hover:-translate-y-0.5 hover:bg-stone-950 hover:text-stone-50"
                @click="activeView = 'learn'"
              >
                Otvori Learn view
              </button>
            </div>

            <div class="mt-5 grid gap-4 sm:grid-cols-3">
              <div class="border border-stone-200 p-4">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Tip</p>
                <p class="mt-3 text-2xl font-semibold text-stone-950">{{ currentImport.sourceType }}</p>
              </div>
              <div class="border border-stone-200 p-4">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Tema</p>
                <p class="mt-3 text-2xl font-semibold text-stone-950">{{ currentImport.topicCount }}</p>
              </div>
              <div class="border border-stone-200 p-4">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-stone-500">Pitanja</p>
                <p class="mt-3 text-2xl font-semibold text-stone-950">{{ currentImport.questionCount }}</p>
              </div>
            </div>

            <button
              type="button"
              class="mt-5 border border-stone-950 bg-stone-950 px-4 py-3 text-sm text-stone-50 transition hover:-translate-y-0.5 hover:bg-stone-800"
              @click="startQuizFromImport"
            >
              Pokreni kviz iz ove kolekcije
            </button>
          </article>
        </section>
      </section>
    </section>
  </main>
</template>

<style scoped>
.grain {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.35)),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180' viewBox='0 0 180 180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.05' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
}

.fade-rise-enter-active,
.fade-rise-leave-active {
  transition: all 220ms ease;
}

.fade-rise-enter-from,
.fade-rise-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
