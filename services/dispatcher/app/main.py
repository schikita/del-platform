import asyncio
import time
from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.config import get_settings
from app.db import Database

import redis.asyncio as redis


settings = get_settings()
db = Database(settings["database_url"])
redis_client = None

STREAM_NAME = "orders:new"
GROUP_NAME = "dispatcher-group"
CONSUMER_NAME = "dispatcher-1"


async def health(request):
    return JSONResponse({"status": "ok", "service": settings["app_name"]})


async def _ensure_group():
    # Создаём группу, если её ещё нет (идемпотентно)
    try:
        await redis_client.xgroup_create(STREAM_NAME, GROUP_NAME, id="0-0", mkstream=True)
    except Exception:
        pass


async def _pick_best_courier():
    # Выбираем активного курьера с минимальной текущей нагрузкой
    row = await db.fetchrow(
        """
        SELECT id::text, current_load
        FROM couriers
        WHERE is_active = TRUE
        ORDER BY current_load ASC, created_at ASC
        LIMIT 1
        """
    )
    if not row:
        return None
    return row["id"]


async def assign_order(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    payload = await request.json()
    order_id = (payload.get("order_id") or "").strip()
    courier_id = (payload.get("courier_id") or "").strip()

    if not order_id or not courier_id:
        return JSONResponse({"detail": "order_id and courier_id required"}, status_code=400)

    updated = await db.execute(
        """
        UPDATE orders
        SET status = 'ASSIGNED', assigned_courier_id = $2
        WHERE id = $1::uuid AND status = 'NEW'
        """,
        order_id,
        courier_id,
    )

    await db.execute(
        """
        UPDATE couriers
        SET current_load = current_load + 1
        WHERE id = $1::uuid
        """,
        courier_id,
    )

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
                        # Если нет активных курьеров — оставляем сообщение висеть (переобработаем позже)
                        continue

                    ok = await _assign_order(order_id, courier_id)
                    if ok:
                        await redis_client.xack(STREAM_NAME, GROUP_NAME, msg_id)

        except Exception:
            # Если Redis/DB кратковременно отвалились — не падаем, продолжаем
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


routes = [
    Route("/health", health, methods=["GET"]),
]

app = Starlette(routes=routes, on_startup=[on_startup], on_shutdown=[on_shutdown])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings["port"])
