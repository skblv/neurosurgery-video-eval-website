import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query so a component can pick a layout rather than
 * rendering both and hiding one, which would leave Recharts measuring a
 * zero-width container at phone sizes.
 *
 * @param query - A media query string, e.g. `(max-width: 600px)`.
 * @returns Whether the query currently matches.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
