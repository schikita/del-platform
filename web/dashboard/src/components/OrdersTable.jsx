"use client";

import { motion, AnimatePresence } from "framer-motion";

function StatusBadge({ status }) {
  const map = {
  NEW: "bg-amber-500/20 text-amber-200 border-amber-500/30",
  ASSIGNED: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  IN_PROGRESS: "bg-sky-500/20 text-sky-200 border-sky-500/30",
  DELIVERED: "bg-violet-500/20 text-violet-200 border-violet-500/30",
  CANCELLED: "bg-red-500/20 text-red-200 border-red-500/30",
};

  const cls = map[status] || "bg-zinc-500/20 text-zinc-200 border-zinc-500/30";

  return (
    <span className={`px-3 py-1 text-xs rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

export default function OrdersTable({ orders }) {
  const rows = orders || [];

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-lg mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-zinc-300">Последние заказы</div>
        <div className="text-xs text-zinc-500">Обновляется автоматически</div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="text-left py-3">Клиент</th>
              <th className="text-left py-3">Адрес</th>
              <th className="text-left py-3">Телефон</th>
              <th className="text-left py-3">Статус</th>
              <th className="text-left py-3">Курьер</th>
              <th className="text-left py-3">Время</th>
            </tr>
          </thead>

          <AnimatePresence initial={false}>
            <tbody>
              {rows.map((o) => (
                <motion.tr
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="border-b border-zinc-900 hover:bg-zinc-800/40"
                >
                  <td className="py-3 pr-3">{o.customer_name}</td>
                  <td className="py-3 pr-3 text-zinc-300">{o.address}</td>
                  <td className="py-3 pr-3 text-zinc-300">{o.phone}</td>
                  <td className="py-3 pr-3"><StatusBadge status={o.status} /></td>
                  <td className="py-3 pr-3 text-zinc-300">
                    {o.assigned_courier_id ? o.assigned_courier_id.slice(0, 8) : "—"}
                  </td>
                  <td className="py-3 pr-3 text-zinc-400">
                    {new Date(o.created_at).toLocaleTimeString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </AnimatePresence>
        </table>
      </div>
    </div>
  );
}
