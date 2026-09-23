from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


OUT = Path("output/pdf/dekhocampus-exam-writing-rules-and-regulations-2026.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = HexColor("#14213D")
BLUE = HexColor("#245FD6")
ORANGE = HexColor("#F47B2A")
GREEN = HexColor("#08795B")
RED = HexColor("#B42318")
MUTED = HexColor("#5E6A7D")
PALE_BLUE = HexColor("#EEF4FF")
PALE_GREEN = HexColor("#EAF8F2")
PALE_ORANGE = HexColor("#FFF3E8")
PALE_RED = HexColor("#FFF0EE")
LINE = HexColor("#D6DFED")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverBrand", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=11, leading=15, textColor=ORANGE, alignment=TA_CENTER,
    spaceAfter=9, tracking=1.5,
))
styles.add(ParagraphStyle(
    name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=26, leading=31, textColor=NAVY, alignment=TA_CENTER,
    spaceAfter=12,
))
styles.add(ParagraphStyle(
    name="CoverSub", parent=styles["Normal"], fontName="Helvetica",
    fontSize=11.5, leading=17, textColor=MUTED, alignment=TA_CENTER,
    spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=18, leading=22, textColor=NAVY, spaceBefore=8, spaceAfter=8,
    keepWithNext=1,
))
styles.add(ParagraphStyle(
    name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=12.4, leading=16, textColor=BLUE, spaceBefore=8, spaceAfter=5,
    keepWithNext=1,
))
styles.add(ParagraphStyle(
    name="H3x", parent=styles["Heading3"], fontName="Helvetica-Bold",
    fontSize=10.3, leading=14, textColor=NAVY, spaceBefore=6, spaceAfter=3,
    keepWithNext=1,
))
styles.add(ParagraphStyle(
    name="Bodyx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=9.1, leading=13.7, textColor=NAVY, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="Smallx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=7.9, leading=11, textColor=NAVY, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="Tinyx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=7.2, leading=9.6, textColor=NAVY, spaceAfter=2,
))
styles.add(ParagraphStyle(
    name="Bulletx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.9, leading=13, leftIndent=14, firstLineIndent=-8,
    bulletIndent=2, textColor=NAVY, spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="Numberx", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.9, leading=13, leftIndent=17, firstLineIndent=-12,
    textColor=NAVY, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=9, leading=13.5, textColor=GREEN, backColor=PALE_GREEN,
    borderColor=HexColor("#B5E1D0"), borderWidth=0.6, borderPadding=8,
    spaceBefore=6, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="Warning", parent=styles["BodyText"], fontName="Helvetica-Bold",
    fontSize=9, leading=13.5, textColor=RED, backColor=PALE_RED,
    borderColor=HexColor("#F2BBB5"), borderWidth=0.6, borderPadding=8,
    spaceBefore=6, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="Note", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=8.7, leading=13, textColor=NAVY, backColor=PALE_BLUE,
    borderColor=HexColor("#BED0F7"), borderWidth=0.5, borderPadding=8,
    spaceBefore=5, spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="CodexBlock", parent=styles["BodyText"], fontName="Courier",
    fontSize=7.2, leading=10, textColor=NAVY, backColor=HexColor("#F4F6FA"),
    borderColor=LINE, borderWidth=0.4, borderPadding=7, spaceAfter=6,
))


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def h(text, level=1):
    return Paragraph(text, styles[{1: "H1x", 2: "H2x", 3: "H3x"}[level]])


def bullets(items):
    return [Paragraph(f"- {item}", styles["Bulletx"]) for item in items]


def numbered(items, start=1):
    return [Paragraph(f"{i}. {item}", styles["Numberx"]) for i, item in enumerate(items, start)]


def rule_table(rows, widths, header=True, tiny=False):
    cell_style = styles["Tinyx" if tiny else "Smallx"]
    data = [[Paragraph(str(cell), cell_style) for cell in row] for row in rows]
    tbl = Table(
        data,
        colWidths=widths,
        repeatRows=1 if header else 0,
        hAlign="LEFT",
        splitByRow=1,
    )
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]
    if header:
        commands.extend([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ])
    for row_index in range(1 if header else 0, len(rows), 2):
        commands.append(("BACKGROUND", (0, row_index), (-1, row_index), HexColor("#F6F8FC")))
    tbl.setStyle(TableStyle(commands))
    return tbl


def section_break():
    return PageBreak()


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    if doc.page > 1:
        canvas.setStrokeColor(LINE)
        canvas.line(18 * mm, height - 15 * mm, width - 18 * mm, height - 15 * mm)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(NAVY)
        canvas.drawString(18 * mm, height - 11 * mm, "DekhoCampus Exam Writing Rules and Regulations")
        canvas.setFillColor(ORANGE)
        canvas.drawRightString(width - 18 * mm, height - 11 * mm, "2026-2027 editorial standard")
    canvas.setStrokeColor(LINE)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont("Helvetica", 7.4)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "Internal editorial and implementation rulebook | Reconciled 23 September 2026")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


story = []

