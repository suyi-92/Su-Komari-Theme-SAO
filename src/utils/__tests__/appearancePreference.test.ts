import { describe, expect, it } from "vitest";
import { readAppearancePreference, writeAppearancePreference } from "../appearancePreference";

function createStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
}

describe("appearance preferences shared with Lite", () => {
  it.each(["white", '"white"'])("migrates legacy %s and keeps pure white on reload", (appearance) => {
    const storage = createStorage({ appearance });
    expect(readAppearancePreference(storage)).toBe("white");
    expect(storage.getItem("appearance")).toBe('"light"');
    expect(readAppearancePreference(storage)).toBe("white");
  });

  it("preserves pure white when the admin changes the shared mode", () => {
    const storage = createStorage();
    writeAppearancePreference(storage, "white");
    expect(storage.getItem("appearance")).toBe('"light"');

    storage.setItem("appearance", "dark");
    expect(readAppearancePreference(storage)).toBe("white");
    expect(storage.getItem("appearance")).toBe("dark");
  });

  it.each(["light", "dark", "system"] as const)("clears the pure-white override when choosing %s", (appearance) => {
    const storage = createStorage();
    writeAppearancePreference(storage, "white");
    writeAppearancePreference(storage, appearance);
    expect(readAppearancePreference(storage)).toBe(appearance);
    expect(storage.getItem("appearance")).toBe(JSON.stringify(appearance));
  });

  it("does not turn the guest default into a personal preference", () => {
    const storage = createStorage({ appearance_default: '"white"' });
    expect(readAppearancePreference(storage)).toBeNull();
    expect(storage.getItem("appearance")).toBeNull();
  });
});
