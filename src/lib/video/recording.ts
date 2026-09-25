// In-browser lesson recording (Stratum core). Browser-only — import from
// client components. Captures the camera, the screen, or the screen with the
// camera in a corner bubble, mixes the microphone with any shared system
// audio, and records it all with MediaRecorder. The result goes through the
// same hosted-video upload as a picked file.

export type RecordingMode = "camera" | "screen" | "screen-camera";

// Longest single recording. Lessons are meant to be short; this also bounds
// how much video the browser holds in memory before it's uploaded.
export const MAX_RECORDING_SECONDS = 45 * 60;

export function canRecord(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

// Screen capture isn't available in mobile browsers.
export function canRecordScreen(): boolean {
  return canRecord() && typeof navigator.mediaDevices.getDisplayMedia === "function";
}

// Chrome/Firefox record WebM, Safari MP4. The video host accepts either.
export function pickMimeType(): string {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a", "video/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function fileExtension(mimeType: string): string {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

// ~1.5 Mbps camera / 2.5 Mbps screen: sharp enough for faces and on-screen
// text, and a 45-minute recording stays well under a gigabyte in memory.
export function videoBitrate(mode: RecordingMode): number {
  return mode === "camera" ? 1_500_000 : 2_500_000;
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

export async function getCamera(videoDeviceId?: string, audioDeviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: {
      deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
}

export async function getMicrophone(audioDeviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined, echoCancellation: true, noiseSuppression: true },
  });
}

// Must be called from a click handler (browsers require a user gesture).
// Asks for system/tab audio too; the user can decline it in the picker.
export async function getScreen(): Promise<MediaStream> {
  return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: true });
}

export async function listDevices(): Promise<{ cameras: MediaDeviceInfo[]; microphones: MediaDeviceInfo[] }> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: devices.filter((d) => d.kind === "videoinput" && d.deviceId),
    microphones: devices.filter((d) => d.kind === "audioinput" && d.deviceId),
  };
}

// A steady tick that keeps running while this tab is in the background.
// Screen+camera recording draws every frame onto a canvas; the presenter
// is usually looking at another window, and main-thread timers and
// requestAnimationFrame are throttled (or stopped) in background tabs.
// Worker timers aren't.
function backgroundSafeTicker(fps: number, onTick: () => void): () => void {
  const source = "let id; onmessage = (e) => { clearInterval(id); if (e.data > 0) id = setInterval(() => postMessage(0), e.data); };";
  const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
  const worker = new Worker(url);
  worker.onmessage = onTick;
  worker.postMessage(Math.round(1000 / fps));
  return () => {
    worker.postMessage(0);
    worker.terminate();
    URL.revokeObjectURL(url);
  };
}

function playHidden(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  void video.play();
  return video;
}

// Draws the shared screen full-frame with the camera in a round bubble in
// the bottom-left corner, and returns the canvas as a video stream.
export function compositeScreenAndCamera(screen: MediaStream, camera: MediaStream): { stream: MediaStream; stop: () => void } {
  const fps = 30;
  const screenVideo = playHidden(screen);
  const cameraVideo = playHidden(camera);
  const canvas = document.createElement("canvas");
  const settings = screen.getVideoTracks()[0]?.getSettings() ?? {};
  // Keep the shared screen's aspect ratio, capped at 1080p.
  const scale = Math.min(1, 1920 / (settings.width ?? 1920), 1080 / (settings.height ?? 1080));
  canvas.width = Math.round((settings.width ?? 1920) * scale);
  canvas.height = Math.round((settings.height ?? 1080) * scale);
  const ctx = canvas.getContext("2d")!;

  const draw = () => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (screenVideo.videoWidth) ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

    if (cameraVideo.videoWidth) {
      const d = Math.round(canvas.height * 0.24);
      const margin = Math.round(canvas.height * 0.03);
      const x = margin;
      const y = canvas.height - d - margin;
      // Centre-crop the camera to a square.
      const side = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
      const sx = (cameraVideo.videoWidth - side) / 2;
      const sy = (cameraVideo.videoHeight - side) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(cameraVideo, sx, sy, side, side, x, y, d, d);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, Math.round(d * 0.02));
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
    }
  };

  const stopTicker = backgroundSafeTicker(fps, draw);
  return {
    stream: canvas.captureStream(fps),
    stop: () => {
      stopTicker();
      screenVideo.srcObject = null;
      cameraVideo.srcObject = null;
    },
  };
}

// Mixes the microphone with the screen's own audio (if the user shared it)
// into a single track, and exposes the mic level for a live meter.
export function mixAudio(mic: MediaStream | null, system: MediaStream | null): {
  track: MediaStreamTrack | null;
  level: () => number;
  stop: () => void;
} {
  const ctx = new AudioContext();
  const destination = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  let hasAudio = false;

  if (mic?.getAudioTracks().length) {
    const source = ctx.createMediaStreamSource(mic);
    source.connect(destination);
    source.connect(analyser);
    hasAudio = true;
  }
  if (system?.getAudioTracks().length) {
    ctx.createMediaStreamSource(system).connect(destination);
    hasAudio = true;
  }

  const samples = new Uint8Array(analyser.fftSize);
  return {
    track: hasAudio ? destination.stream.getAudioTracks()[0] : null,
    // 0–1, loudness of the microphone right now.
    level: () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const s of samples) peak = Math.max(peak, Math.abs(s - 128));
      return Math.min(1, peak / 64);
    },
    stop: () => void ctx.close(),
  };
}

// MediaRecorder's WebM has no duration in its header, so the preview
// player shows no length and can't seek. Seeking far past the end makes
// the browser scan the file and work it out.
export function fixPreviewDuration(video: HTMLVideoElement): void {
  if (Number.isFinite(video.duration)) return;
  const onTimeUpdate = () => {
    video.removeEventListener("timeupdate", onTimeUpdate);
    video.currentTime = 0;
  };
  video.addEventListener("timeupdate", onTimeUpdate);
  video.currentTime = Number.MAX_SAFE_INTEGER;
}
