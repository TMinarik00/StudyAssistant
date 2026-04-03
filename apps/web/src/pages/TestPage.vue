<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useFarmApp } from "../composables/useFarmApp";

const props = defineProps<{
  importId: string;
}>();

const router = useRouter();
const route = useRoute();
const farmApp = useFarmApp();

const loading = ref(false);
const errorMessage = ref("");

const detail = computed(() => farmApp.importDetails.value[props.importId] ?? null);
const selectedTopicId = computed(() =>
  typeof route.query.topicId === "string" ? route.query.topicId : undefined,
);

const activeTopic = computed(() => {
  if (!detail.value) {
    return null;
  }

  const topicId = farmApp.currentCard.value?.topicId ?? selectedTopicId.value;

  return detail.value.topics.find((topic) => topic.id === topicId) ?? null;
});

function optionClass(optionId: string) {
  if (!farmApp.feedback.value) {
    return farmApp.selectedOptionId.value === optionId
      ? "border-ink bg-ink text-white"
      : "border-ink/10 bg-white text-ink hover:-translate-y-0.5 hover:border-ink/30";
  }

  if (farmApp.feedback.value.correctOptionId === optionId) {
    return "border-emerald-300 bg-emerald-50 text-emerald-900";
  }

  if (farmApp.selectedOptionId.value === optionId) {
    return "border-rose-300 bg-rose-50 text-rose-900";
  }

  return "border-ink/8 bg-ink/3 text-ink/40";
}

