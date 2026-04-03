import { createRouter, createWebHistory } from "vue-router";
import HomePage from "./pages/HomePage.vue";
import LearnPage from "./pages/LearnPage.vue";
import TestPage from "./pages/TestPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomePage,
    },
    {
      path: "/learn/:importId",
      name: "learn",
      component: LearnPage,
      props: true,
    },
    {
      path: "/test/:importId",
      name: "test",
      component: TestPage,
      props: true,
    },
  ],
  scrollBehavior() {
    return { top: 0, behavior: "smooth" };
  },
});
