import { unwrapWebhook } from "@/lib/video/mux";
import { applyAssetState, applyUploadState } from "@/lib/video/lesson-video-sync";

// Mux calls this as an uploaded lesson video moves through processing.
// Point a webhook at https://<your-domain>/api/mux/webhook in the Mux
// dashboard and set MUX_WEBHOOK_SECRET to its signing secret.
export async function POST(request: Request) {
  if (!process.env.MUX_WEBHOOK_SECRET) {
    return new Response("Mux webhooks are not configured.", { status: 404 });
  }

  const body = await request.text();
  let event: Awaited<ReturnType<typeof unwrapWebhook>>;
  try {
    // Verifies the mux-signature header against MUX_WEBHOOK_SECRET.
    event = await unwrapWebhook(body, request.headers);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  switch (event.type) {
    case "video.upload.asset_created":
    case "video.upload.errored":
    case "video.upload.cancelled":
      await applyUploadState(event.data);
      break;
    case "video.asset.ready":
    case "video.asset.errored":
      await applyAssetState(event.data);
      break;
  }

  return new Response(null, { status: 204 });
}
