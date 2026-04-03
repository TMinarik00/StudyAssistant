<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useFarmApp } from "../composables/useFarmApp";

const farmApp = useFarmApp();
const route = useRoute();

const pageLabel = computed(() => {
  if (route.name === "learn") {
    return "Ucenje";
  }

  if (route.name === "test") {
    return "Test studio";
  }

  return "Predmeti";
});

onMounted(() => {
  farmApp.initialize();
});
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="pointer-events-none absolute inset-0">
      <div class="hero-mesh absolute left-[-16rem] top-[-14rem] h-[34rem] w-[34rem] rounded-full blur-3xl" />
      <div class="absolute right-[-10rem] top-[8rem] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,_rgba(47,211,190,0.16),_transparent_70%)] blur-3xl" />
      <div class="absolute bottom-[-10rem] left-[20%] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,_rgba(255,134,96,0.14),_transparent_68%)] blur-3xl" />
      <div class="noise absolute inset-0" />
    </div>

    <div class="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-6 lg:px-8">
      <header class="glass-panel flex flex-col gap-5 rounded-[2rem] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex items-center gap-4">
          <RouterLink
            to="/"
            class="inline-flex h-13 w-13 items-center justify-center rounded-full bg-ink text-sm font-semibold uppercase tracking-[0.28em] text-white transition hover:scale-[1.03]"
          >
            DZ
          </RouterLink>

          <div class="space-y-1">
            <p class="text-[0.68rem] uppercase tracking-[0.34em] text-ink/45">{{ pageLabel }}</p>
            <h1 class="font-display text-2xl leading-none text-ink sm:text-3xl">
              Doza Znanja
            </h1>
          </div>
        </div>

        <div class="flex flex-col gap-4 lg:min-w-[28rem] lg:items-end">
          <nav class="flex flex-wrap gap-2 text-sm text-ink/65">
            <RouterLink
              to="/"
              class="rounded-full border border-white/60 px-4 py-2 transition hover:border-ink/20 hover:bg-white/80"
            >
              Home
            </RouterLink>
          </nav>

          <div class="flex flex-col gap-3 lg:items-end">
            <div v-if="farmApp.player.value" class="flex flex-wrap items-center gap-2 text-sm">
              <span class="rounded-full bg-white px-4 py-2 text-ink shadow-sm">
                {{ farmApp.player.value.nickname }}
              </span>
              <span class="rounded-full border border-white/70 px-4 py-2 text-ink/70">
                {{ farmApp.player.value.xp }} XP
              </span>
              <span class="rounded-full border border-white/70 px-4 py-2 text-ink/70">
                streak {{ farmApp.player.value.streak }}
              </span>
              <button
                type="button"
                class="rounded-full border border-ink/15 px-4 py-2 text-ink/65 transition hover:border-ink/35 hover:text-ink"
                @click="farmApp.clearProfile()"
              >
                Promijeni nadimak
              </button>
            </div>

            <form
              v-else
              class="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto"
              @submit.prevent="farmApp.saveNickname(farmApp.nicknameDraft.value)"
            >
              <input
                v-model="farmApp.nicknameDraft.value"
                type="text"
                maxlength="24"
                placeholder="Upisi nadimak za spremanje rezultata"
                class="min-w-[18rem] rounded-full border border-white/70 bg-white/80 px-5 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-ink/30"
              />
              <button
                type="submit"
                class="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink/90 disabled:opacity-60"
                :disabled="farmApp.savingProfile.value"
              >
                {{ farmApp.savingProfile.value ? "Spremam..." : "Spremi nadimak" }}
              </button>
            </form>

            <p v-if="farmApp.profileMessage.value" class="text-sm text-rose-700">
              {{ farmApp.profileMessage.value }}
            </p>
          </div>
        </div>
      </header>

      <main class="mt-6 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
