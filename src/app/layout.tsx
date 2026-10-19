import "@fontsource-variable/inter";
import "@fontsource-variable/source-serif-4";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { CSSProperties } from "react";
import { siteDefaults } from "@/config/site";
import { appUrl } from "@/server/env";
import { getSettings } from "@/server/settings";

// Settings, prices and sessions are read per request (see docs/ARCHITECTURE.md §2).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(appUrl()),
    title: {
      default: `${s.brand.name}: Registered Agent & Texas LLC Formation`,
      template: `%s | ${s.brand.name}`,
    },
    description: s.brand.tagline,
    applicationName: s.brand.name,
    openGraph: { siteName: s.brand.name, type: "website", locale: "en_US" },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: siteDefaults.colors.primary,
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = (value: string, fallback: string) => (HEX.test(value) ? value : fallback);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const style = {
    "--brand-primary": safeColor(s.colors.primary, siteDefaults.colors.primary),
    "--brand-primary-hover": safeColor(s.colors.primaryHover, siteDefaults.colors.primaryHover),
    "--brand-accent": safeColor(s.colors.accent, siteDefaults.colors.accent),
  } as CSSProperties;

  return (
    <html lang="en" style={style}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow"
        >
          Skip to content
        </a>
        {children}
        {s.analytics.plausibleDomain ? (
          <Script defer data-domain={s.analytics.plausibleDomain} src={s.analytics.plausibleScriptUrl} strategy="afterInteractive" />
        ) : null}
      </body>
    </html>
  );
}
