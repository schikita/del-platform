"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiSend } from "@/lib/api";

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

function StatusBadge({ status }) {
  const map = {
    NEW: "bg-amber-500/15 text-amber-200",
    ASSIGNED: "bg-emerald-500/15 text-emerald-200",
    IN_PROGRESS: "bg-sky-500/15 text-sky-200",
    DELIVERED: "bg-purple-500/15 text-purple-200",
    CANCELLED: "bg-red-500/15 text-red-200",
  };

  const cls = map[status] || "bg-white/10 text-white/70";

  return (
    <span className={`rounded-lg px-2 py-1 text-xs ${cls}`}>{status}</span>
  );
}

async function start(orderId) {
  setErr("");
  setLoading(true);
  try {
    await apiSend("dispatcher", "/dispatch/start", "POST", {
      order_id: orderId,
    });
    await loadAll();
  } catch (e) {
    setErr(e && e.message ? e.message : "Start failed");
  } finally {
    setLoading(false);
  }
}

async function complete(orderId) {
  setErr("");
  setLoading(true);
  try {
    await apiSend("dispatcher", "/dispatch/complete", "POST", {
      order_id: orderId,
    });
    await loadAll();
  } catch (e) {
    setErr(e && e.message ? e.message : "Complete failed");
  } finally {
    setLoading(false);
  }
}

async function cancel(orderId) {
  setErr("");
  setLoading(true);
  try {
    await apiSend("dispatcher", "/dispatch/cancel", "POST", {
      order_id: orderId,
    });
    await loadAll();
  } catch (e) {
    setErr(e && e.message ? e.message : "Cancel failed");
  } finally {
    setLoading(false);
  }
}

