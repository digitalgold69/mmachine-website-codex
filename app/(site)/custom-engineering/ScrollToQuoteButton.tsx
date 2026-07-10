"use client";

import type { MouseEvent, ReactNode } from "react";

type ScrollToQuoteButtonProps = {
  children: ReactNode;
  className?: string;
};

export default function ScrollToQuoteButton({ children, className }: ScrollToQuoteButtonProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    const target = document.getElementById("quote-form");
    if (!target) {
      window.location.hash = "quote-form";
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });

    const url = new URL(window.location.href);
    url.hash = "quote-form";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <a href="#quote-form" aria-controls="quote-form" className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
