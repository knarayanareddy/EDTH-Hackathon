import Link from "next/link";
import { notFound } from "next/navigation";
import { BY_SLUG, IDEAS, TRACKS, weighted } from "@/lib/ideas";
import { IdeaWorkspace } from "@/components/IdeaWorkspace";
import { PreviewShell, Panel } from "@/components/ui";
import { renderPreview } from "@/components/previews";

export function generateStaticParams() {
  return IDEAS.map((i) => ({ slug: i.slug }));
}

export default async function IdeaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const idea = BY_SLUG[slug];
  if (!idea) notFound();

  const idx = IDEAS.findIndex((i) => i.slug === slug);
  const prev = IDEAS[idx - 1];
  const next = IDEAS[idx + 1];
  const t = TRACKS[idea.track];

  return (
    <article className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-md border px-2 py-0.5 font-semibold ${t.chip}`}>{t.label}</span>
          <span className="text-slate-500">{idea.group === "review" ? `Idea ${idea.n} of your list` : `New idea ${idea.n}`}</span>
          <span className="text-slate-500">· {idea.trackNote}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">{idea.title}</h1>
        <p className="mt-1 text-lg italic text-slate-300">“{idea.tagline}”</p>
      </header>

      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-cyan-400 px-2 py-0.5 text-xs font-bold uppercase text-slate-950">
            My call: {idea.rec}
          </span>
          <span className="text-sm text-slate-300">Weighted score {weighted(idea.scores).toFixed(2)} / 5</span>
        </div>
        <p className="mt-2 text-base text-white">{idea.verdict}</p>
      </div>

      <PreviewShell title={idea.previewTitle} how={idea.previewHow}>
        {renderPreview(idea.slug)}
      </PreviewShell>

      <Panel title="What I make of it">
        <div className="space-y-3 text-[15px] leading-relaxed text-slate-200">
          {idea.take.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="✓ What is strong">
          <ul className="space-y-2 text-sm text-slate-200">
            {idea.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-emerald-400">+</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="⚠ Risks">
          <ul className="space-y-2 text-sm text-slate-200">
            {idea.risks.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-amber-400">!</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Recommended changes">
        <ol className="space-y-2 text-sm text-slate-200">
          {idea.changes.map((c, i) => (
            <li key={c} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold text-cyan-300">
                {i + 1}
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Questions for the mentors (ask early)">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
            {idea.ask.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Panel>
        <Panel title="Team to look for">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-200">
            {idea.team.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Suggested build order">
        <ol className="space-y-2">
          {idea.plan.map((p) => (
            <li key={p.when} className="grid grid-cols-[110px_1fr] gap-3 text-sm">
              <span className="font-semibold text-cyan-300">{p.when}</span>
              <span className="text-slate-200">{p.what}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Sources I checked">
        <ul className="space-y-1 text-sm">
          {idea.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline-offset-2 hover:underline">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </Panel>

      <IdeaWorkspace slug={idea.slug} defaults={idea.scores} />

      <nav className="flex justify-between text-sm">
        {prev ? (
          <Link href={`/ideas/${prev.slug}`} className="text-slate-300 hover:text-cyan-300">
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/ideas/${next.slug}`} className="text-slate-300 hover:text-cyan-300">
            {next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
