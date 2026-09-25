import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build on ports 3100 (web) and 8100 (API), so they
 * never collide with a local `npm run dev` / `uvicorn` on 3000 / 8000.
 * Build first with: NEXT_PUBLIC_API_URL=http://localhost:8100 npm run build
 * The API needs the "qurious" Python env on PATH.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command:
        "cd ../api && CORS_ORIGINS='[\"http://localhost:3100\"]' python -m uvicorn app.main:app --port 8100",
      url: "http://localhost:8100/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npx next start -p 3100",
      url: "http://localhost:3100",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
