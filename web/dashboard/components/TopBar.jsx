export default function TopBar() {
  return (
    <div className="flex items-center justify-between py-6">
      <div>
        <div className="text-2xl font-semibold tracking-tight">Delivery Control Center</div>
        <div className="text-sm text-zinc-400 mt-1">Наглядная диспетчерская с метриками в стиле Grafana</div>
      </div>

      <div className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300">
        Live • Auto refresh
      </div>
    </div>
  );
}
