import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "Reviva — The AI Front Desk Employee for Med Spas",
  description:
    "Reviva is an AI Front Desk Employee designed to speak with patients, respond to inquiries, and support med spa teams across text and voice.",
  applicationName: "Reviva",
  keywords: [
    "AI front desk",
    "AI employee",
    "voice AI",
    "med spa",
    "patient inquiries",
    "appointment booking",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Reviva — The AI Front Desk Employee for Med Spas",
    description:
      "A consistent AI Employee designed for patient conversations across text and voice.",
    type: "website",
    url: "/",
    siteName: "Reviva",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reviva — The AI Front Desk Employee for Med Spas",
    description:
      "A consistent AI Employee designed for patient conversations across text and voice.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
