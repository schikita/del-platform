import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SERVICE_MAP = {
  analytics: process.env.ANALYTICS_URL || "http://analytics:8004",
  orders: process.env.ORDERS_URL || "http://orders:8001",
  couriers: process.env.COURIERS_URL || "http://couriers:8002",
  dispatcher: process.env.DISPATCHER_URL || "http://dispatcher:8003",
};

function resolveTarget(parts) {
  const safeParts = Array.isArray(parts) ? parts.filter(Boolean) : [];

  if (!safeParts.length) {
    return { service: "analytics", rest: [] };
  }

  const first = safeParts[0];

  // формат: /api/proxy/analytics/kpi
  if (SERVICE_MAP[first]) {
    return { service: first, rest: safeParts.slice(1) };
  }

  // fallback: /api/proxy/kpi => analytics/kpi
  return { service: "analytics", rest: safeParts };
}

async function handler(req, { params }) {
  const parts = params?.path || [];
  const { service, rest } = resolveTarget(parts);

  const targetBase = SERVICE_MAP[service];
  if (!targetBase) {
    return NextResponse.json({ detail: `Unknown service: ${service}` }, { status: 400 });
  }

  const upstreamUrl = new URL(rest.join("/"), targetBase);
  const srcUrl = new URL(req.url);

  // query-string
  srcUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

  const headers = new Headers(req.headers);
  headers.set("X-Internal-Token", process.env.INTERNAL_TOKEN || "");
  headers.delete("host");

  const init = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const resp = await fetch(upstreamUrl.toString(), init);

  const outHeaders = new Headers(resp.headers);
  outHeaders.delete("connection");
  outHeaders.delete("keep-alive");
  outHeaders.delete("transfer-encoding");

  return new NextResponse(resp.body, { status: resp.status, headers: outHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
