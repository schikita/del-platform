import asyncio

import redis.asyncio as redis
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

from starlette.responses import Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.config import get_settings
from app.db import Database


settings = get_settings()
db = Database(settings["database_url"])
redis_client = None

STREAM_NAME = "orders:new"
GROUP_NAME = "dispatcher-group"
CONSUMER_NAME = "dispatcher-1"


def _auth_ok(request):
    expected = settings.get("internal_token") or settings.get("INTERNAL_TOKEN") or ""
    got = request.headers.get("X-Internal-Token") or ""

    if not expected:
        return True

    return got == expected


async def health(request):
    return JSONResponse({"status": "ok", "service": settings["app_name"]})


async def metrics(request):
    data = generate_latest()
    return Response(data, media_type=CONTENT_TYPE_LATEST)

async def _ensure_group():
    try:
        await redis_client.xgroup_create(STREAM_NAME, GROUP_NAME, id="0-0", mkstream=True)
    except Exception:
        pass


async def _pick_best_courier():
    row = await db.fetchrow(
        """
        SELECT id::text AS id, current_load
        FROM couriers
        WHERE is_active = TRUE
        ORDER BY current_load ASC, created_at ASC
        LIMIT 1
        """
    )
    if not row:
        return None
    return row["id"]


async def _assign_order(order_id, courier_id):
    row = await db.fetchrow(
        """
        WITH courier_ok AS (
            SELECT id
            FROM couriers
            WHERE id = $2::uuid AND is_active = TRUE
            FOR UPDATE
        ),
        order_upd AS (
            UPDATE orders
            SET status = 'ASSIGNED',
                assigned_courier_id = $2::uuid
            WHERE id = $1::uuid
              AND status = 'NEW'
              AND EXISTS (SELECT 1 FROM courier_ok)
            RETURNING id
        ),
        courier_upd AS (
            UPDATE couriers
            SET current_load = current_load + 1
            WHERE id = $2::uuid
              AND EXISTS (SELECT 1 FROM order_upd)
            RETURNING id
        )
        SELECT
            (SELECT id FROM order_upd) AS order_id,
            (SELECT id FROM courier_upd) AS courier_id
        """,
        order_id,
        courier_id,
    )

    if not row:
        return False

    return bool(row["order_id"] and row["courier_id"])


