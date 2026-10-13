# Parameter data

## `params/params.json`

One parameter set (`version`) made of versioned records. Each record has
`key`, `value`, `source`, `effectiveFrom`, `effectiveTo` (inclusive, `null` = open-ended),
`editor` and `changeNote`.

The engine picks, for each key, the single record in force on the calculation's `asOfDate`.
Two records for the same key must not overlap in time (the loader rejects it). To change a value:

1. Close the old record by setting its `effectiveTo` to the day before the change.
2. Add a new record with the new `value`, `source`, `effectiveFrom`, `editor` and `changeNote`.
3. Bump `version` and re-run the acceptance tests (`npm test`).

A future-dated record (e.g. new FLPP price caps from 2027-01-01) can be added ahead of time.
It switches on automatically.

`value: null` marks an **open question** from the spec. The engine never guesses: it either
applies the conservative option or leaves the item out, and returns a warning code.

Banks are configured by key prefix `bank.<bankId>.`; promo packages are
`bank.<bankId>.package.<packageId>` with `{ fixedRate, fixedMonths }`. Adding a bank needs data only.

## `zones/regency-zones.csv`

Regency/city BPS code → FLPP **income zone** (1–4) and FLPP **price zone** (A–E).
The two zone maps are independent (Bali, NTB, NTT differ); never derive one from the other.

> TODO: this file is a **partial seed** (Jabodetabek plus one city per zone pattern).
> It must be completed with all 514 regencies/cities from the official BPS list, and the
> boundary cases (Mentawai → B, Anambas → D, Murung Raya and Mahakam Ulu → D) added.
