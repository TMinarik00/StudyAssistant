import { computed, ref } from "vue";
import {
  createImport,
  createPlayer,
  deleteImport,
  getDashboard,
  getImportDetail,
  getImports,
  getNextQuizCard,
  previewImport,
  submitQuizAnswer,
  updateImport,
} from "../api/generated/farmapp";
import type {
  Dashboard,
  ImportDetail,
  ImportPayloadRequest,
  ImportPreview,
  NextQuizCard,
  PlayerProfile,
  QuizAnswerResult,
  SourceImportSummary,
  UpdateImportRequest,
} from "../api/generated/model";

const STORAGE_KEY = "farmapp-player-v2";

const isBrowser = typeof window !== "undefined";

const initialized = ref(false);
const booting = ref(false);
const player = ref<PlayerProfile | null>(null);
const dashboard = ref<Dashboard | null>(null);
const imports = ref<SourceImportSummary[]>([]);
const importDetails = ref<Record<string, ImportDetail>>({});
const nicknameDraft = ref(isBrowser ? window.localStorage.getItem(STORAGE_KEY) ?? "" : "");
const currentCard = ref<NextQuizCard | null>(null);
const currentQuizImportId = ref<string>("");
const currentQuizTopicId = ref<string | undefined>();
const selectedOptionId = ref<string | null>(null);
const feedback = ref<QuizAnswerResult | null>(null);
const libraryMessage = ref("");
const profileMessage = ref("");
const quizMessage = ref("");
const previewMessage = ref("");
const previewState = ref<ImportPreview | null>(null);
const loadingImports = ref(false);
const savingProfile = ref(false);
const previewingImport = ref(false);
const creatingImport = ref(false);
const loadingQuiz = ref(false);
const submittingAnswer = ref(false);

let initializePromise: Promise<void> | null = null;

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

function setStoredNickname(value: string) {
  if (!isBrowser) {
    return;
  }

  if (!value) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, value);
}

function upsertImportSummary(summary: SourceImportSummary) {
  const existingIndex = imports.value.findIndex((item) => item.id === summary.id);

  if (existingIndex === -1) {
    imports.value = [summary, ...imports.value];
    return;
  }

  imports.value = imports.value.map((item) => (item.id === summary.id ? summary : item));
}

function cacheImportDetail(detail: ImportDetail) {
  importDetails.value = {
    ...importDetails.value,
    [detail.import.id]: detail,
  };
}

function updateCachedImportSummary(summary: SourceImportSummary) {
  upsertImportSummary(summary);

  const cachedDetail = importDetails.value[summary.id];

  if (!cachedDetail) {
    return;
  }

  cacheImportDetail({
    ...cachedDetail,
    import: summary,
    topics: cachedDetail.topics.map((topic) => ({
      ...topic,
      sourceLabelHr: summary.titleHr,
    })),
  });
}

function removeCachedImport(importId: string) {
  imports.value = imports.value.filter((item) => item.id !== importId);

  const nextDetails = { ...importDetails.value };
  delete nextDetails[importId];
  importDetails.value = nextDetails;

  if (currentQuizImportId.value === importId) {
    currentQuizImportId.value = "";
    currentQuizTopicId.value = undefined;
    currentCard.value = null;
    selectedOptionId.value = null;
    feedback.value = null;
  }
}

