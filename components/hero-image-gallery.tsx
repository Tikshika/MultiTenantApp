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
};

export function HeroImageGallery({
  tenantSlug,
  tenantName,
  fallbackImage,
}: HeroImageGalleryProps) {
  const [images, setImages] = useState<HeroImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

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
    if (images.length < 2) return;
    const interval = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % images.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [images.length]);

  const currentImage = images[currentIndex];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-200">
      <img
        src={currentImage?.image_url ?? fallbackImage}
        alt={`${tenantName} storefront`}
        className="h-[420px] w-full object-cover"
      />
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
    </div>
  );
}
