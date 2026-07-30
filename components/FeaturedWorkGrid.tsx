"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { FeaturedWork } from "@/lib/featured";
import { featuredOrderItem } from "@/lib/featured-order";
import { OrderButton } from "@/components/QuoteCart";
import Link from "next/link";

type FeaturedWorkGridProps = {
  items: FeaturedWork[];
  emptyText: string;
  gridClassName: string;
  cardImageClassName: string;
  showCategory?: boolean;
  showDescription?: boolean;
};

const GBP = "\u00a3";
const categoryLabel = (job: FeaturedWork) => job.category?.trim() || "Featured Work";

function price(value: number | null) {
  return typeof value === "number" ? `${GBP}${value.toFixed(2)}` : "POA";
}

function PlaceholderImage({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" stroke="#DF1718" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 40 L30 15 L50 40 Z" />
      <circle cx="30" cy="32" r="3" />
    </svg>
  );
}

export default function FeaturedWorkGrid({
  items,
  emptyText,
  gridClassName,
  cardImageClassName,
  showCategory = true,
  showDescription = true,
}: FeaturedWorkGridProps) {
  const [selected, setSelected] = useState<FeaturedWork | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!selected) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    }, 0);

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelected(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [selected]);

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, job: FeaturedWork) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelected(job);
  }

  return (
    <>
      <div className={gridClassName}>
        {items.length === 0 && (
          <div className="rounded-xl border border-racing/10 bg-white p-6 text-sm text-ink-muted sm:col-span-2 lg:col-span-4">
            {emptyText}
          </div>
        )}
        {items.map((job, index) => (
          <article
            key={job.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelected(job)}
            onKeyDown={(event) => handleCardKeyDown(event, job)}
            aria-label={`View ${job.title}`}
            className="card flex cursor-pointer flex-col bg-white transition hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
          >
            <div className={`bg-cream-dark rounded-lg mb-4 overflow-hidden flex items-center justify-center p-2 ${cardImageClassName}`}>
              {job.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={job.imagePath}
                  alt={job.title}
                  width={1200}
                  height={900}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <PlaceholderImage size={64} />
              )}
            </div>

            <div className={showCategory ? "mb-2 flex items-center gap-2" : "mb-1"}>
              <span className={showCategory ? "chip !bg-gold !text-cream" : "text-xs tracking-wider text-gold font-semibold"}>
                {categoryLabel(job).toUpperCase()}
              </span>
            </div>
            <h2 className="font-display text-xl text-racing mb-2">{job.title}</h2>
            {showDescription && (
              <p className="text-sm text-ink-muted leading-relaxed mb-3">{job.description}</p>
            )}
            {!showDescription && (
              <p className="text-sm text-ink-muted leading-relaxed">{job.description}</p>
            )}
            {job.fullStory?.trim() && showDescription && (
              <span className="mb-3 text-sm font-medium text-racing">Open details</span>
            )}
            {typeof job.priceExVat === "number" && (
              <div
                className="mt-auto flex items-center justify-between gap-4 border-t border-racing/10 pt-4"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <div>
                  <div className="font-semibold text-racing">{price(job.priceExVat)}</div>
                  <div className="text-xs text-ink-muted">ex VAT</div>
                </div>
                <OrderButton item={featuredOrderItem(job)} />
              </div>
            )}
          </article>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-racing-dark/65 px-3 py-5 backdrop-blur-sm sm:px-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null);
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="featured-work-modal-title"
            className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-racing/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="chip !bg-gold !text-cream">{categoryLabel(selected).toUpperCase()}</span>
                </div>
                <h2 id="featured-work-modal-title" className="font-display text-2xl leading-tight text-racing sm:text-3xl">
                  {selected.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-lg border border-racing/20 px-3 py-2 text-sm font-semibold text-racing hover:bg-cream-dark"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
                <div className="flex min-h-[260px] items-center justify-center rounded-lg bg-cream-dark p-3 sm:min-h-[420px]">
                  {selected.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.imagePath}
                      alt={selected.title}
                      width={1600}
                      height={1200}
                      decoding="async"
                      className="max-h-[68vh] max-w-full object-contain"
                    />
                  ) : (
                    <PlaceholderImage size={96} />
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-sm leading-7 text-ink-muted">{selected.description}</p>
                  {selected.fullStory?.trim() && (
                    <div className="rounded-lg bg-cream-dark p-4 text-sm leading-7 text-ink">
                      {selected.fullStory}
                    </div>
                  )}
                  <div className="grid gap-2 border-t border-racing/10 pt-4 sm:grid-cols-3 lg:grid-cols-1">
                    <Link href="/catalogue/mini" className="inline-flex items-center justify-center rounded-lg border border-racing/20 px-4 py-3 text-sm font-semibold text-racing hover:bg-cream-dark">
                      Mini Panels Catalogue
                    </Link>
                    <Link href="/catalogue/metals" className="inline-flex items-center justify-center rounded-lg border border-racing/20 px-4 py-3 text-sm font-semibold text-racing hover:bg-cream-dark">
                      Metals Catalogue
                    </Link>
                    <Link href="/custom-engineering" className="inline-flex items-center justify-center rounded-lg bg-gold px-4 py-3 text-sm font-semibold text-cream hover:bg-gold-light">
                      Get Something Custom Made
                    </Link>
                  </div>
                  {typeof selected.priceExVat === "number" && (
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-racing/10 p-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-ink-muted">Price ex VAT</div>
                        <div className="font-display text-2xl text-racing">{price(selected.priceExVat)}</div>
                      </div>
                      <OrderButton item={featuredOrderItem(selected)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
