import {
  FREE_TRANSCRIPTION_LIMIT,
  getAuthUser,
  getGuestUsage,
  isGoogleConfigured,
} from "../../../lib/auth";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  const usage = user ? null : await getGuestUsage(request);

  return Response.json(
    {
      user,
      googleConfigured: isGoogleConfigured(),
      freeLimit: FREE_TRANSCRIPTION_LIMIT,
      freeRemaining: user
        ? null
        : Math.max(0, FREE_TRANSCRIPTION_LIMIT - (usage?.count ?? 0)),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
