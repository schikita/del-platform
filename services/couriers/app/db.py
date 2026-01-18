import asyncpg
from app.sql import CREATE_TABLES_SQL


class Database:
    def __init__(self, dsn):
        self._dsn = dsn
        self._pool = None

    async def connect(self):
        self._pool = await asyncpg.create_pool(dsn=self._dsn, min_size=1, max_size=10)
        async with self._pool.acquire() as conn:
            await conn.execute(CREATE_TABLES_SQL)

    async def close(self):
        if self._pool:
            await self._pool.close()

    async def fetch(self, query, *args):
        async with self._pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def fetchrow(self, query, *args):
        async with self._pool.acquire() as conn:
            return await conn.fetchrow(query, *args)

    async def execute(self, query, *args):
        async with self._pool.acquire() as conn:
            return await conn.execute(query, *args)
