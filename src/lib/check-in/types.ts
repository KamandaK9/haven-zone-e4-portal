// Shared by the check-in screen, its on-device store and the sync action.

export type ServiceKind = "sunday" | "midweek" | "special";

// A service is identified by where/when/what, not an id, so a device that's
// offline can check people into a service that doesn't exist yet — the sync
// creates it (services are unique on these four).
export type ServiceKey = { churchId: string; date: string; kind: ServiceKind; name: string };

export const serviceKeyString = (k: ServiceKey) => `${k.churchId}|${k.date}|${k.kind}|${k.name}`;

export type RosterMember = {
  id: string;
  name: string;
  cell?: string;
  ageGroup?: string;
  isVisitor: boolean;
};

export type Roster = { churchId: string; members: RosterMember[]; savedAt: string };

// One check-in waiting on the device. `id` becomes the attendance row's id,
// which is what makes re-syncing it harmless.
export type QueuedCheckIn = {
  id: string;
  service: ServiceKey;
  memberId: string;
  // Set when this check-in is a first-timer added on the device; memberId is
  // then the id their member row will get.
  visitor?: { firstName: string; lastName: string; phone: string };
  checkedInAt: string;
  deviceId: string;
};

export type SyncResult =
  | { ok: true; synced: string[]; failed: { id: string; error: string }[] }
  | { ok: false; signedOut: boolean; error: string };
