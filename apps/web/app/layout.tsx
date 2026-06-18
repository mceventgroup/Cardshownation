import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Suspense } from "react";
import { GooglePageViewTracker } from "@/components/analytics/google-page-view-tracker";
import { MetaPixelTracker } from "@/components/analytics/meta-pixel-tracker";
import { AppChrome } from "@/components/layout/app-chrome";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() ?? "";
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com"
  ),
  openGraph: {
    siteName: "Card Show Nation",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL ?? "https://cardshownation.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <meta charSet="utf-8" />
        {GOOGLE_TAG_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
                GOOGLE_TAG_ID
              )}`}
              strategy="afterInteractive"
            />
            <Script id="google-tag-config" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                ${GA_MEASUREMENT_ID ? `gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });` : ""}
                ${GOOGLE_ADS_ID ? `gtag('config', '${GOOGLE_ADS_ID}');` : ""}
              `}
            </Script>
          </>
        )}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8982218628461022"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        {META_PIXEL_ID && (
          <Script id="meta-pixel-init" strategy="afterInteractive">
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
        <Suspense fallback={null}>
          {GOOGLE_TAG_ID && <GooglePageViewTracker />}
          {META_PIXEL_ID && <MetaPixelTracker />}
        </Suspense>
        {META_PIXEL_ID && (
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
      </body>
    </html>
  );
}
