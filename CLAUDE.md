# Lhoopa Mortgage Calculator

Indicative home-affordability calculator for Lhoopa Indonesia. Given a household's income and situation, it tells them the highest house price they can finance and the monthly payment they will actually face, under two schemes:

- **FLPP**: government-subsidized KPR (KPR Sejahtera), distributed by banks via BP Tapera.
- **Commercial KPR**: standard conventional bank mortgage, with **BCA as the reference bank** in v1.

Users: home buyers (self-serve, mobile web) and Lhoopa sales agents (advanced mode). It is **not** a credit decision tool: no SLIK/BI Checking, no bank submission.

Source spec: "Lhoopa Indonesia Mortgage Calculator — Business Specification" (Claude Doc, draft v0.1, 13 Oct 2026). If this file and the spec disagree, ask before changing behaviour.

---

## Golden rules (read before writing any code)

1. **The headline number is always the SAFE figure.** For commercial loans that means sizing the loan on the floating rate (11% default) for the whole term, never on the promo rate. The promo-based figure may be shown only as a secondary, labelled "with promo rate".
2. **No hard-coded rules or rates.** Every rate, cap, term, zone and fee lives in versioned parameter data (`data/params/`), with `source`, `effectiveFrom`, `effectiveTo`. The engine reads the version in force on the calculation date.
3. **Two separate zone maps.** FLPP income zones (4 zones) and FLPP price zones (5 zones) do not line up (Bali, NTB, NTT differ). Always look up each one from the regency/city BPS code. Never derive one from the other.
4. **Never overstate affordability.** Compute in full precision; round prices DOWN to the nearest Rp1,000,000 and payments UP to the nearest Rp10,000, at display time only.
5. **The calculation engine is pure.** No I/O, no dates from the system clock inside the engine (pass `asOfDate` in), no UI code. Same inputs + same parameter version = same output.
6. **Every result records the parameter version used**, so any quote can be reproduced later.
7. Results are never an approval. CTA wording: "Talk to an advisor", never "Apply".

---

## Proposed stack (change if the team prefers otherwise)

- TypeScript everywhere, strict mode.
- `packages/engine`: pure calculation library + parameter loader. Unit-tested with Vitest.
- `apps/web`: mobile-first web app and embeddable widget (framework to be decided).
- `data/params/`: versioned JSON parameter files and the regency → zone CSV.
- Money is stored as integer rupiah (`number`, no decimals) in inputs and outputs; intermediate maths in floating point; rounding only at the output boundary (rule 4).

### Commands (npm workspaces, Node ≥ 20)

```bash
npm install          # install all workspaces
npm test             # run the engine tests, including the acceptance tests
npm run typecheck    # tsc --noEmit across workspaces
```

### Layout

