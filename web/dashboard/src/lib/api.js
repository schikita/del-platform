const DEFAULT_SERVICE = "analytics";

function normalizePath(path) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function buildProxyUrl(service, path) {
  const svc = (service || DEFAULT_SERVICE).trim();
  const p = normalizePath(path);

  if (!svc) throw new Error("Service is empty");
  return `/api/proxy/${encodeURIComponent(svc)}${p}`;
}

async function readError(res) {
  const ct = res.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (data && typeof data === "object") {
      return JSON.stringify(data);
    }
  }

  return await res.text().catch(() => "");
}

async function requestJson(service, path, method, payload, query) {
  const url = new URL(buildProxyUrl(service, path), "http://localhost");

  if (query && typeof query === "object") {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      url.searchParams.set(k, String(v));
    });
  }

  const init = {
    method,
    headers: {},
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload || {});
  }

  const res = await fetch(url.pathname + url.search, init);

  if (!res.ok) {
    const txt = await readError(res);
    throw new Error(txt || `Request failed: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return null;

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;

  return await res.json();
}

/**
 * Универсальная отправка:
 * apiSend("orders", "/orders", "POST", {...})
 * apiSend("couriers", "/couriers/123", "PATCH", {...})
 */
export async function apiSend(service, path, method, payload, query) {
  return requestJson(service, path, method, payload, query);
}

/**
 * Перегрузка:
 * 1) apiGet("/kpi")
 * 2) apiGet("analytics", "/orders/recent")
 */
export async function apiGet(a, b, c) {
  // Вариант: apiGet("/kpi", {limit: 10})
  if (typeof a === "string" && a.startsWith("/")) {
    const path = a;
    const query = b && typeof b === "object" ? b : null;
    return requestJson(DEFAULT_SERVICE, path, "GET", null, query);
  }

  // Вариант: apiGet("analytics", "/orders/recent", {limit: 10})
  const service = a;
  const path = b;
  const query = c && typeof c === "object" ? c : null;
  return requestJson(service, path, "GET", null, query);
}

/**
 * Для dashboard-кнопок демо:
 * apiPost("/demo/orders", {})
 */
export async function apiPost(path, payload, query) {
  return requestJson(DEFAULT_SERVICE, path, "POST", payload, query);
}
