export const dynamic = "force-dynamic";

const SERVICE_ENV_MAP = {
  analytics: "ANALYTICS_URL",
  orders: "ORDERS_URL",
  couriers: "COURIERS_URL",
  dispatcher: "DISPATCHER_URL",
};

function getBaseUrl(service) {
  const envName = SERVICE_ENV_MAP[service];
  if (!envName) return null;
  return process.env[envName] || null;
}

function buildTargetUrl(baseUrl, pathParts, searchParams) {
  const base = baseUrl.replace(/\/+$/, "");
  const path = (pathParts || []).join("/");
  const url = new URL(`${base}/${path}`);

  for (const [k, v] of searchParams.entries()) {
    url.searchParams.append(k, v);
  }
  return url.toString();
}

async function forward(req, ctx) {
  const { service, path } = await ctx.params;

  const baseUrl = getBaseUrl(service);
  if (!baseUrl) {
    return new Response(JSON.stringify({ detail: `Unknown service: ${service}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const internalToken = process.env.INTERNAL_TOKEN || "";
  if (!internalToken) {
    return new Response(JSON.stringify({ detail: "INTERNAL_TOKEN is not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const reqUrl = new URL(req.url);
  const targetUrl = buildTargetUrl(baseUrl, path, reqUrl.searchParams);

  const headers = new Headers(req.headers);
  headers.set("X-Internal-Token", internalToken);

  // Важно: нельзя прокидывать Host, иначе некоторые апстримы ломаются
  headers.delete("host");

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);

  let body = null;
  if (hasBody) {
    body = await req.arrayBuffer();
  }

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: "manual",
    cache: "no-store",
  });

  const respHeaders = new Headers(upstream.headers);

  // На всякий случай: чтобы браузер не кешировал
  respHeaders.set("Cache-Control", "no-store");

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export async function GET(req, ctx) {
  return forward(req, ctx);
}
export async function POST(req, ctx) {
  return forward(req, ctx);
}
export async function PATCH(req, ctx) {
  return forward(req, ctx);
}
export async function PUT(req, ctx) {
  return forward(req, ctx);
}
export async function DELETE(req, ctx) {
  return forward(req, ctx);
}
export async function OPTIONS(req, ctx) {
  return forward(req, ctx);
}
