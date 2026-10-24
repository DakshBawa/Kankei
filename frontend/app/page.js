"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { getStates } from "@/lib/api";
import { SEED_STATES } from "@/lib/seed";
import { presetWeights, rank } from "@/lib/scoring";
import { useLang } from "@/lib/lang";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import PersonaForm from "@/components/PersonaForm";
import WeightSliders from "@/components/WeightSliders";
import IndiaMap from "@/components/IndiaMap";
import Ranking from "@/components/Ranking";
import WhyCard from "@/components/WhyCard";
import TopPicks from "@/components/TopPicks";
import SourcesLoop from "@/components/SourcesLoop";
import Info from "@/components/Info";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import BriefModal from "@/components/BriefModal";

const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
const PRESET_KEYS = ["sector", "investment", "headcount", "exporter"];

export default function Home() {
  const { nm } = useLang();
  const [states, setStates] = useState(SEED_STATES);
  const [source, setSource] = useState("seed");
  const [persona, setPersona] = useState({ company: "Nippon Precision Co.", sector: "el", investment: 50, headcount: 800, exporter: true });
  const [weights, setWeights] = useState(() => presetWeights({ sector: "el", investment: 50, headcount: 800, exporter: true }));
  const [sel, setSel] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => { getStates().then((r) => { setStates(r.states); setSource(r.source); }); }, []);
  useEffect(() => () => clearInterval(timer.current), []);

  const ranked = useMemo(() => rank(states, weights, persona.sector), [states, weights, persona.sector]);
  const selected = ranked.find((s) => s.code === sel) || ranked[0];

  const updatePersona = (p) => {
    if (PRESET_KEYS.some((k) => p[k] !== persona[k])) setWeights(presetWeights(p));
    setPersona(p);
  };
  const setWeight = (i, v) => setWeights((w) => w.map((x, j) => (j === i ? v : x)));

  const runDemo = () => {
    clearInterval(timer.current);
    const p = { ...persona, sector: "el" };
    setPersona(p);
    const w = presetWeights(p);
    setWeights(w);
    go("map");
    let v = w[0];
    timer.current = setInterval(() => {
      if (v >= 8) return clearInterval(timer.current);
      v++;
      setWeight(0, v);
    }, 450);
  };

  const leader = `#1 ${nm(ranked[0])} · ${ranked[0].score.toFixed(1)}`;

  return (
    <>
      <Navbar source={source} leader={leader} go={go} onDemo={runDemo} onBrief={() => setBriefOpen(true)} />
      <Hero ranked={ranked} onStart={() => go("persona")} onDemo={runDemo} />
      <main>
        <section>
          <PersonaForm persona={persona} onChange={updatePersona} />
          <WeightSliders weights={weights} onChange={setWeight} />
          <button className="p" onClick={() => setBriefOpen(true)}>資料 · Brief</button>
        </section>
        <IndiaMap ranked={ranked} sel={selected.code} onSelect={setSel} />
        <section>
          <Ranking ranked={ranked} sel={selected.code} onSelect={setSel} />
          <WhyCard states={states} state={selected} rankPos={ranked.indexOf(selected) + 1} weights={weights} sector={persona.sector} />
        </section>
      </main>
      <Info />
      <TopPicks ranked={ranked} states={states} weights={weights} onView={(c) => { setSel(c); go("map"); }} />
      <SourcesLoop />
      <Footer />
      <ScrollToTop />
      <BriefModal open={briefOpen} onClose={() => setBriefOpen(false)} persona={persona} weights={weights} ranked={ranked} states={states} />
    </>
  );
}
