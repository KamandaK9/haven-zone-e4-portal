// How a message's status reads on screen.
export const STATUS_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "outline" }> = {
  pending: { label: "Waiting for approval", tone: "default" },
  approved: { label: "Approved — waiting to send", tone: "default" },
  sending: { label: "Sending…", tone: "secondary" },
  sent: { label: "Sent", tone: "secondary" },
  rejected: { label: "Declined", tone: "outline" },
  cancelled: { label: "Cancelled", tone: "outline" },
};
