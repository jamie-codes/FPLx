import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter, Geist_Mono, Honk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PushServiceWorkerRegistrar } from '@/components/push/PushServiceWorkerRegistrar'

// UIX-01: Inter is the app face (wired to --font-sans in globals.css @theme).
// Variable font — no weight needed. Geist Mono stays for font-mono surfaces;
// Honk stays for the brand mark until the shell lands (UIX-01 Task 5).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const honk = Honk({
  variable: "--font-honk",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: "FPLx: The advanced FPL model",
  description: "Fantasy Premier League transfer intelligence — Gem ratings, DefCon analysis, and multi-GW planner.",
};

const themeInitScript = `(function(){var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark')}})();`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} ${honk.variable} h-full antialiased`}
    >
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <PushServiceWorkerRegistrar />
      </body>
    </html>
  );
}
