"use client";
import { useState } from "react";
import { postContact } from "@/lib/api";
import { useLang } from "@/lib/lang";

export default function ContactForm() {
  const { t } = useLang();
  const [f, setF] = useState({ name: "", email: "", message: "" });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const send = async () => {
    try { await postContact(f); setMsg("cok"); setF({ name: "", email: "", message: "" }); }
    catch { setMsg("cerr"); }
  };
  return (
    <section className="blk" id="contact">
      <h2>{t("cT")}</h2>
      <div className="cfm">
        <label>{t("cN")}</label><input type="text" value={f.name} onChange={set("name")} />
        <label>{t("cE")}</label><input type="text" value={f.email} onChange={set("email")} />
        <label>{t("cM")}</label><textarea value={f.message} onChange={set("message")} />
        <button className="p" onClick={send}>{t("cS")}</button>
        <p className="sm">{msg && t(msg)}</p>
      </div>
    </section>
  );
}
