import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { GooglePageViewTracker } from "@/components/analytics/google-page-view-tracker";
import { MetaPixelTracker } from "@/components/analytics/meta-pixel-tracker";
import { SiteEventTracker } from "@/components/analytics/site-event-tracker";
import { AppChrome } from "@/components/layout/app-chrome";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import "./globals.css";
import { CookieConsent } from "@/components/privacy/cookie-consent";
import { isPrivateBrowserRoute } from "@/lib/private-routes";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "G-R66Z8VG1CC";
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";
const GOOGLE_ADS_CONVERSION_LABEL =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_CONVERSION_LABEL?.trim() ?? "";
const GOOGLE_TAG_ID = GA_MEASUREMENT_ID || GOOGLE_ADS_ID;
const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "1680224933357763";

export const metadata: Metadata = {
  title: {
    default: "Card Show Nation | Card Show Directory",
    template: "%s | Card Show Nation",
  },
  description:
    "The national card show directory. Find upcoming sports card, Pokemon, and TCG shows by state, city, and date.",
  icons: {
    icon: "/csn-brand-mark.png",
    apple: "/csn-brand-mark.png",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com"
  ),
  openGraph: {
    siteName: "Card Show Nation",
    type: "website",
    title: "Card Show Nation | Card Show Directory",
    description: "Find upcoming sports card, Pokemon, and TCG shows by state, city, and date.",
    locale: "en_US",
    images: [{ url: "/cardshow_hero.webp", alt: "Collectors browsing a card show" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Card Show Nation | Card Show Directory",
    description: "Find upcoming sports card, Pokemon, and TCG shows by state, city, and date.",
    images: ["/cardshow_hero.webp"],
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION?.trim()
    ? { google: process.env.GOOGLE_SITE_VERIFICATION.trim() }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const consentValue = cookieStore.get("csn_cookie_consent")?.value;
  const consent = consentValue === "optional" || consentValue === "essential" ? consentValue : null;
  const globalPrivacyControl = requestHeaders.get("sec-gpc") === "1";
  const pathname = requestHeaders.get("x-csn-pathname") ?? "/";
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const hasAuthenticatedSession = [
    "csn_admin",
    "csn_moderator",
    "csn_promoter",
    "csn_user",
  ].some((cookieName) => cookieStore.has(cookieName));
  const allowOptional =
    consent === "optional" &&
    !globalPrivacyControl &&
    !hasAuthenticatedSession &&
    !isPrivateBrowserRoute(pathname);
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta charSet="utf-8" />
        {allowOptional && GOOGLE_TAG_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
                GOOGLE_TAG_ID
              )}`}
              strategy="afterInteractive"
              nonce={nonce}
            />
            <Script id="google-tag-config" strategy="afterInteractive" nonce={nonce}>
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('set', {
                  cookie_expires: 15552000,
                  cookie_update: false,
                  allow_google_signals: false,
                  allow_ad_personalization_signals: false
                });
                ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });` : ""}
                ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}', { allow_ad_personalization_signals: false });` : ""}
              `}
            </Script>
          </>
        )}
        {allowOptional && <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8982218628461022"
          strategy="afterInteractive"
          crossOrigin="anonymous"
          nonce={nonce}
        />}
        {allowOptional && META_PIXEL_ID && (
          <Script id="meta-pixel-init" strategy="afterInteractive" nonce={nonce}>
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${META_PIXEL_ID}');
            `}
          </Script>
        )}
      </head>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-950 antialiased">
        <a href="#main-content" className="fixed left-4 top-3 z-[120] -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0">
          Skip to main content
        </a>
        <Suspense fallback={null}>
          {allowOptional && GOOGLE_TAG_ID && <GooglePageViewTracker />}
          {allowOptional && META_PIXEL_ID && <MetaPixelTracker />}
          {allowOptional && (GOOGLE_TAG_ID || META_PIXEL_ID) && (
            <SiteEventTracker
              googleEnabled={Boolean(GOOGLE_TAG_ID)}
              metaEnabled={Boolean(META_PIXEL_ID)}
              googleAdsConversionId={
                GOOGLE_ADS_ID && GOOGLE_ADS_CONVERSION_LABEL
                  ? `${GOOGLE_ADS_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`
                  : undefined
              }
            />
          )}
        </Suspense>
        {allowOptional && META_PIXEL_ID && (
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${encodeURIComponent(
                META_PIXEL_ID
              )}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        <AppChrome header={<Header />} footer={<Footer />}>
          {children}
        </AppChrome>
        <CookieConsent initialConsent={consent} globalPrivacyControl={globalPrivacyControl} />
        {allowOptional && <Analytics />}
      </body>
    </html>
  );
}
