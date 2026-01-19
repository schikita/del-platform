"use client";

import { useState } from "react";
import { apiPost } from "../lib/api";

export default function Controls({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run(fn) {
    try {
      setMsg("");
      setBusy(true);
      await fn();
      setMsg("Готово");
      if (onDone) onDone();
    } catch (e) {
      setMsg(String(e.message || e));
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(""), 2000);
    }
  }

  return (
    <div className="mt-4 rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-lg">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-zinc-300">Демо-управление</div>
          <div className="text-xs text-zinc-500 mt-1">
            Кнопки создают заказы/курьеров через analytics → services (с internal token).
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={busy}
            onClick={() => run(() => apiPost("/demo/couriers", {}))}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-sm"
          >
            + Курьер
          </button>

          <button
            disabled={busy}
            onClick={() => run(() => apiPost("/demo/orders", {}))}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm text-black"
          >
            + Заказ
          </button>
        </div>
      </div>

      {msg ? (
        <div className="mt-3 text-xs text-zinc-300">
          {msg}
        </div>
      ) : null}
    </div>
  );
}
