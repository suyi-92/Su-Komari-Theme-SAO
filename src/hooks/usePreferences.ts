import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useThemeSettings } from "@/hooks/useThemeSettings";
import { subscribeMediaQuery } from "@/utils/mediaQuery";
import {
  parseStoredAppearance,
  readAppearancePreference,
  writeAppearancePreference,
} from "@/utils/appearancePreference";
import type { Appearance } from "@/utils/themeSettings";

type ResolvedAppearance = Exclude<Appearance, "system">;
const APPEARANCE_BACKGROUND: Record<ResolvedAppearance, string> = {
  dark: "#09090b",
  light: "#f4f5f7",
  white: "#ffffff",
};
const APPEARANCE_DEFAULT_STORAGE_KEY = "appearance_default";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

interface PrefsState {
  appearance: Appearance;
  resolvedAppearance: ResolvedAppearance;
}

const DEFAULTS: PrefsState = {
  appearance: "system",
  resolvedAppearance: "dark",
};

let themeFlipTimer: number | null = null;
let hasExplicitAppearancePreference = false;
let systemAppearanceMediaQuery: MediaQueryList | null = null;

function getSystemAppearanceMediaQuery() {
  if (typeof window === "undefined" || !window.matchMedia) return null;
  systemAppearanceMediaQuery ??= window.matchMedia(SYSTEM_DARK_QUERY);
  return systemAppearanceMediaQuery;
}

function resolveAppearance(a: Appearance): ResolvedAppearance {
  if (a === "system") {
    return getSystemAppearanceMediaQuery()?.matches ? "dark" : "light";
  }
  return a;
}

function readStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function readStoredAppearance() {
  let parsed: Appearance | null = null;
  try {
    parsed = readAppearancePreference(localStorage);
  } catch {}
  const fallback =
    parseStoredAppearance(readStorageItem(APPEARANCE_DEFAULT_STORAGE_KEY)) ??
    DEFAULTS.appearance;
  return {
    appearance: parsed ?? fallback,
    hasExplicitPreference: parsed != null,
  };
}

function persistAppearance(value: Appearance) {
  try {
    writeAppearancePreference(localStorage, value);
  } catch {}
}

function persistDefaultAppearance(value: Appearance) {
  writeStorageItem(APPEARANCE_DEFAULT_STORAGE_KEY, JSON.stringify(value));
}

const listeners = new Set<() => void>();
let snapshot: PrefsState = { ...DEFAULTS };

function emit() {
  for (const l of listeners) l();
}

function markThemeFlip() {
  const root = document.documentElement;
  root.classList.add("theme-flip");
  if (themeFlipTimer != null) {
    window.clearTimeout(themeFlipTimer);
  }
  themeFlipTimer = window.setTimeout(() => {
    root.classList.remove("theme-flip");
    themeFlipTimer = null;
  }, 140);
}

function applyResolvedAppearance(resolvedAppearance: ResolvedAppearance) {
  const root = document.documentElement;
  root.dataset.appearance = resolvedAppearance;
  const isDark = resolvedAppearance === "dark";
  const colorScheme = isDark ? "dark" : "light";
  const color = APPEARANCE_BACKGROUND[resolvedAppearance];
  root.style.colorScheme = colorScheme;

  root.style.backgroundColor = color;
  if (document.body) {
    document.body.style.backgroundColor = color;
    document.body.style.colorScheme = colorScheme;
  }

  // Directly update the sticky navbar so Safari can immediately sample the
  // correct solid background colour for the status-bar / Dynamic Island tint.
  const navBar = document.querySelector<HTMLElement>(".mao-top-nav-bar");
  if (navBar) {
    navBar.style.backgroundColor = color;
  }

  // Keep theme-color meta in sync for Android Chrome / older Safari.
  const existingMetas = document.querySelectorAll('meta[name="theme-color"]');
  existingMetas.forEach((el) => el.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = color;
  document.head.appendChild(meta);

  // Sync apple status-bar style so iOS Dynamic Island / status bar tint follows theme.
  const statusMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  );
  if (statusMeta) {
    statusMeta.content = isDark ? "black-translucent" : "default";
  }
}

function commit(next: Partial<PrefsState>) {
  const merged: PrefsState = { ...snapshot, ...next };
  if (next.appearance) {
    merged.resolvedAppearance = resolveAppearance(merged.appearance);
  }
  if (
    snapshot.appearance === merged.appearance &&
    snapshot.resolvedAppearance === merged.resolvedAppearance
  ) {
    return;
  }
  if (snapshot.resolvedAppearance !== merged.resolvedAppearance) {
    markThemeFlip();
  }
  snapshot = merged;
  applyResolvedAppearance(merged.resolvedAppearance);
  emit();
}

function refreshSystemAppearance() {
  if (snapshot.appearance === "system") {
    commit({ appearance: "system" });
  }
}

function handleVisibilityChange() {
  if (!document.hidden) refreshSystemAppearance();
}

let systemListenersAttached = false;
let mediaUnsubscribe: (() => void) | null = null;

function ensureSystemListeners() {
  if (systemListenersAttached || typeof window === "undefined") return;
  systemListenersAttached = true;
  const mediaQuery = getSystemAppearanceMediaQuery();
  if (mediaQuery) {
    mediaUnsubscribe = subscribeMediaQuery(mediaQuery, refreshSystemAppearance);
  }
  window.addEventListener("focus", refreshSystemAppearance);
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

function clearSystemListeners() {
  if (!systemListenersAttached || typeof window === "undefined") return;
  systemListenersAttached = false;
  mediaUnsubscribe?.();
  mediaUnsubscribe = null;
  window.removeEventListener("focus", refreshSystemAppearance);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
}

function initializeAppearance() {
  const stored = readStoredAppearance();
  hasExplicitAppearancePreference = stored.hasExplicitPreference;
  snapshot = {
    appearance: stored.appearance,
    resolvedAppearance: resolveAppearance(stored.appearance),
  };
  applyResolvedAppearance(snapshot.resolvedAppearance);
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  initializeAppearance();
}

function subscribe(l: () => void) {
  const wasEmpty = listeners.size === 0;
  listeners.add(l);
  if (wasEmpty) ensureSystemListeners();
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) clearSystemListeners();
  };
}

function getSnapshot() {
  return snapshot;
}

export function usePreferences() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const themeSettings = useThemeSettings();

  useEffect(() => {
    if (!themeSettings.isReady || themeSettings.isError || hasExplicitAppearancePreference) {
      return;
    }
    const defaultAppearance = themeSettings.defaultAppearance;
    persistDefaultAppearance(defaultAppearance);
    commit({ appearance: defaultAppearance });
  }, [themeSettings.defaultAppearance, themeSettings.isError, themeSettings.isReady]);

  const setAppearance = useCallback((a: Appearance) => {
    hasExplicitAppearancePreference = true;
    persistAppearance(a);
    commit({ appearance: a });
  }, []);

  return {
    appearance: state.appearance,
    resolvedAppearance: state.resolvedAppearance,
    setAppearance,
  };
}
