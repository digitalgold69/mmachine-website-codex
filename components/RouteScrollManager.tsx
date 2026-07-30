"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

export default function RouteScrollManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element
        ? event.target.closest<HTMLAnchorElement>("a[href]")
        : null;
      if (!target || target.target || target.hasAttribute("download")) return;

      const href = target.getAttribute("href") || "";
      if (!href || href.startsWith("#") || href.includes("#")) return;

      const nextUrl = new URL(target.href, window.location.href);
      if (nextUrl.origin !== window.location.origin || nextUrl.pathname === window.location.pathname) return;

      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      [0, 50, 150, 300, 600].forEach((delay) => {
        window.setTimeout(() => {
          if (!window.location.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          }
        }, delay);
      });
    };

    document.addEventListener("click", onClickCapture, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash) return;

    let cancelled = false;
    const reset = () => {
      if (!cancelled && !window.location.hash) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    };

    reset();
    const stopForUserScroll = () => {
      cancelled = true;
    };
    window.addEventListener("wheel", stopForUserScroll, { passive: true });
    window.addEventListener("touchstart", stopForUserScroll, { passive: true });
    window.addEventListener("keydown", stopForUserScroll);

    let resetLoopFrame = 0;
    const resetLoopUntil = window.performance.now() + 700;
    const resetLoop = () => {
      reset();
      if (!cancelled && window.performance.now() < resetLoopUntil) {
        resetLoopFrame = window.requestAnimationFrame(resetLoop);
      }
    };
    let nestedFrame = 0;
    const frames = [
      window.requestAnimationFrame(reset),
      window.requestAnimationFrame(() => {
        nestedFrame = window.requestAnimationFrame(reset);
      }),
      window.requestAnimationFrame(resetLoop),
    ];
    const timers = [
      window.setTimeout(reset, 50),
      window.setTimeout(reset, 200),
      window.setTimeout(reset, 600),
    ];

    return () => {
      cancelled = true;
      frames.forEach((frame) => window.cancelAnimationFrame(frame));
      if (nestedFrame) window.cancelAnimationFrame(nestedFrame);
      if (resetLoopFrame) window.cancelAnimationFrame(resetLoopFrame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("wheel", stopForUserScroll);
      window.removeEventListener("touchstart", stopForUserScroll);
      window.removeEventListener("keydown", stopForUserScroll);
    };
  }, [pathname]);

  return null;
}
