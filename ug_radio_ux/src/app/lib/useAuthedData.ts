"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/app/lib/auth";
import { ApiError } from "@/app/lib/api";

type Status = "loading" | "error" | "ready";

/** Redirects to /login if unauthenticated, otherwise runs fetcher and tracks its state. */
export function useAuthedData<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    fetcher()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { status, data, error };
}
