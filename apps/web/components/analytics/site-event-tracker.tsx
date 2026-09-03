"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type SiteEventTrackerProps = {
  googleEnabled: boolean;
  metaEnabled: boolean;
  googleAdsConversionId?: string;
};

function googleEvent(name: string, parameters: Record<string, unknown> = {}) {
  window.gtag?.("event", name, parameters);
}

function metaCustomEvent(name: string, parameters: Record<string, unknown> = {}) {
  window.fbq?.("trackCustom", name, parameters);
}

export function SiteEventTracker({
  googleEnabled,
  metaEnabled,
  googleAdsConversionId,
}: SiteEventTrackerProps) {
  const pathname = usePathname();

  useEffect(() => {
    const formStartKey = "csn_submit_show_started_at";
    const formCompleteKey = "csn_submit_show_completed";

    function handleInput(event: Event) {
      if (!(event.target instanceof Element)) return;
      const form = event.target.closest<HTMLFormElement>('[data-analytics-form="submit-show"]');
      if (!form || sessionStorage.getItem(formStartKey)) return;
      sessionStorage.setItem(formStartKey, String(Date.now()));
      sessionStorage.removeItem(formCompleteKey);
      googleEvent("submit_show_started", { source: pathname });
      metaCustomEvent("SubmitShowStarted", { source: pathname });
    }

    function handlePageHide() {
      const startedAt = Number(sessionStorage.getItem(formStartKey));
      if (!startedAt || sessionStorage.getItem(formCompleteKey)) return;
      const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      googleEvent("submit_show_abandoned", { source: pathname, seconds_in_form: seconds });
      metaCustomEvent("SubmitShowAbandoned", { source: pathname, seconds_in_form: seconds });
      sessionStorage.removeItem(formStartKey);
    }

    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;

      const taggedElement = event.target.closest<HTMLElement>("[data-analytics-event]");
      if (taggedElement?.dataset.analyticsEvent) {
        const eventName = taggedElement.dataset.analyticsEvent;
        const source = taggedElement.dataset.analyticsSource ?? pathname;
        googleEvent(eventName, { source });
        metaCustomEvent(eventName, { source });
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("/shows/")) {
        const showId = href.split("/")[2]?.split("?")[0];
        googleEvent("select_content", {
          content_type: "card_show",
          item_id: showId,
          source: pathname,
        });
        metaCustomEvent("SelectShow", { content_id: showId, source: pathname });
        return;
      }

      if (href.startsWith("/submit-show") && pathname !== "/submit-show") {
        googleEvent("submit_show_start", { source: pathname });
        metaCustomEvent("SubmitShowStart", { source: pathname });
        return;
      }

      if (href.startsWith("mailto:") || href.startsWith("tel:")) {
        googleEvent("contact", { method: href.startsWith("mailto:") ? "email" : "phone" });
        metaCustomEvent("Contact", { method: href.startsWith("mailto:") ? "email" : "phone" });
        return;
      }

      try {
        const destination = new URL(href, window.location.href);
        if (destination.origin !== window.location.origin) {
          googleEvent("outbound_click", {
            link_domain: destination.hostname,
            link_url: destination.href,
            source: pathname,
          });
          metaCustomEvent("OutboundClick", {
            link_domain: destination.hostname,
            source: pathname,
          });
        }
      } catch {
        // Ignore malformed or non-navigation href values.
      }
    }

    function handleSubmit(event: SubmitEvent) {
      if (!(event.target instanceof HTMLFormElement)) return;

      const form = event.target;
      const action = form.getAttribute("action") ?? "";
      if (action === "/card-shows") {
        const formData = new FormData(form);
        const hasTextQuery = Boolean(String(formData.get("q") ?? "").trim());
        const state = String(formData.get("state") ?? "").trim();
        const category = String(formData.get("category") ?? "").trim();
        googleEvent("search", {
          search_term: hasTextQuery ? "directory text search" : state || category || "all shows",
          state: state || undefined,
          category: category || undefined,
          free_only: formData.get("free") === "1",
        });
        window.fbq?.("track", "Search", {
          search_string: hasTextQuery ? "directory text search" : state || category || "all shows",
        });
      }

      const eventName = form.dataset.analyticsEvent;
      if (eventName) {
        if (eventName === "submit_show_attempt") {
          sessionStorage.removeItem("csn_submit_show_lead_ga");
          sessionStorage.removeItem("csn_submit_show_lead_meta");
        }
        googleEvent(eventName, { source: pathname });
        metaCustomEvent(eventName, { source: pathname });
      }
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("input", handleInput);
    document.addEventListener("submit", handleSubmit);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("input", handleInput);
      document.removeEventListener("submit", handleSubmit);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [pathname]);

  useEffect(() => {
    const showMatch = pathname.match(/^\/shows\/([^/]+)$/);
    const isLead = pathname === "/submit-show/thank-you";
    if (isLead) {
      sessionStorage.setItem("csn_submit_show_completed", "1");
      sessionStorage.removeItem("csn_submit_show_started_at");
    }
    let googleSent = !googleEnabled;
    let metaSent = !metaEnabled;

    const sendRouteEvents = () => {
      if (!googleSent && typeof window.gtag === "function") {
        if (showMatch) {
          window.gtag("event", "view_item", {
            currency: "USD",
            items: [{ item_id: showMatch[1], item_category: "card_show" }],
          });
        }
        if (isLead && !sessionStorage.getItem("csn_submit_show_lead_ga")) {
          window.gtag("event", "submit_show_completed", { source: "public_submission" });
          window.gtag("event", "generate_lead", { lead_source: "public_submission" });
          if (googleAdsConversionId) {
            window.gtag("event", "conversion", { send_to: googleAdsConversionId });
          }
          sessionStorage.setItem("csn_submit_show_lead_ga", "1");
        }
        googleSent = true;
      }

      if (!metaSent && typeof window.fbq === "function") {
        if (showMatch) {
          window.fbq("track", "ViewContent", {
            content_ids: [showMatch[1]],
            content_type: "product",
          });
        }
        if (isLead && !sessionStorage.getItem("csn_submit_show_lead_meta")) {
          window.fbq("trackCustom", "SubmitShowCompleted", { source: "public_submission" });
          window.fbq("track", "Lead", { content_name: "Public show submission" });
          sessionStorage.setItem("csn_submit_show_lead_meta", "1");
        }
        metaSent = true;
      }
    };

    sendRouteEvents();
    const retry = window.setInterval(sendRouteEvents, 200);
    const stopRetry = window.setTimeout(() => window.clearInterval(retry), 10_000);
    return () => {
      window.clearInterval(retry);
      window.clearTimeout(stopRetry);
    };
  }, [googleAdsConversionId, googleEnabled, metaEnabled, pathname]);

  return null;
}
