"use client";

import { useEffect, useState } from "react";

// Run an async function when `key` changes and track its state.
//
// The `cancelled` flag guards against a race: if you click from album A to
// album B quickly, A's slower answer must not overwrite B's page. (This is
// the classic "stale response" bug in data-fetching effects.)
export function useAsync<T>(fn: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string; data?: T; error?: Error }>({ key: "" });

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (data) => !cancelled && setState({ key, data }),
      (error: Error) => !cancelled && setState({ key, error }),
    );
    return () => {
      cancelled = true;
    };
    // `fn` is re-created every render; `key` is what identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Until the answer for *this* key arrives, report loading (not the old data).
  const current = state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
  };
}
