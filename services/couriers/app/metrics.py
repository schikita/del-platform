from prometheus_client import Counter, Histogram
from prometheus_client import Gauge


COURIERS_CREATED = Counter("couriers_created_total", "Сколько курьеров создано")
HTTP_LATENCY = Histogram(
    "http_request_latency_seconds",
    "Latency запросов",
    buckets=(0.01, 0.03, 0.05, 0.1, 0.2, 0.4, 1.0, 2.0),
)

ACTIVE_COURIERS = Gauge("active_couriers", "Активные курьеры")
