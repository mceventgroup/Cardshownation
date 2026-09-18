"use client";

import { useRef, useState, useTransition } from "react";
import { FACEBOOK_MESSAGE_LIMIT, type FacebookRoundup, type RoundupRange } from "@/lib/facebook-roundups";
import type { FacebookPublishResult } from "@/lib/facebook-publishing";
import { publishFacebookRoundup } from "./actions";

type Draft = FacebookRoundup & { fingerprint: string };
type History = { state: string; status: string; postId: string | null; error: string | null; message: string };

export function FacebookComposer({ range, drafts, history, pageId, pageName, canPublish }: {
  range: RoundupRange; drafts: Draft[]; history: History[];
  pageId: string; pageName: string; canPublish: boolean;
}) {
  const [selected, setSelected] = useState("all");
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, FacebookPublishResult>>({});
  const [copyStatus, setCopyStatus] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const busy = useRef(false);
  const visible = drafts.filter((draft) => selected === "all" || draft.state === selected);

  function publish(draft: Draft, message: string) {
    if (busy.current) return;
    busy.current = true;
    setPublishing(draft.state);
    startTransition(async () => {
      try {
        const result = await publishFacebookRoundup({ ...range, state: draft.state, fingerprint: draft.fingerprint, message, pageId });
        setResults((current) => ({ ...current, [draft.state]: result }));
      } catch {
        setResults((current) => ({ ...current, [draft.state]: { ok: false, blocked: true, error: "The connection was interrupted. Refresh and check your Facebook Page before trying again." } }));
      } finally {
        busy.current = false;
        setPublishing(null);
      }
    });
  }

  async function copy(state: string, message: string) {
    try {
      await navigator.clipboard.writeText(message);
      setCopyStatus((current) => ({ ...current, [state]: "Copied!" }));
    } catch {
      setCopyStatus((current) => ({ ...current, [state]: "Select the post text and copy it manually." }));
    }
  }

  if (!drafts.length) return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No upcoming shows in this date range</h2>
      <p className="mt-2 text-sm text-slate-600">Try next week or choose different dates. States without eligible shows won’t generate a post.</p>
    </div>
  );

  return (
    <section aria-label="Facebook post previews">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{drafts.length} state {drafts.length === 1 ? "post" : "posts"} ready to review</h2>
          <p className="mt-1 text-sm text-slate-500">{drafts.reduce((sum, draft) => sum + draft.showCount, 0)} shows · One post per state · Edit before publishing</p>
        </div>
        <label className="text-sm font-medium text-slate-700">Show state
          <select value={selected} onChange={(event) => setSelected(event.target.value)} className="ml-3 rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="all">All states</option>
            {drafts.map((draft) => <option key={draft.state} value={draft.state}>{draft.stateName} ({draft.showCount})</option>)}
          </select>
        </label>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {visible.map((draft) => {
          const receipt = history.find((post) => post.state === draft.state);
          const result = results[draft.state];
          const publishedUrl = result?.ok ? result.url : receipt?.postId ? `https://www.facebook.com/${receipt.postId}` : null;
          const locked = Boolean(publishedUrl || (result && !result.ok && result.blocked) || (receipt && receipt.status !== "FAILED"));
          const message = locked && receipt ? receipt.message : messages[draft.state] ?? draft.message;
          const tooLong = message.length > FACEBOOK_MESSAGE_LIMIT;
          const error = result && !result.ok ? result.error : receipt?.error;
          return (
            <article key={draft.state} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">{draft.state}</span>
                  <div><h3 className="font-semibold text-slate-900">{draft.stateName}</h3><p className="text-xs text-slate-500">{draft.showCount} upcoming {draft.showCount === 1 ? "show" : "shows"}</p></div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${publishedUrl ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {publishedUrl ? "Published" : locked ? "Check status" : "Draft"}
                </span>
              </div>
              <div className="p-5">
                <label htmlFor={`post-${draft.state}`} className="mb-2 block text-xs font-semibold text-slate-500">Post text</label>
                <textarea id={`post-${draft.state}`} value={message} readOnly={locked || publishing === draft.state}
                  onChange={(event) => { setMessages((current) => ({ ...current, [draft.state]: event.target.value })); setCopyStatus((current) => ({ ...current, [draft.state]: "" })); }}
                  className="min-h-[360px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{message.length.toLocaleString()} characters</span>
                  {!locked && <button onClick={() => setMessages((current) => ({ ...current, [draft.state]: draft.message }))} disabled={Boolean(publishing)} className="font-medium text-brand-700 disabled:opacity-50">Reset text</button>}
                </div>
                {tooLong && <p role="alert" className="mt-3 text-sm text-red-700">Shorten this post to {FACEBOOK_MESSAGE_LIMIT.toLocaleString()} characters before publishing. You can also choose a smaller date range.</p>}
                <div aria-live="polite" className="mt-3 text-sm">
                  {publishedUrl ? <a href={publishedUrl} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 underline">Published — view on Facebook ↗</a>
                    : error ? <p className="text-red-700">{error}</p>
                    : locked ? <p className="text-amber-800">A previous publishing attempt is awaiting confirmation. Check your Page; automatic retry is disabled.</p> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => publish(draft, message)} disabled={!canPublish || locked || Boolean(publishing) || tooLong || !message.trim()}
                    className="rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
                    {publishing === draft.state ? "Publishing…" : publishedUrl ? "Published" : "Publish to Facebook"}
                  </button>
                  <button onClick={() => copy(draft.state, message)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Copy text</button>
                </div>
                <p className="mt-3 text-xs text-slate-500">{canPublish ? `Publishes immediately to ${pageName}.` : "Connect your Page to enable publishing."}</p>
                <p role="status" className="mt-2 text-xs text-slate-600">{copyStatus[draft.state]}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
