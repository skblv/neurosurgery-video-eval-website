import { useSyncExternalStore } from "react";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const clientSnapshot = () => Math.floor(Date.now() / MS_PER_DAY) * MS_PER_DAY;
const serverSnapshot = () => null;

function subscribe(onChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    onChange();
    clearTimeout(timer);
    // All release windows start/end at UTC midnight, independent of viewer zone.
    timer = setTimeout(refresh, MS_PER_DAY - Date.now() % MS_PER_DAY);
  };
  refresh();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
}

/** Avoid stale prerendered badges, and refresh at expiry or after a sleeping tab resumes. */
export function useBadgeDate(): Date | null {
  const timestamp = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  return timestamp === null ? null : new Date(timestamp);
}
