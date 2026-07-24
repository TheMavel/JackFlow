import {
  FREE_TRANSCRIPTION_LIMIT,
  createUsageCookie,
  getAuthUser,
  getGuestUsage,
} from "../../lib/auth";

const TRANSCRIPTION_MODELS = new Set([
  "whisper-1",
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
]);

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const user = await getAuthUser(request);
  const guestUsage = user ? null : await getGuestUsage(request);

  if (!apiKey) {
    return json(
      { error: "Der OpenAI API-Schlüssel ist auf dem Server nicht eingerichtet." },
      503,
    );
  }

  if (
    !user &&
    guestUsage &&
    guestUsage.count >= FREE_TRANSCRIPTION_LIMIT
  ) {
    return json(
      {
        error:
          "Deine fünf kostenlosen Transkriptionen sind aufgebraucht. Melde dich mit Google an, um weiterzumachen.",
        code: "FREE_LIMIT_REACHED",
        freeRemaining: 0,
        requiresLogin: true,
      },
      403,
    );
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return json({ error: "Die Audioaufnahme konnte nicht gelesen werden." }, 400);
  }

  const audio = incoming.get("audio");
  if (!(audio instanceof File)) {
    return json({ error: "Es wurde keine Audioaufnahme übermittelt." }, 400);
  }

  if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return json(
      { error: "Die Aufnahme ist leer oder größer als 20 MB." },
      413,
    );
  }

  const requestedModel = String(incoming.get("model") || "whisper-1");
  const model = TRANSCRIPTION_MODELS.has(requestedModel)
    ? requestedModel
    : "whisper-1";
  const language = String(incoming.get("language") || "de-DE")
    .split("-")[0]
    .toLowerCase();

  const openAIForm = new FormData();
  openAIForm.append("file", audio, audio.name || "jackflow-recording.webm");
  openAIForm.append("model", model);
  openAIForm.append("language", language);
  openAIForm.append("response_format", "json");
  openAIForm.append(
    "prompt",
    language === "de"
      ? "Natürliches Deutsch. Fachbegriffe können JackFlow, SaaS, No-Code und API enthalten."
      : "Natural speech. Technical terms may include JackFlow, SaaS, No-Code, and API.",
  );

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAIForm,
    });
  } catch {
    return json(
      { error: "OpenAI ist gerade nicht erreichbar. Bitte versuche es erneut." },
      502,
    );
  }

  let payload: { text?: string; error?: { message?: string } } = {};
  try {
    payload = (await upstream.json()) as typeof payload;
  } catch {
    return json(
      { error: "OpenAI hat eine unerwartete Antwort zurückgegeben." },
      502,
    );
  }

  if (!upstream.ok) {
    const safeMessage =
      upstream.status === 401
        ? "Der OpenAI API-Schlüssel ist ungültig oder abgelaufen."
        : upstream.status === 429
          ? "Das API-Limit wurde erreicht. Bitte versuche es gleich noch einmal."
          : payload.error?.message ||
            "Die Transkription konnte nicht abgeschlossen werden.";
    return json({ error: safeMessage }, upstream.status === 401 ? 503 : 502);
  }

  if (!payload.text?.trim()) {
    return json(
      { error: "In der Aufnahme wurde keine Sprache erkannt." },
      422,
    );
  }

  const nextUsage =
    !user && guestUsage
      ? {
          id: guestUsage.id,
          count: guestUsage.count + 1,
        }
      : null;
  const response = json({
    text: payload.text.trim(),
    model,
    member: Boolean(user),
    freeRemaining: nextUsage
      ? Math.max(0, FREE_TRANSCRIPTION_LIMIT - nextUsage.count)
      : null,
  });

  if (nextUsage) {
    response.headers.append(
      "Set-Cookie",
      await createUsageCookie(nextUsage, request),
    );
  }

  return response;
}
