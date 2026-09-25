"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AlertCircle, Camera, Circle, Monitor, MonitorPlay, Pause, Play, RotateCcw, Square, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MAX_RECORDING_SECONDS,
  canRecordScreen,
  compositeScreenAndCamera,
  fileExtension,
  fixPreviewDuration,
  getCamera,
  getMicrophone,
  getScreen,
  listDevices,
  mixAudio,
  pickMimeType,
  stopStream,
  videoBitrate,
  type RecordingMode,
} from "@/lib/video/recording";
import { formatDuration } from "@/lib/video/watch";

type Phase = "setup" | "countdown" | "recording" | "review";

const MODES: { mode: RecordingMode; label: string; hint: string; icon: typeof Camera; needsScreen: boolean }[] = [
  { mode: "camera", label: "Camera", hint: "You, talking to camera", icon: Camera, needsScreen: false },
  { mode: "screen", label: "Screen", hint: "Slides, a website, an app", icon: Monitor, needsScreen: true },
  { mode: "screen-camera", label: "Screen + camera", hint: "Your screen with you in the corner", icon: MonitorPlay, needsScreen: true },
];

const noopSubscribe = () => () => {};

// Warn when this much recording time is left.
const WARN_REMAINING_SECONDS = 5 * 60;

function describeMediaError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "Access was blocked. Allow the camera and microphone in your browser's address bar, then try again.";
  if (name === "NotFoundError") return "No camera or microphone was found.";
  if (name === "NotReadableError") return "Your camera or microphone is in use by another app. Close it and try again.";
  return e instanceof Error ? e.message : "Couldn't start recording.";
}

