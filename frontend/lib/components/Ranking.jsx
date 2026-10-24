"use client";
import { useLang } from "@/lib/lang";

export default function Ranking({ ranked, sel, onSelect }) {
  const { t, nm } = useLang();
  const mx = ranked[0].score;
  return (
    <div className="card" id="rank">
      <h2>{t("ranking")}</h2>
      <ol className="rk">
        {ranked.map((s, i) => (
          <li key={s.code} className={s.code === sel ? "sel" : ""} onClick={() => onSelect(s.code)}>
            <span className="n">{i + 1}</span>
            <div>{nm(s)}<div className="b" style={{ width: `${(s.score / mx) * 100}%` }} /></div>
            <b>{s.score.toFixed(1)}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}
