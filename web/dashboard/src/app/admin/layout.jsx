import Link from "next/link";

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xl font-semibold">Admin Console</div>
            <div className="text-sm text-white/60">Управление заказами и курьерами</div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link className="rounded-xl bg-white/5 px-4 py-2 text-sm hover:bg-white/10" href="/admin/orders">
              Orders
            </Link>
            <Link className="rounded-xl bg-white/5 px-4 py-2 text-sm hover:bg-white/10" href="/admin/couriers">
              Couriers
            </Link>
            <Link className="rounded-xl bg-white/5 px-4 py-2 text-sm hover:bg-white/10" href="/admin/map">
              Map
            </Link>
            <Link className="rounded-xl bg-white/5 px-4 py-2 text-sm hover:bg-white/10" href="/admin/dispatch-rules">
              Dispatch rules
            </Link>
            <Link className="rounded-xl bg-white/5 px-4 py-2 text-sm hover:bg-white/10" href="/">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
