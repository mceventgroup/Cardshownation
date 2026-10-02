export const dynamic = "force-dynamic";

// Liveness only. Database readiness remains at /api/health.
export async function GET() {
  return Response.json({ status: "ok", service: "card-show-nation", timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
