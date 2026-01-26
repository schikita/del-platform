import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SERVICE_MAP = {
  analytics: process.env.ANALYTICS_URL || "http://analytics:8004",
  orders: process.env.ORDERS_URL || "http://orders:8001",
  couriers: process.env.COURIERS_URL || "http://couriers:8002",
  dispatcher: process.env.DISPATCHER_URL || "http://dispatcher:8003",
};

function getTargetBase(service) {
  return SERVICE_MAP[service] || null;
}

async function proxyHandler(req, { params }) {
  const service = params?.service;
  const pathParts = params?.path || [];
  const targetBase = getTargetBase(service);

  if (!targetBase) {
    return NextResponse.json({ detail: `Unknown service: ${service}` }, { status: 400 });
  }

  const upstreamUrl = new URL(pathParts.join("/"), targetBase);
  const srcUrl = new URL(req.url);

  // пробрасываем query-string
  srcUrl.searchParams.forEach((v, k) => upstreamUrl.searchParams.set(k, v));

  const headers = new Headers(req.headers);
  headers.set("X-Internal-Token", process.env.INTERNAL_TOKEN || "");
  headers.delete("host");

  const init = {
    method: req.method,
    headers,
    cache: "no-store",
  };

  // тело только если метод не GET/HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const resp = await fetch(upstreamUrl.toString(), init);

  const outHeaders = new Headers(resp.headers);

  // Иногда upstream может отдавать hop-by-hop заголовки
  outHeaders.delete("connection");
  outHeaders.delete("keep-alive");
  outHeaders.delete("transfer-encoding");

  return new NextResponse(resp.body, { status: resp.status, headers: outHeaders });
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
export const OPTIONS = proxyHandler;
