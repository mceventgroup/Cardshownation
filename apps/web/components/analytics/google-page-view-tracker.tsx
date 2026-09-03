"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function GooglePageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const pageLocation = `${window.location.origin}${pathname}`;
    let sent = false;

    const sendPageView = () => {
      if (sent || typeof window.gtag !== "function") return;

      sent = true;
      window.gtag("event", "page_view", {
        page_path: pathname,
        page_location: pageLocation,
        page_title: document.title,
      });
    };

    sendPageView();
    const retry = window.setInterval(sendPageView, 200);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 10_000);

    return () => {
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
    };
  }, [pathname]);

  return null;
}
