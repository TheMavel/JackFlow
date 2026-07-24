import { getGoogleClientId, isGoogleConfigured } from "../../../lib/auth";

export async function GET() {
  return Response.json(
    {
      clientId: getGoogleClientId(),
      configured: isGoogleConfigured(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
