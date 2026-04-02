import { defineConfig } from "orval";

export default defineConfig({
  farmapp: {
    input: {
      target: "../api/openapi.yaml",
    },
    output: {
      target: "./src/api/generated/farmapp.ts",
      schemas: "./src/api/generated/model",
      client: "fetch",
      baseUrl: "/api",
      clean: true,
    },
  },
});
