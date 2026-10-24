"use client";

import Image from "next/image";
import { useLang } from "@/lib/lang";

export default function Hero({ onStart, onDemo }) {
  const { t } = useLang();

  return (
    <div className="hero-wrapper">
      {/* Main Hero Container with Background Image */}
      <section className="hero">
        <Image
          src="/Front.jpg"
          alt="Hero Background"
          fill
          priority
        />

        {/* Brand Name on Top-Left */}
        <div className="hero-top-left">
          <h1 className="hero-kaneki">
            <span className="kanji-main">関係</span>
            <span className="kaneki-sub">KANKEI</span>
          </h1>
        </div>
      </section>

      {/* CTA Buttons Centered Below Hero */}
      <div className="cta cta-below-hero">
        <button className="a" onClick={onStart}>{t("cta1")}</button>
        <button className="b2" onClick={onDemo}>{t("cta2")}</button>
      </div>
    </div>
  );
}