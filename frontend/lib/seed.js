// Lightweight seed fixtures for offline/mock mode
// Matches backend Pydantic schemas — used when NEXT_PUBLIC_USE_MOCKS=true

export const SEED_STATES = [
  {
    rank: 1, state: "Gujarat", score: 82.4,
    factors: [
      { factor: "demand", value: 0.88, weight: 3.0, contribution: 9.24 },
      { factor: "cluster", value: 0.92, weight: 3.0, contribution: 9.68 },
      { factor: "japan_presence", value: 0.75, weight: 2.5, contribution: 6.56 },
      { factor: "logistics", value: 0.85, weight: 2.0, contribution: 5.94 },
      { factor: "incentives", value: 0.78, weight: 2.0, contribution: 5.46 },
      { factor: "cost", value: 0.65, weight: 1.5, contribution: 3.41 },
      { factor: "talent", value: 0.70, weight: 1.5, contribution: 3.68 },
      { factor: "ease_of_business", value: 0.80, weight: 2.0, contribution: 5.60 },
      { factor: "power", value: 0.82, weight: 1.5, contribution: 4.30 },
    ],
    top_factors: [
      { factor: "cluster", value: 0.92, weight: 3.0, contribution: 9.68 },
      { factor: "demand", value: 0.88, weight: 3.0, contribution: 9.24 },
      { factor: "logistics", value: 0.85, weight: 2.0, contribution: 5.94 },
    ],
    language_notes: "Gujarati/Hindi primary; English widely spoken in business",
    data_sources: "Ministry of Commerce, DPIIT, State Investment Promotion Board",
    last_verified: "2025-01-15"
  },
  {
    rank: 2, state: "Maharashtra", score: 78.1,
    factors: [
      { factor: "demand", value: 0.92, weight: 3.0, contribution: 9.68 },
      { factor: "cluster", value: 0.85, weight: 3.0, contribution: 8.93 },
      { factor: "japan_presence", value: 0.82, weight: 2.5, contribution: 7.18 },
      { factor: "logistics", value: 0.90, weight: 2.0, contribution: 6.30 },
      { factor: "incentives", value: 0.60, weight: 2.0, contribution: 4.20 },
      { factor: "cost", value: 0.45, weight: 1.5, contribution: 2.36 },
      { factor: "talent", value: 0.88, weight: 1.5, contribution: 4.62 },
      { factor: "ease_of_business", value: 0.75, weight: 2.0, contribution: 5.25 },
      { factor: "power", value: 0.72, weight: 1.5, contribution: 3.78 },
    ],
    top_factors: [
      { factor: "demand", value: 0.92, weight: 3.0, contribution: 9.68 },
      { factor: "logistics", value: 0.90, weight: 2.0, contribution: 6.30 },
      { factor: "talent", value: 0.88, weight: 1.5, contribution: 4.62 },
    ],
    language_notes: "Marathi/Hindi/English; strong Japanese business community in Pune",
    data_sources: "Ministry of Commerce, DPIIT, Maharashtra Industrial Development Corporation",
    last_verified: "2025-01-15"
  },
  {
    rank: 3, state: "Tamil Nadu", score: 75.6,
    factors: [
      { factor: "demand", value: 0.80, weight: 3.0, contribution: 8.40 },
      { factor: "cluster", value: 0.82, weight: 3.0, contribution: 8.61 },
      { factor: "japan_presence", value: 0.65, weight: 2.5, contribution: 5.69 },
      { factor: "logistics", value: 0.85, weight: 2.0, contribution: 5.95 },
      { factor: "incentives", value: 0.75, weight: 2.0, contribution: 5.25 },
      { factor: "cost", value: 0.70, weight: 1.5, contribution: 3.68 },
      { factor: "talent", value: 0.85, weight: 1.5, contribution: 4.46 },
      { factor: "ease_of_business", value: 0.72, weight: 2.0, contribution: 5.04 },
      { factor: "power", value: 0.78, weight: 1.5, contribution: 4.10 },
    ],
    top_factors: [
      { factor: "cluster", value: 0.82, weight: 3.0, contribution: 8.61 },
      { factor: "demand", value: 0.80, weight: 3.0, contribution: 8.40 },
      { factor: "logistics", value: 0.85, weight: 2.0, contribution: 5.95 },
    ],
    language_notes: "Tamil/English; Chennai has strong auto and electronics cluster",
    data_sources: "Ministry of Commerce, TIDCO, DPIIT",
    last_verified: "2025-01-15"
  },
];

export const SEED_PARTNERS = [
  {
    partner: {
      partner_id: "p001", name: "Bharat Forgings Ltd.", state: "Maharashtra", sector: "Auto Components",
      type: "Contract Manufacturer", turnover_band: "INR 500Cr+", years_in_business: 28,
      japan_client_experience: "Extensive (Toyota, Denso)", language: "English + Japanese interpreter",
      brands_handled: ["Bosch", "Continental"], directors: "Rajesh Kumar Gupta"
    },
    match_score: 84.2, fit_score: 87.5,
    trust: { partner_id: "p001", score: 79.3, tier: "A", components: [], flags: [] },
    fit_components: [
      { name: "Japan Experience", score: 92, weight: 0.3, note: "Direct Toyota/Denso relationships" },
      { name: "Sector Fit", score: 88, weight: 0.25, note: "Auto components alignment" },
      { name: "Scale", score: 82, weight: 0.2, note: "Capacity meets requirement" },
    ],
    state_opportunity_score: 78.1, conflicts: [], reasons: ["Strong Japan client track record", "Exceeds quality certifications"]
  },
  {
    partner: {
      partner_id: "p002", name: "Precision Sensors India Pvt. Ltd.", state: "Gujarat", sector: "Industrial Sensors",
      type: "Distributor", turnover_band: "INR 50-200Cr", years_in_business: 12,
      japan_client_experience: "Some (Omron)", language: "English",
      brands_handled: ["Omron", "Keyence"], directors: "Priya Shah"
    },
    match_score: 79.8, fit_score: 82.1,
    trust: { partner_id: "p002", score: 75.8, tier: "A", components: [], flags: ["Concentrated customer base"] },
    fit_components: [
      { name: "Product Category Fit", score: 95, weight: 0.3, note: "Industrial sensors specialist" },
      { name: "Geographic Reach", score: 80, weight: 0.2, note: "Strong in Gujarat/Maharashtra" },
      { name: "Language", score: 72, weight: 0.15, note: "English capable, no Japanese" },
    ],
    state_opportunity_score: 82.4, conflicts: ["Handles competing brand: Keyence"], reasons: ["Best-fit sector alignment", "Target state presence"]
  },
];
