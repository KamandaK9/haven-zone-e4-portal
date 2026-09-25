import { redirect } from "next/navigation";
import { Briefcase, Cake, Calendar, Gift, Heart, MessageCircleMore } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactInfoForm } from "@/components/member-portal/contact-info-form";
import { MemberPhotoUpload } from "@/components/members/member-photo-upload";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getChurch, getCountry, getMember, memberFullName } from "@/lib/data/analytics";
import { POSITION_LABELS } from "@/lib/access";

// Roster fields (title, KC handle, profession, ...) only exist for members
// pulled in from a leadership-roster import — most plain members won't have
// any of these, so each one only renders when there's actually a value.
function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

export default async function MemberProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.linkedMemberId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account isn&apos;t linked to a member record yet — contact your zone admin.
      </p>
    );
  }

  const ds = await getZoneDataset(profile.zoneId);
  const member = getMember(ds, profile.linkedMemberId);
  if (!member) {
    return <p className="text-sm text-muted-foreground">Couldn&apos;t find your member record.</p>;
  }

  const church = getChurch(ds, member.churchId);
  const country = getCountry(ds, member.countryId);
  const importantInfo = [
    { icon: Briefcase, label: "Profession", value: member.profession },
    { icon: Heart, label: "Spouse", value: member.spouseName },
    { icon: Cake, label: "Birthday", value: member.birthday },
    { icon: Gift, label: "Wedding anniversary", value: member.weddingAnniversary },
    { icon: MessageCircleMore, label: "KingsChat handle", value: member.kcHandle },
  ].filter((row) => row.value);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your photo and details, as they appear across the portal.</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <MemberPhotoUpload
            memberId={member.id}
            firstName={member.firstName}
            lastName={member.lastName}
            avatarColor={member.avatarColor}
            photoUrl={member.photoUrl}
          />
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{memberFullName(member)}</h2>
            <Badge variant="secondary" className="font-normal">
              {member.position !== "member" ? POSITION_LABELS[member.position] : member.title || member.role}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{church?.name}</span>
            <span className="flex items-center gap-1">
              {country?.flag} {country?.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {member.joinDate
                ? `Joined ${new Date(member.joinDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                : "Join date not recorded"}
            </span>
          </div>
        </CardContent>
      </Card>

      {importantInfo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Important information</CardTitle>
            <CardDescription>Held on file for you — contact your chapter if any of this needs correcting.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {importantInfo.map((row) => (
              <InfoRow key={row.label} icon={row.icon} label={row.label} value={row.value} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contact info</CardTitle>
          <CardDescription>Keep your email and phone up to date.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContactInfoForm email={member.email} phone={member.phone} />
        </CardContent>
      </Card>
    </div>
  );
}
