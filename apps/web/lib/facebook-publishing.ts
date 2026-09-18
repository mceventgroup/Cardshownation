import { FacebookRequestError } from "@/lib/facebook-client";

export type FacebookPublishResult =
  | { ok: true; url: string }
  | { ok: false; error: string; blocked: boolean };

export type FacebookPublishStore = {
  reserve(): Promise<boolean>;
  published(postId: string): Promise<void>;
  failed(status: "FAILED" | "UNKNOWN", error: string): Promise<void>;
};

// A durable unique reservation precedes the network write. Never automatically
// retry an ambiguous response: Facebook may already have created the post.
export async function publishReservedFacebookPost(
  store: FacebookPublishStore,
  publish: () => Promise<{ id: string; url: string }>,
): Promise<FacebookPublishResult> {
  if (!await store.reserve()) return { ok: false, blocked: true, error: "This state and date range has already been published or is awaiting confirmation. Refresh to see its status." };
  let post: { id: string; url: string };
  try {
    post = await publish();
  } catch (error) {
    const uncertain = !(error instanceof FacebookRequestError) || error.uncertain;
    const message = error instanceof FacebookRequestError ? error.message : "Publishing could not be confirmed. Check your Facebook Page.";
    try { await store.failed(uncertain ? "UNKNOWN" : "FAILED", message); } catch {
      return { ok: false, blocked: true, error: "Publishing status could not be saved. Check your Facebook Page before trying again." };
    }
    return { ok: false, blocked: uncertain, error: message };
  }
  try { await store.published(post.id); } catch {
    // The original reservation stays locked even when storing the receipt fails.
    return { ok: true, url: post.url };
  }
  return { ok: true, url: post.url };
}