async def assign_order(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    payload = await request.json()
    order_id = (payload.get("order_id") or "").strip()
    courier_id = (payload.get("courier_id") or "").strip()

    if not order_id or not courier_id:
        return JSONResponse({"detail": "order_id and courier_id required"}, status_code=400)

    courier = await db.fetchrow(
        "SELECT id::text AS id, is_active FROM couriers WHERE id = $1::uuid",
        courier_id,
    )
    if not courier:
        return JSONResponse({"detail": "Courier not found"}, status_code=404)
    if courier["is_active"] is False:
        return JSONResponse({"detail": "Courier is inactive"}, status_code=409)

    order = await db.fetchrow(
        "SELECT id::text AS id, status FROM orders WHERE id = $1::uuid",
        order_id,
    )
    if not order:
        return JSONResponse({"detail": "Order not found"}, status_code=404)
    if order["status"] != "NEW":
        return JSONResponse({"detail": f"Order must be NEW, got {order['status']}"}, status_code=409)

    ok = await _assign_order(order_id, courier_id)
    if not ok:
        return JSONResponse({"detail": "Assign failed"}, status_code=409)

    return JSONResponse({"ok": True})


async def dispatcher_loop():
    await _ensure_group()

    while True:
        try:
            items = await redis_client.xreadgroup(
                GROUP_NAME,
                CONSUMER_NAME,
                streams={STREAM_NAME: ">"},
                count=20,
                block=2000,
            )

            if not items:
                continue

            for stream_name, messages in items:
                for msg_id, data in messages:
                    order_id = (data.get(b"order_id") or b"").decode("utf-8").strip()
                    if not order_id:
                        await redis_client.xack(STREAM_NAME, GROUP_NAME, msg_id)
                        continue

                    courier_id = await _pick_best_courier()
                    if not courier_id:
                        continue

                    ok = await _assign_order(order_id, courier_id)
                    if ok:
                        await redis_client.xack(STREAM_NAME, GROUP_NAME, msg_id)

        except Exception:
            await asyncio.sleep(1.0)


async def on_startup():
    global redis_client
    await db.connect()
    redis_client = redis.from_url(settings["redis_url"])
    asyncio.create_task(dispatcher_loop())


async def on_shutdown():
    if redis_client:
        await redis_client.close()
    await db.close()


async def _start_order(order_id):
    updated = await db.fetchrow(
        """
        UPDATE orders
        SET status = 'IN_PROGRESS'
        WHERE id = $1::uuid AND status = 'ASSIGNED'
        RETURNING id::text AS id
        """,
        order_id,
    )
    return bool(updated)


async def _complete_order(order_id):
    row = await db.fetchrow(
        """
        WITH order_upd AS (
            UPDATE orders
            SET status = 'DELIVERED'
            WHERE id = $1::uuid AND status = 'IN_PROGRESS'
            RETURNING assigned_courier_id
        ),
        courier_upd AS (
            UPDATE couriers
            SET current_load = GREATEST(current_load - 1, 0)
            WHERE id = (SELECT assigned_courier_id FROM order_upd)
            RETURNING id
        )
        SELECT
            (SELECT assigned_courier_id FROM order_upd) AS courier_id,
            (SELECT id FROM courier_upd) AS updated_courier_id
        """,
        order_id,
    )

    if not row:
        return False

    return True


async def _cancel_order(order_id):
    row = await db.fetchrow(
        """
        WITH order_upd AS (
            UPDATE orders
            SET status = 'CANCELLED'
            WHERE id = $1::uuid AND status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS')
            RETURNING status AS prev_status, assigned_courier_id
        ),
        courier_upd AS (
            UPDATE couriers
            SET current_load = GREATEST(current_load - 1, 0)
            WHERE id = (SELECT assigned_courier_id FROM order_upd)
              AND (SELECT prev_status FROM order_upd) IN ('ASSIGNED', 'IN_PROGRESS')
            RETURNING id
        )
        SELECT
            (SELECT prev_status FROM order_upd) AS prev_status,
            (SELECT assigned_courier_id FROM order_upd) AS courier_id
        """,
        order_id,
    )

    if not row:
        return False

    return True


async def start_order(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    payload = await request.json()
    order_id = (payload.get("order_id") or "").strip()

    if not order_id:
        return JSONResponse({"detail": "order_id required"}, status_code=400)

    ok = await _start_order(order_id)
    if not ok:
        return JSONResponse({"detail": "Order must be ASSIGNED"}, status_code=409)

    return JSONResponse({"ok": True})


async def complete_order(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    payload = await request.json()
    order_id = (payload.get("order_id") or "").strip()

    if not order_id:
        return JSONResponse({"detail": "order_id required"}, status_code=400)

    ok = await _complete_order(order_id)
    if not ok:
        return JSONResponse({"detail": "Order must be IN_PROGRESS"}, status_code=409)

    return JSONResponse({"ok": True})


async def cancel_order(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    payload = await request.json()
    order_id = (payload.get("order_id") or "").strip()

    if not order_id:
        return JSONResponse({"detail": "order_id required"}, status_code=400)

    ok = await _cancel_order(order_id)
    if not ok:
        return JSONResponse({"detail": "Order not cancellable"}, status_code=409)

    return JSONResponse({"ok": True})



routes = [
    Route("/health", health, methods=["GET"]),
    Route("/metrics", metrics, methods=["GET"]),
    Route("/dispatch/assign", assign_order, methods=["POST"]),
    Route("/dispatch/start", start_order, methods=["POST"]),
    Route("/dispatch/complete", complete_order, methods=["POST"]),
    Route("/dispatch/cancel", cancel_order, methods=["POST"]),
]

app = Starlette(routes=routes, on_startup=[on_startup], on_shutdown=[on_shutdown])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings["port"])
