import { NextResponse } from "next/server";

const SERVICE_MAP = {
  analytics: process.env.ANALYTICS_URL || "http://analytics:8004",
  orders: process.env.ORDERS_URL || "http://orders:8001",
  couriers: process.env.COURIERS_URL || "http://couriers:8002",
  dispatcher: process.env.DISPATCHER_URL || "http://dispatcher:8003",
};

function getTargetBase(service) {
  return SERVICE_MAP[service] || null;
}

async function handler(req, ctx) {
  const service = ctx?.params?.service;
  const pathParts = ctx?.params?.path || [];
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

  // отдаём тело как есть
  const outHeaders = new Headers(resp.headers);
  return new NextResponse(resp.body, { status: resp.status, headers: outHeaders });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
