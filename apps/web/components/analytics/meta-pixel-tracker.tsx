"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function MetaPixelTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    let sent = false;

    const sendPageView = () => {
      if (sent || typeof window.fbq !== "function") return;

      sent = true;
      window.fbq("track", "PageView", {
        page_path: pagePath,
        page_location: window.location.href,
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
  }, [pathname, searchParams]);

  return null;
}
