"use client";

import { useEffect, useRef, useState } from "react";

type ModeId = "prompt" | "message" | "list" | "email";
type TranscriptionModel =
  | "whisper-1"
  | "gpt-4o-mini-transcribe"
  | "gpt-4o-transcribe";

const MODES: Record<
  ModeId,
  { label: string; eyebrow: string; title: string; sample: string }
> = {
  prompt: {
    label: "KI-Prompt",
    eyebrow: "Gedanken in gute Anweisungen verwandeln",
    title: "Sag der KI genau, was du brauchst.",
    sample:
      "Erstelle einen siebentägigen Reiseplan für Italien. Morgens möchte ich historische Orte sehen, nachmittags eine Pause machen und abends lokale Restaurants entdecken.",
  },
  message: {
    label: "Nachricht",
    eyebrow: "Persönlich, direkt und ohne Tippfehler",
    title: "Schreib, als würdest du sprechen.",
    sample:
      "Hey Lea, ich bin heute ungefähr zehn Minuten später da. Bestell gerne schon mal einen Kaffee für mich – bis gleich!",
  },
  list: {
    label: "Liste",
    eyebrow: "Aus freien Gedanken wird sofort Struktur",
    title: "Bring Ordnung in alles, was dir einfällt.",
    sample:
      "Für den Launch: Landingpage finalisieren\nDemo-Video aufnehmen\nNewsletter vorbereiten\nFeedback vom Team einsammeln",
  },
  email: {
    label: "E-Mail",
    eyebrow: "Professionell, ohne steif zu klingen",
    title: "Von der Idee zur fertigen E-Mail.",
    sample:
      "Hallo Frau Berger,\n\nvielen Dank für das gute Gespräch. Anbei finden Sie die besprochenen nächsten Schritte. Ich freue mich auf Ihre Rückmeldung.\n\nBeste Grüße",
  },
};

const DEMO_TRANSCRIPTS: Record<ModeId, string> = {
  prompt:
    "ähm plane mir bitte eine woche in italien also wichtig sind mir geschichte gutes essen und ich will nachmittags nicht so viel machen",
  message:
    "hey lea ich komme heute so zehn minuten später bestell gerne schon mal einen kaffee für mich bis gleich",
  list:
    "landingpage finalisieren dann demo video aufnehmen außerdem newsletter vorbereiten und feedback vom team einsammeln",
  email:
    "hallo frau berger vielen dank für das gute gespräch anbei finden sie die nächsten schritte ich freue mich auf ihre rückmeldung beste grüße",
};