- `packages/engine/src/`: `calculate.ts` (entry), `flpp.ts`, `commercial.ts`, `upfront.ts`, `finance.ts` (annuity maths), `rounding.ts` (output boundary only), `params.ts` (versioned records, resolved by `asOfDate`), `config.ts` (typed views over params), `zones.ts`, `validate.ts`.
- `packages/engine/src/node/load.ts`: file loader for Node (`@lhoopa/engine/node`), kept out of the pure entry.
- `data/params/params.json`: parameter records. Bank keys are namespaced `bank.<bankId>.*` (e.g. `bank.bca.floatingRate` for the spec's `bca.floatingRate`), and promo packages are `bank.<bankId>.package.<id>`. `value: null` marks an open question; the engine returns a warning code rather than guessing.
- `data/zones/regency-zones.csv`: **partial seed**; must be completed from the BPS master list.
- `apps/web`: not created yet (framework undecided).

---

## Domain glossary

| Term | Meaning |
| --- | --- |
| KPR | Kredit Pemilikan Rumah, a home mortgage |
| FLPP | Fasilitas Likuiditas Pembiayaan Perumahan, the subsidized mortgage scheme |
| MBR | Masyarakat Berpenghasilan Rendah, the low-income households eligible for FLPP |
| BP Tapera | Agency that runs FLPP |
| SBUM | Subsidi Bantuan Uang Muka, the government down-payment grant for FLPP buyers |
| DP | Down payment (uang muka) |
| DSR | Debt service ratio: total monthly debt payments ÷ gross monthly income |
| SBDK | Bank's published base lending rate |
| LTV | Loan to value |
| BPHTB | Land and building transfer tax |
| NPOPTKP | Tax-free threshold for BPHTB, set per region |
| Rumah tapak / rusun | Landed house / apartment |

---

## Scope

**v1 (in scope)**
- FLPP for landed houses
- Commercial conventional KPR, BCA reference
- FLPP eligibility check
- Max loan, max price, monthly payment, payment after promo
- Upfront cash and months to save it
- Matching results to Lhoopa listings

**Out of scope for v1**
- FLPP apartments (rusun), planned for v2
- Sharia KPR, planned for v2
- Credit scoring and document upload
- Refinance / take-over simulation
- Multi-bank comparison, planned for v2

---

## Inputs

| ID | Field | Type | Validation | Mode |
| --- | --- | --- | --- | --- |
| I1 | Home location | BPS regency/city code | Required; drives both zone lookups | Quick |
| I2 | Marital status | `single` \| `married` | Required | Quick |
| I3 | Applicant gross monthly income | IDR | 1,000,000 – 200,000,000 | Quick |
| I4 | Spouse gross monthly income | IDR | ≥ 0; must be 0 if single | Quick |
| I5 | Owns a house today | boolean | Required | Quick |
| I6 | Ever received a housing subsidy | boolean | Required | Quick |
| I7 | Existing monthly debt payments | IDR | ≥ 0 | Quick |
| I8 | Cash savings available | IDR | ≥ 0 | Quick |
| I9 | Monthly saving capacity | IDR | ≥ 0; default 10% of income | Advanced |
| I10 | Applicant age | years | 21 – 64 | Advanced |
| I11 | Employment type | `salaried` \| `self_employed` \| `informal` | Document hints only | Advanced |
| I12 | Target home price | IDR | Optional; pre-filled from a listing | Advanced |
| I13 | Down payment | % | ≥ scheme minimum | Advanced |
| I14 | Loan term | years | ≤ scheme max and ≤ (max payoff age − I10) | Advanced |
| I15 | Rate scenario | `promo` \| `regular_fixed` \| `custom` | Commercial only | Advanced |

---

## Parameters (initial values, as of October 2026)

Load these into `data/params/` as the first parameter version. Keep the `source` URL with each value.

### FLPP loan terms

| Key | Value | Source |
| --- | --- | --- |
| `flpp.rate.landed` | 0.05, fixed for the whole term | Bisnis, 25 Jun 2026 — https://ekonomi.bisnis.com/read/20260625/47/1983246/resmi-tenor-kpr-rumah-subsidi-rusun-diperpanjang-sampai-40-tahun |
| `flpp.rate.apartment` | 0.06 (v2) | same |
| `flpp.term.maxYears` | 40 | same |
| `flpp.term.defaultYears` | 20, plus a 40-year comparison | Lhoopa choice |
| `flpp.dp.minPct` | 0.01 | BP Tapera via https://blog.itera.ac.id/?p=5865 |
| `flpp.sbum.amount` | TBD, open question | — |
| `flpp.dsr` | 0.30 | Lhoopa policy, to validate with banks |

### FLPP income caps (gross monthly IDR, Permen PKP 5/2025)

Source: https://www.cnbcindonesia.com/news/20250424183353-4-628546/catat-batas-maksimal-gaji-mbr-beli-rumah-subsidi-rp-14-juta

| Income zone | Regions | Single | Married |
| --- | --- | --- | --- |
| 1 | Java excl. Jabodetabek, Sumatra, NTB, NTT | 8,500,000 | 10,000,000 |
| 2 | Kalimantan, Sulawesi, Bangka Belitung, Riau Islands, Maluku, North Maluku, Bali | 9,000,000 | 11,000,000 |
| 3 | All Papua provinces | 10,500,000 | 12,000,000 |
| 4 | Jakarta, Bogor, Depok, Tangerang, Bekasi | 12,000,000 | 14,000,000 |

### FLPP landed-house price caps (IDR, Kepmen PUPR 689/KPTS/M/2023, unchanged in 2026)

Source: https://www.investortrust.id/business/110359/apersi-usul-harga-rumah-subsidi-naik-15-ini-alasannya

| Price zone | Regions | Max price |
| --- | --- | --- |
| A | Java excl. Jabodetabek; Sumatra excl. Riau Islands, Bangka Belitung, Mentawai | 166,000,000 |
| B | Sulawesi, Bangka Belitung, Mentawai, Riau Islands excl. Anambas | 173,000,000 |
| C | Kalimantan excl. Murung Raya and Mahakam Ulu | 182,000,000 |
| D | Jabodetabek, Bali, NTB, NTT, Maluku, North Maluku, Anambas, Murung Raya, Mahakam Ulu | 185,000,000 |
| E | All Papua provinces | 240,000,000 |

Developers are lobbying for a 12–15% rise. The loader must support a future-dated version of this table.

### Commercial KPR: BCA reference

| Key | Value | Source |
| --- | --- | --- |
| `bca.term.maxYears` | 25 | https://finansial.bisnis.com/read/20260918/55/2005179/ini-4-langkah-mengatur-pembiayaan-kpr-rumah-pertama |
| `bca.maxPayoffAge` | 65 | https://www.cermati.com/kredit-pemilikan-rumah/kpr-bca-fix-rate |
| `bca.incomeBasis` | Gross; spouse income may be combined | same |
| `bca.floatingRate` | 0.11 | https://keuangan.kontan.co.id/news/likuiditas-bank-ketat-begini-bunga-floating-kpr |
| `bca.sbdk` | 0.0914 (July 2026), informational only | same |
| `bca.dp.defaultPct` | 0.10, allowed range 0.10 – 0.20 | https://www.industry.co.id/read/152959/perbandingan-kpr-bri-vs-mandiri-vs-bca-vs-btn-2026-mana-cicilan-paling-ringan |
| `bca.dsr.default` / `bca.dsr.max` | 0.30 / 0.40; not published by BCA | industry rule of thumb, same source |
| `bca.provisionPct` | 0.01 (promo 0.0081) | https://keuangan.kontan.co.id/news/bca-tawarkan-bunga-kpr-mulai-123-ini-tips-agar-cicilan-tetap-aman |

**BCA promo packages**: new homes from partner developers, valid until 2026-10-31. Source: Kontan, 13 Sep 2026 (provisionPct link above).

| Package | Fixed rate | Fixed months |
| --- | --- | --- |
| `bca-expo-1y` | 0.0123 | 12 |
| `bca-expo-2y` | 0.0235 | 24 |
| `bca-expo-3y` | 0.0275 | 36 |
| `bca-expo-5y` | 0.0381 | 60 |

After the fixed period, every package reverts to `bca.floatingRate`.

**Bank Indonesia LTV rule**: banks with bad loans under 5% may lend up to 100% of value (0% DP) until 2026-12-31. Source: https://keuangan.kontan.co.id/news/kebijakan-dp-rumah-0-diperpanjang-hingga-2026-apakah-dongkrak-kredit-properti. Store it as a parameter with that `effectiveTo` date. The default DP stays at 10%.

### Upfront costs (configurable)

| Cost | Default | Applies to |
| --- | --- | --- |
| Down payment | Per scheme | Both |
| Bank provision fee | `bca.provisionPct` × loan | Commercial |
| Notary, deed, mortgage registration | % of price, value TBD | Both |
| BPHTB | 5% × max(0, price − regional NPOPTKP) | Commercial; FLPP exemption TBD |
| Appraisal and insurance | Fixed amount per bank, TBD | Commercial |

---

## Routing

The commercial result is **always** computed. The FLPP result is added when **all** of these are true:

- `I5 == false` (the household owns no house)
- `I6 == false` (the household never received a housing subsidy)
- `I3 + I4 <= incomeCap[incomeZone(I1)][I2]`
- Applicant is at least 21 or married. This is an open question; keep it behind a parameter.

If FLPP fails, return the reason code:
- `INCOME_ABOVE_CAP`
- `OWNS_HOUSE`
- `PRIOR_SUBSIDY`
- `AGE`

If FLPP passes but no FLPP-eligible Lhoopa listing exists in the area, return both results with the flag `NO_FLPP_LISTING_NEARBY`.

---

## Calculation logic

### Payment capacity

- `Y = I3 + I4`
- `A = DSR × Y − I7`
- If `A <= 0`, return `DEBT_TOO_HIGH` and stop.

### Annuity

With monthly rate `r = annualRate / 12` and `n` months:

```
AF(r, n) = (1 − (1 + r)^−n) / r        // if r == 0: AF = n
maxLoan  = A × AF(r, n)
payment  = loan / AF(r, n)
```

### Term

`n = 12 × min(schemeMaxYears, maxPayoffAge − I10, userTermYears)`

### FLPP path

1. Use `r = flpp.rate.landed / 12` for the whole term.
2. `capacityPrice = maxLoan / (1 − dpPct)`
3. `maxPrice = min(capacityPrice, priceCap[priceZone(I1)])`
4. `loan = maxPrice × (1 − dpPct)`; `payment = loan / AF`
5. `bindingConstraint` = `PRICE_CAP` or `INCOME`

### Commercial path

**Prudent method (headline):**
- Size the loan at `bca.floatingRate` over the full term.
- `maxPrice = maxLoan / (1 − dpPct)`

**Bank method (secondary, labelled "with promo rate"):**
1. `L = A × AF(r1, n)`, where `r1` is the promo rate.
2. `P1 = A`
3. Balance after `k` fixed months: `B_k = L(1 + r1)^k − P1 × ((1 + r1)^k − 1) / r1`
4. `P2 = B_k / AF(r2, n − k)`, where `r2` is the floating rate.
5. `paymentShock = P2 / P1`
6. `postPromoDsr = (P2 + I7) / Y`

**Risk flag** from `postPromoDsr`:
- `GREEN` if ≤ 0.30
- `AMBER` if ≤ 0.40
- `RED` otherwise

### Upfront cash and saving time

- `C = DP + provision + notary + BPHTB + appraisal/insurance − SBUM`
  - SBUM is subtracted for FLPP only.
- `shortfall = max(0, C − I8)`
- `monthsToSave = ceil(shortfall / I9)`
  - `0` means "ready now".
  - If `I9 == 0` and `shortfall > 0`, return `null` with the reason `NO_SAVING_CAPACITY`.

---

## Outputs

The engine returns one result object per scheme:

| ID | Output | Notes |
| --- | --- | --- |
| O1 | Eligibility + reason codes | |
| O2 | `safeMaxPrice` | Headline value |
| O3 | `bankMethodMaxPrice` | Commercial only |
| O4 | `bindingConstraint` | `INCOME` \| `PRICE_CAP` \| `AGE` \| `DEBT` |
| O5 | `payment`, `paymentPctIncome` | Commercial also returns `paymentDuringPromo` and `paymentAfterPromo` |
| O6 | `paymentShock` | UI shows a badge when > 1.3 |
| O7 | Term comparison | FLPP: 20/30/40 years. Commercial: 15/20/25 years |
| O8 | `upfrontCash` | Itemized |
| O9 | `monthsToSave` | |
| O10 | Listing filter price | FLPP: FLPP max price. Commercial: safe max price |
| O11 | `paramsVersion`, `asOfDate` | |

---

## Business rules

| ID | Rule |
| --- | --- |
| BR1 | Headline = safe figure, never the promo-based figure. |
| BR2 | Listings are filtered on the safe max price. An optional "stretch" toggle may go up to the bank-method price, with a visible label. |
| BR3 | Term ≤ max payoff age − applicant age. |
| BR4 | FLPP results only show listings flagged `flppEligible`. |
| BR5 | The parameter version is selected by `asOfDate`; expired rules switch automatically. Example: the 0% DP rule ends 2026-12-31. |
| BR6 | Promo packages past their end date are hidden. |
| BR7 | CTA is "Talk to an advisor", never "Apply". |

**Disclaimer** under every result, in Bahasa Indonesia (default) and English:

> Indicative simulation only, based on rules and rates as of [date]. Final eligibility, rate, loan amount and fees are decided by the bank and, for FLPP, by BP Tapera.

---

## Acceptance tests (must pass; tolerances ±Rp1M on prices, ±Rp10k on payments)

Shared setup for both examples:

| Setting | Value |
| --- | --- |
| DSR | 0.30 |
| Existing debt (I7) | 0 |
| Location | Kabupaten Tangerang (income zone 4, price zone D) |
| Applicant | Married |
| Calculation date | 2026-10-13 |

### Example 1: household income Rp10,000,000 (FLPP-eligible)

| Check | Expected |
| --- | --- |
| FLPP: capacity loan at 5% over 20 years | ≈ Rp455M |
| FLPP: `safeMaxPrice` | Rp185M, with `bindingConstraint = PRICE_CAP` |
| FLPP: payment over 20 years | ≈ Rp1.21M |
| FLPP: payment over 40 years | ≈ Rp0.88M |
| FLPP: DP (1%) | Rp1.85M |
| Commercial prudent: loan at 11% over 25 years | ≈ Rp306M |
| Commercial prudent: `safeMaxPrice` at 10% DP | ≈ Rp340M |
| Commercial bank method, `bca-expo-5y` (3.81%): loan | ≈ Rp580M |
| Commercial bank method: price | ≈ Rp644M |
| Commercial bank method: balance after 60 months | ≈ Rp503M |
| Commercial bank method: `paymentAfterPromo` | ≈ Rp5.20M |
| Commercial bank method: `postPromoDsr` | ≈ 0.52 → `RED` |

### Example 2: household income Rp16,000,000 (above the FLPP cap)

| Check | Expected |
| --- | --- |
| FLPP | Ineligible, reason `INCOME_ABOVE_CAP` |
| Commercial prudent: loan | ≈ Rp490M |
| Commercial prudent: `safeMaxPrice` | ≈ Rp544M |
| Commercial bank method (3.81%): loan | ≈ Rp928M |
| Commercial bank method: price | ≈ Rp1.03B |
| Commercial bank method: `paymentAfterPromo` | ≈ Rp8.31M |
| Commercial bank method: `postPromoDsr` | ≈ 0.52 → `RED` |

Any change to the parameters or the engine must re-run these tests.

---

## Admin and data

- Parameters are versioned records with:
  - `value`
  - `source` (URL)
  - `effectiveFrom`
  - `effectiveTo`
  - `editor`
  - `changeNote`
- Regency → zone mapping is a CSV keyed by BPS code, with one income zone and one price zone per row. Validation must reject:
  - missing regencies
  - duplicate regencies
- Rate packages are defined per bank. Adding a bank must not require code changes.

---

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | Under 1 s per calculation; usable on 3G |
| Interface | Mobile-first; embeddable widget for Lhoopa listing pages |
| Language | Bahasa Indonesia (default) and English. All user-facing strings go through i18n |
| Privacy | Income and marital data are personal data under UU PDP 27/2022. Store nothing without consent; anonymous use must work. Leads go to the Lhoopa CRM only. Never log raw income values |
| Branding | BCA is named as a reference only; no bank or BP Tapera logos |

---

## Open questions (do not guess; keep these behind parameters or TODOs)

- SBUM amount and eligibility for 2026.
- The DSR that partner banks actually apply (30% / 35% / 40%).
- Does BCA size loans on the promo rate or on a stressed rate?
- Is the 40-year FLPP term live at all 43 distributing banks, and for which ages?
- FLPP minimum age, and the spouse-income rule for single Tapera participants.
- BPHTB and other fee exemptions for MBR buyers in each Lhoopa regency.
- Will BI extend the 100% LTV rule beyond 2026-12-31?
- Will FLPP price caps rise in 2027?
- How is income defined for informal workers?
- Will there be a formal BCA partnership, or will BCA stay a neutral reference?
