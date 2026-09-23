# DekhoCampus exam content strategy

Last reconciled: 23 September 2026

This is the canonical policy for researching, writing, reviewing and publishing exam pages. It replaces conflicting wording in individual batch notes. A batch report is evidence for review; it is not a database migration and it is not proof a page is live.

## 1. Resolve the exam before writing

- Match the live canonical exam by stable slug and current database identity.
- Treat sessions, phases and counselling rounds as schedules of the canonical exam unless the authority publishes them as separate products.
- Merge confirmed duplicates into the canonical row and soft-delete the redundant row only after references and redirects are checked.
- Never import a stale snapshot ID without matching it against the current production row.

## 2. Research official sources first

- The conducting authority, regulator, government portal, university or official bulletin controls dates, eligibility, fees, pattern, result and counselling claims.
- Store the official application URL, official notice or bulletin URL, check time and source list with the record.
- Do not turn a search snippet, coaching calendar, social post or previous-cycle date into a current fact.
- Use a specific 2027 fact only when the responsible authority has published it. Otherwise write "Not announced" and explain where the official update will appear.
- Keep a genuine current 2026 cycle where that is what the authority is still running. Do not force a year change for SEO.
- Never invent an expert quote, survey, cutoff, fee, seat count, eligibility condition or "information gain" data point.

## 3. Answer the student's decision

- Open with the practical answer or consequence in the first two or three sentences. Never print prompt residue such as "Answer first" or "Executive summary".
- Name the authority, route, paper, course, counselling body or document when it helps the student act.
- State uncertain facts once. Avoid repeating the same official-confirmation disclaimer under several headings.
- Explain that a submitted form, qualifying score or rank is not an admission offer. Cover the actual next step: shortlist, choice filling, interview, verification, allotment or joining.
- Use Indian admissions context and plain Indian English. A small natural Hindi phrase is optional, never forced or reused as a batch slogan.

## 4. Structure for people and search systems

- Store clean semantic HTML, not Markdown: paragraphs, useful H2/H3 headings, lists and real HTML tables only when comparison genuinely helps.
- Never paste a flattened Markdown table or a vertical sequence of orphaned column labels.
- Do not add an H1 inside managed content because the page template supplies it.
- Use short paragraphs and varied sentence lengths. The layout should follow the topic, not a repeated intro, facts, risks, checklist and conclusion template.
- Put FAQs only in the dedicated FAQ field and render them in the page FAQ section. Do not repeat the same questions and answers inside the article body.
- Keep four distinct, exam-specific FAQs unless the page contract explicitly calls for a different reviewed count.
- Add three or four verified, contextually useful DekhoCampus links. Add the official application link and the official notification or bulletin link. Do not publish unverified external links.

## 5. Every exam must sound and work differently

- Use a different opening sentence and consequence for every record in a batch.
- Explain the application route in exam-specific wording. A paragraph, ordered steps, checklist or short action plan may be used when it suits the real process.
- Give preparation advice tied to the actual paper: Biology diagrams, legal provisions, quantitative speed, clinical cases, design observation, branch mathematics or another verified subject task.
- Do not reuse "Roz thoda", "same as above", generic error-log copy or the same application paragraph across records.
- Change FAQ wording and answers as well as headings. Adding the exam name to a shared template does not make it original.

## 6. Metadata and page fields

- Keep the meta title at or below 60 characters and the meta description at or below 155 characters.
- Preserve the stable slug unless a reviewed redirect is part of the same release.
- Fill dates, eligibility, syllabus, pattern, application, preparation, result, counselling, summary, source and freshness fields only with supported values.
- Record the real conducting authority. Never label every exam as NTA.
- Keep the page title, metadata and body aligned with the same cycle and search intent.

## 7. Human review and quality gates

- A reviewer must check claim-to-source support, current dates, authority ownership, duplicate identity, broken links, spelling and mobile rendering.
- Automated checks must reject duplicate slugs, repeated openings, repeated application or preparation blocks, duplicate FAQ questions, FAQs embedded in body HTML, forbidden phrases, raw Markdown, schema-invalid fields, unsupported dates and missing official sources.
- SEO, AEO and GEO scores are diagnostics, not ranking guarantees. AI-detector percentages are not a publication standard and must not replace factual or editorial review.
- Do not publish merely because a generator returned content or a numeric score reached 100.

## 8. Safe production release

- Build one canonical manifest from the latest approved version of each live slug. Resolve every competing version before migration.
- Preflight against the current production database, not the July snapshot. Abort on missing, inactive, duplicated or mismatched slugs.
- Map only fields supported by the current `exams` schema. Upsert FAQ rows separately in the `faqs` table.
- Back up every affected row and FAQ before writing. Apply updates transactionally and retain a rollback manifest and migration ledger.
- Verify the public exam page, FAQ section, sitemap and API after the write. A Git commit or frontend deployment alone does not update database content.

## Current repository status

The audit dated 23 September 2026 found 41 committed batch builders and 41 JSON plus 41 Markdown reports. They contain 410 versions for 390 unique exam rows. Twenty rows have competing batch versions, 112 active rows from the old 506-row snapshot were never refreshed, and only batch 041 enforces the final variation policy. Batches 001 through 040 must be regenerated or individually reviewed before a production cutover. See `reports/exam-refresh-repository-audit-2026-09-23.md` for the reproducible inventory.
