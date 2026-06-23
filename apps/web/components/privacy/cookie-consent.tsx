"use client";

import { useState } from "react";

type Consent = "essential" | "optional";

export function CookieConsent({ initialConsent }: { initialConsent: Consent | null }) {
  const [visible, setVisible] = useState(initialConsent === null);
  if (!visible) return <button type="button" onClick={() => setVisible(true)} className="fixed bottom-3 left-3 z-[90] rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow">Cookie settings</button>;
  function choose(value: Consent) {
    document.cookie = `csn_cookie_consent=${value}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
    setVisible(false);
    if (value === "optional") window.location.reload();
  }
  return <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl" role="dialog" aria-label="Cookie choices">
    <p className="font-semibold text-slate-950">Your privacy choices</p>
    <p className="mt-2 text-sm leading-6 text-slate-600">Essential cookies keep accounts secure. Optional analytics and advertising stay off unless you accept them.</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={() => choose("essential")} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Essential only</button>
      <button type="button" onClick={() => choose("optional")} className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Accept optional</button>
    </div>
  </div>;
}
