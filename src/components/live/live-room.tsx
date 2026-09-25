"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import MuxPlayer from "@mux/mux-player-react/lazy";
import { Check, Copy, Eye, EyeOff, MessageSquareOff, Radio, Send, Trash2, UsersRound, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberAvatar } from "@/components/members/member-avatar";
import {
  deleteChatMessage,
  endLiveStream,
  refreshLiveStatus,
  sendChatMessage,
  setChatEnabled,
  setViewerMuted,
} from "@/lib/actions/livestreams";
import type { ChatMessage, LiveStream } from "@/lib/data/livestreams";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { PlaybackSource } from "@/lib/video/provider";
import { cn, pluralize } from "@/lib/utils";
import { tenant } from "@/tenant";

export type Viewer = { profileId: string; name: string; avatarColor: string; photoUrl?: string; leader: boolean };
type Present = Viewer & { joinedAt: string };

const HOST_POLL_MS = 15_000;

function splitName(name: string): [string, string] {
  const parts = name.trim().split(/\s+/);
  return [parts[0] ?? "?", parts.length > 1 ? parts[parts.length - 1] : ""];
}

function Avatar({ person, className }: { person: Pick<Viewer, "name" | "avatarColor" | "photoUrl">; className?: string }) {
  const [first, last] = splitName(person.name);
  return <MemberAvatar firstName={first} lastName={last} avatarColor={person.avatarColor} photoUrl={person.photoUrl} className={className} />;
}

// A clock that ticks every `intervalMs`; null while server rendering, so
// relative times never mismatch between server and browser.
function useNow(intervalMs: number): number | null {
  return useSyncExternalStore(
    useCallback(
      (onTick: () => void) => {
        const id = setInterval(onTick, intervalMs);
        return () => clearInterval(id);
      },
      [intervalMs]
    ),
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null
  );
}

