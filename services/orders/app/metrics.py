from prometheus_client import Counter, Histogram, Gauge


ORDERS_CREATED = Counter("orders_created_total", "Количество созданных заказов")
ORDERS_ASSIGNED = Counter("orders_assigned_total", "Количество назначенных заказов")

HTTP_LATENCY = Histogram(
    "http_request_latency_seconds",
    "Latency запросов",
    buckets=(0.01, 0.03, 0.05, 0.1, 0.2, 0.4, 1.0, 2.0),
)

ACTIVE_ORDERS = Gauge("active_orders", "Активные заказы (NEW/ASSIGNED)")
