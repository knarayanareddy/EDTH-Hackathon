import { useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

export type Tone = "cyan" | "green" | "amber" | "red" | "slate" | "violet";

const toneText: Record<Tone, string> = {
  cyan: "text-cyan-300",
  green: "text-emerald-300",
  amber: "text-amber-300",
  red: "text-rose-300",
  slate: "text-slate-300",
  violet: "text-violet-300",
};
const toneBox: Record<Tone, string> = {
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  red: "border-rose-500/40 bg-rose-500/10 text-rose-200",
  slate: "border-slate-600 bg-slate-800/60 text-slate-300",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-200",
};

export function Pill({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none", toneBox[tone], className)}>
      {children}
    </span>
  );
}

export function MockBadge({ children = "MOCK DATA – illustration, not a measured result" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      {children}
    </span>
  );
}

export function Panel({ title, kicker, right, children, className }: { title?: ReactNode; kicker?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-black/20", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {kicker && <div className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80">{kicker}</div>}
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone = "cyan" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn("font-mono text-lg font-semibold leading-tight", toneText[tone])}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function Callout({ tone = "cyan", title, children }: { tone?: Tone; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-[13px] leading-relaxed", toneBox[tone])}>
      {title && <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide">{title}</div>}
      <div className="text-slate-300">{children}</div>
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, unit, hint }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; hint?: string }) {
  return (
    <label className="block">
      <div className="mb-0.5 flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-200">
          {Number.isInteger(step) ? value : value.toFixed(2)}
          {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-400" />
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </label>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left hover:bg-slate-800/60" aria-pressed={checked}>
      <span className={cn("mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full border transition", checked ? "border-cyan-400 bg-cyan-500/30 justify-end" : "border-slate-600 bg-slate-800 justify-start")}>
        <span className={cn("mx-0.5 h-3 w-3 rounded-full", checked ? "bg-cyan-300" : "bg-slate-500")} />
      </span>
      <span>
        <span className="block text-xs text-slate-200">{label}</span>
        {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
      </span>
    </button>
  );
}

export function Btn({ children, onClick, tone = "cyan", disabled, className, active }: { children: ReactNode; onClick?: () => void; tone?: Tone; disabled?: boolean; className?: string; active?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        toneBox[tone],
        active ? "ring-1 ring-current" : "hover:brightness-125",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Hold-to-confirm button: an irreversible action needs a deliberate 1.2 s press. A tap does nothing. */
export function HoldButton({ label, onConfirm, ms = 1200, tone = "red", disabled }: { label: string; onConfirm: () => void; ms?: number; tone?: Tone; disabled?: boolean }) {
  const [p, setP] = useState(0);
  const raf = useRef(0);
  const t0 = useRef(0);
  const stop = () => {
    cancelAnimationFrame(raf.current);
    setP(0);
  };
  const start = () => {
    if (disabled) return;
    t0.current = performance.now();
    const tick = () => {
      const q = Math.min(1, (performance.now() - t0.current) / ms);
      setP(q);
      if (q >= 1) {
        onConfirm();
        setP(0);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      className={cn("relative select-none overflow-hidden rounded-md border px-3 py-1.5 text-xs font-semibold disabled:opacity-40", toneBox[tone])}
    >
      <span className="absolute inset-y-0 left-0 bg-current opacity-30" style={{ width: `${p * 100}%` }} />
      <span className="relative">{p > 0 ? "Keep holding…" : label}</span>
    </button>
  );
}

export function Bar({ value, max = 1, tone = "cyan" }: { value: number; max?: number; tone?: Tone }) {
  const col = { cyan: "bg-cyan-400", green: "bg-emerald-400", amber: "bg-amber-400", red: "bg-rose-400", slate: "bg-slate-400", violet: "bg-violet-400" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-slate-800">
      <div className={cn("h-full rounded", col)} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

export function SectionTitle({ kicker, title, children }: { kicker?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-4">
      {kicker && <div className="text-[11px] font-semibold uppercase tracking-widest text-cyan-400">{kicker}</div>}
      <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
      {children && <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-400">{children}</p>}
    </div>
  );
}
