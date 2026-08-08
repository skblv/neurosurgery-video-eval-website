import { useCallback, useSyncExternalStore } from "react";

/**
 * Reads the current location hash so the site can serve more than one page.
 *
 * Routing lives in the hash rather than the path because the site is served by
 * GitHub Pages, which answers an unknown path with its own 404 page instead of
 * our bundle. A hash never reaches the server, so `#/<secret>` loads the same
 * `index.html` as the leaderboard.
 *
 * @returns The hash with its leading `#/` removed, e.g. the unguessable submit
 *   path or `status/<token>`. Empty string on the leaderboard.
 */
export function useHashRoute(): string {
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("hashchange", onStoreChange);
    return () => window.removeEventListener("hashchange", onStoreChange);
  }, []);

  const getSnapshot = useCallback(
    () => window.location.hash.replace(/^#\/?/, ""),
    [],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => "");
}
