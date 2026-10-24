"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/context";
import { useT } from "@/lib/i18n";
import { seedDemo } from "@/lib/api";
import { DemoLabel } from "@/components/UI";

const DEMO_PROFILE = {
  company: "Tanaka Seiki",
  hq: "Osaka, Japan",
  employees: "45",
  product: "Industrial temperature and pressure sensors",
  product_category: "industrial_sensors",
  customer_type: "B2B",
  budget_jpy: "5000000",
  route: "import",
};

export default function OnboardPage() {
  const { lang, setSession, setDemoLoaded } = useApp();
  const tr = useT(lang);
  const router = useRouter();
  const [form, setForm] = useState({
    company: "", hq: "", employees: "", product: "",
    product_category: "industrial_sensors",
    customer_type: "B2B",
    budget_jpy: "",
    route: "export_via_distributor",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fill = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const s = await seedDemo("demo");
      setSession(s);
      setDemoLoaded(true);
      router.push("/research");
    } catch (err) {
      setError(err.message);
      router.push("/research");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => setForm(DEMO_PROFILE);

  return (
    <div className="animate-fadeIn" style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "1.5rem", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, color: "var(--primary)", marginBottom: 6 }}>
          Onboarding
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.84rem" }}>
          Set up your company profile to power AI-driven market entry intelligence.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Company Profile</div>
          <button className="btn btn-outline btn-sm" onClick={handleDemoFill}>
            ⚡ Autofill Demo
          </button>
        </div>

        {form.company === DEMO_PROFILE.company && (
          <div style={{ marginBottom: 16 }}>
            <DemoLabel /> <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: 6 }}>Tanaka Seiki demo persona loaded</span>
          </div>
        )}

        {error && (
          <div className="error-state" style={{ marginBottom: 16 }}>
            ⚠ {error} — navigating to Research with cached data.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Company Name *</label>
              <input className="form-input" value={form.company} onChange={e => fill({ company: e.target.value })} placeholder="e.g. Tanaka Seiki K.K." required />
            </div>
            <div className="form-group">
              <label className="form-label">Headquarters</label>
              <input className="form-input" value={form.hq} onChange={e => fill({ hq: e.target.value })} placeholder="City, Japan" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Product / Service Description *</label>
            <textarea className="form-input" rows={2} value={form.product} onChange={e => fill({ product: e.target.value })} placeholder="Describe what you sell" required style={{ resize: "none" }} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Product Category *</label>
              <select className="form-input form-select" value={form.product_category} onChange={e => fill({ product_category: e.target.value })}>
                <option value="industrial_sensors">Industrial Sensors</option>
                <option value="auto_components">Auto Components</option>
                <option value="consumer_goods">Consumer Goods</option>
                <option value="general">General</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Business Model</label>
              <select className="form-input form-select" value={form.customer_type} onChange={e => fill({ customer_type: e.target.value })}>
                <option value="B2B">B2B</option>
                <option value="B2C">B2C</option>
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Budget (JPY)</label>
              <input className="form-input" type="number" value={form.budget_jpy} onChange={e => fill({ budget_jpy: e.target.value })} placeholder="5000000" min={0} />
            </div>
            <div className="form-group">
              <label className="form-label">Employees</label>
              <input className="form-input" type="number" value={form.employees} onChange={e => fill({ employees: e.target.value })} placeholder="45" min={1} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Entry Route</label>
            <select className="form-input form-select" value={form.route} onChange={e => fill({ route: e.target.value })}>
              <option value="export_via_distributor">Export via Distributor</option>
              <option value="contract_manufacturing">Contract Manufacturing</option>
              <option value="joint_venture">Joint Venture</option>
              <option value="wholly_owned_subsidiary">Wholly Owned Subsidiary</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 1 }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
              {loading ? "Seeding demo…" : "Continue to Research →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