function tidySentence(input: string) {
  const withoutFillers = input
    .replace(/\b(ähm+|äh+|also|sozusagen|quasi)\b[,\s]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutFillers) return "";

  const capitalized =
    withoutFillers.charAt(0).toLocaleUpperCase("de-DE") +
    withoutFillers.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function polishText(input: string, mode: ModeId) {
  const cleaned = tidySentence(input);
  if (!cleaned) return "";

  if (mode === "list") {
    return cleaned
      .replace(/\.$/, "")
      .split(/\b(?:dann|außerdem|und danach|und)\b|,/gi)
      .map((item) => item.trim())
      .filter(Boolean)
      .map(
        (item) =>
          `• ${item.charAt(0).toLocaleUpperCase("de-DE")}${item.slice(1)}`,
      )
      .join("\n");
  }

  if (mode === "email") {
    return cleaned
      .replace(/\bhallo frau berger\b/i, "Hallo Frau Berger,\n\n")
      .replace(
        /\bbeste grüße\b/i,
        "\n\nBeste Grüße\nDein Name",
      )
      .replace(/\.\s*\n\n/g, ".\n\n");
  }

  return cleaned;
}

function WaveMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`wave-mark ${small ? "wave-mark--small" : ""}`} aria-hidden>
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export default function Home() {
  const [mode, setMode] = useState<ModeId>("prompt");
  const [text, setText] = useState(MODES.prompt.sample);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [autoPolish, setAutoPolish] = useState(true);
  const [language, setLanguage] = useState("de-DE");
  const [model, setModel] = useState<TranscriptionModel>("whisper-1");
  const [status, setStatus] = useState("Bereit zum Diktieren");
  const [copied, setCopied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function changeMode(nextMode: ModeId) {
    if (isListening) stopListening();
    setMode(nextMode);
    setText(MODES[nextMode].sample);
    setStatus("Bereit zum Diktieren");
  }

  function stopListening() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setStatus("Aufnahme wird verarbeitet …");
    }
  }

  async function transcribeRecording(blob: Blob, extension: string) {
    setIsTranscribing(true);
    setStatus(`${model === "whisper-1" ? "Whisper" : "OpenAI"} transkribiert …`);

    try {
      const formData = new FormData();
      formData.append("audio", blob, `jackflow-recording.${extension}`);
      formData.append("language", language);
      formData.append("model", model);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        text?: string;
        error?: string;
      };

      if (!response.ok || !result.text) {
        throw new Error(result.error || "Die Aufnahme konnte nicht transkribiert werden.");
      }

      setText(autoPolish ? polishText(result.text, mode) : result.text);
      setStatus(
        autoPolish
          ? "Transkribiert · Füllwörter entfernt · Text formatiert"
          : "Transkription abgeschlossen",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Die Transkription ist fehlgeschlagen.",
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startListening() {
    if (isListening) {
      stopListening();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus("Audioaufnahme wird in diesem Browser nicht unterstützt");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ];
      const mimeType =
        preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ??
        "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setStatus("Die Audioaufnahme wurde unterbrochen.");
        setIsListening(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      };

      recorder.onstop = () => {
        const recordedType = recorder.mimeType || "audio/webm";
        const extension = recordedType.includes("ogg") ? "ogg" : "webm";
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recordedType,
        });

        setIsListening(false);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        if (audioBlob.size < 900) {
          setStatus("Die Aufnahme war zu kurz. Versuch es noch einmal.");
          return;
        }

        void transcribeRecording(audioBlob, extension);
      };

      recorder.start(250);
      setText("");
      setCopied(false);
      setIsListening(true);
      setStatus("Aufnahme läuft · Tippe erneut zum Beenden");
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError");
      setStatus(
        denied
          ? "Mikrofonzugriff wurde nicht erlaubt"
          : "Das Mikrofon ist gerade nicht verfügbar",
      );
    }
  }

  function runDemo() {
    const result = autoPolish
      ? polishText(DEMO_TRANSCRIPTS[mode], mode)
      : DEMO_TRANSCRIPTS[mode];
    setText(result);
    setStatus(autoPolish ? "Füllwörter entfernt · Text formatiert" : "Rohtext eingefügt");
  }

  async function copyText() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="JackFlow Startseite">
          <WaveMark small />
          <span>JackFlow</span>
        </a>
        <nav aria-label="Hauptnavigation">
          <a href="#studio">Produkt</a>
          <a href="#features">Funktionen</a>
          <a href="#privacy">Datenschutz</a>
        </nav>
        <a className="header-cta" href="#studio">
          Kostenlos ausprobieren <span>↗</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="orbit orbit--left" aria-hidden>
          <span>ähm</span>
          <span>also</span>
          <span>quasi</span>
        </div>
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" /> Voice-to-text, neu gedacht
          </span>
          <h1>
            Sprich frei.
            <br />
            <em>JackFlow</em> schreibt klar.
          </h1>
          <p>
            Deine Stimme wird zu sauberem, strukturiertem Text – direkt dort,
            wo deine Gedanken entstehen.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#studio">
              <WaveMark small />
              Jetzt diktieren
            </a>
            <button className="text-button" type="button" onClick={runDemo}>
              Demo ohne Mikrofon <span>→</span>
            </button>
          </div>
          <div className="trust-line">
            <span>✓ Kein Konto nötig</span>
            <span>✓ Deutsch & Englisch</span>
            <span>✓ Lokal testbar</span>
          </div>
        </div>
        <div className="speed-stamp" aria-label="Bis zu viermal schneller">
          <strong>4×</strong>
          <span>schneller als tippen</span>
        </div>
      </section>

      <section className="studio-section" id="studio">
        <div className="section-heading">
          <span className="eyebrow">Live ausprobieren</span>
          <h2>Vom Gedanken zum fertigen Text.</h2>
          <p>Wähle ein Format, drücke auf das Mikrofon und sprich einfach los.</p>
        </div>

        <div className="mode-tabs" role="tablist" aria-label="Textformat wählen">
          {(Object.keys(MODES) as ModeId[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? "active" : ""}
              onClick={() => changeMode(id)}
            >
              {MODES[id].label}
            </button>
          ))}
        </div>

        <div className="studio-shell">
          <article className="editor-card">
            <div className="editor-topline">
              <div>
                <span>{MODES[mode].eyebrow}</span>
                <h3>{MODES[mode].title}</h3>
              </div>
              <button
                type="button"
                className="copy-button"
                onClick={copyText}
                disabled={!text}
              >
                {copied ? "Kopiert ✓" : "Kopieren"}
              </button>
            </div>

            <div
              className={`writing-area ${isListening ? "is-listening" : ""} ${
                isTranscribing ? "is-transcribing" : ""
              }`}
            >
              <textarea
                aria-label="Dein diktierter Text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Dein Text erscheint hier …"
              />
              <div className="editor-status">
                <span>
                  <i className={isListening || isTranscribing ? "pulse" : ""} />
                  {status}
                </span>
                <span>{text.length} Zeichen</span>
              </div>
            </div>

            <div className="record-row">
              <button
                type="button"
                className={`mic-button ${isListening ? "is-active" : ""} ${
                  isTranscribing ? "is-busy" : ""
                }`}
                onClick={startListening}
                disabled={isTranscribing}
                aria-label={isListening ? "Diktat beenden" : "Diktat starten"}
              >
                <span className="mic-icon" aria-hidden />
              </button>
              <div className="record-instruction">
                <strong>
                  {isTranscribing
                    ? "Whisper arbeitet"
                    : isListening
                      ? "Aufnahme läuft"
                      : "Diktat starten"}
                </strong>
                <span>
                  {isTranscribing
                    ? "Deine Aufnahme wird gerade in Text verwandelt."
                    : isListening
                      ? "Sprich natürlich – tippe erneut zum Beenden."
                      : "Tippe auf das Mikrofon und erlaube den Zugriff."}
                </span>
              </div>
              <button type="button" className="demo-chip" onClick={runDemo}>
                Demo-Text testen
              </button>
            </div>
          </article>

          <aside className="control-card">
            <div className="control-heading">
              <span className="spark">✦</span>
              <div>
                <strong>Flow-Regeln</strong>
                <span>So wird dein Text verfeinert</span>
              </div>
            </div>

            <label className="control-row">
              <div>
                <strong>Auto-Polish</strong>
                <span>Entfernt Füllwörter und glättet Sätze</span>
              </div>
              <input
                type="checkbox"
                checked={autoPolish}
                onChange={(event) => setAutoPolish(event.target.checked)}
              />
              <span className="toggle" aria-hidden />
            </label>

            <label className="select-row">
              <span>Transkriptionsmodell</span>
              <select
                value={model}
                onChange={(event) =>
                  setModel(event.target.value as TranscriptionModel)
                }
                disabled={isListening || isTranscribing}
              >
                <option value="whisper-1">Whisper 1</option>
                <option value="gpt-4o-mini-transcribe">
                  GPT-4o mini Transcribe
                </option>
                <option value="gpt-4o-transcribe">
                  GPT-4o Transcribe
                </option>
              </select>
            </label>

            <label className="select-row">
              <span>Sprache</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                disabled={isListening || isTranscribing}
              >
                <option value="de-DE">Deutsch (DE)</option>
                <option value="de-AT">Deutsch (AT)</option>
                <option value="de-CH">Deutsch (CH)</option>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </select>
            </label>

            <div className="dictionary-box">
              <div className="dictionary-title">
                <span>Persönliches Wörterbuch</span>
                <button type="button" aria-label="Wort hinzufügen">+</button>
              </div>
              <div className="word-chips">
                <span>JackFlow</span>
                <span>SaaS</span>
                <span>No-Code</span>
                <span>Yako</span>
              </div>
            </div>

            <div className="privacy-note" id="privacy">
              <span aria-hidden>⌁</span>
              <p>
                <strong>Privacy first</strong>
                Audio wird zur Transkription sicher an OpenAI übertragen und von
                JackFlow nicht gespeichert.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="feature-section" id="features">
        <div className="feature-intro">
          <span className="eyebrow">Ein Werkzeug, viele Situationen</span>
          <h2>Deine Stimme passt sich deiner Arbeit an.</h2>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-card--yellow">
            <span className="feature-number">01</span>
            <div className="mini-document">
              <span />
              <span />
              <span />
              <span />
            </div>
            <h3>Sauber statt wortwörtlich</h3>
            <p>
              Füllwörter verschwinden. Sätze bekommen Struktur. Deine Stimme
              bleibt trotzdem deine.
            </p>
          </article>
          <article className="feature-card feature-card--lavender">
            <span className="feature-number">02</span>
            <div className="language-stack" aria-hidden>
              <span>Hallo</span>
              <span>Hello</span>
              <span>Salut</span>
            </div>
            <h3>Mehrsprachig denken</h3>
            <p>
              Wechsle zwischen Sprachen und Varianten, ohne deinen Arbeitsfluss
              zu unterbrechen.
            </p>
          </article>
          <article className="feature-card feature-card--green">
            <span className="feature-number">03</span>
            <div className="snippet-preview">
              <span>/termin</span>
              <p>Hier findest du meinen Kalender: jackflow.app/call</p>
            </div>
            <h3>Snippets, die Zeit sparen</h3>
            <p>
              Wiederkehrende Antworten, Links und Formulierungen liegen nur ein
              gesprochenes Stichwort entfernt.
            </p>
          </article>
        </div>
      </section>

      <section className="closing">
        <WaveMark />
        <h2>Weniger tippen.<br />Mehr ausdrücken.</h2>
        <p>Die erste JackFlow-Version ist bereit für deine nächsten Ideen.</p>
        <a className="primary-button primary-button--light" href="#studio">
          Jetzt ausprobieren <span>↑</span>
        </a>
      </section>

      <footer>
        <a className="brand brand--footer" href="#top">
          <WaveMark small />
          <span>JackFlow</span>
        </a>
        <p>Eine eigenständige Voice-to-Text-Produktoberfläche.</p>
        <span>Prototype · 2026</span>
      </footer>
    </main>
  );
}
