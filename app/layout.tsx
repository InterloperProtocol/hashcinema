import type { Metadata, Viewport } from "next";
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
  title: "HashCinema | Multichain Memecoin Video Generator",
  description:
    "Generate low-cost cinematic videos for one memecoin at a time across Solana, Ethereum, BNB Chain, and Base.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`site-body ${bodyFont.variable} ${monoFont.variable} ${displayFont.variable} antialiased`}
      >
        <SiteHeader />
        <div className="site-content">{children}</div>
      </body>
    </html>
  );
}
