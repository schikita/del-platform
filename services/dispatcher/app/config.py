import os


def get_settings():
    return {
        "app_name": os.getenv("APP_NAME", "dispatcher"),
        "port": int(os.getenv("PORT", "8003")),
        "database_url": os.getenv("DATABASE_URL", ""),
        "redis_url": os.getenv("REDIS_URL", ""),
        "internal_token": os.getenv("INTERNAL_TOKEN", ""),
    }
