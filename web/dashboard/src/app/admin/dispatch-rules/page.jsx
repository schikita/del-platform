export default function DispatchRulesPage() {
  return (
    <div className="rounded-2xl bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="text-sm font-medium text-white/80">Dispatch rules</div>
      <div className="mt-3 text-sm text-white/60">
        Здесь будет настройка правил назначения (например: “наименьшая загрузка”, “по зонам”, “по приоритету”, SLA).
        Сейчас используется ручное назначение на странице Orders.
      </div>
    </div>
  );
}