export default function AdminOrdersPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  const [orders, setOrders] = useState([]);
  const [couriers, setCouriers] = useState([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const activeCouriers = useMemo(
    () => couriers.filter((c) => c.is_active),
    [couriers],
  );

  const courierById = useMemo(() => {
    const m = new Map();
    (couriers || []).forEach((c) => m.set(c.id, c));
    return m;
  }, [couriers]);

  const filteredOrders = useMemo(() => {
    const text = q.trim().toLowerCase();

    return (orders || [])
      .filter((o) => {
        if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
        if (!text) return true;

        const blob =
          `${o.customer_name || ""} ${o.address || ""} ${o.phone || ""}`.toLowerCase();
        return blob.includes(text);
      })
      .slice(0, 200);
  }, [orders, q, statusFilter]);

  const counters = useMemo(() => {
    const res = {
      all: 0,
      NEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    (orders || []).forEach((o) => {
      res.all += 1;
      if (res[o.status] !== undefined) res[o.status] += 1;
    });
    return res;
  }, [orders]);

  async function loadAll() {
    setErr("");
    try {
      const [o, c] = await Promise.all([
        apiGet("analytics", "/orders/recent"),
        apiGet("analytics", "/couriers/load"),
      ]);
      setOrders(o?.orders || []);
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

  async function createOrder() {
    setErr("");
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function assign(orderId, courierId) {
    setErr("");
    setBusy(true);
    try {
      await apiSend("dispatcher", "/dispatch/assign", "POST", {
        order_id: orderId,
        courier_id: courierId,
      });
      await loadAll();
    } catch (e) {
      setErr(e && e.message ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  function pickBestCourierId() {
    if (!activeCouriers.length) return "";
    const sorted = [...activeCouriers].sort(
      (a, b) => (a.current_load || 0) - (b.current_load || 0),
    );
    return sorted[0]?.id || "";
  }

  async function assignBest(orderId) {
    const bestId = pickBestCourierId();
    if (!bestId) return;
    await assign(orderId, bestId);
  }

  return (
    <div className="space-y-6">
      {err ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <Card title="Создать заказ">
            <div className="space-y-3">
              <Field
                label="Клиент"
                value={customerName}
                onChange={setCustomerName}
                placeholder="Иван Иванов"
              />
              <Field
                label="Адрес"
                value={address}
                onChange={setAddress}
                placeholder="ул. Ленина, 10"
              />
              <Field
                label="Телефон"
                value={phone}
                onChange={setPhone}
                placeholder="+375291234567"
              />

              <button
                className="mt-2 w-full rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50"
                disabled={
                  busy ||
                  !customerName.trim() ||
                  !address.trim() ||
                  !phone.trim()
                }
                onClick={createOrder}
              >
                Создать
              </button>

              <div className="text-xs text-white/50">
                Заказ создаётся со статусом{" "}
                <span className="text-white/70">NEW</span>.
              </div>
            </div>
          </Card>

          <div className="mt-6 space-y-3">
            <Card
              title="Фильтры"
              right={
                <button
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                  disabled={busy}
                  onClick={loadAll}
                >
                  Обновить
                </button>
              }
            >
              <div className="space-y-3">
                <label className="block">
                  <div className="mb-1 text-xs text-white/60">Поиск</div>
                  <input
                    className="w-full rounded-xl bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Клиент / адрес / телефон"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-xs text-white/60">Статус</div>
                  <select
                    className="w-full rounded-xl bg-black/30 px-3 py-2 text-sm ring-1 ring-white/10"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">Все ({counters.all})</option>
                    <option value="NEW">NEW ({counters.NEW})</option>
                    <option value="ASSIGNED">
                      ASSIGNED ({counters.ASSIGNED})
                    </option>
                    <option value="IN_PROGRESS">
                      IN_PROGRESS ({counters.IN_PROGRESS})
                    </option>
                    <option value="DELIVERED">
                      DELIVERED ({counters.DELIVERED})
                    </option>
                    <option value="CANCELLED">
                      CANCELLED ({counters.CANCELLED})
                    </option>
                  </select>
                </label>

                <div className="text-xs text-white/50">
                  Активных курьеров:{" "}
                  <span className="text-white/70">{activeCouriers.length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Card title="Заказы (контроль диспетчера)">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="py-2 text-left font-medium">Клиент</th>
                    <th className="py-2 text-left font-medium">Адрес</th>
                    <th className="py-2 text-left font-medium">Телефон</th>
                    <th className="py-2 text-left font-medium">Статус</th>
                    <th className="py-2 text-left font-medium">Курьер</th>
                    <th className="py-2 text-right font-medium">Назначение</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((o) => {
                    const courier = o.assigned_courier_id
                      ? courierById.get(o.assigned_courier_id)
                      : null;

                    return (
                      <tr key={o.id} className="border-b border-white/5">
                        <td className="py-2">{o.customer_name}</td>
                        <td className="py-2">{o.address}</td>
                        <td className="py-2">{o.phone}</td>
                        <td className="py-2">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="py-2 text-white/70">
                          {courier ? courier.name : "—"}
                        </td>

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
                                disabled={
                                  loading || activeCouriers.length === 0
                                }
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

                              <button
                                className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                                disabled={loading}
                                onClick={() => cancel(o.id)}
                              >
                                Отменить
                              </button>
                            </div>
                          ) : null}

                          {o.status === "ASSIGNED" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                                disabled={loading}
                                onClick={() => start(o.id)}
                              >
                                В работу
                              </button>

                              <button
                                className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                                disabled={loading}
                                onClick={() => cancel(o.id)}
                              >
                                Отменить
                              </button>
                            </div>
                          ) : null}

                          {o.status === "IN_PROGRESS" ? (
                            <div className="flex justify-end gap-2">
                              <button
                                className="rounded-xl bg-emerald-500/20 px-4 py-2 text-xs hover:bg-emerald-500/30 disabled:opacity-50"
                                disabled={loading}
                                onClick={() => complete(o.id)}
                              >
                                Доставлен
                              </button>

                              <button
                                className="rounded-xl bg-white/10 px-4 py-2 text-xs hover:bg-white/15 disabled:opacity-50"
                                disabled={loading}
                                onClick={() => cancel(o.id)}
                              >
                                Отменить
                              </button>
                            </div>
                          ) : null}

                          {["DELIVERED", "CANCELLED"].includes(o.status) ? (
                            <span className="text-xs text-white/40">—</span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}

                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        className="py-6 text-center text-white/50"
                        colSpan={6}
                      >
                        Заказов нет (или фильтр ничего не нашёл).
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-white/45">
              Примечание: “Лучший” = активный курьер с минимальной текущей
              нагрузкой.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
