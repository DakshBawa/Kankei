"use client";
import { useLang } from "@/lib/lang";

export default function Info() {
  const { t } = useLang();
  return (
    <>
      <section className="blk" id="about"><h2>{t("aT")}</h2><p>{t("aP")}</p></section>
      <section className="blk" id="method">
        <h2>{t("rT")}</h2>
        <div className="three">
          {["r1", "r2", "r3"].map((k) => <div key={k}><b>{t(k + "h")}</b><p>{t(k)}</p></div>)}
        </div>
      </section>
    </>
  );
}
