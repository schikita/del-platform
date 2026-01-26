"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, apiSend } from "@/lib/api";

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

function Pill({ ok, text }) {
  return (
    <span className={`rounded-lg px-2 py-1 text-xs ${ok ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/60"}`}>
      {text}
    </span>
  );
}

export default function AdminCouriersPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [couriers, setCouriers] = useState([]);

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    if (!text) return couriers || [];
    return (couriers || []).filter((c) => String(c.name || "").toLowerCase().includes(text));
  }, [couriers, q]);

  async function loadAll() {
    setErr("");
    try {
      const c = await apiGet("analytics", "/couriers/load");
      setCouriers(c?.couriers || []);
    } catch (e) {
      setErr(e && e.message ? e.message : "Failed to fetch");
    }
  }

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 5000);
    return () => clearInterval(t);
  }, []);

  async function toggleCourier(id, nextActive) {
    setErr("");
    setBusy(true);
    try {
      await apiSend("couriers", `/couriers/${id}`, "PATCH", { is_active: nextActive });
      await loadAll();
    } catch (e) {
      setErr(e && e.message ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function createDemoCourier() {
    setErr("");
    setBusy(true);
    try {
      // у вас это уже используется на главной странице в Controls:
      // apiPost("/demo/couriers", {})
      await apiPost("/demo/couriers", {});
      await loadAll();
    } catch (e) {
      setErr(e && e.message ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <Card
        title="Курьеры"
        right={
          <div className="flex gap-2">
            <button
              className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
              disabled={busy}
              onClick={loadAll}
            >
              Обновить
            </button>
            <button
              className="rounded-xl bg-emerald-500/15 px-4 py-2 text-xs hover:bg-emerald-500/20 disabled:opacity-50"
              disabled={busy}
              onClick={createDemoCourier}
            >
              + Демо-курьер
            </button>
          </div>
        }
      >
        <div className="mb-4">
          <input
            className="w-full rounded-xl bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени"
          />
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60">
              <tr className="border-b border-white/10">
                <th className="py-2 text-left font-medium">Имя</th>
                <th className="py-2 text-left font-medium">Загрузка</th>
                <th className="py-2 text-left font-medium">Активен</th>
                <th className="py-2 text-right font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-white/5">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-white/70">{c.current_load}</td>
                  <td className="py-2">
                    <Pill ok={c.is_active} text={c.is_active ? "YES" : "NO"} />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => toggleCourier(c.id, !c.is_active)}
                    >
                      {c.is_active ? "Отключить" : "Включить"}
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-white/50" colSpan={4}>
                    Курьеров нет. Нажми “+ Демо-курьер”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
