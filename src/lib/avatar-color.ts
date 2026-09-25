import { tenant } from "@/tenant";

// Background for a new member's initials avatar. Cosmetic only, so
// Math.random is fine.
export function randomAvatarColor(): string {
  const colors = tenant.avatarColors;
  return colors[Math.floor(Math.random() * colors.length)];
}
