"use client";
import { useEffect, useState } from "react";
import { FACTORS, SECTOR_JA } from "@/lib/seed";
import { edges } from "@/lib/scoring";
import { postBrief } from "@/lib/api";

// The 資料 one-pager is always Japanese. If POST /api/brief answers with
// { conclusion, reasons[] } those texts replace the locally generated ones.
export default function BriefModal({ open, onClose, persona, weights, ranked, states }) {
  const [remote, setRemote] = useState(null);
  const top = ranked.slice(0, 5), w = ranked[0];
  useEffect(() => {
    if (!open) return;
    setRemote(null);
    postBrief({ persona, weights, ranking: top.map((s) => ({ code: s.code, score: +s.score.toFixed(2) })) })
      .then(setRemote).catch(() => setRemote(null));
  }, [open]); // eslint-disable-line
  if (!open) return null;
  const reasons = remote?.reasons?.length ? remote.reasons
    : edges(states, w, weights).slice(0, 3).map((o) => `${FACTORS[o.i].ja}：${o.v}点（全州平均比 ${o.d >= 0 ? "+" : ""}${o.d.toFixed(0)}pt）`);
  return (
    <div id="ov" onClick={(e) => e.target.id === "ov" && onClose()}>
      <div className="paper">
        <div className="x"><button onClick={() => window.print()}>印刷</button><button onClick={onClose}>閉じる</button></div>
        <h3>インド進出候補州 評価資料</h3>
        <div className="s">作成日：{new Date().toLocaleDateString("ja-JP")}　|　対象：{persona.company}</div>
        <h4>1. 前提条件</h4>
        <ul><li>業種：{SECTOR_JA[persona.sector]}</li><li>投資規模：約{persona.investment}百万米ドル</li><li>想定従業員数：{persona.headcount.toLocaleString()}名</li><li>輸出志向：{persona.exporter ? "あり（港湾アクセス重視）" : "なし"}</li></ul>
        <h4>2. 結論</h4>
        <p style={{ fontSize: 15, margin: "4px 0" }}><b>{remote?.conclusion || `第一候補：${w.nameJa}州（総合 ${w.score.toFixed(1)}点）`}</b></p>
        <p style={{ fontSize: 13, margin: "4px 0" }}>次点は{top[1].nameJa}（{top[1].score.toFixed(1)}点）、{top[2].nameJa}（{top[2].score.toFixed(1)}点）。</p>
        <h4>3. 上位5州ランキング</h4>
        <table>
          <thead><tr><th>順位</th><th>州</th>{FACTORS.map((f) => <th key={f.key}>{f.ja}</th>)}<th>総合</th></tr></thead>
          <tbody>{top.map((s, i) => <tr key={s.code}><td>{i + 1}</td><td>{s.nameJa}</td>{s.scores.map((v, j) => <td key={j}>{v}</td>)}<td><b>{s.score.toFixed(1)}</b></td></tr>)}</tbody>
        </table>
        <div className="s">評価ウェイト：{FACTORS.map((f, i) => `${f.ja} ${weights[i]}`).join(" / ")}</div>
        <h4>4. {w.nameJa}を推奨する主な理由</h4>
        <ul>{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        <h4>5. 出典</h4>
        <ul>{FACTORS.map((f) => <li className="s" key={f.key}>{f.ja}：{f.srcJa}</li>)}</ul>
      </div>
    </div>
  );
}
