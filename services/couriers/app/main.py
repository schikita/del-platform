import time
from starlette.applications import Starlette
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route
from starlette.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from app.config import get_settings
from app.db import Database
from app.metrics import COURIERS_CREATED, HTTP_LATENCY, ACTIVE_COURIERS


settings = get_settings()
db = Database(settings["database_url"])


def _auth_ok(request):
    token = request.headers.get("X-Internal-Token", "")
    return token and token == settings["internal_token"]


async def health(request):
    return JSONResponse({"status": "ok", "service": settings["app_name"]})


async def metrics(request):
    data = generate_latest()
    return PlainTextResponse(data, media_type=CONTENT_TYPE_LATEST)


async def create_courier(request):
    start = time.time()
    try:
        if not _auth_ok(request):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        payload = await request.json()
        name = (payload.get("name") or "").strip()
        if not name:
            return JSONResponse({"detail": "name is required"}, status_code=400)

        row = await db.fetchrow(
            """
            INSERT INTO couriers(name, is_active, current_load)
            VALUES($1, TRUE, 0)
            RETURNING id::text, created_at
            """,
            name,
        )

        COURIERS_CREATED.inc()
        await _refresh_active_couriers_gauge()

        return JSONResponse({"id": row["id"], "name": name, "created_at": row["created_at"].isoformat()}, status_code=201)
    finally:
        HTTP_LATENCY.observe(time.time() - start)


async def list_couriers(request):
    start = time.time()
    try:
        if not _auth_ok(request):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        rows = await db.fetch(
            """
            SELECT id::text, name, is_active, current_load, created_at
            FROM couriers
            ORDER BY created_at DESC
            LIMIT 200
            """
        )

        result = []
        for r in rows:
            result.append(
                {
                    "id": r["id"],
                    "name": r["name"],
                    "is_active": bool(r["is_active"]),
                    "current_load": int(r["current_load"]),
                    "created_at": r["created_at"].isoformat(),
                }
            )

        return JSONResponse({"couriers": result})
    finally:
        HTTP_LATENCY.observe(time.time() - start)


async def set_active(request):
    start = time.time()
    try:
        if not _auth_ok(request):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)

        courier_id = request.path_params.get("courier_id")
        payload = await request.json()
        is_active = bool(payload.get("is_active"))

        await db.execute(
            "UPDATE couriers SET is_active = $1 WHERE id = $2::uuid",
            is_active,
            courier_id,
        )

        await _refresh_active_couriers_gauge()
        return JSONResponse({"ok": True})
    finally:
        HTTP_LATENCY.observe(time.time() - start)


async def _refresh_active_couriers_gauge():
    row = await db.fetchrow("SELECT COUNT(*) AS c FROM couriers WHERE is_active = TRUE")
    ACTIVE_COURIERS.set(int(row["c"]))


async def on_startup():
    await db.connect()
    await _refresh_active_couriers_gauge()


async def on_shutdown():
    await db.close()


routes = [
    Route("/health", health, methods=["GET"]),
    Route("/metrics", metrics, methods=["GET"]),
    Route("/couriers", create_courier, methods=["POST"]),
    Route("/couriers", list_couriers, methods=["GET"]),
    Route("/couriers/{courier_id}/active", set_active, methods=["PATCH"]),
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
