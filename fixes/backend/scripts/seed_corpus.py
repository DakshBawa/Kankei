"""Write the starter RAG corpus to data/corpus/*.md.

Why this exists: an empty corpus makes /research/brief and /comply/explain
produce weak, uncited output. These 16 short documents give the RAG layer
something real to retrieve and cite from the first `docker compose up`.

IMPORTANT: these are starter summaries written from general knowledge, NOT
quotations from the sources. Each file says so in its header
(`status: starter-summary`, `last_verified: UNVERIFIED`). Before the final demo,
replace the bodies with text pulled from the official source URL (see
fetch_official.py) and set `last_verified` to the date you checked it.

Usage:
    python scripts/seed_corpus.py              # write missing files
    python scripts/seed_corpus.py --if-empty   # do nothing if corpus/ already has files
    python scripts/seed_corpus.py --force      # overwrite
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

NOTE = (
    "_Starter summary written from general knowledge, not quoted from the source. "
    "Verify against the official source before relying on it._"
)

# slug: (title, authority, source_url, body)
DOCS = {
    "fdi-routes": (
        "FDI routes into India: automatic vs government approval",
        "DPIIT, Ministry of Commerce and Industry",
        "https://dpiit.gov.in/",
        "Foreign direct investment enters India through two routes. Under the automatic route no prior government approval "
        "is needed. Under the government route the investment needs prior approval. Which route applies depends on the "
        "sector, and some sectors have caps or conditions (for example on ownership percentage or local sourcing). "
        "Manufacturing of most industrial goods is generally open, but the consolidated FDI policy must be checked for "
        "the specific sector and product. After investment, the Indian company reports the inflow to the RBI.",
    ),
    "entity-options": (
        "Entity options for a foreign company entering India",
        "Ministry of Corporate Affairs; Reserve Bank of India",
        "https://www.mca.gov.in/",
        "Common structures: a wholly owned subsidiary (usually a private limited company), a joint venture with an Indian "
        "partner, a limited liability partnership (LLP, available where FDI rules allow), and a branch, liaison or project "
        "office. A liaison office is limited to liaison and representative activities and cannot earn income in India. "
        "Branch and liaison offices need RBI approval through an authorised dealer bank. A subsidiary gives the most "
        "operational freedom and limited liability, but requires incorporation, capital and ongoing compliance. A JV "
        "adds local knowledge and relationships, but needs a carefully drafted shareholders' agreement.",
    ),
    "fema-reporting": (
        "FEMA and RBI reporting for foreign investment",
        "Reserve Bank of India",
        "https://www.rbi.org.in/",
        "The Foreign Exchange Management Act (FEMA) governs cross-border investment and payments. Inbound investment has "
        "to be reported to the RBI through its online reporting system within prescribed timelines, using forms such as "
        "FC-GPR for the issue of shares. Indian companies with foreign investment also file an annual return on foreign "
        "liabilities and assets. Liaison and branch offices file annual activity certificates. Missing a deadline can "
        "lead to late-submission fees, so build these dates into the compliance roadmap.",
    ),
    "gst-basics": (
        "GST registration and basics for foreign-owned businesses",
        "GST Council; GSTN",
        "https://www.gst.gov.in/",
        "Goods and Services Tax is levied on supplies of goods and services. Registration is required once turnover crosses "
        "thresholds that vary by type of supply and state, and some businesses must register regardless of turnover. "
        "A registered business can generally claim input tax credit on GST paid on business purchases. "
        "Imports attract Integrated GST (IGST) at the border. Rates depend on the HS classification of the product, so "
        "classification should be settled early.",
    ),
    "customs-duty": (
        "How import duty is built up",
        "Central Board of Indirect Taxes and Customs (CBIC)",
        "https://www.cbic.gov.in/",
        "Import cost is built up from the assessable value (usually the CIF value) plus basic customs duty (BCD), "
        "a social welfare surcharge calculated on the BCD where applicable, and IGST charged on the combined value. "
        "The rates come from the tariff schedule and depend on the HS code; exemption notifications and free trade "
        "agreements such as the India-Japan CEPA can reduce duty for eligible goods with proper origin proof. "
        "Classification disputes are a common cause of delay, so pre-classify products and keep technical documentation ready.",
    ),
    "iec": (
        "Importer-Exporter Code (IEC)",
        "Directorate General of Foreign Trade (DGFT)",
        "https://www.dgft.gov.in/",
        "A business that imports or exports goods commercially in India generally needs an Importer-Exporter Code issued "
        "by DGFT. It is tied to the entity's PAN and is needed for customs clearance. Obtain it early in the roadmap, "
        "because it is a prerequisite for many later steps. Some goods are restricted or need extra licences, which "
        "the DGFT policy lists by HS code.",
    ),
    "bis-crs-qco": (
        "BIS certification: Compulsory Registration and Quality Control Orders",
        "Bureau of Indian Standards (BIS)",
        "https://www.bis.gov.in/",
        "Some product categories must be certified or registered with BIS before they can be manufactured, imported or "
        "sold in India. This happens through the Compulsory Registration Scheme for listed electronics and IT goods and "
        "through Quality Control Orders for other categories. Whether an industrial sensor falls under a mandatory scheme "
        "depends on the exact product and its standard, so check product by product. Foreign manufacturers usually need "
        "testing in a recognised laboratory and may need to appoint an Indian authorised representative.",
    ),
    "wpc-eta": (
        "Wireless equipment approval (WPC / ETA)",
        "Department of Telecommunications (DoT), Wireless Planning and Coordination wing",
        "https://dot.gov.in/",
        "Products with radio or wireless functions, such as Bluetooth or Wi-Fi modules, generally need an equipment type "
        "approval from the telecom authorities before import and sale. Industrial sensors with wireless connectivity "
        "may fall under this. Check the current procedure and the frequency bands that are covered, as the process "
        "and online portals have changed over time.",
    ),
    "cdsco-devices": (
        "Medical device regulation (CDSCO)",
        "Central Drugs Standard Control Organisation (CDSCO)",
        "https://cdsco.gov.in/",
        "Medical devices are regulated under the Medical Devices Rules, 2017, with devices grouped into risk classes A "
        "to D. Importers generally need an import licence and manufacturers need registration or licensing "
        "according to the device class. Documentation such as a quality management system certificate, a device master "
        "file and free-sale certificates from the country of origin is typically required. Timelines vary with the class.",
    ),
    "fssai-food": (
        "Food products (FSSAI)",
        "Food Safety and Standards Authority of India (FSSAI)",
        "https://www.fssai.gov.in/",
        "Food businesses, including importers of food products, need FSSAI registration or a licence, and imported food "
        "is subject to clearance and labelling requirements. Labels must carry specified information in "
        "prescribed formats. Check product-specific standards before shipping a first consignment.",
    ),
    "india-japan-cepa-dtaa": (
        "India-Japan trade and tax agreements",
        "Ministry of Commerce and Industry; Income Tax Department",
        "https://commerce.gov.in/",
        "India and Japan have a Comprehensive Economic Partnership Agreement (CEPA, in force since 2011) that reduces "
        "or removes tariffs on many goods when origin rules are met, and a bilateral double taxation avoidance agreement "
        "(DTAA) that sets maximum withholding rates on dividends, interest and royalties and defines permanent "
        "establishment rules. The exact tariff lines and treaty rates should be read from the current texts "
        "before they are used in a landed-cost or structuring decision.",
    ),
    "transfer-pricing": (
        "Transfer pricing for related-party transactions",
        "Income Tax Department, India",
        "https://incometaxindia.gov.in/",
        "Transactions between a Japanese parent and its Indian subsidiary or JV are treated as international transactions "
        "between associated enterprises. They must be priced at arm's length and documented, and a report from "
        "a chartered accountant is filed with the tax return when thresholds are met. Intra-group royalties, "
        "management fees and the price of goods supplied to the Indian entity are the usual areas of scrutiny.",
    ),
    "japan-industrial-townships": (
        "Japan-focused industrial areas in India",
        "Invest India; JETRO",
        "https://www.investindia.gov.in/",
        "Several Indian states host industrial areas that market themselves to Japanese firms, with dedicated "
        "support desks, ready plots and utilities. Reported examples include the Japanese zone near Neemrana in "
        "Rajasthan and Japan-oriented areas in Gujarat, Karnataka, Tamil Nadu and Andhra Pradesh. Japanese automakers "
        "and their supplier networks cluster around Gurugram-Manesar (Haryana), Gujarat, Karnataka and Tamil Nadu. "
        "JETRO and the Embassy of Japan keep current lists of Japanese companies and desks; confirm the details "
        "before naming a location.",
    ),
    "state-incentives": (
        "State industrial policies and incentives",
        "State industrial development departments; Invest India",
        "https://www.investindia.gov.in/",
        "Indian states compete for manufacturing investment with their own industrial policies. Typical incentives include "
        "capital subsidies, reimbursement of state GST, stamp duty exemptions, power tariff concessions and subsidised "
        "land in industrial parks. Eligibility depends on investment size, sector, location (for example backward districts) "
        "and the date of the policy. Compare the current policy documents of each shortlisted state and apply before "
        "starting commercial production where required.",
    ),
    "pli-schemes": (
        "Production Linked Incentive (PLI) schemes",
        "DPIIT and sector ministries",
        "https://dpiit.gov.in/",
        "The central government runs PLI schemes that pay incentives on incremental sales of goods made in India across "
        "a range of sectors, including automobiles and auto components, electronics and others. Each scheme has "
        "its own eligibility criteria, minimum investment and sales thresholds, and application windows. They mainly "
        "benefit larger investments, so check whether a smaller entrant can qualify before including them in a business case.",
    ),
    "business-culture-jp-in": (
        "Business culture: Japanese and Indian counterparts",
        "Kankei team notes (not an official source)",
        "https://www.jetro.go.jp/en/",
        "Japanese firms tend to decide by consensus (nemawashi and ringi), which is slow to start and fast to execute, "
        "and communicate indirectly, so 'we will consider it' often means no. Indian firms are often led by a founder or family "
        "head who can decide quickly, communicate more directly, and treat relationships and flexibility as part of the deal; "
        "'no problem' can express willingness rather than a checked commitment. Meetings in India may start late or run "
        "long. Practical habits that help both sides: written minutes after every meeting, explicit dates and owners, "
        "regular reporting, and early agreement on how escalation works. These are tendencies, not rules about individuals.",
    ),
}


def render(slug: str, spec: tuple) -> str:
    title, authority, url, body = spec
    return (
        "---\n"
        f"id: {slug}\n"
        f"title: {title}\n"
        f"authority: {authority}\n"
        f"source_url: {url}\n"
        "last_verified: UNVERIFIED\n"
        "status: starter-summary\n"
        "---\n\n"
        f"# {title}\n\n{NOTE}\n\n{body}\n"
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/corpus")
    ap.add_argument("--if-empty", action="store_true", help="skip if the folder already has .md files")
    ap.add_argument("--force", action="store_true", help="overwrite existing files")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    existing = list(out.glob("*.md"))
    if args.if_empty and existing:
        print(f"corpus already has {len(existing)} files; nothing to do")
        return 0

    written = 0
    for slug, spec in DOCS.items():
        path = out / f"{slug}.md"
        if path.exists() and not args.force:
            continue
        path.write_text(render(slug, spec), encoding="utf-8")
        written += 1
    print(f"wrote {written} files to {out} ({len(DOCS)} documents in the set)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
