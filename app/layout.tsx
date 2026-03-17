import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk, Syne } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const bodyFont = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const displayFont = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Trench Cinema | HashCinema",
  description:
    "Turn recent Pump.fun memecoin trading into a cinematic AI trailer built from wallet personality, trench lore, and chaotic on-chain behavior.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${bodyFont.variable} ${monoFont.variable} ${displayFont.variable} antialiased`}
      >
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
