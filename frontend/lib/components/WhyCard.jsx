"use client";
import { FACTORS } from "@/lib/seed";
import { edges } from "@/lib/scoring";
import { useLang } from "@/lib/lang";

export default function WhyCard({ states, state, rankPos, weights, sector }) {
  const { t, lang, nm } = useLang();
  const top = edges(states, state, weights).slice(0, 3);
  const inCluster = state.sectors?.includes(sector);
  return (
    <div className="card" id="whycard">
      <h2>{t("why")}</h2>
      <b className="big">{nm(state)}</b> <span className="mut">· #{rankPos} · {state.score.toFixed(1)}</span>
      {inCluster && <div className="mut sm">{t("cluster").replace("{s}", t(sector))}</div>}
      {top.map((o) => {
        const f = FACTORS[o.i];
        return (
          <div className="fac" key={f.key}>
            <div><span>{lang === "ja" ? f.ja : f.en}</span><span>{o.v} <small>({o.d >= 0 ? "+" : ""}{o.d.toFixed(0)} {t("vsavg")})</small></span></div>
            <div className="bar"><i style={{ width: `${o.v}%` }} /></div>
            <small>{lang === "ja" ? f.srcJa : f.srcEn}</small>
          </div>
        );
      })}
      <div className="mut sm" style={{ marginTop: 8 }}>{t("whynote")}</div>
    </div>
  );
}
