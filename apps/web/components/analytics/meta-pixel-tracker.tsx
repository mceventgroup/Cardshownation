"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function MetaPixelTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const pageLocation = `${window.location.origin}${pathname}`;
    let sent = false;

    const sendPageView = () => {
      if (sent || typeof window.fbq !== "function") return;

      sent = true;
      window.fbq("track", "PageView", {
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
