# Exam identity and logo audit

Checked 2026-09-23T15:17:57.730Z. All 485 canonical exams have separate short and full names.

424 use visually reviewed marks from official exam/institution/authority sources, 51 retain existing catalog marks, and 10 remain unresolved. A conducting-authority crest is not presented as a newly invented exam logo.

Official assets are immutable, first-party WebP files, at most 600 pixels on the longest side, with no added ring and no synthetic upscaling. Existing catalog marks have not been newly certified as official.

## Outstanding sources

- **Agniveervayu** (agniveervayu): Official recruitment site returned HTTP 503; alternate Indian Air Force host timed out. No verified downloadable mark.
- **AP POLYCET** (ap-polycet): Catalog host did not resolve and alternate AP POLYCET host returned HTTP 503. Official exam-specific mark remains unverified.
- **HP SET** (hp-set): HPPSC official site requires unsafe legacy TLS renegotiation; HTTP retry timed out. No security downgrade used.
- **IAT** (iiser-iat): Current official admissions header is text-only. No common IAT mark verified; a single IISER campus crest would misrepresent the joint exam.
- **JPSC Combined Civil Services** (jpsc-combined-civil-services): Official image path returned a loading animation, not the commission logo; rejected during visual review.
- **KPSC KAS** (kpsc-kas): Official KPSC host returned malformed HTTP headers; HTTP retry timed out. No alternative official mark verified.
- **NMAT** (nmat): Official MBA.com page blocked automated retrieval. Alternate GMAC paths returned 404; no exam-specific mark verified.
- **Pre D.El.Ed** (rajasthan-pre-deled): Catalog URL is an informational/ad-supported site, not a verified authority source. Official portal did not expose a verified logo. Do not source a mark from the catalog URL.
- **Rajasthan SET** (rajasthan-set): Catalog recruitment host has a hostname/certificate mismatch. The reachable state recruitment portal does not establish the SET conducting authority's logo.
- **WBCS** (wbcs): Official WBPSC host requires unsafe legacy TLS renegotiation. No security downgrade used and no verified alternative asset found.

## Release safeguards

The UI uses the reviewed asset inventory for missing/obsolete generated logos. Genuine custom saved logos are retained. Unresolved records show a neutral file icon, never an invented seal.

The full database-logo sync with --assert-complete refuses to run while these source gaps exist. The frontend update can be deployed independently without rewriting production exam rows. Every record and source is listed in exam-official-logo-audit.csv.
