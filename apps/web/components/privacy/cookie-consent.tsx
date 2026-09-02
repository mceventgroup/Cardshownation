"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Consent = "essential" | "optional";

export function CookieConsent({ initialConsent, globalPrivacyControl }: { initialConsent: Consent | null; globalPrivacyControl: boolean }) {
  const [visible, setVisible] = useState(initialConsent === null);
  const [hydrated, setHydrated] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!visible) {
    return <button ref={settingsButtonRef} type="button" aria-haspopup="dialog" aria-controls="cookie-preferences-dialog" onClick={() => { setVisible(true); window.requestAnimationFrame(() => dialogRef.current?.focus()); }} className="fixed bottom-3 left-3 z-[90] rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow hover:bg-slate-50">Cookie settings</button>;
  }
  function closePanel() {
    setVisible(false);
    window.requestAnimationFrame(() => settingsButtonRef.current?.focus());
  }
  function choose(value: Consent) {
    if (value === "optional" && globalPrivacyControl) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `csn_cookie_consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    closePanel();
    if (initialConsent !== null || value === "optional") window.location.reload();
  }
  return <div id="cookie-preferences-dialog" ref={dialogRef} tabIndex={-1} onKeyDown={(event) => { if (event.key === "Escape") closePanel(); }} className="fixed inset-x-2 bottom-2 z-[100] mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-4 sm:bottom-4 sm:p-5" role="dialog" aria-labelledby="cookie-dialog-title" aria-describedby="cookie-dialog-description">
    <div className="flex items-start justify-between gap-4">
      <p id="cookie-dialog-title" className="text-sm font-semibold text-slate-950 sm:text-base">Your privacy choices</p>
      <button type="button" onClick={closePanel} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Close</button>
    </div>
    <p id="cookie-dialog-description" className="mt-1.5 text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">Essential cookies keep sign-in and requested features secure. Optional analytics and advertising stay off unless you allow them. Read our <Link href="/cookies" className="font-semibold text-brand-700 underline-offset-4 hover:underline">Cookie Policy</Link>.</p>
    {globalPrivacyControl && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium leading-5 text-emerald-800" role="status">Global Privacy Control is active. Optional analytics and advertising are disabled for this browser.</p>}
    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
      <button type="button" disabled={!hydrated} onClick={() => choose("essential")} className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:text-sm">Essential only</button>
      <button type="button" disabled={!hydrated || globalPrivacyControl} onClick={() => choose("optional")} className="rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm">Allow optional cookies</button>
    </div>
  </div>;
}
