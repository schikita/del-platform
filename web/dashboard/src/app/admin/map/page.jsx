"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

function Card({ title, children, right }) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white/80">{title}</div>
        {right ? <div>{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function hashTo01(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return (h % 10000) / 10000;
}

function getCourierPosition(id, t) {
  // стабильная базовая позиция
  const bx = hashTo01(id + ":x");
  const by = hashTo01(id + ":y");

  // плавное движение (имитация GPS)
  const dx = Math.sin(t / 1800 + bx * 10) * 0.06;
  const dy = Math.cos(t / 1600 + by * 10) * 0.06;

  const x = Math.min(0.95, Math.max(0.05, bx + dx));
  const y = Math.min(0.95, Math.max(0.05, by + dy));

  return { x, y };
}

export default function AdminMapPage() {
  const [err, setErr] = useState("");
  const [couriers, setCouriers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [now, setNow] = useState(Date.now());

  async function loadAll() {
    setErr("");
    try {
      const [c, o] = await Promise.all([
        apiGet("analytics", "/couriers/load"),
        apiGet("analytics", "/orders/recent"),
      ]);
      setCouriers(c?.couriers || []);
      setOrders(o?.orders || []);
    } catch (e) {
      setErr(e && e.message ? e.message : "Failed to fetch");
    }
  }

  useEffect(() => {
    loadAll();
    const t1 = setInterval(loadAll, 5000);
    const t2 = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);

  const activeCouriers = useMemo(() => (couriers || []).filter((c) => c.is_active), [couriers]);

  const newOrders = useMemo(() => (orders || []).filter((o) => o.status === "NEW").slice(0, 25), [orders]);

  return (
    <div className="space-y-6">
      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <Card
        title="Имитация карты (курьеры + новые заказы)"
        right={
          <button
            className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15"
            onClick={loadAll}
          >
            Обновить
          </button>
        }
      >
        <div className="text-xs text-white/50 mb-4">
          Это визуальная имитация: позиции курьеров двигаются математически, чтобы диспетчерская выглядела живой.
        </div>

        <div className="relative h-[520px] rounded-2xl bg-black/30 ring-1 ring-white/10 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.25)_1px,transparent_0)] [background-size:22px_22px]" />

          {activeCouriers.map((c) => {
            const p = getCourierPosition(String(c.id), now);
            const left = `${p.x * 100}%`;
            const top = `${p.y * 100}%`;

            return (
              <div
                key={c.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left, top }}
                title={`${c.name} • load ${c.current_load}`}
              >
                <div className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_6px_rgba(16,185,129,0.15)]" />
                <div className="mt-2 whitespace-nowrap rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white/80 ring-1 ring-white/10">
                  {c.name}
                </div>
              </div>
            );
          })}

          {newOrders.map((o) => {
            const bx = hashTo01(String(o.id) + ":ox");
            const by = hashTo01(String(o.id) + ":oy");
            const left = `${(0.08 + bx * 0.84) * 100}%`;
            const top = `${(0.08 + by * 0.84) * 100}%`;

            return (
              <div
                key={o.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left, top }}
                title={`${o.customer_name} • ${o.address}`}
              >
                <div className="h-3 w-3 rotate-45 bg-amber-300 shadow-[0_0_0_6px_rgba(245,158,11,0.15)]" />
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-white/60">
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            Активных курьеров: <span className="text-white/80">{activeCouriers.length}</span>
          </div>
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            Новых заказов на карте: <span className="text-white/80">{newOrders.length}</span>
          </div>
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            Обновление: <span className="text-white/80">auto</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
