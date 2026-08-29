import { register } from "@/lib/metrics";

export async function GET() {
  try {
    const metricsData = await register.metrics();
    return new Response(metricsData, {
      status: 200,
      headers: {
        "Content-Type": register.contentType,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Failed to generate Prometheus metrics:", error?.stack || error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
