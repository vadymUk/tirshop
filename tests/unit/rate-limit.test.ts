import { beforeEach, describe, expect, it, vi } from "vitest";

const headerValues = vi.hoisted(() => ({ ip: "1.1.1.1" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": headerValues.ip }),
}));

import { isRateLimited } from "@/lib/rate-limit";

let counter = 0;
const uniqueAction = () => `test-action-${counter++}`;

beforeEach(() => {
  headerValues.ip = "1.1.1.1";
  vi.useRealTimers();
});

describe("isRateLimited", () => {
  it("allows up to the limit and blocks after it", async () => {
    const action = uniqueAction();
    expect(await isRateLimited(action, 3, 60)).toBe(false);
    expect(await isRateLimited(action, 3, 60)).toBe(false);
    expect(await isRateLimited(action, 3, 60)).toBe(false);
    expect(await isRateLimited(action, 3, 60)).toBe(true);
  });

  it("counts clients and actions separately", async () => {
    const action = uniqueAction();
    await isRateLimited(action, 1, 60);
    expect(await isRateLimited(action, 1, 60)).toBe(true);

    headerValues.ip = "2.2.2.2";
    expect(await isRateLimited(action, 1, 60)).toBe(false);
    expect(await isRateLimited(uniqueAction(), 1, 60)).toBe(false);
  });

  it("starts a new window after it expires", async () => {
    vi.useFakeTimers();
    const action = uniqueAction();
    await isRateLimited(action, 1, 60);
    expect(await isRateLimited(action, 1, 60)).toBe(true);
    vi.advanceTimersByTime(61_000);
    expect(await isRateLimited(action, 1, 60)).toBe(false);
  });
});
