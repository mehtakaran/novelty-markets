import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Novelty Markets AI Assistant",
  description: "Trading desk prototype: discovery, compliance, pricing, and price monitoring for novelty betting markets.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="font-semibold text-sm tracking-tight">Novelty Markets AI Assistant</span>
              <nav className="flex gap-4 text-sm">
                <Link href="/" className="text-neutral-900 hover:underline underline-offset-2">
                  Review Queue
                </Link>
                <Link href="/monitoring" className="text-neutral-900 hover:underline underline-offset-2">
                  Live Markets
                </Link>
                <Link href="/audit" className="text-neutral-900 hover:underline underline-offset-2">
                  Audit Log
                </Link>
              </nav>
            </div>
            <a
              href="http://localhost:8233"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-900 underline underline-offset-2"
            >
              Temporal Web UI ↗
            </a>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
