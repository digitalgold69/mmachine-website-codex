"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { QuoteRequest } from "@/lib/quote-types";

const LIVE_REFRESH_MS = 3000;

type QuoteRequestsUpdatedDetail = {
  quotes: QuoteRequest[];
  newRequestCount: number;
  signature: string;
};

function quoteSignature(quotes: QuoteRequest[]) {
  return quotes
    .map((quote) => `${quote.id}:${quote.status}:${quote.updatedAt}`)
    .sort()
    .join("|");
}

function newRequestCount(quotes: QuoteRequest[]) {
  return quotes.filter((quote) => quote.status === "new").length;
}

function emitQuoteUpdate(detail: QuoteRequestsUpdatedDetail) {
  window.dispatchEvent(new CustomEvent("mmachine:quote-requests-updated", { detail }));
}

export default function DashboardLiveUpdates() {
  const router = useRouter();
  const pathname = usePathname();
  const signatureRef = useRef("");
  const inFlightRef = useRef<AbortController | null>(null);

  const refreshActiveQuotes = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (inFlightRef.current) return;

    const controller = new AbortController();
    inFlightRef.current = controller;

    try {
      const response = await fetch("/api/quote-requests?live=1", {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) return;

      const data = await response.json() as { quotes?: QuoteRequest[] };
      const quotes = Array.isArray(data.quotes) ? data.quotes : [];
      const signature = quoteSignature(quotes);

      emitQuoteUpdate({
        quotes,
        newRequestCount: newRequestCount(quotes),
        signature,
      });

      const changed = Boolean(signatureRef.current) && signature !== signatureRef.current;
      signatureRef.current = signature;
      if (changed && pathname === "/dashboard") {
        router.refresh();
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.warn("dashboard_live_quote_refresh_failed", error);
      }
    } finally {
      if (inFlightRef.current === controller) {
        inFlightRef.current = null;
      }
    }
  }, [pathname, router]);

  useEffect(() => {
    void refreshActiveQuotes();
    const interval = window.setInterval(refreshActiveQuotes, LIVE_REFRESH_MS);

    function handleFocus() {
      void refreshActiveQuotes();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshActiveQuotes();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      inFlightRef.current?.abort();
      inFlightRef.current = null;
    };
  }, [refreshActiveQuotes]);

  return null;
}

