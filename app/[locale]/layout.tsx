import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { SerwistProvider } from "@serwist/turbopack/react";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeScript } from "@/components/layout/theme-script";
import { InstallCaptureScript } from "@/components/pwa/install-capture-script";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { UpdateNotice } from "@/components/pwa/update-notice";
import { resolveLocale } from "@/i18n/locale-param";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  preload: false, // only used for the formula on /how-we-rank, so do not delay every page for it
  subsets: ["latin"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1620" },
  ],
};

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: t("title"),
    description: t("description"),
    applicationName: "FreerideAtlas",
    appleWebApp: {
      capable: true,
      title: "FreerideAtlas",
      statusBarStyle: "default",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("Nav");

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <ThemeScript />
        <InstallCaptureScript />
      </head>
      <body className="flex min-h-full flex-col">
        {/* No service worker in development: it would cache pages while they are being edited. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          // Never reload by itself when the connection returns: it would wipe a half-done quiz or checklist.
          reloadOnOnline={false}
        >
          <NextIntlClientProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
            >
              {t("skipToContent")}
            </a>
            <OfflineBanner />
            <UpdateNotice />
            <SiteHeader />
            <main
              id="main"
              className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"
            >
              {children}
            </main>
            <SiteFooter />
          </NextIntlClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
