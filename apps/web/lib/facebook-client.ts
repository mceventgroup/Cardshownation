export type FacebookConfig = { pageId: string; accessToken: string; apiVersion: string };

export class FacebookRequestError extends Error {
  constructor(message: string, public readonly uncertain = false) { super(message); }
}

export function createFacebookClient(config: FacebookConfig, request: typeof fetch = fetch) {
  if (!/^\d+$/.test(config.pageId) || !/^v\d+\.0$/.test(config.apiVersion) || !config.accessToken.trim()) {
    throw new FacebookRequestError("Facebook Page settings are incomplete or invalid.");
  }
  async function graph(path: string, body?: URLSearchParams): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await request(`https://graph.facebook.com/${config.apiVersion}/${path}`, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${config.accessToken}` },
        body, cache: "no-store", signal: AbortSignal.timeout(20_000), redirect: "error",
      });
    } catch {
      throw new FacebookRequestError(body
        ? "Facebook did not confirm the result. Check your Page before trying again."
        : "Could not reach Facebook. Try checking the connection again.", Boolean(body));
    }
    let result: Record<string, unknown>;
    try { result = await response.json(); } catch {
      throw new FacebookRequestError("Facebook returned an unreadable response. Check your Page before trying again.", Boolean(body));
    }
    if (!result || typeof result !== "object") {
      throw new FacebookRequestError("Facebook returned an unexpected response. Check your Page before trying again.", Boolean(body));
    }
    if (!response.ok || result.error) {
      const code = (result.error as { code?: number } | undefined)?.code;
      // Do not expose raw Meta responses: they can contain credential or request details.
      const message = code === 190 ? "The Facebook Page token expired or is invalid. Update the Page connection."
        : code === 10 || code === 200 ? "Facebook denied publishing access. Check the Page token and Page posting permissions."
        : response.status === 429 || code === 4 || code === 32 || code === 613 ? "Facebook is limiting requests. Wait before trying again."
        : "Facebook rejected the request. Check the Page connection and posting permissions.";
      throw new FacebookRequestError(message, Boolean(body) && response.status >= 500);
    }
    return result;
  }
  return {
    async getPage() {
      const page = await graph("me?fields=id,name");
      if (page.id !== config.pageId || typeof page.name !== "string") {
        throw new FacebookRequestError("This token does not belong to the configured Facebook Page. Use that Page's access token.");
      }
      return { id: config.pageId, name: page.name };
    },
    async publish(message: string) {
      const post = await graph(`${config.pageId}/feed`, new URLSearchParams({ message }));
      if (typeof post.id !== "string" || !/^\d+_\d+$/.test(post.id)) {
        throw new FacebookRequestError("Facebook did not return a post ID. Check your Page before trying again.", true);
      }
      return { id: post.id, url: `https://www.facebook.com/${post.id}` };
    },
  };
}
