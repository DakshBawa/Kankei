"use client";
import { useLang } from "@/lib/lang";

// Tile-grid cartogram: each state sits on its (col,row) cell.
export default function IndiaMap({ ranked, sel, onSelect }) {
  const { t, nm } = useLang();
  const mx = ranked[0].score,
    mn = ranked[ranked.length - 1].score;
  const pos = {};
  ranked.forEach((s) => (pos[`${s.col},${s.row}`] = s));

  // Dynamic Tile Color Logic: Saffron (India) to Red (Japan)
  const getTileStyle = (k, isSelected) => {
    if (isSelected) {
      return {
        background: "var(--japan-red)",
        color: "#ffffff",
      };
    }

    // Blend between Saffron (#ff9933) and Red (#d92b27) based on normalized score (0 to 1)
    const r = Math.round(255 + (217 - 255) * k);
    const g = Math.round(153 + (43 - 153) * k);
    const b = Math.round(51 + (39 - 51) * k);

    return {
      background: `rgb(${r}, ${g}, ${b})`,
      color: k > 0.5 ? "#ffffff" : "#1b1a17",
    };
  };

  const cells = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 9; c++) {
      const s = pos[`${c},${r}`];
      if (!s) {
        cells.push(<div key={`${c}-${r}`} className="t e" />);
        continue;
      }

      const k = (s.score - mn) / (mx - mn || 1);
      const isSelected = s.code === sel;

      cells.push(
        <button
          key={s.code}
          className={"t" + (isSelected ? " sel" : "")}
          style={getTileStyle(k, isSelected)}
          title={`${nm(s)}: ${s.score.toFixed(1)}`}
          onClick={() => onSelect(s.code)}
        >
          {s.code}
          <small>{s.score.toFixed(0)}</small>
        </button>
      );
    }
  }

  return (
    <section className="card" id="map">
      <h2>{t("scores")}</h2>
      <div className="map">{cells}</div>
      <div className="leg">
        <span>{mn.toFixed(0)}</span>
        <i />
        <span>{mx.toFixed(0)}</span>
      </div>
      <p className="note">{t("foot")}</p>
    </section>
  );
}