# Cover
story.extend([
    Spacer(1, 24 * mm),
    p("DEKHOCAMPUS", "CoverBrand"),
    p("Exam Writing Rules and Regulations", "CoverTitle"),
    p("Complete research, writing, SEO, AEO, GEO, quality-control and publishing standard for DekhoCampus exam pages", "CoverSub"),
    Spacer(1, 9 * mm),
    p("Purpose: produce accurate, useful and naturally written exam guidance for Indian students and parents without invented dates, copied templates, broken tables or false authority claims.", "Callout"),
    Spacer(1, 11 * mm),
    rule_table([
        ["Applies to", "Exam overview pages, date updates, application guides, admit-card guides, cutoff and counselling articles, batch refreshes and AI-assisted drafts"],
        ["Editorial goal", "Help the reader make the next safe decision while supporting SEO, AEO, GEO, LLMO and E-E-A-T"],
        ["Authority", "Official exam body, regulator, government, university or counselling authority always outranks third-party summaries"],
        ["Status", "Canonical policy for all new work; legacy batches must be reviewed before production use"],
    ], [36 * mm, 136 * mm], header=False),
    Spacer(1, 14 * mm),
    p("Version 1.0 | Exam-specific edition", "CoverSub"),
    PageBreak(),
])

# Contents and hierarchy
story.extend([
    h("How to use this rulebook"),
    p("This PDF reconciles every exam-writing instruction discussed in the working sessions. Where older instructions conflict with newer implementation, the current implemented rule wins. Writers, editors, AI prompts, validators and database importers must use the same standard."),
    h("Rule hierarchy", 2),
    *numbered([
        "Factual accuracy and student safety override keyword targets, word counts and stylistic preferences.",
        "The latest official notice overrides old calendars, coaching articles, search snippets and previous-year pages.",
        "Current implemented output rules override older experimental prompts.",
        "Human editorial review overrides automated scores when a claim, date or interpretation is unsafe.",
        "A record stays in review when evidence is missing. It is never filled with a plausible guess.",
    ]),
    h("Resolved instruction conflicts", 2),
    rule_table([
        ["Earlier instruction", "Current exam rule"],
        ["Pure unformatted text or zero HTML", "Use clean semantic HTML because the CMS and search systems require structured headings, paragraphs and lists."],
        ["Always include a comparison table", "Use a real HTML table only when it improves a comparison. Never force one and never output a flattened Markdown table."],
        ["Repeat FAQs in the article", "Store FAQs only in the dedicated FAQ field and render them only in the FAQ section."],
        ["Use em dashes for human rhythm", "Use ASCII hyphens only. Typography validation rejects en dashes and em dashes."],
        ["Invent a realistic expert insight or statistic", "Never invent evidence. Information gain must come from an official or otherwise verified source."],
        ["Make every exam 2027", "Use 2027 only when appropriate. Preserve a genuine active 2026 cycle, and mark unpublished future dates as Not announced."],
        ["Guarantee 100 SEO or a human score", "Scores are diagnostic. No ranking, detector or human-percentage guarantee is permitted."],
    ], [52 * mm, 120 * mm]),
    p("Non-negotiable: no instruction to sound human permits fake facts, fake experience, fake quotes or fake certainty.", "Warning"),
    PageBreak(),
])

# Audience and goals
story.extend([
    h("1. Audience, purpose and editorial position"),
    rule_table([
        ["Area", "Required standard"],
        ["Primary audience", "Indian students, usually 17-19, working applicants where relevant, and parents managing cost, travel and risk."],
        ["Reader state", "Assume stress, deadline pressure and confusion. Give the decision first and explain the rule without talking down."],
        ["Language", "Clear English or natural Indian English. A familiar Hindi or Hinglish phrase may appear only when it fits and is never reused as a batch slogan."],
        ["Tone", "Direct, practical, trustworthy and willing to call out confusing bureaucracy. Never abusive, sensational or falsely certain."],
        ["Role", "A street-smart admissions expert who understands applications, counselling, allotment, cutoffs, documents and recognition risks."],
        ["Business identity", "DekhoCampus is guidance and discovery support, not the exam authority, regulator or admissions body."],
        ["Goals", "SEO, AEO, GEO, LLMO, E-E-A-T, usability, conversion clarity and low-risk student action."],
    ], [38 * mm, 134 * mm]),
    h("What a strong exam page does", 2),
    *bullets([
        "Answers the immediate question in the first two or three sentences.",
        "Names the correct authority and explains the exact next action.",
        "Separates confirmed facts, expected events and pending information.",
        "Gives specific, verified context instead of repeating generic warnings.",
        "Makes application, preparation and counselling guidance specific to that exam.",
        "Lets the reader move to related exams, courses, colleges and official portals without confusion.",
    ]),
    p("A page is successful when a student can act safely after reading it. Length and scores are secondary.", "Callout"),
])

