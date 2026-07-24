import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JackFlow – Sprich frei. Schreib klar.",
  description:
    "Eine eigenständige Voice-to-Text-App für klare Prompts, Nachrichten, Listen und E-Mails.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
