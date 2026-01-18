import json
import time
from starlette.applications import Starlette
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route
from starlette.requests import Request
from starlette.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.config import get_settings
from app.db import Database
from app.metrics import ORDERS_CREATED, HTTP_LATENCY, ACTIVE_ORDERS

import redis.asyncio as redis


settings = get_settings()
db = Database(settings["database_url"])
redis_client = None


def _auth_ok(request):
    token = request.headers.get("X-Internal-Token", "")
    return token and token == settings["internal_token"]


async def health(request):
    return JSONResponse({"status": "ok", "service": settings["app_name"]})


async def metrics(request):
    data = generate_latest()
    return PlainTextResponse(data, media_type=CONTENT_TYPE_LATEST)


async def create_order(request):
    start = time.time()
    try:
        if not _auth_ok(request):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        payload = await request.json()
        customer_name = (payload.get("customer_name") or "").strip()
        address = (payload.get("address") or "").strip()
        phone = (payload.get("phone") or "").strip()
        items = payload.get("items") or []

        if not customer_name or not address or not phone:
            return JSONResponse({"detail": "customer_name/address/phone are required"}, status_code=400)

        items_json = json.dumps(items, ensure_ascii=False)
        status = "NEW"

        row = await db.fetchrow(
            """
            INSERT INTO orders(customer_name, address, phone, items_json, status)
            VALUES($1, $2, $3, $4, $5)
            RETURNING id::text, created_at
            """,
            customer_name,
            address,
            phone,
            items_json,
            status,
        )

        ORDERS_CREATED.inc()

        # Пушим событие в Redis Stream, чтобы диспетчер назначил курьера
        await redis_client.xadd(
            "orders:new",
            {"order_id": row["id"]},
            maxlen=5000,
            approximate=True,
        )

        await _refresh_active_orders_gauge()

        return JSONResponse(
            {"id": row["id"], "status": status, "created_at": row["created_at"].isoformat()},
            status_code=201,
        )
    finally:
        HTTP_LATENCY.observe(time.time() - start)


async def list_orders(request):
    start = time.time()
    try:
        if not _auth_ok(request):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        status = (request.query_params.get("status") or "").strip()
        limit = int(request.query_params.get("limit") or "50")

        if limit < 1:
            limit = 1
        if limit > 200:
            limit = 200

        if status:
            rows = await db.fetch(
                """
                SELECT id::text, customer_name, address, phone, items_json, status,
                       COALESCE(assigned_courier_id::text, '') AS assigned_courier_id,
                       created_at, updated_at
                FROM orders
                WHERE status = $1
                ORDER BY created_at DESC
                LIMIT $2
                """,
                status,
                limit,
            )
        else:
            rows = await db.fetch(
                """
                SELECT id::text, customer_name, address, phone, items_json, status,
                       COALESCE(assigned_courier_id::text, '') AS assigned_courier_id,
                       created_at, updated_at
                FROM orders
                ORDER BY created_at DESC
                LIMIT $1
                """,
                limit,
            )

        result = []
        for r in rows:
            result.append(
                {
                    "id": r["id"],
                    "customer_name": r["customer_name"],
                    "address": r["address"],
                    "phone": r["phone"],
                    "items": json.loads(r["items_json"]),
                    "status": r["status"],
                    "assigned_courier_id": r["assigned_courier_id"] or None,
                    "created_at": r["created_at"].isoformat(),
                    "updated_at": r["updated_at"].isoformat(),
                }
            )

        return JSONResponse({"orders": result})
    finally:
        HTTP_LATENCY.observe(time.time() - start)


async def _refresh_active_orders_gauge():
    row = await db.fetchrow(
        """
        SELECT COUNT(*) AS c
        FROM orders
        WHERE status IN ('NEW', 'ASSIGNED')
        """
    )
    ACTIVE_ORDERS.set(int(row["c"]))


async def on_startup():
    global redis_client
    await db.connect()
    redis_client = redis.from_url(settings["redis_url"])
    await _refresh_active_orders_gauge()


async def on_shutdown():
    if redis_client:
        await redis_client.close()
    await db.close()


routes = [
    Route("/health", health, methods=["GET"]),
    Route("/metrics", metrics, methods=["GET"]),
    Route("/orders", create_order, methods=["POST"]),
    Route("/orders", list_orders, methods=["GET"]),
]

app = Starlette(routes=routes, on_startup=[on_startup], on_shutdown=[on_shutdown])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings["port"])
