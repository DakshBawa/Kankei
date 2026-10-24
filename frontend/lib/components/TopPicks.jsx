"use client";
import { FACTORS } from "@/lib/seed";
import { edges, tileColor } from "@/lib/scoring";
import { useLang } from "@/lib/lang";

export default function TopPicks({ ranked, states, weights, onView }) {
  const { t, lang, nm } = useLang();
  const lo = ranked[ranked.length - 1].score, hi = ranked[0].score;
  return (
    <section className="blk" id="picks">
      <h2>{t("pT")}</h2>
      <div className="pg">
        {ranked.slice(0, 6).map((s, i) => {
          const k = (s.score - lo) / (hi - lo || 1);
          const names = edges(states, s, weights).slice(0, 2).map((o) => (lang === "ja" ? FACTORS[o.i].ja : FACTORS[o.i].en)).join(" · ");
          return (
            <div className="pc" key={s.code}>
              <div className="im" style={{ background: tileColor(k), color: k > 0.5 ? "#fff" : "#1b1a17" }}>{s.code}</div>
              <span className="sc">{s.score.toFixed(1)}</span>
              <b>{i + 1}. {nm(s)}</b>
              <small>{names}</small>
              <button onClick={() => onView(s.code)}>{t("view")}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
