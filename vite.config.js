import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: "/health/",
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        // Keep d3 out of the entry chunk: it is only needed by the
        // lazily loaded chart views. (Function form: rolldown-based
        // Vite no longer accepts the object form.)
        manualChunks: (id) => (/node_modules\/(d3|d3-[^/]+)\//.test(id) ? "d3" : undefined),
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html"],
      include: [
        "src/domain/**/*.js",
        "src/stores/**/*.js",
      ],
      all: true,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
