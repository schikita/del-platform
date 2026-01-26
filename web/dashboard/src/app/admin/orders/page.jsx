"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="mb-4 text-sm font-medium text-white/80">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-white/60">{label}</div>
      <input
        className="w-full rounded-xl bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export default function AdminOrdersPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);

  const activeCouriers = useMemo(() => couriers.filter((c) => c.is_active), [couriers]);

  async function loadAll() {
    setErr("");
    setLoading(true);
    try {
      const [o, c] = await Promise.all([
        apiGet("analytics", "/orders/recent"),
        apiGet("analytics", "/couriers/load"),
      ]);
      setOrders(o.orders || []);
      setCouriers(c.couriers || []);
    } catch (e) {
      setErr(e && e.message ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 5000);
    return () => clearInterval(t);
  }, []);

  async function createOrder() {
    setErr("");
    setLoading(true);
    try {
      await apiSend("orders", "/orders", "POST", {
        customer_name: customerName.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });

      setCustomerName("");
      setAddress("");
      setPhone("");

      await loadAll();
    } catch (e) {
      setErr(e && e.message ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function assign(orderId, courierId) {
    setErr("");
    setLoading(true);
    try {
      await apiSend("dispatcher", "/dispatch/assign", "POST", {
        order_id: orderId,
        courier_id: courierId,
      });
      await loadAll();
    } catch (e) {
      setErr(e && e.message ? e.message : "Assign failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        {err ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}
      </div>

      <div className="col-span-12 lg:col-span-4">
        <Card title="Создать заказ">
          <div className="space-y-3">
            <Field label="Клиент" value={customerName} onChange={setCustomerName} placeholder="Иван Иванов" />
            <Field label="Адрес" value={address} onChange={setAddress} placeholder="ул. Ленина, 10" />
            <Field label="Телефон" value={phone} onChange={setPhone} placeholder="+375291234567" />

            <button
              className="mt-2 w-full rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
              disabled={loading || !customerName.trim() || !address.trim() || !phone.trim()}
              onClick={createOrder}
            >
              Создать
            </button>

            <div className="text-xs text-white/50">
              Заказ будет создан со статусом NEW и появится в списке “Последние заказы”.
            </div>
          </div>
        </Card>
      </div>

      <div className="col-span-12 lg:col-span-8">
        <Card title="Последние заказы">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-white/60">
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left font-medium">Клиент</th>
                  <th className="py-2 text-left font-medium">Адрес</th>
                  <th className="py-2 text-left font-medium">Телефон</th>
                  <th className="py-2 text-left font-medium">Статус</th>
                  <th className="py-2 text-left font-medium">Курьер</th>
                  <th className="py-2 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-white/5">
                    <td className="py-2">{o.customer_name}</td>
                    <td className="py-2">{o.address}</td>
                    <td className="py-2">{o.phone}</td>
                    <td className="py-2">
                      <span className="rounded-lg bg-white/10 px-2 py-1 text-xs">{o.status}</span>
                    </td>
                    <td className="py-2 text-white/70">{o.assigned_courier_id || "—"}</td>
                    <td className="py-2 text-right">
                      {o.status === "NEW" ? (
                        <div className="flex justify-end gap-2">
                          <select
                            className="rounded-xl bg-black/30 px-3 py-2 text-xs ring-1 ring-white/10"
                            defaultValue=""
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              assign(o.id, v);
                              e.target.value = "";
                            }}
                            disabled={loading || activeCouriers.length === 0}
                          >
                            <option value="" disabled>
                              Назначить курьера
                            </option>
                            {activeCouriers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} (load: {c.current_load})
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span className="text-xs text-white/40">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-white/50" colSpan={6}>
                      Пока нет заказов. Создай первый заказ слева.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
