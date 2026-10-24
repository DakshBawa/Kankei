// Demo data. Used when the backend is unreachable or NEXT_PUBLIC_USE_SEED=1.
// Scores are PLACEHOLDERS (0-100) in this order: cost, talent, infra, policy, logistics, ease.
export const FACTORS = [
  { key: "cost", en: "Cost", ja: "コスト", srcEn: "State wage and land-cost benchmarks (RBI Handbook; state industrial land boards)", srcJa: "州別の賃金・土地コスト指標（RBIハンドブック、州産業用地公社）" },
  { key: "talent", en: "Talent", ja: "人材", srcEn: "Skilled-workforce supply (AISHE; PLFS; NSDC skill gap)", srcJa: "技能人材の供給（AISHE、PLFS、NSDCスキルギャップ調査）" },
  { key: "infra", en: "Infrastructure", ja: "インフラ", srcEn: "Power, roads and industrial parks (CEA; NITI Aayog; NICDC)", srcJa: "電力・道路・工業団地（CEA、NITI Aayog、NICDC）" },
  { key: "policy", en: "Incentives", ja: "政策・優遇", srcEn: "State industrial policies and PLI/SEZ coverage (DPIIT; state policy gazettes)", srcJa: "州産業政策とPLI／SEZの適用状況（DPIIT、州政策官報）" },
  { key: "logi", en: "Logistics", ja: "物流", srcEn: "Port and freight-corridor proximity (NITI Aayog Export Preparedness Index; DFCCIL)", srcJa: "港湾・貨物専用回廊への近接性（NITI Aayog輸出準備度指数、DFCCIL）" },
  { key: "ease", en: "Ease of business", ja: "事業環境", srcEn: "Reform scores (DPIIT BRAP assessment)", srcJa: "規制改革スコア（DPIITのBRAP評価）" },
];
export const SECTORS = ["el", "au", "ph", "tx", "fd"];
export const SECTOR_JA = { el: "電子機器", au: "自動車部品", ph: "医薬品", tx: "繊維", fd: "食品加工" };
export const PRESETS = { el: [1,5,3,2,3,1], au: [2,3,3,2,4,1], ph: [2,4,3,3,2,3], tx: [5,2,2,3,3,1], fd: [3,1,3,3,4,2] };
const CL = { el: ["TN","KA","TS","UP","AP"], au: ["TN","MH","GJ","HR","KA"], ph: ["GJ","TS","MH","HP","KA"], tx: ["GJ","TN","RJ","WB","OD"], fd: ["PB","AP","MH","GJ","UP"] };
const RAW = [
  ["JK","Jammu & Kashmir","ジャンムー・カシミール",3,0,[70,42,40,52,30,44]],["PB","Punjab","パンジャブ",3,1,[70,66,72,64,66,66]],
  ["HP","Himachal Pradesh","ヒマーチャル・プラデーシュ",4,1,[68,60,58,62,50,66]],["UK","Uttarakhand","ウッタラーカンド",5,1,[68,64,60,68,56,64]],
  ["HR","Haryana","ハリヤナ",3,2,[66,76,82,72,84,74]],["DL","Delhi","デリー",4,2,[45,82,86,60,78,68]],
  ["UP","Uttar Pradesh","ウッタル・プラデーシュ",5,2,[78,68,70,80,66,82]],["BR","Bihar","ビハール",6,2,[85,50,48,56,46,50]],
  ["AS","Assam","アッサム",8,2,[80,52,46,64,40,52]],["RJ","Rajasthan","ラージャスターン",2,3,[76,60,66,74,62,72]],
  ["MP","Madhya Pradesh","マディヤ・プラデーシュ",4,3,[80,62,66,78,60,76]],["JH","Jharkhand","ジャールカンド",6,3,[82,52,50,60,50,54]],
  ["WB","West Bengal","西ベンガル",7,3,[72,66,60,56,60,52]],["GJ","Gujarat","グジャラート",1,4,[82,72,88,90,92,92]],
  ["MH","Maharashtra","マハラシュトラ",3,4,[52,88,90,78,90,76]],["CG","Chhattisgarh","チャッティースガル",5,4,[78,56,56,72,52,64]],
  ["OD","Odisha","オディシャ",6,4,[78,60,62,76,66,70]],["GA","Goa","ゴア",2,5,[54,72,70,66,70,76]],
  ["TS","Telangana","テランガーナ",4,5,[62,86,80,88,72,90]],["AP","Andhra Pradesh","アーンドラ・プラデーシュ",5,5,[72,70,74,84,76,86]],
  ["KA","Karnataka","カルナータカ",3,6,[55,92,82,76,70,78]],["KL","Kerala","ケララ",3,7,[50,80,70,58,70,60]],
  ["TN","Tamil Nadu","タミル・ナドゥ",4,7,[60,90,88,82,86,80]],
];
export const SEED_STATES = RAW.map(([code, name, nameJa, col, row, scores]) => ({
  code, name, nameJa, col, row, scores, sectors: Object.keys(CL).filter((k) => CL[k].includes(code)),
}));
