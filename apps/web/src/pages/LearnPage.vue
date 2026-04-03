<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useFarmApp } from "../composables/useFarmApp";

const props = defineProps<{
  importId: string;
}>();

const router = useRouter();
const farmApp = useFarmApp();

const loading = ref(false);
const errorMessage = ref("");

const detail = computed(() => farmApp.importDetails.value[props.importId] ?? null);

async function loadPage() {
  loading.value = true;
  errorMessage.value = "";

  try {
    await farmApp.initialize();
    await farmApp.ensureImportDetail(props.importId);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Predmet nije moguce ucitati.";
  } finally {
    loading.value = false;
  }
}

function openTest(topicId?: string) {
  router.push({
    name: "test",
    params: {
      importId: props.importId,
    },
    query: topicId ? { topicId } : undefined,
  });
}

watch(
  () => props.importId,
  () => {
    loadPage();
  },
);

onMounted(() => {
  loadPage();
});
</script>

<template>
  <div class="space-y-6">
    <section v-if="loading" class="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <div class="glass-panel min-h-[26rem] animate-pulse rounded-[2rem]" />
      <div class="grid gap-4">
        <div class="glass-panel h-44 animate-pulse rounded-[1.8rem]" />
        <div class="glass-panel h-44 animate-pulse rounded-[1.8rem]" />
        <div class="glass-panel h-44 animate-pulse rounded-[1.8rem]" />
      </div>
    </section>

    <section v-else-if="detail" class="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <aside class="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <article class="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-7 text-white shadow-[0_34px_110px_rgba(19,18,31,0.18)] sm:px-8">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,146,100,0.32),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(64,218,196,0.22),_transparent_30%)]" />
          <div class="relative z-10 space-y-6">
            <p class="text-[0.72rem] uppercase tracking-[0.34em] text-white/68">Learn page</p>
            <h2 class="font-display text-5xl leading-[0.95] tracking-[-0.04em]">
              {{ detail.import.titleHr }}
            </h2>
            <p class="max-w-xl text-base leading-7 text-white/72">
              Predmet je pretvoren u mirne blokove za ucenje. Prodi lekcije redom, pa
              otvori test kada zelis provjeriti koliko je gradivo sjelo.
            </p>

            <p class="max-w-xl text-sm leading-7 text-white/62">
              {{ detail.import.processingNotesHr }}
            </p>

            <div class="grid gap-3 sm:grid-cols-3">
              <div class="rounded-[1.25rem] bg-white/10 p-4">
                <p class="text-[0.7rem] uppercase tracking-[0.2em] text-white/58">Lekcije</p>
                <p class="mt-3 text-3xl font-semibold">{{ detail.lessons.length }}</p>
              </div>
              <div class="rounded-[1.25rem] bg-white/10 p-4">
                <p class="text-[0.7rem] uppercase tracking-[0.2em] text-white/58">Teme</p>
                <p class="mt-3 text-3xl font-semibold">{{ detail.topics.length }}</p>
              </div>
              <div class="rounded-[1.25rem] bg-white/10 p-4">
                <p class="text-[0.7rem] uppercase tracking-[0.2em] text-white/58">Pitanja</p>
                <p class="mt-3 text-3xl font-semibold">{{ detail.import.questionCount }}</p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                class="rounded-full bg-white px-5 py-3 text-sm font-medium text-ink transition hover:-translate-y-0.5"
                @click="openTest()"
              >
                Uradi test iz predmeta
              </button>
              <button
                type="button"
                class="rounded-full border border-white/16 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                @click="router.push('/')"
              >
                Natrag na Home
              </button>
            </div>
          </div>
        </article>

        <article class="glass-panel rounded-[1.8rem] p-5">
          <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">Mapa predmeta</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="topic in detail.topics"
              :key="topic.id"
              class="rounded-full border border-white/70 bg-white px-4 py-2 text-sm text-ink/68"
            >
              {{ topic.titleHr }}
            </span>
          </div>
        </article>
      </aside>

      <section class="space-y-4">
        <article
          v-for="lesson in detail.lessons"
          :key="lesson.id"
          class="rounded-[1.9rem] border border-white/60 bg-white/88 p-5 shadow-[0_24px_70px_rgba(24,19,15,0.08)] sm:p-6"
        >
          <div class="flex flex-col gap-4 border-b border-ink/8 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div class="space-y-2">
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/40">
                Lesson {{ lesson.sortOrder }}
              </p>
              <h3 class="font-display text-4xl leading-none tracking-[-0.04em] text-ink">
                {{ lesson.titleHr }}
              </h3>
            </div>

            <button
              v-if="lesson.topicId"
              type="button"
              class="rounded-full border border-ink/12 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink/28 hover:bg-ink/3"
              @click="openTest(lesson.topicId ?? undefined)"
            >
              Testiraj ovu cjelinu
            </button>
          </div>

          <div class="mt-5 space-y-5">
            <div class="rounded-[1.35rem] bg-[#fffaf6] p-5">
              <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">Sazetak</p>
              <p class="mt-4 max-w-4xl text-base leading-7 text-ink/68">
                {{ lesson.overviewHr }}
              </p>
            </div>

            <div class="grid gap-4 lg:grid-cols-3">
              <div class="rounded-[1.25rem] bg-[#f7fbff] p-4">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">Kljucni pojmovi</p>
                <ul class="mt-4 space-y-3 text-sm leading-6 text-ink/64">
                  <li v-for="concept in lesson.keyConceptsHr" :key="concept">{{ concept }}</li>
                </ul>
              </div>

              <div class="rounded-[1.25rem] bg-[#fff7f2] p-4">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">Na sto pazi</p>
                <ul class="mt-4 space-y-3 text-sm leading-6 text-ink/64">
                  <li v-for="prompt in lesson.studyPromptsHr" :key="prompt">{{ prompt }}</li>
                </ul>
              </div>

              <div class="rounded-[1.25rem] bg-[#f5fff9] p-4">
                <p class="text-[0.72rem] uppercase tracking-[0.24em] text-ink/42">Checklist</p>
                <ul class="mt-4 space-y-3 text-sm leading-6 text-ink/64">
                  <li v-for="item in lesson.recallChecklistHr" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
          </div>
        </article>
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