async function bootTestPage() {
  loading.value = true;
  errorMessage.value = "";

  try {
    await farmApp.initialize();
    await farmApp.ensureImportDetail(props.importId);

    if (farmApp.player.value) {
      await farmApp.startQuiz(props.importId, selectedTopicId.value);
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Predmet nije moguce otvoriti.";
  } finally {
    loading.value = false;
  }
}

async function changeScope(topicId?: string) {
  await router.replace({
    name: "test",
    params: {
      importId: props.importId,
    },
    query: topicId ? { topicId } : undefined,
  });

  if (farmApp.player.value) {
    await farmApp.startQuiz(props.importId, topicId);
  }
}

async function saveNicknameAndStart() {
  const saved = await farmApp.saveNickname(farmApp.nicknameDraft.value);

  if (saved) {
    await farmApp.startQuiz(props.importId, selectedTopicId.value);
  }
}

watch(
  () => [props.importId, selectedTopicId.value],
  async () => {
    if (!farmApp.player.value) {
      return;
    }

    await farmApp.startQuiz(props.importId, selectedTopicId.value);
  },
);

onMounted(() => {
  bootTestPage();
});
</script>

<template>
  <div class="space-y-6">
    <section v-if="loading" class="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <div class="glass-panel min-h-[25rem] animate-pulse rounded-[2rem]" />
      <div class="glass-panel min-h-[25rem] animate-pulse rounded-[2rem]" />
    </section>

    <section v-else-if="detail" class="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
      <aside class="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <article class="rounded-[2rem] bg-[#12141e] px-6 py-7 text-white shadow-[0_34px_110px_rgba(19,18,31,0.2)] sm:px-8">
          <p class="text-[0.72rem] uppercase tracking-[0.34em] text-white/65">Test studio</p>
          <h2 class="mt-5 font-display text-5xl leading-[0.95] tracking-[-0.04em]">
            {{ detail.import.titleHr }}
          </h2>
          <p class="mt-4 text-base leading-7 text-white/72">
            Jedan predmet, jedan fokus. Odaberi sve teme ili suzi test na jednu cjelinu.
          </p>

          <div class="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div class="rounded-[1.25rem] bg-white/10 p-4">
              <p class="text-[0.72rem] uppercase tracking-[0.22em] text-white/55">Scope</p>
              <p class="mt-3 text-2xl font-semibold">
                {{ activeTopic?.titleHr ?? "Sve teme" }}
              </p>
            </div>
            <div class="rounded-[1.25rem] bg-white/10 p-4">
              <p class="text-[0.72rem] uppercase tracking-[0.22em] text-white/55">Pitanja</p>
              <p class="mt-3 text-2xl font-semibold">{{ detail.import.questionCount }}</p>
            </div>
            <div class="rounded-[1.25rem] bg-white/10 p-4">
              <p class="text-[0.72rem] uppercase tracking-[0.22em] text-white/55">Status</p>
              <p class="mt-3 text-2xl font-semibold">
                {{ farmApp.player.value ? "Rezultat se sprema" : "Nadimak potreban" }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5"
              @click="router.push({ name: 'learn', params: { importId: props.importId } })"
            >
              Otvori Learn page
            </button>
            <button
              type="button"
              class="rounded-full border border-white/16 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              @click="router.push('/')"
            >
              Natrag na Home
            </button>
          </div>
        </article>

        <article class="glass-panel rounded-[1.8rem] p-5">
          <div class="flex items-end justify-between gap-4">
            <div>
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">Odabir teme</p>
              <h3 class="mt-2 font-display text-3xl leading-none text-ink">Scope testa</h3>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-full px-4 py-2.5 text-sm transition"
              :class="!selectedTopicId ? 'bg-ink text-white' : 'border border-ink/12 bg-white text-ink/68 hover:border-ink/30'"
              @click="changeScope(undefined)"
            >
              Sve teme
            </button>

            <button
              v-for="topic in detail.topics"
              :key="topic.id"
              type="button"
              class="rounded-full px-4 py-2.5 text-sm transition"
              :class="selectedTopicId === topic.id ? 'bg-ink text-white' : 'border border-ink/12 bg-white text-ink/68 hover:border-ink/30'"
              @click="changeScope(topic.id)"
            >
              {{ topic.titleHr }}
            </button>
          </div>
        </article>

        <article v-if="!farmApp.player.value" class="glass-panel rounded-[1.8rem] p-5">
          <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">Nadimak za rezultat</p>
          <p class="mt-3 text-sm leading-7 text-ink/62">
            Test moze poceti cim spremis nadimak. Learn dio ostaje dostupan i bez toga.
          </p>
          <form class="mt-4 space-y-3" @submit.prevent="saveNicknameAndStart">
            <input
              v-model="farmApp.nicknameDraft.value"
              type="text"
              maxlength="24"
              placeholder="Upisi nadimak"
              class="w-full rounded-[1rem] border border-ink/12 bg-white px-4 py-3 text-sm text-ink outline-none focus:border-ink/30"
            />
            <button
              type="submit"
              class="w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-ink/92"
              :disabled="farmApp.savingProfile.value"
            >
              {{ farmApp.savingProfile.value ? "Spremam..." : "Spremi i kreni" }}
            </button>
          </form>
        </article>
      </aside>

      <section class="space-y-5">
        <article class="rounded-[2rem] border border-white/60 bg-white/88 p-5 shadow-[0_26px_80px_rgba(24,19,15,0.08)] sm:p-6">
          <div class="flex flex-col gap-4 border-b border-ink/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">
                {{ farmApp.currentCard.value?.progressLabel ?? "Spremno za test" }}
              </p>
              <h3 class="mt-2 font-display text-4xl leading-none tracking-[-0.04em] text-ink">
                {{ activeTopic?.titleHr ?? detail.import.titleHr }}
              </h3>
            </div>

            <div class="flex flex-wrap items-center gap-2 text-sm text-ink/55">
              <span class="rounded-full border border-ink/10 bg-white px-4 py-2">
                {{ farmApp.player.value ? `${farmApp.player.value.xp} XP` : "Bez spremljenog rezultata" }}
              </span>
              <span class="rounded-full border border-ink/10 bg-white px-4 py-2">
                {{ farmApp.player.value ? `streak ${farmApp.player.value.streak}` : "Unesi nadimak" }}
              </span>
            </div>
          </div>

          <div v-if="farmApp.loadingQuiz.value" class="mt-6 space-y-4 animate-pulse">
            <div class="h-4 w-40 rounded-full bg-ink/8" />
            <div class="h-16 rounded-[1.5rem] bg-ink/6" />
            <div class="grid gap-3">
              <div class="h-18 rounded-[1.25rem] bg-ink/6" />
              <div class="h-18 rounded-[1.25rem] bg-ink/6" />
              <div class="h-18 rounded-[1.25rem] bg-ink/6" />
            </div>
          </div>

          <template v-else-if="farmApp.currentCard.value">
            <div class="mt-6 space-y-6">
              <div class="space-y-3">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">
                  {{ farmApp.currentCard.value.topicTitleHr }}
                </p>
                <h4 class="max-w-4xl font-display text-5xl leading-[0.95] tracking-[-0.04em] text-ink">
                  {{ farmApp.currentCard.value.questionHr }}
                </h4>
              </div>

              <div class="grid gap-3">
                <button
                  v-for="option in farmApp.currentCard.value.options"
                  :key="option.id"
                  type="button"
                  class="flex w-full items-start gap-4 rounded-[1.35rem] border px-4 py-4 text-left text-base transition"
                  :class="optionClass(option.id)"
                  :disabled="Boolean(farmApp.feedback.value) || !farmApp.player.value"
                  @click="farmApp.selectedOptionId.value = option.id"
                >
                  <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current text-sm uppercase">
                    {{ option.id }}
                  </span>
                  <span class="leading-7">{{ option.textHr }}</span>
                </button>
              </div>

              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  class="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink/92 disabled:opacity-55"
                  :disabled="!farmApp.player.value || !farmApp.selectedOptionId.value || Boolean(farmApp.feedback.value) || farmApp.submittingAnswer.value"
                  @click="farmApp.submitCurrentAnswer()"
                >
                  {{ farmApp.submittingAnswer.value ? "Provjeravam..." : "Provjeri odgovor" }}
                </button>
                <p class="text-sm leading-6 text-ink/58">
                  {{ farmApp.player.value ? "Odaberi opciju i potvrdi odgovor." : "Prvo spremi nadimak s lijeve strane." }}
                </p>
              </div>

              <div
                v-if="farmApp.feedback.value"
                class="rounded-[1.4rem] border border-ink/10 bg-[#fff7f1] p-5"
              >
                <p
                  class="text-[0.72rem] uppercase tracking-[0.24em]"
                  :class="farmApp.feedback.value.isCorrect ? 'text-emerald-700' : 'text-rose-700'"
                >
                  {{ farmApp.feedback.value.isCorrect ? "Tocan odgovor" : "Vrijeme za repeticiju" }}
                </p>
                <h5 class="mt-3 font-display text-3xl leading-none text-ink">
                  {{
                    farmApp.feedback.value.isCorrect
                      ? `+${farmApp.feedback.value.xpEarned} XP`
                      : "Procitaj objasnjenje i nastavi"
                  }}
                </h5>
                <p class="mt-4 text-base leading-7 text-ink/68">
                  {{ farmApp.feedback.value.explanationHr }}
                </p>
                <p class="mt-3 text-sm leading-6 text-ink/58">
                  {{ farmApp.feedback.value.nextUnlockHr }}
                </p>
                <button
                  type="button"
                  class="mt-5 rounded-full border border-ink/12 bg-white px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/28"
                  @click="farmApp.loadNextQuizCard()"
                >
                  Sljedece pitanje
                </button>
              </div>
            </div>
          </template>

          <div
            v-else
            class="mt-6 rounded-[1.4rem] border border-dashed border-ink/12 bg-ink/2 p-6"
          >
            <p class="font-display text-3xl leading-none text-ink">Nema aktivnog pitanja.</p>
            <p class="mt-4 text-sm leading-7 text-ink/58">
              {{ farmApp.quizMessage.value || "Odaberi temu ili provjeri je li za predmet spremljen nadimak." }}
            </p>
          </div>
        </article>

        <p v-if="farmApp.quizMessage.value && farmApp.currentCard.value" class="text-sm text-rose-700">
          {{ farmApp.quizMessage.value }}
        </p>
      </section>
    </section>

    <section
      v-else
      class="rounded-[2rem] border border-dashed border-ink/16 bg-white/72 p-10 text-center"
    >
      <p class="font-display text-4xl leading-none text-ink">Predmet nije dostupan.</p>
      <p class="mt-4 text-sm leading-7 text-ink/58">
        {{ errorMessage || "Mozda je obrisan ili jos nije ucitan." }}
      </p>
      <button
        type="button"
        class="mt-6 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-ink/92"
        @click="router.push('/')"
      >
        Povratak na Home
      </button>
    </section>
  </div>
</template>
