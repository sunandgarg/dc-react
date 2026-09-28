# Exam logo display audit

Checked 28 September 2026 against the public production API, the checked-in identity inventory and the rendered local search UI.

## Cause and fix

CSEET's database logo still points to `admin-uploads/exam-logos-v2/cseet-icsi.webp`, an old generated placeholder. Its detail page already replaces that with the visually reviewed ICSI logo. Search results and the exam calendar did not apply that replacement.

Search (header, hero and universal search) and the exam calendar now use the same exam branding resolver and image component as detail/list cards. Frontend `/exam-logos/` assets are not rewritten into AWS storage URLs. Genuine saved custom logos remain unchanged; failed custom search logos can fall back to the reviewed mark. Missing logos do not fall back to a banner or generated ring.

No production exam records or article-generation settings were changed.

## Coverage and verification

| Check | Result |
| --- | --- |
| Active production exams | 485 |
| Active slugs matched to identity inventory | 485 / 485 |
| Legacy placeholder URLs still saved in database | 270; replaced at display time |
| Inventory logos reviewed from official sources | 424 |
| Existing catalog marks retained, not newly certified as official | 51 |
| Inventory entries without a verified official logo | 10 |
| Distinct resolved live logo URLs fetched | 332 / 332 returned nonempty image responses |
| Local CSEET header search | Correct ICSI logo visibly rendered |

Image response checks establish availability, not authenticity. Source provenance and visual review come from the identity inventory. The HTTP audit does not certify every retained custom/catalog mark as official.

## Remaining official-source verification

These ten identities remain unresolved in the official-logo inventory. Prior source-discovery limitations below are historical review notes, not newly rechecked source outages.

| Exam | Remaining issue |
| --- | --- |
| Agniveervayu | Official recruitment hosts previously unavailable; no verified downloadable mark |
| AP POLYCET | Official portal/logo verification outstanding; a saved custom mark is currently retained |
| HP SET | Official host required unsafe legacy TLS; no security downgrade used |
| IISER IAT | No joint IAT mark verified; using one campus crest would misrepresent the joint exam |
| JPSC Combined Civil Services | Discovered image was a loading animation, not a logo |
| KPSC KAS | Official host retrieval failed; alternate official mark unverified |
| NMAT | Official mark retrieval blocked; a saved custom mark is currently retained |
| Rajasthan Pre D.El.Ed / BSTC | Catalog host was not an established official source |
| Rajasthan SET | Authority/logo provenance still unresolved |
| WBCS | Official host required unsafe legacy TLS; no security downgrade used |

Eight of these have only obsolete placeholder data and therefore display the neutral unavailable-logo icon. AP POLYCET and NMAT retain saved custom marks; these are not newly verified official logos.

## Rules currently followed when adding exams

The full editorial policy is in `docs/exam-content-strategy-2026.md` and the identity source ledger is `shared/exam-identities.json`.

1. Resolve one canonical exam identity and conducting authority. Keep short and full names separate; do not create duplicate records for ordinary sessions.
2. Research current official authority pages and bulletins. Keep sources and verification time; never invent dates, fees, eligibility, seats or cutoffs.
3. Preserve the real active year/session. Unpublished future dates must say **Not announced**, not a copied previous-year date.
4. Use one template H1, clean H2/H3 content, readable paragraphs and genuine HTML tables. Keep FAQs in the dedicated FAQ section, not duplicated in body content.
5. Editorial policy calls for four useful exam-specific FAQs, three or four relevant internal links, and verified official application/notification links.
6. Keep content, metadata, authority, dates and links aligned. Policy targets meta titles up to 60 characters and descriptions up to 155; these are local editorial targets, not legal limits or ranking guarantees.
7. Use verified exam/authority logos with provenance, contained sizing and no added decorative rings. Preserve legitimate manual overrides. Unresolved logos are disclosed rather than invented.
8. Respect writer permissions and approval requirements. Review mobile rendering, source accuracy and links before publication. Production data batches require preflight, backup, transactional application and post-release verification.

### Important enforcement distinction

The admin form currently requires a name, slug and every listing filter (category, streams, course groups and education levels). Backend permissions and the configured editorial approval workflow are enforced. The editorial source/FAQ/link counts and manual logo authenticity review are not all mandatory validators on every ordinary admin save. The repository batch-policy check validates specific prepared batch artifacts; it is not a complete audit of every live exam record. Defaults in a new form still need editorial verification.

This release repairs logo display only. It does not silently introduce stricter publishing blocks, certify unfinished content batches, or rewrite exam facts.
