"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { EventMedia } from "@/lib/data/types";

export function EventGallery({ images }: { images: EventMedia[] }) {
  const [index, setIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const current = index === null ? null : images[index];
  const step = (delta: number) =>
    setIndex((i) => (i === null ? i : (i + delta + images.length) % images.length));

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setIndex(i)}
            className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted group"
            aria-label={img.title ? `Open ${img.title}` : `Open picture ${i + 1}`}
          >
            <Image
              src={img.url}
              alt={img.title ?? ""}
              fill
              sizes="(min-width: 640px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <Dialog open={index !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogContent className="sm:max-w-4xl p-2 bg-black border-none">
          <DialogTitle className="sr-only">{current?.title ?? "Event picture"}</DialogTitle>
          {current && (
            <div className="relative h-[70vh] w-full">
              <Image src={current.url} alt={current.title ?? ""} fill sizes="90vw" className="object-contain" />
            </div>
          )}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
                aria-label="Previous picture"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
                aria-label="Next picture"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
