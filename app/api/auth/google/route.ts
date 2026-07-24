import {
  createSessionCookie,
  verifyGoogleCredential,
} from "../../../lib/auth";

export async function POST(request: Request) {
  const expectedOrigin = new URL(request.url).origin;
  const incomingOrigin = request.headers.get("origin");
  if (incomingOrigin && incomingOrigin !== expectedOrigin) {
    return Response.json({ error: "Ungültige Login-Anfrage." }, { status: 403 });
  }

  let credential = "";
  try {
    const body = (await request.json()) as { credential?: unknown };
    credential =
      typeof body.credential === "string" ? body.credential.trim() : "";
  } catch {
    return Response.json({ error: "Ungültige Login-Daten." }, { status: 400 });
  }

  if (!credential) {
    return Response.json(
      { error: "Google hat keine Anmeldedaten übermittelt." },
      { status: 400 },
    );
  }

  try {
    const user = await verifyGoogleCredential(credential);
    const response = Response.json({ user });
    response.headers.append(
      "Set-Cookie",
      await createSessionCookie(user, request),
    );
    return response;
  } catch {
    return Response.json(
      {
        error:
          "Der Google-Login konnte nicht bestätigt werden. Prüfe Client-ID und autorisierte Herkunft.",
      },
      { status: 401 },
    );
  }
}
