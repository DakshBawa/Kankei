"use client";
import { FACTORS } from "@/lib/seed";
import { useLang } from "@/lib/lang";

export default function WeightSliders({ weights, onChange }) {
  const { t, lang } = useLang();
  return (
    <div className="card" id="weightsec">
      <h2>{t("weights")}</h2>
      {FACTORS.map((f, i) => (
        <div className="sl" key={f.key}>
          <div><span>{lang === "ja" ? f.ja : f.en}</span><b>{weights[i]}</b></div>
          <input type="range" min="0" max="10" value={weights[i]} onChange={(e) => onChange(i, +e.target.value)} />
        </div>
      ))}
    </div>
  );
}