# Research
story.extend([
    PageBreak(),
    h("2. Research and source regulations"),
    h("Source priority", 2),
    *numbered([
        "Current official exam website or conducting-authority portal.",
        "Current official notification, bulletin, information brochure, prospectus or counselling notice.",
        "Government, regulator, statutory body or official university page.",
        "Official result, admit-card, answer-key or counselling portal for the relevant cycle.",
        "Older official documents only for historical comparison, clearly labelled with their year.",
        "Third-party pages only to discover a lead. They cannot be the final authority for a changing claim.",
    ]),
    h("Research packet required for every exam", 2),
    rule_table([
        ["Required evidence", "What to capture"],
        ["Identity", "Official exam name, abbreviation, authority, level, category and canonical route."],
        ["Cycle", "Active year or session and whether the schedule is confirmed, expected or not announced."],
        ["Dates", "Notification, application opening/closing, correction, admit card, exam, result and counselling dates where published."],
        ["Eligibility", "Age, qualification, subject combination, attempts, nationality, category and programme-specific conditions."],
        ["Pattern and syllabus", "Paper names, sections, mode, duration, language, marks and marking scheme from the current document."],
        ["Application", "Official apply URL, document requirements, fee and correction route."],
        ["After the exam", "Answer key, scorecard, shortlist, counselling, interview, verification, allotment or joining process."],
        ["Freshness", "Source URL, document year/version, checked time and reviewer confidence."],
    ], [42 * mm, 130 * mm]),
    h("Research restrictions", 2),
    *bullets([
        "Do not treat a Google snippet as the source.",
        "Do not copy a coaching calendar into a future cycle.",
        "Do not publish a social post, WhatsApp message or YouTube claim without official confirmation.",
        "Do not copy competitor prose, tables or FAQ wording.",
        "Do not publish a source URL that was not opened and checked.",
        "Keep private research notes, prompts and confidence scores out of public content.",
    ]),
])

# Dates
story.extend([
    PageBreak(),
    h("3. Dates, cycles and freshness"),
    h("The 2026 and 2027 rule", 2),
    p("Do not change a year just because a future-year keyword appears attractive. If an authority is still running a 2026 cycle, keep it as 2026. Use a 2027 date only after the responsible authority publishes it. When the 2027 schedule is unavailable, write Not announced and tell the reader which official page will carry the update."),
    rule_table([
        ["Situation", "Required wording or action"],
        ["Exact 2027 date is officially published", "Use the date, name the authority and store the supporting source and verification time."],
        ["2027 exam is expected but no calendar exists", "Use Not announced. Do not move the previous year's day and month forward."],
        ["Current 2026 process is still open", "Keep the genuine 2026 status and deadline. Do not relabel it as 2027."],
        ["Only a tentative official calendar exists", "Label the date tentative and explain that the detailed notification can change it."],
        ["Different sessions have different dates", "Keep sessions under the canonical exam unless the authority treats them as separate products."],
        ["A date changed", "Update every related field, article paragraph, metadata mention, FAQ answer and change log together."],
    ], [50 * mm, 122 * mm]),
    h("Date-writing rules", 2),
    *bullets([
        "Use one clear date format consistently on the page.",
        "Never say scheduled around Not announced, See official calendar or Pending.",
        "Do not bury an expired date inside a long paragraph.",
        "State uncertainty once, then move to useful action instead of repeating a disclaimer under every heading.",
        "Record data_verified_at and data_last_checked_at when the system supports them.",
    ]),
    p("False precision is worse than a blank. A transparent pending status protects the student and the site.", "Warning"),
])

# Identity/dedupe
story.extend([
    PageBreak(),
    h("4. Canonical identity, sessions and duplicates"),
    *numbered([
        "Match the live exam by stable slug and current production identity before writing.",
        "Check full name, abbreviation, authority, level and admission purpose to prevent a false match.",
        "Treat sessions, phases, answer keys and counselling rounds as updates to the canonical exam unless they serve a genuinely separate search intent.",
        "When duplicate rows exist, choose one canonical record, preserve references and prepare redirects before any soft deletion.",
        "Never import an old snapshot ID directly into production without matching the current row.",
        "Keep a duplicate-resolution note showing canonical slug, retired slug, reason and redirect status.",
    ]),
    h("Duplicate-content tests", 2),
    *bullets([
        "No repeated opening sentence across a batch.",
        "No identical application paragraph across different exams.",
        "No reused preparation block with only the exam name changed.",
        "No repeated FAQ question set across unrelated exams.",
        "No separate page that competes with the parent exam for the same intent.",
        "No cosmetic headline rewrite for an already covered topic and year.",
    ]),
    p("Adding the exam name to a shared template does not make the content original.", "Callout"),
])

# Inputs and fields
story.extend([
    PageBreak(),
    h("5. Required inputs and exam data fields"),
    h("Editorial inputs", 2),
    *bullets([
        "Primary keyword and natural variants.",
        "Secondary keywords and named entities.",
        "Audience segment and immediate decision.",
        "Search intent: informational, commercial or transactional.",
        "Target length and content depth.",
        "Official research packet and verification time.",
        "Verified DekhoCampus internal-link candidates.",
        "Batch siblings so repetition checks can compare all ten records.",
    ]),
    h("Core exam record fields", 2),
    rule_table([
        ["Field group", "Required content"],
        ["Identity", "name, title, full_name, stable slug and conducting_authority"],
        ["Classification", "category, level, mode, frequency and exam type where supported"],
        ["Current status", "active cycle, status, exam date, application dates and result or counselling status"],
        ["Decision content", "eligibility, syllabus, pattern, application process, preparation, result and counselling guidance"],
        ["Summaries", "description, hero hook, page summary, important dates and change context"],
        ["SEO metadata", "meta title, meta description, keywords, tags and canonical route"],
        ["Evidence", "official website, registration URL, source URLs and checked timestamps"],
        ["Navigation", "three or four verified internal links plus official apply and notification links"],
        ["FAQs", "four distinct records stored in the separate FAQ table or dedicated FAQ field"],
    ], [40 * mm, 132 * mm]),
    p("Only write fields supported by the current production schema. FAQs are upserted separately when the database uses a dedicated FAQ table.", "Note"),
])

