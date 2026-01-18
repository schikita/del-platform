import os


def get_settings():
    return {
        "app_name": os.getenv("APP_NAME", "couriers"),
        "port": int(os.getenv("PORT", "8002")),
        "database_url": os.getenv("DATABASE_URL", ""),
        "internal_token": os.getenv("INTERNAL_TOKEN", ""),
    }
