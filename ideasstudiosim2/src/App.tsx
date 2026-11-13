import React, { useState } from "react";
import { AuditAndMergerView } from "./components/AuditAndMergerView";
import { UkraineFrontlineView } from "./components/UkraineFrontlineView";
import { BenchmarkTacticalView } from "./components/BenchmarkTacticalView";
import { NexusTrustLineView } from "./components/NexusTrustLineView";
import { MantaviaCableGuardView } from "./components/MantaviaCableGuardView";
import { ThermalClearHotView } from "./components/ThermalClearHotView";
import { PhalanxSwarmView } from "./components/PhalanxSwarmView";
import {
  Anchor,
  Compass,
  Cpu,
  Flame,
  GitMerge,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type TabId =
  | "audit"
  | "ukraine"
  | "benchmark"
  | "nexus"
  | "mantavia"
  | "thermal"
  | "phalanx";

const TABS: {
  id: TabId;
  shortLabel: string;
  subLabel: string;
  badgeColor: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: "audit",
    shortLabel: "1. Package Review & 28→5 Merger",
    subLabel: "hackreview + hack2ndrun + Master Brief",
    badgeColor: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
    icon: GitMerge,
  },
  {
    id: "ukraine",
    shortLabel: "2. Ukraine 2026 Frontline Lab",
    subLabel: "Nightmares, What Works & New Ideas",
    badgeColor: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    icon: Flame,
  },
  {
    id: "benchmark",
    shortLabel: "3. Benchmark Repo → Tactical GTT",
    subLabel: "Ground Truth Circle + Atech BlindSpot",
    badgeColor: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    icon: ShieldCheck,
  },
  {
    id: "nexus",
    shortLabel: "4. Nexus: TRUSTLINE v2",
    subLabel: "Video Geolocation + DEM + OSINT",
    badgeColor: "text-sky-300 border-sky-500/40 bg-sky-500/10",
    icon: Compass,
  },
  {
    id: "mantavia",
    shortLabel: "5. Mantavia: CABLEGUARD v2",
    subLabel: "Causal AIS + Samus Swan + ISR Plan",
    badgeColor: "text-yellow-300 border-yellow-500/40 bg-yellow-500/10",
    icon: Anchor,
  },
  {
    id: "thermal",
    shortLabel: "6. Thermal: CLEARHOT 14-Bit",
    subLabel: "FPGA Streaming ISP + .bin Loader",
    badgeColor: "text-rose-300 border-rose-500/40 bg-rose-500/10",
    icon: Cpu,
  },
  {
    id: "phalanx",
    shortLabel: "7. Own Challenge: PHALANX Swarm",
    subLabel: "Counter-Shahed Red-Team & Evidence",
    badgeColor: "text-violet-300 border-violet-500/40 bg-violet-500/10",
    icon: Radar,
  },
];

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>("audit");

  const handleNavigate = (tab: string) => {
    if (TABS.some((t) => t.id === tab)) {
      setActiveTab(tab as TabId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#040911] text-slate-100 selection:bg-cyan-500/30">
      {/* Top Tactical Command Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-[#050c17]/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 shadow-inner">
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold tracking-tight text-white sm:text-lg">
                    EDTH COMMAND & RESEARCH SUITE
                  </h1>
                  <span className="hidden rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 sm:inline-block">
                    UNIFIED END-TO-END EDITION
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  End-to-End Review of <code>combined_hackathon_package</code> · Ukraine 2025–2026
                  Frontline Intelligence · <code>benchmark</code> Tactical Synthesis · 5 Live
                  Prototypes
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 font-mono text-[11px] text-slate-400 xl:flex">
              <span className="rounded border border-slate-800 bg-slate-900/90 px-2.5 py-1">
                SIMULATIONS EXPLICITLY LABELLED
              </span>
              <span className="rounded border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-1 text-cyan-300">
                5 CODE BUGS VERIFIED & FIXED
              </span>
            </div>
          </div>

          {/* 7-Tab Navigation Strip */}
          <nav className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col justify-between rounded-lg border px-2.5 py-2 text-left transition ${
                    isActive
                      ? "border-cyan-400 bg-slate-800/95 shadow-md"
                      : "border-slate-800/90 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`truncate text-xs font-bold ${
                        isActive ? "text-white" : "text-slate-300"
                      }`}
                    >
                      {tab.shortLabel}
                    </span>
                    <Icon
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? "text-cyan-400" : "text-slate-500"
                      }`}
                    />
                  </div>
                  <div className="mt-0.5 truncate text-[10px] text-slate-400">{tab.subLabel}</div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === "audit" && <AuditAndMergerView onNavigateTab={handleNavigate} />}
        {activeTab === "ukraine" && <UkraineFrontlineView onNavigateTab={handleNavigate} />}
        {activeTab === "benchmark" && <BenchmarkTacticalView />}
        {activeTab === "nexus" && <NexusTrustLineView />}
        {activeTab === "mantavia" && <MantaviaCableGuardView />}
        {activeTab === "thermal" && <ThermalClearHotView />}
        {activeTab === "phalanx" && <PhalanxSwarmView />}
      </main>

      {/* Footer with Evidence Guardrails */}
      <footer className="mt-12 border-t border-slate-800/80 bg-slate-950/90 py-6 text-xs text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6">
          <div>
            <strong className="text-slate-200">Evidence & Integrity Guardrail:</strong> All
            interactive previews use clearly labelled synthetic/replay trajectories unless you load
            your local <code>.bin</code> or DMA AIS Parquet files. Missing telemetry is always
            represented as <code>STALE / UNKNOWN</code>, never as “All Clear.”
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            EDTH Unified Suite · Built from hackreview + hack2ndrun + hackideasreviewed + benchmark
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