# Writing tone
story.extend([
    PageBreak(),
    h("6. Human writing and tone rules"),
    h("Opening", 2),
    *bullets([
        "Start with the answer, consequence, deadline risk or decision - not a definition of education or a generic introduction.",
        "Never print prompt residue such as Answer first:, Answer:, Executive summary: or Here is the answer:.",
        "Put the primary keyword naturally in the first 100 words.",
        "Do not use the same hook twice in a batch.",
    ]),
    h("Voice and rhythm", 2),
    *bullets([
        "Use active voice and contractions where natural: don't, can't, isn't, you'll.",
        "Mix short punchy sentences with longer explanatory sentences. Do not manufacture a pattern.",
        "Starting a sentence with But, And, Because or Or is acceptable when it sounds natural.",
        "Use rhetorical questions sparingly and answer them immediately.",
        "Allow mild frustration with confusing official processes, but keep advice respectful and precise.",
        "Write to the student, not at the student. Parents should still understand cost, recognition and travel risks.",
        "End when the final useful point is made. Do not add a generic conclusion or repeat the thesis.",
    ]),
    h("What human does not mean", 2),
    *bullets([
        "Do not insert spelling mistakes on purpose.",
        "Do not force Hinglish into every page.",
        "Do not invent personal counselling experience, interviews or student stories.",
        "Do not become rude, reckless or overconfident.",
        "Do not chase AI-detector scores by damaging clarity or accuracy.",
    ]),
])

# Banned language
story.extend([
    PageBreak(),
    h("7. Forbidden language and presentation patterns"),
    h("Blocked words and phrases", 2),
    p("Do not use the following in publishable exam copy unless a quoted official title absolutely requires it:"),
    rule_table([
        ["Category", "Blocked language"],
        ["Generic AI words", "delve, testament, tapestry, paramount, landscape, seamless, robust, comprehensive, crucial"],
        ["Corporate verbs", "foster, harness, leverage, encapsulate, illuminate, demystify, unravel, pivot, elevate, underscore, showcase, streamline, bolster, optimize"],
        ["Corporate adjectives", "pivotal, multifaceted, bespoke, groundbreaking, imperative, overarching, dynamic, nuanced, quintessential, transformative"],
        ["Generic transitions", "furthermore, moreover, additionally, nevertheless, consequently, henceforth, in tandem with, it is worth noting that"],
        ["Openings and closings", "in conclusion, ultimately, to summarize, in summary, let's dive in, here is a detailed guide, certainly, in today's world"],
        ["Ed-tech cliches", "holistic development, academic excellence, myriad of options, embark on your journey, transformative experience, navigating the landscape, educational tapestry, vibrant campus life"],
        ["Marketing cliches", "game-changer, unlock the power, beacon, vital role"],
        ["Typography", "em dash and en dash; use the ordinary ASCII hyphen instead"],
    ], [43 * mm, 129 * mm], tiny=True),
    h("Forbidden structural patterns", 2),
    *bullets([
        "No repeated Executive summary -> Key facts -> Rationale -> Steps -> Risk matrix -> Red flags -> FAQs formula.",
        "No flattened Markdown tables or vertical strings of column labels and values.",
        "No five headings that restate the same verify the official notice warning.",
        "No identical paragraph lengths and sentence rhythm throughout the page.",
        "No FAQ block in content HTML.",
        "No copied competitor attribution, YouTube promotion or source-led filler.",
    ]),
])

# HTML and FAQ
story.extend([
    PageBreak(),
    h("8. Semantic HTML and FAQ contract"),
    h("Allowed content structure", 2),
    rule_table([
        ["Element", "Use"],
        ["p", "Normal paragraphs and the direct answer immediately after a question heading."],
        ["h2", "Major student questions, decisions or process sections."],
        ["h3", "Subtopics within a larger section. Do not use H3 as decoration."],
        ["ul and li", "Features, risks, document lists, paper sections and non-sequential checks."],
        ["ol and li", "Real application or counselling sequences when order matters."],
        ["strong", "Short labels inside lists or paragraphs. Do not bold entire paragraphs."],
        ["table with thead, th and tbody", "Only for a genuine comparison such as category cutoff, paper structure or counselling option."],
        ["a", "Verified internal paths and official external URLs with descriptive anchor text."],
    ], [42 * mm, 130 * mm]),
    h("HTML restrictions", 2),
    *bullets([
        "No Markdown headings, asterisks, pipe tables or fenced code blocks in CMS content.",
        "No H1 inside managed content because the page template supplies the H1.",
        "No broken, unclosed or nested anchor tags.",
        "No external link wrapping whole paragraphs, headings or table sections.",
        "No table when a short bullet list is easier to scan on mobile.",
    ]),
    h("FAQ regulations", 2),
    *bullets([
        "Default target: four distinct exam-specific FAQs.",
        "Store FAQs in the faqs array or FAQ table only.",
        "Do not repeat FAQ headings, questions or answers in article HTML.",
        "Questions must match the real exam: eligibility, dates, application, paper, result, counselling or recognition.",
        "Answers must not introduce facts absent from the researched body content.",
        "Do not copy the same FAQ set across a batch.",
    ]),
    p("The page renderer owns the FAQ section. The writer supplies clean question-answer records, not a second body section.", "Callout"),
])

