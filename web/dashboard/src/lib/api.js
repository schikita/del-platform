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
    if (data && typeof data === "object") return JSON.stringify(data);
  }
  return await res.text().catch(() => "");
}

export async function proxyGet(service, path) {
  const url = buildProxyUrl(service, path);

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await readError(res);
    throw new Error(txt || `Request failed: ${res.status}`);
  }

  return await res.json();
}

export async function proxyPost(service, path, payload) {
  const url = buildProxyUrl(service, path);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await readError(res);
    throw new Error(txt || `Request failed: ${res.status}`);
  }

  return await res.json();
}
