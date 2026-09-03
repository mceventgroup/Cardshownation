import { NextRequest, NextResponse } from "next/server";
import { FLYER_MAX_SIZE_BYTES, isAcceptedFlyerFile } from "@/lib/flyer-spec";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request-ip";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit("flyer-extract", getRequestIp(request.headers) ?? "unknown", { maxAttempts: 10, windowMs: 24 * 60 * 60 * 1000, blockMs: 24 * 60 * 60 * 1000 });
  if (!rateLimit.allowed) return NextResponse.json({ error: "Automatic flyer reading has reached today’s limit. Your flyer will still upload." }, { status: 429 });
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "Automatic reading is temporarily unavailable. Your flyer will still upload." }, { status: 503 });
  const formData = await request.formData();
  const file = formData.get("flyer");
  if (!(file instanceof File) || !isAcceptedFlyerFile(file) || !file.size || file.size > FLYER_MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Choose a JPG, PNG, or WebP flyer under 2 MB." }, { status: 400 });
  }
  const dataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_FLYER_MODEL?.trim() || "gpt-4o",
      store: false,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Read this card-show flyer. Return only the requested fields. Dates must be YYYY-MM-DD, times must be h:mm AM/PM rounded to the nearest half hour, state must be a 2-letter US code, and unknown values must be empty strings. Do not guess." },
        { type: "input_image", image_url: dataUrl },
      ] }],
      text: { format: { type: "json_schema", name: "flyer_details", strict: true, schema: {
        type: "object",
        properties: Object.fromEntries(["showName", "startDate", "endDate", "startTimeLabel", "endTimeLabel", "venueName", "venueAddress", "city", "state", "admissionPrice", "websiteUrl"].map((key) => [key, { type: "string" }])),
        required: ["showName", "startDate", "endDate", "startTimeLabel", "endTimeLabel", "venueName", "venueAddress", "city", "state", "admissionPrice", "websiteUrl"],
        additionalProperties: false,
      } } },
      max_output_tokens: 500,
    }),
  });
  if (!response.ok) return NextResponse.json({ error: "We could not read this flyer. You can still enter the details normally." }, { status: 502 });
  const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = result.output_text ?? result.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("") ?? "";
  try {
    const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return NextResponse.json({ details: JSON.parse(jsonText) });
  } catch {
    return NextResponse.json({ error: "We could not confidently read this flyer. You can still enter the details normally." }, { status: 422 });
  }
}
