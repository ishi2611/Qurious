import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ApiStatus from "./ApiStatus";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("shows Connected when /health returns ok", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", version: "0.1.0" })),
      ),
  );
  render(<ApiStatus />);
  expect(await screen.findByText(/Connected/)).toBeDefined();
});

test("shows a hint when the API can't be reached", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
  );
  render(<ApiStatus />);
  expect(await screen.findByText(/Not reachable/)).toBeDefined();
});
