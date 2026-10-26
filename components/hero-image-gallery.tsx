"use client";

import { useEffect, useState } from "react";

type HeroImage = {
  id: number;
  image_url: string;
};

type HeroImageGalleryProps = {
  tenantSlug: string;
  tenantName: string;
  fallbackImage: string;
  imageClassName?: string;
};

export function HeroImageGallery({
  tenantSlug,
  tenantName,
  fallbackImage,
  imageClassName = "h-64 w-full object-cover sm:h-[360px] md:h-[420px]",
}: HeroImageGalleryProps) {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);

  useEffect(() => {
    if (!isViewerOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsViewerOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/storefront/${tenantSlug}/hero-images`, { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as { images?: HeroImage[] };
        if (response.ok && !cancelled && result.images?.length) {
          setImages(result.images);
        }
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  useEffect(() => {
    if (images.length < 2 || isViewerOpen) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % images.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [images.length, isViewerOpen]);

  const currentImage = images[currentIndex];

  return (
    <div className="relative min-w-0 overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200">
      <button
        type="button"
        onClick={() => {
          setImageZoom(1);
          setIsViewerOpen(true);
        }}
        aria-label={`View ${tenantName} hero image`}
        className="block w-full cursor-zoom-in"
      >
        <img
          src={currentImage?.image_url ?? fallbackImage}
          alt={`${tenantName} storefront`}
          className={imageClassName}
        />
      </button>
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Show previous hero image"
            onClick={() => setCurrentIndex((index) => (index - 1 + images.length) % images.length)}
            className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl shadow hover:bg-white"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Show next hero image"
            onClick={() => setCurrentIndex((index) => (index + 1) % images.length)}
            className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-xl shadow hover:bg-white"
          >
            ›
          </button>
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                aria-label={`Show hero image ${index + 1}`}
                aria-current={index === currentIndex}
                onClick={() => setCurrentIndex(index)}
                className={`h-2.5 w-2.5 rounded-full border border-white ${
                  index === currentIndex ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
      {isViewerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setIsViewerOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hero-image-title"
            className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
              <h2 id="hero-image-title" className="truncate font-semibold text-slate-900">
                {tenantName}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImageZoom((zoom) => Math.max(0.5, zoom - 0.25))}
                  disabled={imageZoom <= 0.5}
                  aria-label="Zoom out"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-xl disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-12 text-center text-sm text-slate-600" aria-live="polite">
                  {Math.round(imageZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setImageZoom((zoom) => Math.min(3, zoom + 0.25))}
                  disabled={imageZoom >= 3}
                  aria-label="Zoom in"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-xl disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setIsViewerOpen(false)}
                  aria-label="Close image viewer"
                  className="ml-1 grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-xl text-slate-700 hover:bg-slate-200"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto bg-slate-100 p-3">
              <img
                src={currentImage?.image_url ?? fallbackImage}
                alt={`${tenantName} storefront`}
                className="mx-auto h-auto"
                style={{ width: `${imageZoom * 100}%`, maxWidth: "none" }}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
