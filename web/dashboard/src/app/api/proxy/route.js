export async function GET(req, ctx) {
    return proxy(req, ctx);
}

export async function POST(req, ctx) {
    return proxy(req, ctx);
}

async function proxy(req, ctx) {
    const analyticsBase = process.env.ANALYTICS_URL || "http://analytics:8004";
    const token = process.env.INTERNAL_TOKEN || "";

    const path = (ctx.params.path || []).join("/");
    const url = new URL(req.url);
    const target = `${analyticsBase}/${path}${url.search}`;

    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.set("X-Internal-Token", token);

    const init = {
        method: req.method,
        headers,
        cache: "no-store",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = await req.arrayBuffer();
    }

    const upstream = await fetch(target, init);

    return new Response(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
    });
}
