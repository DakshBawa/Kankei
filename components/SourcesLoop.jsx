const SRC = ["DPIIT", "NITI Aayog", "RBI Handbook", "CEA", "AISHE", "PLFS", "NSDC", "NICDC", "DFCCIL"];
export default function SourcesLoop() {
  return (
    <div className="loop"><div className="trk">{[...SRC, ...SRC].map((s, i) => <span key={i}>{s}</span>)}</div></div>
  );
}
