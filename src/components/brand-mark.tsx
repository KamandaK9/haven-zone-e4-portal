import Image from "next/image";
import { tenant } from "@/tenant";

export function BrandMark({ className = "", size = 40 }: { className?: string; size?: number }) {
  const { src, alt, width: intrinsicWidth, height: intrinsicHeight } = tenant.logo;
  const width = Math.round(size * (intrinsicWidth / intrinsicHeight));
  return (
    <Image
      src={src}
      alt={alt}
      width={intrinsicWidth}
      height={intrinsicHeight}
      className={`shrink-0 object-contain ${className}`}
      style={{ width, height: size }}
      priority
    />
  );
}
