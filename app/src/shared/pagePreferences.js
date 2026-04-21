import { useEffect } from "react";
import { fetchJson } from "./api.js";

export const PAGE_PREFERENCE_DEBOUNCE_MS = 320;

export function usePagePreferencesAutosave(
  page,
  values,
  { enabled = true, debounceMs = PAGE_PREFERENCE_DEBOUNCE_MS } = {},
) {
  useEffect(() => {
    if (!enabled || !page || !values || !Object.keys(values).length) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        await fetchJson("/api/preferences", {
          method: "POST",
          body: JSON.stringify({ page, values }),
        });
      } catch (error) {
        console.error(`[yolo-lab] gagal menyimpan preferensi halaman ${page}:`, error);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [page, values, enabled, debounceMs]);
}
