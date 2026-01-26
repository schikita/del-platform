"use client";

import { useEffect, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="mb-4 text-sm font-medium text-white/80">{title}</div>
      {children}
    </div>
  );
}

export default function AdminCouriersPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [couriers, setCouriers] = useState([]);

  async function loadAll() {
    setErr("");
    setLoading(true);
    try {
      const c = await apiGet("analytics", "/couriers/load");
      setCouriers(c.couriers || []);
    } catch (e) {
      setErr(e && e.message ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function toggleCourier(id, nextActive) {
    setErr("");
    setLoading(true);
    try {
      await apiSend("couriers", `/couriers/${id}`, "PATCH", { is_active: nextActive });
      await loadAll();
    } catch (e) {
      setErr(e && e.message ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <Card title="Курьеры">
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
              {couriers.map((c) => (
                <tr key={c.id} className="border-b border-white/5">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2">{c.current_load}</td>
                  <td className="py-2">
                    <span className={`rounded-lg px-2 py-1 text-xs ${c.is_active ? "bg-emerald-500/15" : "bg-white/10"}`}>
                      {c.is_active ? "YES" : "NO"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                      disabled={loading}
                      onClick={() => toggleCourier(c.id, !c.is_active)}
                    >
                      {c.is_active ? "Отключить" : "Включить"}
                    </button>
                  </td>
                </tr>
              ))}
              {couriers.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-white/50" colSpan={4}>
                    Курьеров нет. Добавление курьеров сделаем следующим шагом.
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