# SEO/AEO/GEO
story.extend([
    PageBreak(),
    h("9. SEO, AEO, GEO, LLMO and E-E-A-T rules"),
    rule_table([
        ["Layer", "Exam-page implementation"],
        ["Search intent", "Answer the actual decision in the first two or three sentences. Avoid broad textbook background."],
        ["Primary keyword", "Use in the meta title, first 100 words, one or two H2 headings and three to five natural body mentions."],
        ["Secondary keywords", "Use only where the entity or step is relevant. Do not force a checklist of variants."],
        ["Meta title", "Keyword-frontloaded and no more than 60 characters."],
        ["Meta description", "Clear benefit or action and no more than 155 characters."],
        ["AEO", "For a genuine question H2, make the first paragraph a direct, self-contained answer, usually about 40-60 words when that length fits."],
        ["GEO and LLMO", "Use named entities, correct authority, exact status, source date and quotable fact blocks. Avoid vague superlatives."],
        ["Information gain", "Add verified paper codes, subject requirements, fee rules, cutoff context or counselling realities. Never invent a statistic, benchmark or quote."],
        ["Experience", "Show practical process knowledge without claiming personal experience that did not happen."],
        ["Expertise", "Explain why a rule matters and what the student should check or carry."],
        ["Authoritativeness", "Name the responsible authority and distinguish the rule from DekhoCampus interpretation."],
        ["Trust", "Use consistent dates, visible uncertainty, official links, author/reviewer details and update timestamps."],
    ], [40 * mm, 132 * mm], tiny=True),
    h("Score policy", 2),
    p("SEO, AEO and GEO checkers are useful diagnostics. They do not prove ranking. Grammarly, QuillBot and AI-detector percentages are not editorial truth. Never publish unsafe copy merely to reach 100 or a claimed 60-70 percent human score.", "Warning"),
])

# Internal linking
story.extend([
    PageBreak(),
    h("10. Internal and external linking"),
    h("Internal links", 2),
    p("Every exam page should normally include at least three or four verified DekhoCampus links where relevant:"),
    *bullets([
        "The main exam directory or relevant exam-category hub.",
        "A related course or programme page.",
        "Colleges accepting the exam or a verified college directory filter.",
        "A useful tool, counselling guide, preparation resource or related exam.",
    ]),
    h("External links", 2),
    *bullets([
        "External link 1: the official application or registration portal.",
        "External link 2: the official notification, bulletin, prospectus or current source page.",
        "Use descriptive anchor text, not Click here.",
        "Open and verify every external destination before publication.",
        "Do not use an aggregator or affiliate application form when an official portal exists.",
    ]),
    h("Link safety", 2),
    *bullets([
        "Internal links must resolve to real DekhoCampus paths.",
        "Do not insert the same exact-match anchor repeatedly.",
        "Never let a malformed anchor turn later paragraphs or headings into links.",
        "Recheck links after slug merges, deduplication or year changes.",
        "Do not leak private S3 keys, internal manifests or research-only URLs.",
    ]),
    p("A link is useful only when it moves the student to a trustworthy next step.", "Callout"),
])

# Word counts
story.extend([
    PageBreak(),
    h("11. Word-count and depth options"),
    p("Length follows the task. A student downloading an admit card should not cross a thousand words to find the document checklist. A full eligibility or counselling decision may need more context."),
    rule_table([
        ["Mode", "Target", "Allowed tolerance", "Best use"],
        ["Compact", "350-400 words", "About 40 words either side when needed", "Admit card, answer key, short date update or one narrow question."],
        ["Standard", "400 words", "About 40-50 words either side", "Application, eligibility, cutoff interpretation or focused preparation guidance."],
        ["Detailed", "500 words", "About 50-60 words either side", "Multi-stage counselling, complex subject mapping or comparison-heavy decisions."],
        ["Custom", "Intent-led", "Editor-approved", "A topic whose verified detail genuinely requires less or more space."],
    ], [29 * mm, 28 * mm, 39 * mm, 76 * mm]),
    h("Length restrictions", 2),
    *bullets([
        "Do not pad the article by repeating official-verification disclaimers.",
        "Do not add a FAQ section to inflate body word count.",
        "Do not remove a safety-critical rule to hit an exact count.",
        "Do not force a table, conclusion or generic preparation paragraph for length.",
        "Count the article body separately from metadata and separate FAQ records.",
    ]),
])

