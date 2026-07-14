import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/test/**/*.test.js"],
    // Tests hit the real (Neon) database over the network.
    testTimeout: 30000,
    hookTimeout: 30000,
    // API tests share rate-limiter state; keep files sequential.
    fileParallelism: false,
  },
});
