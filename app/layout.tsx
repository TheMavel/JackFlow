import type { Metadata } from "next";
import jackflowIcon from "../images/jackflow-app-icon.png";
import jackflowSocialCard from "../images/jackflow-social-card.png";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "JackFlow – Sprich frei. Schreib klar.",
  description:
    "Eine eigenständige Voice-to-Text-App für klare Prompts, Nachrichten, Listen und E-Mails.",
  applicationName: "JackFlow",
  icons: {
    icon: [{ url: jackflowIcon.src, type: "image/png" }],
    apple: jackflowIcon.src,
  },
  openGraph: {
    title: "JackFlow – Sprich frei. Schreib klar.",
    description:
      "Sprich. JackFlow schreibt. Voice-to-Text für klare Prompts, Nachrichten, Listen und E-Mails.",
    type: "website",
    locale: "de_DE",
    images: [
      {
        url: jackflowSocialCard.src,
        width: 1672,
        height: 941,
        alt: "JackFlow – Sprich. JackFlow schreibt.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JackFlow – Sprich frei. Schreib klar.",
    description:
      "Sprich. JackFlow schreibt. Voice-to-Text für klare Prompts, Nachrichten, Listen und E-Mails.",
    images: [jackflowSocialCard.src],
  },
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
