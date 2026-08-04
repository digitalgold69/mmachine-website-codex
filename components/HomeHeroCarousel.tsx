"use client";

import type { PointerEvent } from "react";
import { useRef } from "react";
import { useState } from "react";

export type HomeHeroSlide = {
  label: string;
  alt: string;
  avifSrcSet?: string;
  webpSrcSet?: string;
  jpegSrcSet?: string;
  fallbackSrc: string;
  width: number;
  height: number;
};

type HomeHeroCarouselProps = {
  slides: HomeHeroSlide[];
};

export default function HomeHeroCarousel({ slides }: HomeHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const pointerStartX = useRef<number | null>(null);
  const canCompare = slides.length > 1;

  function showPrevious() {
    setActiveIndex((index) => (index - 1 + slides.length) % slides.length);
  }

  function showNext() {
    setActiveIndex((index) => (index + 1) % slides.length);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointerStartX.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (pointerStartX.current === null) return;
    const dragDistance = event.clientX - pointerStartX.current;
    pointerStartX.current = null;
    if (Math.abs(dragDistance) < 45) return;
    if (dragDistance > 0) showPrevious();
    else showNext();
  }

  return (
    <div
      className="group relative hidden aspect-[3/2] w-full cursor-grab overflow-hidden active:cursor-grabbing lg:block"
      onPointerDown={handlePointerDown}
      onPointerCancel={() => {
        pointerStartX.current = null;
      }}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex h-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide, index) => (
          <picture key={slide.label} className="block h-full w-full flex-none">
            {slide.avifSrcSet ? (
              <source
                media="(min-width: 1024px)"
                type="image/avif"
                srcSet={slide.avifSrcSet}
                sizes="(min-width: 1280px) 590px, 48vw"
              />
            ) : null}
            {slide.webpSrcSet ? (
              <source
                media="(min-width: 1024px)"
                type="image/webp"
                srcSet={slide.webpSrcSet}
                sizes="(min-width: 1280px) 590px, 48vw"
              />
            ) : null}
            {slide.jpegSrcSet ? (
              <source
                media="(min-width: 1024px)"
                type="image/jpeg"
                srcSet={slide.jpegSrcSet}
                sizes="(min-width: 1280px) 590px, 48vw"
              />
            ) : null}
            <img
              src={slide.fallbackSrc}
              alt={slide.alt}
              width={slide.width}
              height={slide.height}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
          </picture>
        ))}
      </div>

      {canCompare ? (
        <>
          <button
            type="button"
            onClick={showPrevious}
            className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-racing/85 text-white opacity-0 shadow-lg transition hover:bg-racing focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Show previous homepage hero option"
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={showNext}
            className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-racing/85 text-white opacity-0 shadow-lg transition hover:bg-racing focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Show next homepage hero option"
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <div className="sr-only" aria-live="polite">
            Showing {slides[activeIndex]?.label}
          </div>
        </>
      ) : null}
    </div>
  );
}
