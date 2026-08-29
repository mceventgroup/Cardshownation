"use client";

import { useEffect, useState } from "react";

type Consent = "essential" | "optional";

export function CookieConsent({ initialConsent }: { initialConsent: Consent | null }) {
  const [visible, setVisible] = useState(initialConsent === null);
  const [hasSavedChoice, setHasSavedChoice] = useState(initialConsent !== null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!visible) {
    if (hasSavedChoice) return null;
    return <button type="button" onClick={() => setVisible(true)} className="fixed bottom-3 left-3 z-[90] rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow">Cookie settings</button>;
  }
  function choose(value: Consent) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `csn_cookie_consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    setHasSavedChoice(true);
    setVisible(false);
    if (value === "optional") window.location.reload();
  }
  return <div className="fixed inset-x-2 bottom-2 z-[100] mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-4 sm:bottom-4 sm:p-5" role="dialog" aria-label="Cookie choices">
    <p className="text-sm font-semibold text-slate-950 sm:text-base">Your privacy choices</p>
    <p className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">Essential cookies keep sign-in secure. Optional analytics help improve this free directory and stay off unless you allow them.</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
      <button type="button" disabled={!hydrated} onClick={() => choose("essential")} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:text-sm">Essential only</button>
      <button type="button" disabled={!hydrated} onClick={() => choose("optional")} className="rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:text-sm">Allow analytics</button>
    </div>
  </div>;
}
