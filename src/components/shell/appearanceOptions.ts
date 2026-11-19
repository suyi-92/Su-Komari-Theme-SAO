import { Monitor, Moon, Square, Sun } from "lucide-react";
import type { Appearance } from "@/utils/themeSettings";

export const APPEARANCE_OPTIONS = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
  { value: "white", label: "纯白", icon: Square },
] as const satisfies readonly { value: Appearance; label: string; icon: typeof Sun }[];
