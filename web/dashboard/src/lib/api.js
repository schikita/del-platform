async function readErrorText(res) {
  try {
    const txt = await res.text();
    return txt || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function apiGet(service, path) {
  const res = await fetch(`/api/proxy/${service}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await readErrorText(res));
  return await res.json();
}

export async function apiSend(service, path, method, payload) {
  const res = await fetch(`/api/proxy/${service}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : null,
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await readErrorText(res));
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await res.json();
  return await res.text();
}
