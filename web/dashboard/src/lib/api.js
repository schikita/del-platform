const BASE = "/api/proxy";

async function parseResponse(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return await res.text();
}

export async function apiGet(path) {
    const res = await fetch(`${BASE}${path}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Request failed");
    }

    return await parseResponse(res);
}

export async function apiPost(path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        cache: "no-store",
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Request failed");
    }

    return await parseResponse(res);
}
