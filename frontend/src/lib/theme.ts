import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";

/**
 * Inline script executed before first paint so the correct theme class is on
 * <html> immediately (no light flash for dark-mode users).
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((!p||p==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);var c=document.documentElement.classList;d?c.add("dark"):c.remove("dark");}catch(e){}})();`;

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function applyTheme(preference: ThemePreference) {
  if (typeof document === "undefined") return;
  const dark =
    preference === "dark" || (preference === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

type ThemeStore = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  hydrate: () => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  preference: "system",
  setPreference: (preference) => {
    try {
      if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this session.
    }
    applyTheme(preference);
    set({ preference });
  },
  hydrate: () => set({ preference: readPreference() }),
}));

export function resolvedTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") return systemPrefersDark() ? "dark" : "light";
  return preference;
}