# Batch variation
story.extend([
    PageBreak(),
    h("12. Batch-processing regulations"),
    p("Work in reviewable groups of ten exams. Every item must be independently researched and written. A batch is a workflow unit, not permission to reuse copy."),
    h("Non-negotiable uniqueness rules", 2),
    *bullets([
        "Never use the same opening sentence twice.",
        "Change the application explanation to match the real portal and process. Paragraphs, numbered steps and checklists may rotate only when appropriate.",
        "Give subject-specific preparation advice. Nursing can mention biology diagrams; management can address calculation speed; law can address provisions and case reading; design can address observation and sketching.",
        "Never reuse Roz thoda or another signature slang line.",
        "Create different FAQ phrasing and answers for every exam.",
        "Vary the outline according to the exam rather than shuffling a fixed template.",
        "Compare each draft with all nine siblings before accepting the batch.",
    ]),
    h("Batch deliverables", 2),
    *numbered([
        "One canonical manifest with ten unique live slugs.",
        "Official source list and checked timestamp for every record.",
        "Structured update payload using only supported database fields.",
        "Separate FAQ payloads.",
        "Duplicate, phrase-reuse, link, metadata and date-validation report.",
        "Human review notes and a clear accepted or rejected status.",
    ]),
    p("If a template is visible, the batch is rejected.", "Warning"),
])

# Exam-specific preparation and applications
story.extend([
    PageBreak(),
    h("13. Application and preparation specificity"),
    h("Application guidance", 2),
    *bullets([
        "Name the correct portal and authority.",
        "Explain registration, document upload, fee payment, correction and final confirmation only when supported.",
        "Mention exact document formats or fee amounts only when the current official notice establishes them.",
        "Warn about irreversible choices such as paper, subject, category, centre or programme selection when real.",
        "Tell the reader what proof to save: submitted form, payment receipt, confirmation page or choice-lock record.",
        "Use recruitment language for recruitment exams and admission language for entrance exams.",
    ]),
    h("Preparation guidance", 2),
    *bullets([
        "Tie every tip to the current syllabus, mode and paper structure.",
        "Name the actual skill: diagram recall, numerical speed, legal comprehension, current affairs, clinical reasoning, design observation, branch mathematics or language accuracy.",
        "Recommend previous papers or mocks only when the paper format is comparable.",
        "Avoid generic study daily, stay consistent and keep an error log copy unless the exam-specific explanation makes it useful.",
        "Do not promise a score, rank or selection outcome.",
    ]),
    h("After the exam", 2),
    *bullets([
        "Explain answer key, objection, result, scorecard, shortlist, counselling, interview, verification, allotment or joining as applicable.",
        "State clearly that a qualifying score or submitted form is not an admission or employment offer.",
        "Name the next responsible authority if it differs from the testing body.",
    ]),
])

# Safety and accuracy
story.extend([
    PageBreak(),
    h("14. Accuracy, safety and legal safeguards"),
    *bullets([
        "No fabricated dates, fees, cutoffs, ranks, seats, subject codes, eligibility rules or approval claims.",
        "No invented expert quotes, surveys, benchmarks, statistics, student stories or testimonials.",
        "No guarantee of admission, selection, employment, salary, scholarship or rank.",
        "No false urgency, fake countdown, invented seat scarcity or unsupported deadline pressure.",
        "No competitor promotion or copied wording.",
        "No claim that DekhoCampus conducts the exam or controls counselling.",
        "No publication of credentials, private applicant data, internal prompts or private source manifests.",
        "No hard deletion of duplicate exams without reference checks, redirects and recoverability.",
    ]),
    h("High-risk claims requiring double verification", 2),
    rule_table([
        ["Claim", "Minimum review"],
        ["Application deadline", "Current official notice plus live portal status."],
        ["Eligibility or subject mapping", "Current bulletin plus programme or counselling rule where applicable."],
        ["Fee or refund", "Official fee schedule or notice and correct category or institution context."],
        ["Cutoff or qualifying mark", "Official result/counselling document with year and category."],
        ["Recognition or approval", "Current regulator record for the exact course, campus and cycle."],
        ["Seat count", "Current official seat matrix and counselling round context."],
    ], [48 * mm, 124 * mm]),
    p("If a student could lose time, money or an opportunity because of a claim, verify it twice and show the official path.", "Callout"),
])

# QA
story.extend([
    PageBreak(),
    h("15. Automated and human quality gates"),
    rule_table([
        ["Gate", "Reject or return for correction when"],
        ["Identity", "Slug, authority, year or exam purpose does not match the live canonical record."],
        ["Sources", "Official application or notification source is missing, stale or unopened."],
        ["Dates", "A pending value is presented as confirmed or years conflict across fields."],
        ["Metadata", "Title exceeds 60 characters, description exceeds 155, or the promise differs from the page."],
        ["Keyword", "Primary phrase is missing from required positions or is mechanically stuffed."],
        ["Structure", "Body contains H1, Markdown, a flattened table, broken HTML or a duplicated FAQ block."],
        ["Originality", "Opening, application, preparation or FAQ text repeats across the batch."],
        ["Language", "Forbidden cliche, prompt residue, fake experience, forced slang or excessive hype appears."],
        ["Links", "Fewer than three useful internal links, missing official links or a broken/unverified destination."],
        ["Claims", "Unsupported date, fee, cutoff, seat, eligibility, quote, approval or outcome is present."],
        ["Usability", "The reader cannot identify the next action or mobile formatting is hard to scan."],
        ["Technical", "Schema field mismatch, unsafe HTML, missing canonical or public page regression."],
    ], [38 * mm, 134 * mm], tiny=True),
    h("Human reviewer questions", 2),
    *bullets([
        "Would I trust this date enough to book travel or pay a fee?",
        "Can I trace every high-impact claim to the correct authority?",
        "Does this sound like this exam, or could the exam name be swapped without changing the article?",
        "Is any paragraph repeating advice already given?",
        "Can the reader tell what is confirmed, tentative and pending?",
        "Are FAQs separate and genuinely useful?",
        "Do all links work and lead to the intended page?",
    ]),
])

