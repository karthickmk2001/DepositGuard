import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True only after client hydration. Avoids the SSR/CSR mismatch that
 * wallet-dependent UI hits, without the `setState` in an effect that
 * `react-hooks/set-state-in-effect` flags.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
