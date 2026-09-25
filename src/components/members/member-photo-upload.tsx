"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "./member-avatar";
import { createClient } from "@/lib/supabase/client";
import { createMemberPhotoUploadToken, removeMemberPhoto, setMemberPhoto } from "@/lib/actions/member-photo";
import { MEMBER_PHOTOS_BUCKET } from "@/lib/member-photo";

export function MemberPhotoUpload({
  memberId,
  firstName,
  lastName,
  avatarColor,
  photoUrl,
}: {
  memberId: string;
  firstName: string;
  lastName: string;
  avatarColor: string;
  photoUrl?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const token = await createMemberPhotoUploadToken(memberId, { name: file.name, type: file.type, size: file.size });
    if (!token.ok) {
      setBusy(false);
      return setError(token.error);
    }
    const { error: uploadError } = await createClient()
      .storage.from(MEMBER_PHOTOS_BUCKET)
      .uploadToSignedUrl(token.path, token.token, file, { contentType: file.type });
    if (uploadError) {
      setBusy(false);
      return setError(uploadError.message);
    }
    const result = await setMemberPhoto(memberId, token.path);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await removeMemberPhoto(memberId);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <MemberAvatar
        firstName={firstName}
        lastName={lastName}
        avatarColor={avatarColor}
        photoUrl={photoUrl}
        className="h-16 w-16 text-lg"
      />
      <div className="space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {photoUrl ? "Change photo" : "Add photo"}
          </Button>
          {photoUrl && (
            <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" disabled={busy} onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          )}
        </div>
        {error ? (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 5 MB.</p>
        )}
      </div>
    </div>
  );
}
