"use client";
import { useEffect, useState } from "react";
export default function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const f = () => setShow(scrollY > 500);
    addEventListener("scroll", f);
    return () => removeEventListener("scroll", f);
  }, []);
  return show ? <button id="up" aria-label="Top" onClick={() => scrollTo({ top: 0, behavior: "smooth" })}>↑</button> : null;
}
