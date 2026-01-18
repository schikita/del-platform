"use client";

import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import KpiCards from "../components/KpiCards";
import Charts from "../components/Charts";
import OrdersTable from "../components/OrdersTable";
import { apiGet } from "../lib/api";

export default function Page() {
  const [kpi, setKpi] = useState({});
  const [series, setSeries] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [k, s, c, o] = await Promise.all([
        apiGet("/kpi"),
        apiGet("/timeseries/orders"),
        apiGet("/couriers/load"),
        apiGet("/orders/recent")
      ]);

      setKpi(k);
      setSeries(s.series || []);
      setCouriers(c.couriers || []);
      setOrders(o.orders || []);
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 pb-10">
        <TopBar />

        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <KpiCards kpi={kpi} />
        <Charts series={series} couriers={couriers} />
        <OrdersTable orders={orders} />
      </div>
    </div>
  );
}