# Workflow and publishing
story.extend([
    PageBreak(),
    h("16. End-to-end production workflow"),
    rule_table([
        ["Stage", "Required action", "Release evidence"],
        ["1. Select", "Choose ten canonical live exams and exclude duplicates or conflicting sessions.", "Manifest with IDs and slugs"],
        ["2. Research", "Open official sources and capture current-cycle evidence.", "Source log and checked time"],
        ["3. Draft", "Write unique structured content, metadata, links and separate FAQs.", "Review payload"],
        ["4. Validate", "Run phrase, duplicate, FAQ, HTML, metadata, link and claim checks.", "Machine QA report"],
        ["5. Review", "Human editor checks accuracy, tone, student action and mobile readability.", "Approval or rejection notes"],
        ["6. Preflight", "Match payload to current production rows and supported schema fields.", "Zero unresolved mismatches"],
        ["7. Back up", "Export every affected exam and FAQ row before writing.", "Timestamped backup and rollback map"],
        ["8. Apply", "Update transactionally; upsert FAQs separately; never import stale snapshot IDs.", "Migration ledger"],
        ["9. Verify", "Check API, public page, FAQ section, sitemap, canonical and links.", "Post-release verification"],
        ["10. Monitor", "Watch authority changes, broken links, indexing and user feedback.", "Freshness queue"],
    ], [24 * mm, 103 * mm, 45 * mm], tiny=True),
    h("Rollback regulation", 2),
    p("Every production batch must be reversible. Keep the previous rows, FAQ records, canonical mapping and migration ledger. If public verification fails, restore the affected rows instead of improvising a second write."),
    p("A Git commit or frontend deployment does not update database exam content. Production data changes require an explicit, validated migration.", "Warning"),
])

# Writing blueprint
story.extend([
    PageBreak(),
    h("17. Recommended exam-page blueprint"),
    p("This is a decision framework, not a mandatory repeated template. Select only the sections the exam and intent need."),
    rule_table([
        ["Possible section", "What it should answer"],
        ["Opening answer", "What is happening, who it affects and the immediate next action."],
        ["Current status and dates", "What is confirmed, tentative or pending for the active cycle."],
        ["Who can apply", "The real qualification, age, subject, attempts and category conditions."],
        ["Application route", "Where to apply, critical choices, documents, payment and proof to save."],
        ["Paper and syllabus", "Mode, sections, marking, language and preparation implications."],
        ["Exam-day or document checks", "What to carry, report time and authority-specific restrictions when published."],
        ["Result and next step", "Answer key, scorecard, shortlist, counselling, interview, verification or joining."],
        ["Decision context", "Verified fees, cutoffs, subject mapping, travel or recognition issue when relevant."],
        ["Useful links", "Three or four contextual DekhoCampus routes plus official apply and notice links."],
        ["Separate FAQs", "Four distinct question-answer records rendered outside the article body."],
    ], [46 * mm, 126 * mm]),
    h("Direct-answer paragraph standard", 2),
    p("When an H2 is a real question, the first paragraph should normally provide a concise self-contained answer. A 40-60 word block is useful for extractability when the answer needs that space, but clarity decides the final length. Do not force every H2 into the same shape."),
])

# Good/bad examples
story.extend([
    PageBreak(),
    h("18. Good and bad exam-copy examples"),
    h("Opening", 2),
    rule_table([
        ["Reject", "Accept"],
        ["Answer first: Candidates must check the official website for all updates.", "The 2027 schedule is not announced yet. Keep your documents ready, but do not pay through any portal until the conducting authority opens the official application window."],
        ["In today's world, this crucial examination plays a vital role in shaping careers.", "Your score is only the first filter. The college or counselling authority can still apply course eligibility, category and document rules before offering a seat."],
    ], [86 * mm, 86 * mm]),
    h("Dates", 2),
    rule_table([
        ["Reject", "Accept"],
        ["The exam is scheduled around Not announced.", "The exam date has not been announced. Check the authority's current notice page before booking travel."],
        ["The 2027 exam will likely be held on the same date as 2026.", "The authority has not published the 2027 calendar. The 2026 date is historical context, not a 2027 deadline."],
    ], [86 * mm, 86 * mm]),
    h("Information gain", 2),
    rule_table([
        ["Reject", "Accept"],
        ["A university may require particular subjects, so verify the rules.", "For a named university, state the exact verified subject combination and the current official source. If the current rule is unavailable, say so instead of generalising."],
        ["Expert Insight: 82 percent of students make this mistake.", "Authority fact: use the exact paper code, qualifying rule or fee from the current official document, with no invented survey."],
    ], [86 * mm, 86 * mm]),
    h("Tables and FAQs", 2),
    rule_table([
        ["Reject", "Accept"],
        ["A pasted stack of table headers and values with no HTML structure.", "A compact semantic table with labelled headers, or a short bullet list when mobile reading is better."],
        ["FAQ questions repeated under an H2 and again in the FAQ widget.", "Four FAQ records in the dedicated FAQ field only."],
    ], [86 * mm, 86 * mm]),
])