function countdown(target: string, now: number): string {
  const ms = Date.parse(target) - now;
  if (ms <= 0) return "Starting any moment";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `Starts in ${pluralize(mins, "minute")}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Starts in ${pluralize(hours, "hour")}${mins % 60 ? ` ${mins % 60}m` : ""}`;
  return `Starts ${new Date(target).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`;
}

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs">{shown ? value : "•".repeat(24)}</code>
        {secret && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide" : "Show"}>
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function LiveRoom({
  stream,
  playback,
  initialMessages,
  me,
  isHost,
  mutedIds: initialMuted,
  broadcast,
}: {
  stream: LiveStream;
  // Live picture while live; the replay once ended and ready; else null.
  playback: PlaybackSource | null;
  initialMessages: ChatMessage[];
  me: Viewer;
  isHost: boolean;
  mutedIds: string[];
  // Hosts only: where the broadcasting app sends the picture.
  broadcast: { ingestUrl: string; streamKey: string } | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [present, setPresent] = useState<Present[]>([]);
  const [muted, setMuted] = useState(new Set(initialMuted));
  const [tab, setTab] = useState<"chat" | "here">("chat");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const now = useNow(30_000);
  // Latest details for the presence entry, without re-joining the room
  // whenever the page re-renders.
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  // Realtime: who's here (presence on a private channel only viewers of this
  // stream may join), new/removed chat messages, and the stream going live
  // or ending (the page re-renders with the player).
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    const room = supabase.channel(`live:${stream.id}`, { config: { private: true, presence: { key: meRef.current.profileId } } });
    const feed = supabase.channel(`live-feed:${stream.id}`);

    room.on("presence", { event: "sync" }, () => {
      const state = room.presenceState<Present>();
      setPresent(
        Object.values(state)
          .map((metas) => metas[0])
          .filter(Boolean)
          .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      );
    });

    type MessageRow = Database["public"]["Tables"]["live_stream_messages"]["Row"];
    const toMessage = (m: MessageRow): ChatMessage => ({
      id: m.id,
      profileId: m.profile_id,
      authorName: m.author_name,
      body: m.deleted_at ? "" : m.body,
      createdAt: m.created_at,
      deleted: !!m.deleted_at,
    });
    feed
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_stream_messages", filter: `stream_id=eq.${stream.id}` }, (p) =>
        setMessages((ms) => (ms.some((m) => m.id === (p.new as MessageRow).id) ? ms : [...ms, toMessage(p.new as MessageRow)]))
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_stream_messages", filter: `stream_id=eq.${stream.id}` }, (p) =>
        setMessages((ms) => ms.map((m) => (m.id === (p.new as MessageRow).id ? toMessage(p.new as MessageRow) : m)))
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${stream.id}` }, () => router.refresh());

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      room.subscribe(async (status) => {
        if (status === "SUBSCRIBED") await room.track({ ...meRef.current, joinedAt: new Date().toISOString() } satisfies Present);
      });
      feed.subscribe();
    })();

    return () => {
      cancelled = true;
      void supabase.removeChannel(room);
      void supabase.removeChannel(feed);
    };
  }, [stream.id, me.profileId, router]);

  // Without webhooks the host's page is what notices the broadcast starting
  // and stopping; Realtime then tells everyone else.
  const settled = stream.status === "ended" && stream.recordingStatus !== "processing";
  useEffect(() => {
    if (!isHost || settled) return;
    const id = setInterval(async () => {
      const { status } = await refreshLiveStatus(stream.id);
      if (status && status !== stream.status) router.refresh();
    }, HOST_POLL_MS);
    return () => clearInterval(id);
  }, [isHost, settled, stream.id, stream.status, router]);

  // Keep the newest message in view unless the reader has scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const iAmMuted = muted.has(me.profileId);
  const chatClosed = stream.status === "ended" ? "Chat has closed." : !stream.chatEnabled ? "Chat is turned off." : iAmMuted ? "You've been muted in this chat." : null;
  const hostIds = useMemo(() => new Set(present.filter((p) => p.leader).map((p) => p.profileId)), [present]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setChatError(null);
    const result = await sendChatMessage(stream.id, body);
    setSending(false);
    if (!result.ok) return setChatError(result.error);
    setDraft("");
  }

  async function end() {
    setBusy(true);
    const result = await endLiveStream(stream.id);
    setBusy(false);
    setConfirmEnd(false);
    if (result.ok) router.refresh();
  }

  const lobby = (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-gradient-to-br from-primary to-[color-mix(in_oklab,var(--primary)_55%,black)] p-6 text-center text-primary-foreground">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest opacity-80">
          {stream.status === "ended" ? "Stream ended" : "Lobby"}
        </p>
        <p className="text-xl font-semibold sm:text-2xl">
          {stream.status === "ended"
            ? stream.recordingStatus === "processing"
              ? "The replay will be ready shortly"
              : stream.startedAt
                ? "The replay isn't available"
                : "This stream didn't go live"
            : now === null
              ? " "
              : countdown(stream.scheduledAt, now)}
        </p>
      </div>
      {stream.status !== "ended" && (
        <div className="space-y-2">
          <div className="flex justify-center -space-x-2">
            {present.slice(0, 12).map((p) => (
              <Avatar key={p.profileId} person={p} className="h-9 w-9 text-xs ring-2 ring-primary" />
            ))}
          </div>
          <p className="text-sm opacity-90">
            {present.length === 0 ? "Waiting for people to arrive…" : `${pluralize(present.length, "person", "people")} here`}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-4">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
          {playback ? (
            <MuxPlayer
              playbackId={playback.playbackId}
              tokens={playback.tokens}
              streamType={stream.status === "live" ? "ll-live" : "on-demand"}
              autoPlay={stream.status === "live" ? "muted" : false}
              accentColor={tenant.chartPrimary}
              metadataVideoTitle={stream.title}
              metadataViewerUserId={me.profileId}
              className="h-full w-full"
            />
          ) : (
            lobby
          )}
          {stream.status === "live" && (
            <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              <Radio className="h-3 w-3" /> Live
            </span>
          )}
          {stream.status !== "ended" && present.length > 0 && playback && (
            <span className="pointer-events-none absolute right-3 top-3 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
              <UsersRound className="h-3 w-3" /> {present.length}
            </span>
          )}
        </div>

        {isHost && broadcast && stream.status !== "ended" && (
          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">Broadcast setup</p>
                <p className="text-xs text-muted-foreground">
                  {stream.status === "live" ? "You're live — viewers can see you." : "Start streaming from your app and this page goes live for everyone automatically."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={async () => { setBusy(true); await setChatEnabled(stream.id, !stream.chatEnabled); setBusy(false); router.refresh(); }}>
                  <MessageSquareOff className="h-3.5 w-3.5" />
                  {stream.chatEnabled ? "Turn chat off" : "Turn chat on"}
                </Button>
                {confirmEnd ? (
                  <Button variant="destructive" size="sm" onClick={end} disabled={busy}>
                    {stream.status === "live" ? "End for everyone" : "Close stream"}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmEnd(true)}>
                    {stream.status === "live" ? "End stream" : "Close without streaming"}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyField label="Server" value={broadcast.ingestUrl} />
              <CopyField label="Stream key — keep it private" value={broadcast.streamKey} secret />
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">How to connect</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">OBS on a laptop:</span> Settings → Stream → Service “Custom…”, paste the Server and
                  Stream key, then Start Streaming.
                </li>
                <li>
                  <span className="font-medium text-foreground">Phone:</span> in the free Larix Broadcaster app, add a connection with the URL{" "}
                  <code className="text-xs">server/stream key</code> (the two joined with a slash) and tap record.
                </li>
                <li>It goes live here within a few seconds of the signal arriving. Stop streaming in the app, or press End stream, to finish.</li>
              </ol>
            </details>
          </section>
        )}

        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{stream.title}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(stream.startedAt ?? stream.scheduledAt).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}
            {stream.audience === "leaders" ? " · Leaders only" : stream.audience === "chapters" ? " · Selected chapters" : ""}
          </p>
          {stream.description && <p className="whitespace-pre-line pt-1 text-sm leading-relaxed">{stream.description}</p>}
        </div>
      </div>

      <aside className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
        <div className="flex border-b text-sm">
          {(["chat", "here"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn("flex-1 py-2.5 font-medium", tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground")}
            >
              {t === "chat" ? "Chat" : `Here (${present.length})`}
            </button>
          ))}
        </div>

        {tab === "chat" ? (
          <>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet — say hello.</p>}
              {messages.map((m) => (
                <div key={m.id} className="group flex gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-semibold">{m.authorName}</span>
                      {hostIds.has(m.profileId) && <span className="ml-1 rounded bg-primary/10 px-1 text-[10px] font-medium text-primary">Leader</span>}
                      <span className="ml-1.5 text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </p>
                    {m.deleted ? (
                      <p className="italic text-muted-foreground">Message removed</p>
                    ) : (
                      <p className="whitespace-pre-line break-words leading-snug">{m.body}</p>
                    )}
                  </div>
                  {isHost && !m.deleted && (
                    <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => deleteChatMessage(m.id)} aria-label="Remove message">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {m.profileId !== me.profileId && (
                        <button
                          type="button"
                          className={cn("rounded p-1 hover:bg-muted", muted.has(m.profileId) ? "text-destructive" : "text-muted-foreground")}
                          aria-label={muted.has(m.profileId) ? `Unmute ${m.authorName}` : `Mute ${m.authorName}`}
                          onClick={async () => {
                            const next = !muted.has(m.profileId);
                            const r = await setViewerMuted(stream.id, m.profileId, next);
                            if (r.ok) setMuted((s) => { const n = new Set(s); if (next) n.add(m.profileId); else n.delete(m.profileId); return n; });
                          }}
                        >
                          <VolumeX className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form
              className="border-t p-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              {chatClosed ? (
                <p className="px-1 py-2 text-center text-xs text-muted-foreground">{chatClosed}</p>
              ) : (
                <div className="flex gap-1.5">
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Say something…" maxLength={500} aria-label="Chat message" />
                  <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Send">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {chatError && <p className="px-1 pt-1 text-xs text-destructive">{chatError}</p>}
            </form>
          </>
        ) : (
          <ul className="flex-1 divide-y overflow-y-auto">
            {present.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Nobody else is here yet.</li>}
            {present.map((p) => (
              <li key={p.profileId} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                <Avatar person={p} className="h-7 w-7 text-[10px]" />
                <span className="min-w-0 flex-1 truncate">
                  {p.name}
                  {p.profileId === me.profileId && <span className="text-muted-foreground"> (you)</span>}
                </span>
                {p.leader && <span className="text-[10px] font-medium text-primary">Leader</span>}
                {now !== null && (
                  <span className="text-[11px] text-muted-foreground">
                    {Math.max(0, Math.round((now - Date.parse(p.joinedAt)) / 60000))}m
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
