import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Renders a member's uploaded photo when there is one, falling back to their
// initials on their avatar color — the one place that decides which to show,
// so every avatar in the app updates once a photo is added.
export function MemberAvatar({
  firstName,
  lastName,
  avatarColor,
  photoUrl,
  className,
}: {
  firstName: string;
  lastName: string;
  avatarColor: string;
  photoUrl?: string;
  className?: string;
}) {
  return (
    <Avatar className={cn(className)}>
      {photoUrl && <AvatarImage src={photoUrl} alt="" />}
      <AvatarFallback className="text-white font-semibold" style={{ backgroundColor: avatarColor }}>
        {firstName[0]}
        {lastName[0]}
      </AvatarFallback>
    </Avatar>
  );
}
