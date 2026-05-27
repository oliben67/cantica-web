import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { relativeTime, cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("deduplicates tailwind conflicting classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles falsy values", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });
});

describe("relativeTime", () => {
  const BASE = new Date("2024-06-15T12:00:00.000Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' within 60 seconds", () => {
    const iso = new Date(BASE - 30_000).toISOString();
    expect(relativeTime(iso)).toBe("just now");
  });

  it("returns minutes for < 1 hour", () => {
    const iso = new Date(BASE - 5 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe("5m ago");
  });

  it("returns hours for < 24 hours", () => {
    const iso = new Date(BASE - 3 * 3600_000).toISOString();
    expect(relativeTime(iso)).toBe("3h ago");
  });

  it("returns days for < 30 days", () => {
    const iso = new Date(BASE - 7 * 86400_000).toISOString();
    expect(relativeTime(iso)).toBe("7d ago");
  });

  it("returns locale date for > 30 days", () => {
    const old = new Date(BASE - 40 * 86400_000);
    const iso = old.toISOString();
    expect(relativeTime(iso)).toBe(old.toLocaleDateString());
  });

  it("boundary: exactly 59 seconds returns 'just now'", () => {
    const iso = new Date(BASE - 59_000).toISOString();
    expect(relativeTime(iso)).toBe("just now");
  });

  it("boundary: exactly 60 seconds returns '1m ago'", () => {
    const iso = new Date(BASE - 60_000).toISOString();
    expect(relativeTime(iso)).toBe("1m ago");
  });
});