async function loadImportsCatalog() {
  loadingImports.value = true;
  libraryMessage.value = "";

  try {
    const response = await getImports();
    imports.value = ensureOk(response);
  } catch (error) {
    libraryMessage.value = getMessageFromError(error);
  } finally {
    loadingImports.value = false;
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
  imports.value = data.imports;
}

async function initialize() {
  if (initialized.value) {
    return;
  }

  if (!initializePromise) {
    initializePromise = (async () => {
      booting.value = true;

      try {
        await loadImportsCatalog();

        const storedNickname = isBrowser
          ? window.localStorage.getItem(STORAGE_KEY)?.trim() ?? ""
          : "";

        if (storedNickname) {
          nicknameDraft.value = storedNickname;
          await saveNickname(storedNickname, true);
        }

        initialized.value = true;
      } finally {
        booting.value = false;
      }
    })();
  }

  await initializePromise;
}

async function saveNickname(nickname: string, silent = false) {
  const normalized = nickname.trim();

  if (!normalized) {
    profileMessage.value = "Upisi nadimak kako bismo mogli spremati tvoj napredak.";
    return false;
  }

  savingProfile.value = true;

  if (!silent) {
    profileMessage.value = "";
  }

  try {
    const response = await createPlayer({ nickname: normalized });
    const data = ensureOk(response);

    player.value = data;
    nicknameDraft.value = data.nickname;
    setStoredNickname(data.nickname);
    await refreshDashboard();

    return true;
  } catch (error) {
    profileMessage.value = getMessageFromError(error);
    return false;
  } finally {
    savingProfile.value = false;
  }
}

async function clearProfile() {
  player.value = null;
  dashboard.value = null;
  currentCard.value = null;
  currentQuizImportId.value = "";
  currentQuizTopicId.value = undefined;
  selectedOptionId.value = null;
  feedback.value = null;
  profileMessage.value = "";
  nicknameDraft.value = "";
  setStoredNickname("");
}

async function ensureImportDetail(importId: string) {
  const cached = importDetails.value[importId];

  if (cached) {
    return cached;
  }

  const response = await getImportDetail(importId);
  const detail = ensureOk(response);
  cacheImportDetail(detail);

  return detail;
}

async function previewSubject(payload: ImportPayloadRequest) {
  previewingImport.value = true;
  previewMessage.value = "";

  try {
    const response = await previewImport(payload);
    previewState.value = ensureOk(response);
    return previewState.value;
  } catch (error) {
    previewState.value = null;
    previewMessage.value = getMessageFromError(error);
    return null;
  } finally {
    previewingImport.value = false;
  }
}

async function createSubject(payload: ImportPayloadRequest) {
  creatingImport.value = true;
  previewMessage.value = "";

  try {
    const response = await createImport(payload);
    const created = ensureOk(response);

    previewState.value = created;
    await loadImportsCatalog();

    if (created.importId) {
      await ensureImportDetail(created.importId);
    }

    return created;
  } catch (error) {
    previewMessage.value = getMessageFromError(error);
    return null;
  } finally {
    creatingImport.value = false;
  }
}

async function renameSubject(importId: string, titleHr: string) {
  const payload: UpdateImportRequest = { titleHr };
  const response = await updateImport(importId, payload);
  const updatedSummary = ensureOk(response);

  updateCachedImportSummary(updatedSummary);

  return updatedSummary;
}

async function setPinnedSubject(importId: string, isPinned: boolean) {
  const payload: UpdateImportRequest = { isPinned };
  const response = await updateImport(importId, payload);
  const updatedSummary = ensureOk(response);

  updateCachedImportSummary(updatedSummary);

  return updatedSummary;
}

async function archiveSubject(importId: string) {
  const response = await deleteImport(importId);
  ensureOk(response as { status: number; data: void | { message?: string } });
  removeCachedImport(importId);
}

async function startQuiz(importId: string, topicId?: string) {
  currentQuizImportId.value = importId;
  currentQuizTopicId.value = topicId;
  currentCard.value = null;
  selectedOptionId.value = null;
  feedback.value = null;
  quizMessage.value = "";

  if (!player.value) {
    quizMessage.value = "Za test je potreban nadimak kako bismo spremili rezultat.";
    return false;
  }

  loadingQuiz.value = true;

  try {
    const response = await getNextQuizCard({
      playerId: player.value.id,
      sourceImportId: importId,
      topicId,
    });

    currentCard.value = ensureOk(response);
    return true;
  } catch (error) {
    currentCard.value = null;
    quizMessage.value = getMessageFromError(error);
    return false;
  } finally {
    loadingQuiz.value = false;
  }
}

async function loadNextQuizCard() {
  if (!currentQuizImportId.value) {
    return false;
  }

  return startQuiz(currentQuizImportId.value, currentQuizTopicId.value);
}

async function submitCurrentAnswer() {
  if (!player.value || !currentCard.value || !selectedOptionId.value || feedback.value) {
    return null;
  }

  submittingAnswer.value = true;
  quizMessage.value = "";

  try {
    const response = await submitQuizAnswer({
      playerId: player.value.id,
      flashcardId: currentCard.value.flashcardId,
      selectedOptionId: selectedOptionId.value,
    });

    feedback.value = ensureOk(response);
    await refreshDashboard();

    return feedback.value;
  } catch (error) {
    quizMessage.value = getMessageFromError(error);
    return null;
  } finally {
    submittingAnswer.value = false;
  }
}

const hasPlayer = computed(() => Boolean(player.value));

export function useFarmApp() {
  return {
    initialized: computed(() => initialized.value),
    booting: computed(() => booting.value),
    player,
    dashboard,
    imports,
    importDetails,
    nicknameDraft,
    currentCard,
    currentQuizImportId,
    currentQuizTopicId,
    selectedOptionId,
    feedback,
    libraryMessage,
    profileMessage,
    quizMessage,
    previewMessage,
    previewState,
    loadingImports,
    savingProfile,
    previewingImport,
    creatingImport,
    loadingQuiz,
    submittingAnswer,
    hasPlayer,
    initialize,
    saveNickname,
    clearProfile,
    loadImportsCatalog,
    refreshDashboard,
    ensureImportDetail,
    previewSubject,
    createSubject,
    renameSubject,
    setPinnedSubject,
    archiveSubject,
    startQuiz,
    loadNextQuizCard,
    submitCurrentAnswer,
  };
}
