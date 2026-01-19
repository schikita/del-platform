import random
import time
from datetime import datetime, timedelta

import httpx
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.config import get_settings
from app.db import Database


settings = get_settings()
db = Database(settings["database_url"])

DASHBOARD_ORIGINS = {
    "http://185.244.50.22:13001",
    "http://localhost:13001",
}

http_client = None


def _is_dashboard_origin(request):
    origin = request.headers.get("Origin")
    return origin in DASHBOARD_ORIGINS


def _is_internal_auth(request):
    token = request.headers.get("X-Internal-Token", "")
    return bool(token) and token == settings["internal_token"]


def _auth_ok(request):
    if _is_internal_auth(request):
        return True
    if _is_dashboard_origin(request):
        return True
    return False


def _ui_only_ok(request):
    return _is_dashboard_origin(request)


async def health(request):
    return JSONResponse({"status": "ok", "service": settings["app_name"]})


async def kpi(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    row_total = await db.fetchrow("SELECT COUNT(*) AS c FROM orders")
    row_new = await db.fetchrow("SELECT COUNT(*) AS c FROM orders WHERE status = 'NEW'")
    row_assigned = await db.fetchrow("SELECT COUNT(*) AS c FROM orders WHERE status = 'ASSIGNED'")
    row_couriers = await db.fetchrow("SELECT COUNT(*) AS c FROM couriers WHERE is_active = TRUE")

    return JSONResponse(
        {
            "total_orders": int(row_total["c"]),
            "new_orders": int(row_new["c"]),
            "assigned_orders": int(row_assigned["c"]),
            "active_couriers": int(row_couriers["c"]),
        }
    )


async def orders_recent(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    rows = await db.fetch(
        """
        SELECT id::text, customer_name, address, phone, status,
               COALESCE(assigned_courier_id::text, '') AS assigned_courier_id,
               created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 50
        """
    )

    items = []
    for r in rows:
        items.append(
            {
                "id": r["id"],
                "customer_name": r["customer_name"],
                "address": r["address"],
                "phone": r["phone"],
                "status": r["status"],
                "assigned_courier_id": r["assigned_courier_id"] or None,
                "created_at": r["created_at"].isoformat(),
            }
        )

    return JSONResponse({"orders": items})


async def couriers_load(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    rows = await db.fetch(
        """
        SELECT id::text, name, current_load, is_active
        FROM couriers
        ORDER BY current_load DESC, name ASC
        LIMIT 50
        """
    )

    items = []
    for r in rows:
        items.append(
            {
                "id": r["id"],
                "name": r["name"],
                "current_load": int(r["current_load"]),
                "is_active": bool(r["is_active"]),
            }
        )

    return JSONResponse({"couriers": items})


async def timeseries_orders(request):
    if not _auth_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    now = datetime.utcnow()
    start = now - timedelta(minutes=60)

    rows = await db.fetch(
        """
        SELECT date_trunc('minute', created_at) AS ts, COUNT(*) AS c
        FROM orders
        WHERE created_at >= $1
        GROUP BY ts
        ORDER BY ts ASC
        """,
        start,
    )

    points = []
    for r in rows:
        points.append({"ts": r["ts"].isoformat(), "value": int(r["c"])})

    return JSONResponse({"series": points})


def _rand_phone():
    return "+37529" + "".join(str(random.randint(0, 9)) for _ in range(7))


def _rand_customer():
    first = ["Иван", "Павел", "Сергей", "Алексей", "Дмитрий", "Анна", "Мария", "Ольга"]
    last = ["Иванов", "Петров", "Сидоров", "Козлов", "Кузнецов", "Смирнова", "Орлова"]
    return f"{random.choice(first)} {random.choice(last)}"


def _rand_address():
    streets = ["Ленина", "Советская", "Победы", "Гагарина", "Купалы", "Независимости"]
    return f"ул. {random.choice(streets)}, д. {random.randint(1, 120)}, кв. {random.randint(1, 200)}"


def _rand_items():
    items = [
        {"sku": "pizza", "qty": 1},
        {"sku": "cola", "qty": 2},
        {"sku": "burger", "qty": 1},
        {"sku": "fries", "qty": 1},
    ]
    k = random.randint(1, 3)
    random.shuffle(items)
    return items[:k]


async def demo_create_order(request):
    if not _ui_only_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    payload = {}
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    customer_name = (payload.get("customer_name") or "").strip() or _rand_customer()
    address = (payload.get("address") or "").strip() or _rand_address()
    phone = (payload.get("phone") or "").strip() or _rand_phone()
    items = payload.get("items") or _rand_items()

    headers = {"X-Internal-Token": settings["internal_token"]}
    resp = await http_client.post(
        f"{settings['orders_url'].rstrip('/')}/orders",
        json={"customer_name": customer_name, "address": address, "phone": phone, "items": items},
        headers=headers,
        timeout=10.0,
    )

    return JSONResponse(resp.json(), status_code=resp.status_code)


async def demo_create_courier(request):
    if not _ui_only_ok(request):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)

    payload = {}
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    name = (payload.get("name") or "").strip()
    if not name:
        name = f"Courier #{random.randint(100, 999)}"

    headers = {"X-Internal-Token": settings["internal_token"]}
    resp = await http_client.post(
        f"{settings['couriers_url'].rstrip('/')}/couriers",
        json={"name": name},
        headers=headers,
        timeout=10.0,
    )

    return JSONResponse(resp.json(), status_code=resp.status_code)


async def on_startup():
    global http_client
    await db.connect()
    http_client = httpx.AsyncClient()


async def on_shutdown():
    global http_client
    if http_client:
        await http_client.aclose()
    await db.close()


async def options_ok(request):
    return JSONResponse({}, status_code=204)


routes = [
    Route("/{path:path}", options_ok, methods=["OPTIONS"]),

    Route("/health", health, methods=["GET"]),
    Route("/kpi", kpi, methods=["GET"]),
    Route("/orders/recent", orders_recent, methods=["GET"]),
    Route("/couriers/load", couriers_load, methods=["GET"]),
    Route("/timeseries/orders", timeseries_orders, methods=["GET"]),

    Route("/demo/orders", demo_create_order, methods=["POST"]),
    Route("/demo/couriers", demo_create_courier, methods=["POST"]),
]

app = Starlette(routes=routes, on_startup=[on_startup], on_shutdown=[on_shutdown])
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(DASHBOARD_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings["port"])
