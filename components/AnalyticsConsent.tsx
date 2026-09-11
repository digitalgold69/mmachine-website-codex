"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ANALYTICS_ID, CONSENT_KEY, analyticsAllowed, clearAnalyticsCookies,
  readAnalyticsConsent, saveAnalyticsConsent, stopAnalytics, trackPage,
} from "@/lib/analytics-client";

export function CookieSettingsButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event("mmachine-cookie-settings"))}
    className="hover:text-gold underline underline-offset-4">Cookie settings</button>;
}

export default function AnalyticsConsent() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<"accepted" | "rejected" | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!analyticsAllowed(window.location.hostname, window.location.pathname)) return;
    const stored = readAnalyticsConsent();
    setChoice(stored);
    setOpen(stored === null);
    if (stored !== "accepted") { stopAnalytics(); clearAnalyticsCookies(); }
    const show = () => setOpen(true);
    const sync = (event: StorageEvent) => {
      if (event.key !== CONSENT_KEY && event.key !== null) return;
      const next = readAnalyticsConsent();
      if (next !== "accepted") {
        stopAnalytics();
        clearAnalyticsCookies();
        window.location.reload();
      } else { setChoice(next); setOpen(false); }
    };
    window.addEventListener("mmachine-cookie-settings", show);
    window.addEventListener("storage", sync);
    return () => {
      stopAnalytics();
      window.removeEventListener("mmachine-cookie-settings", show);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => { trackPage(pathname, choice === "accepted"); }, [pathname, choice]);

  function choose(next: "accepted" | "rejected") {
    saveAnalyticsConsent(next);
    setChoice(next);
    setOpen(false);
    if (next === "rejected") {
      stopAnalytics();
      clearAnalyticsCookies();
      // Unload an already-running Google tag when consent is withdrawn.
      if (document.getElementById("mmachine-google-analytics")) window.location.reload();
    }
  }

  if (!open) return null;
  return (
    <section aria-label="Analytics cookie choices" data-analytics-id={ANALYTICS_ID}
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-racing/20 bg-cream p-5 text-ink shadow-xl sm:p-6">
      <h2 className="font-display text-xl text-racing">Your cookie choices</h2>
      <p className="mt-2 text-sm leading-relaxed">
        We use essential storage to keep your basket working. With your permission, Google Analytics
        helps us understand which pages are useful. You can change your choice in Cookie settings at any time.
        {" "}<Link href="/privacy" className="underline underline-offset-2">Privacy policy</Link>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => choose("rejected")}
          className="min-h-11 flex-1 rounded-lg border border-racing px-4 py-2 text-sm font-semibold text-racing hover:bg-racing/5">Reject analytics</button>
        <button type="button" onClick={() => choose("accepted")}
          className="min-h-11 flex-1 rounded-lg border border-racing bg-racing px-4 py-2 text-sm font-semibold text-white hover:bg-racing-light">Accept analytics</button>
        {choice !== null && <button type="button" onClick={() => setOpen(false)}
          className="min-h-11 px-3 text-sm underline">Close</button>}
      </div>
    </section>
  );
}
