import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "info" | "mute" | "hold";

const TONES: Record<Tone, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  bad: "border-red-500/40 bg-red-500/10 text-red-300",
  info: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
  mute: "border-slate-600 bg-slate-800 text-slate-300",
  hold: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

export function Badge({ tone = "mute", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-slate-900/70 ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PreviewShell({ title, how, children }: { title: string; how: string[]; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-300">
            Interactive preview · simulated data
          </p>
          <h2 className="text-base font-semibold text-white">{title}</h2>
        </div>
        <Badge tone="warn">Not real sensor / vessel data</Badge>
      </header>
      <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 p-4">{children}</div>
        <aside className="border-t border-slate-800 bg-slate-950/50 p-4 lg:border-l lg:border-t-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">How to read this</p>
          <ul className="space-y-2 text-sm text-slate-300">
            {how.map((h) => (
              <li key={h} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export function fmtAge(sec: number): string {
  if (sec < 60) return `${Math.max(0, Math.round(sec))}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function Btn({
  children,
  onClick,
  tone = "mute",
  disabled,
  active,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "mute" | "primary" | "danger";
  disabled?: boolean;
  active?: boolean;
  title?: string;
}) {
  const base =
    "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  const t =
    tone === "primary"
      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
      : tone === "danger"
        ? "border-red-500/50 bg-red-500/15 text-red-200 hover:bg-red-500/25"
        : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${t} ${active ? "ring-2 ring-cyan-400/70" : ""}`}
    >
      {children}
    </button>
  );
}
