import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests/e2e", use: { baseURL: "http://127.0.0.1:4301", browserName: "chromium", screenshot: "only-on-failure", trace: "retain-on-failure" }, webServer: { command: "npm run dev", url: "http://127.0.0.1:4301", reuseExistingServer: !process.env.CI }, workers: 1 });
