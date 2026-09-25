import { isVideoProviderId } from "@/lib/video/provider";
import { getVideoProvider } from "@/lib/video/providers";
import { applyAssetState, applyUploadState } from "@/lib/video/lesson-video-sync";

// Video hosts call this as an uploaded lesson video moves through
// processing — e.g. point Mux at https://<your-domain>/api/video/mux/webhook.
// Each provider verifies its own signature.
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerId } = await params;
  if (!isVideoProviderId(providerId)) return new Response("Unknown video provider.", { status: 404 });
  const provider = getVideoProvider(providerId);
  if (!provider.webhooksConfigured()) {
    return new Response(`${provider.label} webhooks are not configured.`, { status: 404 });
  }

  const body = await request.text();
  let update: Awaited<ReturnType<typeof provider.parseWebhook>>;
  try {
    update = await provider.parseWebhook(body, request.headers);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  if (update && "upload" in update) await applyUploadState(providerId, update.upload);
  else if (update && "asset" in update) await applyAssetState(providerId, update.asset);
  return new Response(null, { status: 204 });
}
