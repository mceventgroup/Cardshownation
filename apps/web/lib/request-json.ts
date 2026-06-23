export class RequestTooLargeError extends Error {}

export async function readJsonBodyLimited<T>(request: Request, maxBytes: number): Promise<T> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestTooLargeError("Request body is too large.");
  if (!request.body) return JSON.parse(await request.text()) as T;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let json = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RequestTooLargeError("Request body is too large.");
    }
    json += decoder.decode(value, { stream: true });
  }
  return JSON.parse(json + decoder.decode()) as T;
}
