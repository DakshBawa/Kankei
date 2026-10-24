"use client";
import { SECTORS } from "@/lib/seed";
import { useLang } from "@/lib/lang";

export default function PersonaForm({ persona, onChange }) {
  const { t } = useLang();
  const set = (k, v) => onChange({ ...persona, [k]: v });
  return (
    <div className="card" id="persona">
      <h2>{t("persona")}</h2>
      <label>{t("company")}</label>
      <input type="text" value={persona.company} onChange={(e) => set("company", e.target.value)} />
      <label>{t("sector")}</label>
      <select value={persona.sector} onChange={(e) => set("sector", e.target.value)}>
        {SECTORS.map((s) => <option key={s} value={s}>{t(s)}</option>)}
      </select>
      <label>{t("inv")}</label>
      <input type="number" min="1" value={persona.investment} onChange={(e) => set("investment", +e.target.value || 0)} />
      <label>{t("hc")}</label>
      <input type="number" min="10" value={persona.headcount} onChange={(e) => set("headcount", +e.target.value || 0)} />
      <div className="chk">
        <input type="checkbox" checked={persona.exporter} onChange={(e) => set("exporter", e.target.checked)} />
        <span>{t("exp")}</span>
      </div>
    </div>
  );
}
