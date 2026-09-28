# Homepage course curation

Reviewed 28 September 2026. Applies only to the homepage Explore by Category course cards.

## What changed

The previous alphabetical fallback surfaced Aeronautical Engineering and similarly alphabetically early courses, not a researched selection. Each of the 13 categories now has five explicit course picks. All 65 placements were matched against active records in the public catalogue; no course records or names were changed in the database.

The displayed names are concise labels, and links retain each existing record's real slug. Exact-slug fetching prevents incomplete legacy categories or the category query's 200-record limit from hiding the curated picks. Only active records are fetched. Missing picks can be filled by existing category candidates; sample records are excluded. No nonexistent course URL is generated.

The cards also share the college/exam panel's row sizing, icon footprint and stretchable list layout. Course/college counts remain hidden on these course cards. The course cache key has been advanced to avoid retaining the old recommendations.

## Course picks, in display order

| Category | Five courses |
| --- | --- |
| Engineering | B.Tech Computer Science; B.Tech Artificial Intelligence; B.Tech Data Science; B.Tech Information Technology; B.Tech Electronics & Communication |
| Management | MBA; MBA Business Analytics; BBA; MBA Finance; MBA Digital Marketing |
| Commerce and Banking | B.Com Honours; B.Com; Chartered Accountancy; Company Secretary; B.Com Banking & Insurance |
| Medical | MBBS; B.Sc Nursing; Bachelor of Physiotherapy; BDS; B.Sc Medical Laboratory Technology |
| Science | B.Sc Computer Science; B.Sc Biotechnology; M.Sc Data Science; B.Sc Forensic Science; B.Sc Statistics |
| Hotel Management | B.Sc Hospitality & Hotel Administration; BHM; Hotel Management & Catering Technology; Catering Technology & Culinary Arts; Tourism & Travel Management |
| Information Technology | BCA; MCA; B.Sc Information Technology; B.Sc Computer Science; Cybersecurity & Ethical Hacking |
| Arts & Humanities | BA Psychology; BA Economics Honours; BJMC; BA Journalism; MA Public Policy |
| Agriculture | B.Sc Agriculture; B.Sc Horticulture; B.Tech Food Technology; M.Sc Agriculture; MBA Agribusiness Management |
| Law | BA LLB; BBA LLB; LLB; LLM; B.Com LLB |
| Pharmacy | B.Pharm; D.Pharm; Pharm.D; M.Pharm Pharmaceutics; M.Pharm Pharmaceutical Analysis |
| Education | B.Ed; D.El.Ed; B.El.Ed; M.Ed; B.Ed Special Education |
| Design | B.Des; B.Des UX Design; B.Des Product Design; B.Des Fashion Communication; B.Des Graphic Design |

## Evidence and limitations

These are editorially curated popular and emerging programmes, not measured Google search-volume rankings, official course rankings, guaranteed employment outcomes, or proof that every specialisation is currently growing. Evidence mixes Indian enrolment patterns, broader employment trends and established programme offerings. The card subtitle is therefore “Popular & emerging programmes,” rather than an unqualified high-demand claim.

- [AISHE final reports](https://aishe.gov.in/document-category/aishe-final-reports/), including the 2023–24 report released in 2026: Indian enrolment context, including Computer Engineering's prominence and substantial healthcare and mainstream degree participation. Enrolment is historical, not live 2026 search demand.
- [World Economic Forum, Future of Jobs Report 2025](https://www.weforum.org/publications/the-future-of-jobs-report-2025/digest/): forward-looking signals for AI/data, cybersecurity, software, care and education. This is global employer research, not an Indian course-popularity league table.
- [IIT Patna Computer Science & Engineering](https://www.iitp.ac.in/departments/computer-science-engineering): real CSE and AI/data-science programme context.
- [IIM Bangalore MBA Business Analytics](https://www.iimb.ac.in/programmes/pgpba): established analytics-focused management programme context.
- [University of Delhi curricula](https://academicaffairs.du.ac.in/syllabi/): commerce, economics, psychology and other disciplinary programme context.
- [NCHMCT](https://www.nchm.gov.in/): hospitality and hotel administration programme context.
- [ICAR agricultural programme accreditation lists](https://icar.gov.in/index.php/en/updated-list-accreditation-agricultural-universitiescolleges-and-their-programs): agricultural programme context, not a claim of approval for any particular DekhoCampus listing.
- [NLSIU BA LLB](https://www.nls.ac.in/programme/ba-llb-hons/) and [three-year LLB](https://www.nls.ac.in/programme/3-year-llb-hons/): law programme context.
- [PCI FAQs](https://pci.gov.in/en/faqs/): pharmacy course types and registration distinctions. A course-card listing does not establish approval of a particular institution.
- [NCTE ITEP](https://ncte.gov.in/website/ITEP/ITEPIndex.aspx) and [IGNOU B.Ed](https://www.ignou.ac.in/schools/programme/B.ED): teacher-education context. No old B.Ed/BA B.Ed record was relabelled as ITEP.
- [NIFT programmes and admissions](https://nift.ac.in/admissions) and [Fashion Communication](https://nift.ac.in/academics/programmes/undergraduate/fashion-communication): design and communication programme context, including digital disciplines.

The catalogue does not currently provide a verified dedicated B.Tech CSE (AI & ML) record or ITEP record. Engineering therefore uses the existing B.Tech Artificial Intelligence page, without inventing a CSE specialisation. The IT cybersecurity listing is not labelled as a B.Tech degree. Exact programme eligibility, duration and institutional recognition still need checking on the individual page before applying.

## Future review

Review these selections when better Indian search-demand data, enquiries, application events or updated enrolment reports become available. `src/lib/homepageCoursePicks.ts` is the single place to adjust course order and display labels; existing public course records must exist before adding a slug. This change does not create a new admin configuration feature or alter existing editorial/admin workflows.
