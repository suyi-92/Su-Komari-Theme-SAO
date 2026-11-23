import { isAppearance, type Appearance } from "./themeSettings";

const SHARED_APPEARANCE_KEY = "appearance";
const PURE_WHITE_KEY = "komaritheme:appearance-white";

type AppearanceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function parseStoredAppearance(raw: string | null): Appearance | null {
  if (isAppearance(raw)) return raw;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isAppearance(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeAppearancePreference(storage: AppearanceStorage, value: Appearance) {
  // Lite's administration UI reads the shared key and only accepts light, dark, or system.
  if (value === "white") {
    storage.setItem(PURE_WHITE_KEY, "1");
    storage.setItem(SHARED_APPEARANCE_KEY, JSON.stringify("light"));
    return;
  }
  storage.setItem(SHARED_APPEARANCE_KEY, JSON.stringify(value));
  storage.removeItem(PURE_WHITE_KEY);
}

export function readAppearancePreference(storage: AppearanceStorage): Appearance | null {
  const shared = parseStoredAppearance(storage.getItem(SHARED_APPEARANCE_KEY));
  if (shared === "white") {
    try {
      writeAppearancePreference(storage, "white");
    } catch {
      // Keep the legacy preference usable when storage is read-only.
    }
    return "white";
  }
  return storage.getItem(PURE_WHITE_KEY) === "1" ? "white" : shared;
}
