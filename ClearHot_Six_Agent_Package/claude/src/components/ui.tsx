import type { ReactNode } from 'react';

export const Card = ({ title, kicker, children, className = '' }: { title?: string; kicker?: string; children: ReactNode; className?: string }) => (
  <section className={'rounded-2xl border border-slate-700/80 bg-slate-900/80 p-4 ' + className}>
    {kicker && <p className="text-[10px] font-bold uppercase tracking-[.2em] text-cyan-300">{kicker}</p>}
    {title && <h3 className="mb-2 mt-0.5 text-sm font-bold text-white">{title}</h3>}
    {children}
  </section>
);

export const Toggle = ({ label, hint, checked, onChange, accent = 'accent-emerald-400' }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; accent?: string }) => (
  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
    <span><span className="block text-xs font-semibold text-slate-100">{label}</span>{hint && <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{hint}</span>}</span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={'mt-0.5 h-4 w-4 shrink-0 ' + accent} />
  </label>
);

export const Slider = ({ label, value, min, max, step, onChange, fmt, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string; hint?: string }) => (
  <label className="block">
    <span className="flex justify-between text-xs text-slate-300"><span>{label}</span><span className="font-mono text-cyan-300">{fmt ? fmt(value) : value}</span></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-cyan-400" />
    {hint && <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>}
  </label>
);

export function Select<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-300">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100">
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {hint && <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}

export const Btn = ({ children, onClick, disabled, tone = 'cyan', className = '' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: 'cyan' | 'rose' | 'slate' | 'emerald'; className?: string }) => {
  const t = { cyan: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25', rose: 'border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30', slate: 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700', emerald: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25' }[tone];
  return <button disabled={disabled} onClick={onClick} className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${t} ${className}`}>{children}</button>;
};

export function LossChart({ loss, val }: { loss: number[]; val: { step: number; v: number }[] }) {
  const w = 300, h = 80;
  if (loss.length < 2) return <div className="flex h-20 items-center justify-center rounded-lg bg-slate-950 text-[11px] text-slate-500">loss curve appears during training</div>;
  const all = [...loss, ...val.map((v) => v.v)].filter((v) => v > 0);
  const lo = Math.log(Math.min(...all)), hi = Math.log(Math.max(...all));
  const Y = (v: number) => h - 4 - ((Math.log(Math.max(v, 1e-9)) - lo) / Math.max(1e-6, hi - lo)) * (h - 8);
  const sm = loss.map((_, i) => { const a = Math.max(0, i - 4); let s = 0; for (let k = a; k <= i; k++) s += loss[k]; return s / (i - a + 1); });
  const X = (i: number) => (i / (loss.length - 1)) * (w - 4) + 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full rounded-lg bg-slate-950">
      <polyline fill="none" stroke="#38bdf8" strokeWidth="1.2" points={sm.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} />
      <polyline fill="none" stroke="#fbbf24" strokeWidth="1.5" points={val.map((v) => `${X(v.step - 1)},${Y(v.v)}`).join(' ')} />
      <text x="4" y="10" fontSize="8" fill="#38bdf8">train loss (smoothed, log)</text>
      <text x="4" y="20" fontSize="8" fill="#fbbf24">held-out-scene validation</text>
    </svg>
  );
}