// Records a lesson video in the browser and hands the finished file back
// (it's uploaded with the lesson, like a picked file).
export function LessonRecorder({
  onComplete,
  onCancel,
  onBusyChange,
}: {
  onComplete: (file: File, durationSeconds: number) => void;
  onCancel: () => void;
  // True while recording or holding an unsaved take, so the parent can
  // stop the dialog closing and losing it.
  onBusyChange?: (busy: boolean) => void;
}) {
  // Browser capability — false while server-rendering, so the markup matches
  // on hydration.
  const screenAllowed = useSyncExternalStore(noopSubscribe, canRecordScreen, () => false);
  const [mode, setMode] = useState<RecordingMode>("camera");
  const [phase, setPhase] = useState<Phase>("setup");
  const [countdown, setCountdown] = useState(3);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState<string>();
  const [micId, setMicId] = useState<string>();
  const [take, setTake] = useState<{ url: string; blob: Blob; seconds: number } | null>(null);
  // Bumped to restart the setup preview after a failed start (e.g. the
  // screen picker was cancelled) — the phase stays "setup" in that case.
  const [setupAttempt, setSetupAttempt] = useState(0);

  const previewRef = useRef<HTMLVideoElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  // Everything that has to be torn down.
  const cameraStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const screenStream = useRef<MediaStream | null>(null);
  const composite = useRef<{ stop: () => void } | null>(null);
  const audio = useRef<ReturnType<typeof mixAudio> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  // Elapsed-time bookkeeping (pauses excluded).
  const startedAt = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const pausedTotal = useRef(0);

  const usesCamera = mode !== "screen";

  useEffect(() => {
    onBusyChange?.(phase === "recording" || phase === "countdown" || phase === "review");
  }, [phase, onBusyChange]);

  const releaseAll = useCallback(() => {
    composite.current?.stop();
    composite.current = null;
    audio.current?.stop();
    audio.current = null;
    stopStream(cameraStream.current);
    stopStream(micStream.current);
    stopStream(screenStream.current);
    cameraStream.current = micStream.current = screenStream.current = null;
  }, []);

  // Live preview + mic meter while setting up. Restarts when the mode or a
  // device changes.
  useEffect(() => {
    if (phase !== "setup") return;
    let cancelled = false;
    (async () => {
      releaseAll();
      try {
        const stream = usesCamera ? await getCamera(cameraId, micId) : await getMicrophone(micId);
        if (cancelled) return stopStream(stream);
        if (usesCamera) cameraStream.current = stream;
        else micStream.current = stream;
        audio.current = mixAudio(stream, null);
        if (previewRef.current) previewRef.current.srcObject = usesCamera ? stream : null;
        const devices = await listDevices();
        if (cancelled) return;
        setCameras(devices.cameras);
        setMicrophones(devices.microphones);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(describeMediaError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, usesCamera, cameraId, micId, setupAttempt, releaseAll]);

  // Mic level meter, written straight to the DOM (no re-render per frame).
  useEffect(() => {
    if (phase === "review") return;
    let raf = 0;
    const tick = () => {
      const level = audio.current?.level() ?? 0;
      if (meterRef.current) meterRef.current.style.width = `${Math.round(level * 100)}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const currentElapsed = useCallback(() => {
    const now = performance.now();
    const pausing = pausedAt.current !== null ? now - pausedAt.current : 0;
    return (now - startedAt.current - pausedTotal.current - pausing) / 1000;
  }, []);

  const stopRecording = useCallback(() => {
    const r = recorder.current;
    if (r && r.state !== "inactive") r.stop();
  }, []);

  // Recording clock + the hard time limit.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const s = currentElapsed();
      setElapsed(s);
      if (s >= MAX_RECORDING_SECONDS) stopRecording();
    }, 250);
    return () => clearInterval(id);
  }, [phase, currentElapsed, stopRecording]);

  // Don't let a refresh or closed tab silently throw away a recording.
  useEffect(() => {
    if (phase !== "recording" && phase !== "review") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  // Final cleanup.
  useEffect(() => {
    return () => {
      if (recorder.current && recorder.current.state !== "inactive") {
        recorder.current.ondataavailable = null;
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      releaseAll();
    };
  }, [releaseAll]);

  useEffect(() => {
    return () => {
      if (take) URL.revokeObjectURL(take.url);
    };
  }, [take]);

  async function start() {
    setError(null);
    try {
      // The screen picker has to open straight from this click.
      if (mode !== "camera") {
        screenStream.current = await getScreen();
        // The browser's own "Stop sharing" button ends the recording.
        screenStream.current.getVideoTracks()[0]?.addEventListener("ended", stopRecording);
      }

      const mic = usesCamera ? cameraStream.current : micStream.current;
      if (!mic) throw new Error("The microphone isn't ready yet — give it a moment and try again.");

      let videoTrack: MediaStreamTrack | undefined;
      if (mode === "camera") videoTrack = cameraStream.current!.getVideoTracks()[0];
      else if (mode === "screen") videoTrack = screenStream.current!.getVideoTracks()[0];
      else {
        const c = compositeScreenAndCamera(screenStream.current!, cameraStream.current!);
        composite.current = c;
        videoTrack = c.stream.getVideoTracks()[0];
      }

      audio.current?.stop();
      audio.current = mixAudio(mic, screenStream.current);
      const tracks = [videoTrack, audio.current.track].filter((t): t is MediaStreamTrack => !!t);
      const stream = new MediaStream(tracks);
      if (previewRef.current) previewRef.current.srcObject = stream;

      const mimeType = pickMimeType();
      const r = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: videoBitrate(mode),
        audioBitsPerSecond: 128_000,
      });
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
        // Also enforced here: data events keep arriving even when the tab
        // is in the background and its timers are throttled.
        if (currentElapsed() >= MAX_RECORDING_SECONDS) stopRecording();
      };
      r.onstop = () => {
        const seconds = Math.min(currentElapsed(), MAX_RECORDING_SECONDS);
        const blob = new Blob(chunks.current, { type: r.mimeType || mimeType || "video/webm" });
        chunks.current = [];
        releaseAll();
        setTake({ url: URL.createObjectURL(blob), blob, seconds });
        setPaused(false);
        setPhase("review");
      };
      recorder.current = r;

      setPhase("countdown");
      for (let n = 3; n > 0; n--) {
        setCountdown(n);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      startedAt.current = performance.now();
      pausedTotal.current = 0;
      pausedAt.current = null;
      setElapsed(0);
      r.start(1000); // a chunk every second
      setPhase("recording");
    } catch (e) {
      releaseAll();
      setPhase("setup");
      setSetupAttempt((n) => n + 1);
      // Camera and mic were granted during setup, so a NotAllowedError here
      // means the screen picker was cancelled — not worth an error.
      const cancelledPicker = e instanceof DOMException && e.name === "NotAllowedError" && mode !== "camera";
      if (!cancelledPicker) setError(describeMediaError(e));
    }
  }

  function togglePause() {
    const r = recorder.current;
    if (!r) return;
    if (r.state === "recording") {
      r.pause();
      pausedAt.current = performance.now();
      setPaused(true);
    } else if (r.state === "paused") {
      pausedTotal.current += performance.now() - (pausedAt.current ?? performance.now());
      pausedAt.current = null;
      r.resume();
      setPaused(false);
    }
  }

  function recordAgain() {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setElapsed(0);
    setPhase("setup");
  }

  function acceptTake() {
    if (!take) return;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const file = new File([take.blob], `recording-${stamp}.${fileExtension(take.blob.type)}`, { type: take.blob.type });
    onComplete(file, take.seconds);
  }

  const remaining = MAX_RECORDING_SECONDS - elapsed;

  return (
    <div className="space-y-4">
      {phase === "setup" && (
        <div className="grid grid-cols-3 gap-2">
          {MODES.filter((m) => screenAllowed || !m.needsScreen).map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => setMode(m.mode)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                mode === m.mode ? "border-primary bg-primary/5" : "hover:bg-muted/60"
              )}
            >
              <m.icon className={cn("h-4 w-4 mb-1.5", mode === m.mode ? "text-primary" : "text-muted-foreground")} />
              <p className="text-sm font-medium leading-tight">{m.label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug">{m.hint}</p>
            </button>
          ))}
        </div>
      )}

      {/* Preview: live camera during setup, the actual recording while recording, the take in review. */}
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {phase === "review" && take ? (
          <video
            key={take.url}
            src={take.url}
            controls
            playsInline
            className="h-full w-full"
            onLoadedMetadata={(e) => fixPreviewDuration(e.currentTarget)}
          />
        ) : (
          <video ref={previewRef} autoPlay muted playsInline className={cn("h-full w-full object-contain", mode === "camera" && "-scale-x-100")} />
        )}

        {phase === "setup" && mode === "screen" && (
          <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-white/70 px-6">
            You&apos;ll choose which screen, window or tab to share when you press Start.
          </div>
        )}
        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-6xl font-semibold text-white">{countdown}</div>
        )}
        {phase === "recording" && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
            <Circle className={cn("h-2.5 w-2.5 fill-red-500 text-red-500", !paused && "animate-pulse")} />
            {paused ? "Paused" : "Recording"} · {formatDuration(elapsed)} / {formatDuration(MAX_RECORDING_SECONDS)}
          </div>
        )}
      </div>

      {phase !== "review" && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground w-10 shrink-0">Mic</span>
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div ref={meterRef} className="h-full rounded-full bg-emerald-500 transition-[width] duration-75" style={{ width: 0 }} />
          </div>
        </div>
      )}

      {phase === "setup" && (cameras.length > 0 || microphones.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {usesCamera && cameras.length > 0 && (
            <div className="space-y-1.5">
              <Label>Camera</Label>
              <Select value={cameraId ?? cameras[0].deviceId} onValueChange={setCameraId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((d, i) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {microphones.length > 0 && (
            <div className="space-y-1.5">
              <Label>Microphone</Label>
              <Select value={micId ?? microphones[0].deviceId} onValueChange={setMicId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {microphones.map((d, i) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {phase === "recording" && remaining <= WARN_REMAINING_SECONDS && (
        <p className="text-xs font-medium text-amber-700">
          {formatDuration(remaining)} left — recordings stop automatically at {MAX_RECORDING_SECONDS / 60} minutes.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={phase === "countdown"}>
          {phase === "review" ? "Discard" : "Cancel"}
        </Button>
        <div className="flex gap-2">
          {phase === "setup" && (
            <Button type="button" onClick={start} className="gap-1.5">
              <Circle className="h-3.5 w-3.5 fill-current" /> Start recording
            </Button>
          )}
          {phase === "recording" && (
            <>
              <Button type="button" variant="outline" onClick={togglePause} className="gap-1.5">
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {paused ? "Resume" : "Pause"}
              </Button>
              <Button type="button" variant="destructive" onClick={stopRecording} className="gap-1.5">
                <Square className="h-3.5 w-3.5 fill-current" /> Stop
              </Button>
            </>
          )}
          {phase === "review" && take && (
            <>
              <Button type="button" variant="outline" onClick={recordAgain} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Record again
              </Button>
              <Button type="button" onClick={acceptTake} className="gap-1.5">
                <Check className="h-3.5 w-3.5" /> Use this recording ({formatDuration(take.seconds)})
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
