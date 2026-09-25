import Image from "next/image";

// Intrinsic size of public/logo-mark.png (cropped from the real Haven logo —
// the text baked into the original was removed, mark only).
const INTRINSIC_WIDTH = 345;
const INTRINSIC_HEIGHT = 414;

export function BrandMark({ className = "", size = 40 }: { className?: string; size?: number }) {
  const width = Math.round(size * (INTRINSIC_WIDTH / INTRINSIC_HEIGHT));
  return (
    <Image
      src="/logo-mark.png"
      alt="The Haven"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      className={`shrink-0 object-contain ${className}`}
      style={{ width, height: size }}
      priority
    />
  );
}
