const BASE = process.env.NEXT_PUBLIC_ANALYTICS_URL || "http://localhost:8004";

export async function apiGet(path) {
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
        },
        cache: "no-store"
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Request failed");
    }

    return await res.json();
}
