"use client";

import { motion } from "framer-motion";

function Card({ title, value, hint }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-lg"
    >
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="text-3xl font-semibold mt-2">{value}</div>
      <div className="text-xs text-zinc-500 mt-2">{hint}</div>
    </motion.div>
  );
}

export default function KpiCards({ kpi }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card title="Всего заказов" value={kpi.total_orders ?? "-"} hint="Общее количество в базе" />
      <Card title="Новые" value={kpi.new_orders ?? "-"} hint="Ожидают назначения" />
      <Card title="Назначенные" value={kpi.assigned_orders ?? "-"} hint="Уже отданы курьеру" />
      <Card title="Активных курьеров" value={kpi.active_couriers ?? "-"} hint="Готовы работать" />
    </div>
  );
}
