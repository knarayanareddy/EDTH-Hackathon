import Link from "next/link";
import { IDEAS, TRACKS } from "@/lib/ideas";

export function Sidebar() {
  const reviews = IDEAS.filter((i) => i.group === "review");
  const fresh = IDEAS.filter((i) => i.group === "new");
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 px-4 py-6 md:block scroll-thin">
      <Link href="/" className="block">
        <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">Almere 2026</p>
        <p className="text-lg font-bold text-white">Idea Dossier</p>
        <p className="text-xs text-slate-400">Review · critique · live previews</p>
      </Link>

      <nav className="mt-6 space-y-6 text-sm">
        <div className="space-y-1">
          <Link className="block rounded-md px-2 py-1.5 text-slate-200 hover:bg-slate-800" href="/">
            Overview & decision matrix
          </Link>
          <Link className="block rounded-md px-2 py-1.5 text-slate-200 hover:bg-slate-800" href="/research">
            Research notes & fact-check
          </Link>
          <Link className="block rounded-md px-2 py-1.5 text-slate-200 hover:bg-slate-800" href="/more">
            More ideas to consider
          </Link>
        </div>

        <div>
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Your 9 ideas reviewed
          </p>
          <ul className="space-y-0.5">
            {reviews.map((i) => (
              <li key={i.slug}>
                <Link
                  href={`/ideas/${i.slug}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <span className={`h-2 w-2 rounded-full ${TRACKS[i.track].dot}`} />
                  <span className="w-4 text-slate-500">{i.n}</span>
                  {i.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            New ideas
          </p>
          <ul className="space-y-0.5">
            {fresh.map((i) => (
              <li key={i.slug}>
                <Link
                  href={`/ideas/${i.slug}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <span className={`h-2 w-2 rounded-full ${TRACKS[i.track].dot}`} />
                  <span className="w-4 text-slate-500">{i.n}</span>
                  {i.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </aside>
  );
}
