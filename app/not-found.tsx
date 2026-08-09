import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ alignItems: "center", background: "#f5f7f6", display: "flex", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
      <section style={{ background: "#fff", border: "1px solid #dfe5e1", borderRadius: 8, maxWidth: 520, padding: 40, textAlign: "center", width: "100%" }}>
        <Search aria-hidden color="#087a46" size={30} />
        <h1 style={{ fontSize: 26, margin: "20px 0 10px" }}>没有找到这个页面</h1>
        <p style={{ color: "#6f7b75", fontSize: 13, lineHeight: 1.7, margin: "0 0 24px" }}>链接可能已经调整。你可以返回官网，或继续浏览北京试点教练。</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href="/" style={{ alignItems: "center", border: "1px solid #cbd4cf", borderRadius: 5, display: "inline-flex", fontSize: 12, fontWeight: 700, gap: 6, minHeight: 44, padding: "0 15px" }}><ArrowLeft aria-hidden size={16} />返回官网</Link>
          <Link href="/coaches" style={{ alignItems: "center", background: "#087a46", borderRadius: 5, color: "#fff", display: "inline-flex", fontSize: 12, fontWeight: 700, minHeight: 44, padding: "0 15px" }}>浏览教练</Link>
        </div>
      </section>
    </main>
  );
}

