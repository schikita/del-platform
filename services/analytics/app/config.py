import os


def get_settings():
    return {
        "app_name": os.getenv("APP_NAME", "analytics"),
        "port": int(os.getenv("PORT", "8004")),
        "database_url": os.getenv("DATABASE_URL", ""),
        "internal_token": os.getenv("INTERNAL_TOKEN", ""),
        "orders_url": os.getenv("ORDERS_URL", "http://orders:8001"),
        "couriers_url": os.getenv("COURIERS_URL", "http://couriers:8002"),
    }
