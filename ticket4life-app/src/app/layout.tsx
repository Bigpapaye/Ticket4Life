import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { Web3Providers } from "@/providers/Web3Providers";
import { NavActions } from "@/components/NavActions";
import { MainNav } from "@/components/MainNav";
import { ToastProvider } from "@/lib/toast";
import { SyncProvider } from "@/components/SyncProvider";
import { EventProvider } from "@/components/EventProvider";
import { EnvGuard } from "@/components/EnvGuard";
import { BG_CREAM, BG_PANEL, BORDER, TEXT_PRIMARY } from "@/styles/theme";
import { APP } from "@/config/app";

const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Source_Code_Pro({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP.siteUrl || "http://localhost:3000"),
  title: {
    default: "Ticket4Life",
    template: "%s | Ticket4Life",
  },
  description: "Mint un ticket NFT, participe au quiz hebdomadaire et tente de gagner le prize money. Revends ton ticket quand tu veux.",
  openGraph: {
    title: "Ticket4Life",
    description: "Mint un ticket NFT, participe au quiz hebdomadaire et tente de gagner le prize money.",
    url: "/",
    siteName: "Ticket4Life",
    type: "website",
    images: [
      { url: "/globe.svg", width: 1200, height: 630, alt: "Ticket4Life" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ticket4Life",
    description: "Mint un ticket NFT, participe au quiz hebdomadaire et tente de gagner le prize money.",
    images: ["/globe.svg"],
  },
  icons: {
    icon: "/globe.svg",
    shortcut: "/globe.svg",
    apple: "/globe.svg",
  },
};

export const viewport = {
  themeColor: "#27E7C5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Web3Providers>
          <ToastProvider>
            <SyncProvider>
              <EventProvider>
              <div className="min-h-screen flex flex-col" style={{ backgroundColor: BG_CREAM }}>
              {/* Skip link for keyboard users */}
              <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:bg-black focus:text-white focus:px-3 focus:py-2 focus:rounded">
                Aller au contenu principal
              </a>
              <header role="banner" aria-label="En-tête Ticket4Life" style={{ backgroundColor: BG_CREAM }}>
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
                  <MainNav />
                  <div className="flex items-center gap-3">
                    <a
                      href="https://x.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] px-2 py-0.5 rounded-full border"
                      title="Compte X"
                      aria-label="Ouvrir le compte X dans un nouvel onglet"
                      style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}
                    >
                      X
                    </a>
                    <span
                      className="text-[12px] px-2 py-0.5 rounded-full border"
                      style={{ backgroundColor: BG_PANEL, color: TEXT_PRIMARY, borderColor: BORDER }}
                    >
                      Base Sepolia
                    </span>
                    <NavActions />
                  </div>
                </div>
              </header>
              {/* Environment and network guard */}
              <div className="mx-auto max-w-6xl px-4 mt-3">
                <EnvGuard />
              </div>
              <main id="content" className="flex-1" role="main">
                {children}
              </main>
              <footer className="border-t text-xs text-gray-500">
                <div className="mx-auto max-w-6xl px-4 py-4">© {new Date().getFullYear()} Ticket4Life</div>
              </footer>
              </div>
              </EventProvider>
            </SyncProvider>
          </ToastProvider>
        </Web3Providers>
      </body>
    </html>
  );
}
