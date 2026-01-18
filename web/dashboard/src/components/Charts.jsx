"use client";

import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from "recharts";

function Panel({ title, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-lg"
    >
      <div className="text-sm text-zinc-300 mb-4">{title}</div>
      {children}
    </motion.div>
  );
}

export default function Charts({ series, couriers }) {
  const seriesData = (series || []).map((p) => ({
    ts: new Date(p.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    value: p.value
  }));

  const couriersData = (couriers || []).slice(0, 12).map((c) => ({
    name: c.name,
    load: c.current_load
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <Panel title="Поток заказов (последний час)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seriesData}>
              <XAxis dataKey="ts" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0f0f10", border: "1px solid #27272a" }} />
              <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Нагрузка курьеров (топ)">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={couriersData}>
              <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#0f0f10", border: "1px solid #27272a" }} />
              <Bar dataKey="load" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