# Prompt contract
story.extend([
    PageBreak(),
    h("19. Reusable exam-author prompt contract"),
    p("Use this as the policy layer before the topic-specific request. Supply the verified research packet separately."),
    p(
        "You are the senior DekhoCampus exam editor writing for Indian students and parents. "
        "Answer the student's decision in the first two or three sentences. Use only the supplied official evidence. "
        "Never invent dates, fees, cutoffs, seats, eligibility, quotes, surveys, approvals or outcomes. "
        "Use clean semantic HTML with p, h2, h3, ul, ol, li, strong, a and a real table only when useful. "
        "Do not use H1, Markdown, a flattened table, prompt residue or a FAQ block in content_html. "
        "Return four distinct exam-specific FAQs in the separate faqs field only. "
        "Use a unique opening, application explanation, subject-specific preparation advice and FAQ set. "
        "Add three or four verified DekhoCampus links, one official application link and one official notification link. "
        "Keep the meta title within 60 characters and meta description within 155 characters. "
        "Use natural Indian English, varied rhythm and direct practical advice without forced slang or banned corporate cliches. "
        "Mark unpublished future information as Not announced. Preserve a genuine active 2026 cycle instead of changing its year for SEO. "
        "Return strict structured data compatible with the current schema and include sources and checked time for review.",
        "CodexBlock",
    ),
    h("Required topic packet", 2),
    p("Exam: {{EXAM_NAME}} | Cycle: {{ACTIVE_CYCLE}} | Primary keyword: {{PRIMARY_KEYWORD}} | Secondary keywords: {{SECONDARY_KEYWORDS}} | Audience: {{AUDIENCE}} | Intent: {{SEARCH_INTENT}} | Target length: {{WORD_COUNT_MODE}} | Official sources: {{OFFICIAL_SOURCES}} | Verified facts: {{VERIFIED_FACTS}} | Internal links: {{INTERNAL_LINKS}} | Batch siblings: {{BATCH_SIBLINGS}}", "CodexBlock"),
])

# Checklists
story.extend([
    PageBreak(),
    h("20. Final writer and reviewer checklists"),
    h("Writer handoff", 2),
    *bullets([
        "Canonical exam and authority are correct.",
        "Active cycle is correct and every date has a status.",
        "Opening directly answers the decision.",
        "Application and preparation sections are exam-specific.",
        "HTML is semantic and contains no H1 or Markdown.",
        "FAQs exist only in the separate field.",
        "Three or four internal links and both official external links are verified.",
        "Metadata fits 60/155 limits.",
        "No banned phrase, copied passage, repeated template or unsupported claim remains.",
        "Sources and checked timestamp are attached for review.",
    ]),
    h("Reviewer approval", 2),
    *bullets([
        "Official evidence was opened, not inferred from a snippet.",
        "All high-risk claims were checked twice.",
        "Dates and year agree across fields, content, metadata and FAQs.",
        "The page reads differently from the other nine batch records.",
        "No flattened table or FAQ duplication appears.",
        "The reader has a clear next action and no false promise.",
        "Desktop and mobile previews are readable and links work.",
        "The payload maps safely to current production fields.",
    ]),
    p("Approval means the page is safe and useful - not that a search ranking is guaranteed.", "Callout"),
])

# Repository status appendix
story.extend([
    PageBreak(),
    h("Appendix A. Current repository audit context"),
    p("The rules above apply to all new exam work and to any legacy record before production migration. The latest repository audit found:"),
    rule_table([
        ["Audit item", "Finding"],
        ["Numbered batches", "41 batch builders with matching JSON and Markdown review reports"],
        ["Batch versions", "410 versions covering 390 unique exam slugs"],
        ["Additional rechecks", "11 editorial recheck versions, bringing the artifact total to 421"],
        ["Competing versions", "30 slugs have competing batch or recheck versions"],
        ["Uncovered old-snapshot rows", "112 active snapshot slugs were not refreshed"],
        ["Latest variation policy", "Only the latest 10 records contain the final content-variation metadata"],
        ["Legacy repeated phrase issue", "370 legacy rows still contain a forbidden repeated phrase"],
        ["Production meaning", "Reports are review artifacts only; they do not update the live database"],
    ], [55 * mm, 117 * mm]),
    p("Legacy batches are not automatically approved by being present in Git. They require regeneration or individual review, live-slug preflight and an explicit transactional database migration.", "Warning"),
    h("Appendix B. One-line publication rule", 1),
    p("Research from the authority, write for the student, validate for the machine, review as a human, and publish only through a reversible process.", "Callout"),
])


doc = SimpleDocTemplate(
    str(OUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=22 * mm,
    bottomMargin=20 * mm,
    title="DekhoCampus Exam Writing Rules and Regulations",
    author="DekhoCampus",
    subject="Exam research, writing, SEO, AEO, GEO, quality control and publishing rules",
)
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
