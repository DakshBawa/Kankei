"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang";

const ITEMS = [
  ["persona", "persona"],
  ["weightsec", "weights"],
  ["map", "m2"],
  ["rank", "ranking"],
  ["whycard", "why"],
  ["about", "aT"],
  ["picks", "pT"],
  ["method", "rT"],
  ["contact", "cT"],
];

export default function Navbar({ source, go, onDemo, onBrief }) {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const close = (fn) => () => {
    setOpen(false);
    if (fn) fn();
  };

  return (
    <>
      <header className="top">
        <div className="brand">
          <span className="mk">印</span>
          <b className="brand-name">
            関係 <span className="kankei-text">Kankei</span>
          </b>
        </div>
        <span className="badge">
          {source === "api" ? t("live") : t("")}
        </span>
      </header>

      <div id="fm" className={open ? "open" : ""}>
        <div className="row">
          <button id="fmb" onClick={() => setOpen(!open)}>
            {t("menu")}
          </button>
        </div>

        <div id="fp">
          {ITEMS.map(([id, k], i) => (
            <button
              key={id}
              className="m2"
              style={{ animationDelay: i * 40 + "ms" }}
              onClick={close(() => go(id))}
            >
              {t(k)}
            </button>
          ))}
          <button
            className="m2"
            style={{ animationDelay: "360ms" }}
            onClick={close(onBrief)}
          >
            {t("m4")}
          </button>
          <hr />
          <button className="m2" onClick={close(onDemo)}>
            {t("cta2")}
          </button>
          <div className="lg">
            {["en", "ja"].map((l) => (
              <button
                key={l}
                className={lang === l ? "on" : ""}
                onClick={() => setLang(l)}
              >
                {l === "en" ? "EN" : "日本語"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}