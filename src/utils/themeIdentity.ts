import manifest from "../../komari-theme.json" with { type: "json" };

export const THEME_NAME = manifest.name;
export const THEME_SHORT = manifest.short;
export const THEME_URL = manifest.url;
export const THEME_REPO = new URL(THEME_URL).pathname.slice(1);
