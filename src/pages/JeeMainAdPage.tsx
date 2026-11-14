import QUESTION_PAPERS from "@/data/jeeMainPapers.json";
import { useState, type MouseEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ChevronDown, Info } from "lucide-react";
import { hasSubmittedLead } from "@/lib/leadSession";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { FAQSection } from "@/components/FAQSection";
import { AuthorByline } from "@/components/AuthorByline";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { LeadGateDialog } from "@/components/LeadGateDialog";
import { useSEO } from "@/hooks/useSEO";
import { CarouselControls, useCarouselNav } from "@/components/CarouselControls";

const COLLEGE_APPLICATIONS = [
  { slug: "lovely-professional-university", name: "Lovely Professional University", logo_url: "https://aws-origin.dekhocampus.com/storage/v1/object/public/legacy-public-assets/sanitized/bottom-12-v1/ea/eaa5565056636a93d2e1c8fe856429dd3d691dc660dbfad6ca1ddd61dd225e23.webp", href: "https://www.lpu.in/landing-pages/brand/?utm_source=dekhocampus" },
  { slug: "amity-university-noida", name: "Amity University", logo_url: "/assets/amity-noida-admissions-logo.png", href: "https://noida.amity.edu/admission-open/?utm_source=dekhocampus&utm_medium=jee&utm_campaign=jeep" },
];

const NTA_PORTAL = "https://jeemain.nta.nic.in/";
const OFFICIAL_FORM = "https://jeemain.nta.nic.in/online-application-form-for-jee-main-2027-session-1/";
const APPLICATION_NOTICE = "https://nta.ac.in/Download/Notice/Notice_20261024220013.pdf";
const FRESH_FORM_NOTICE = "https://nta.ac.in/Download/Notice/Notice_20261030202143.pdf";
const BULLETIN = "https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/10/202610241890224107.pdf";
const NOTICE_IMAGE = "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/editor/1793377152584-fljho1.webp";
const REGULAR_APPLICATION_CLOSES = Date.parse("2026-11-22T18:20:00Z");
const LATE_APPLICATION_OPENS = Date.parse("2026-11-22T18:30:00Z");
const VIDEO_CLOSES = Date.parse("2026-11-26T18:20:00Z");
const PAPERS_ZIP = "https://aws-origin.dekhocampus.com/storage/v1/object/public/study-material/jee-main/2022-2026/DekhoCampus_JEE_Main_2022_2026_All_106_Papers.zip";

const copy = {
  en: {
    title: "JEE Main 2027 Application: Dates, Fees & Official Form",
    meta: "Apply through NTA's JEE Main 2027 portal. Find Session 1 deadlines, fees, documents and official question papers from 2022 to 2026.",
    eyebrow: "DekhoCampus application guide",
    intro: "Applying for the January session? Submit your form on NTA's website. This guide explains the dates and the step that proves your application is complete.",
    officialButton: "Go to the official NTA application portal",
    independent: "DekhoCampus is an independent guidance site. Our form below does not submit your JEE Main application to NTA.",
    scheduleTitle: "Know your application window",
    scheduleIntro: "NTA's 24 October 2026 notice gives these Session 1 windows. Check the portal for any later change before paying.",
    schedule: [
      ["Regular application and payment", "By 22 November 2026, 11:50 pm IST"],
      ["Application with ₹500 late fee", "23 to 26 November 2026, ending 11:50 pm IST"],
      ["Correction facility", "27 to 29 November 2026"],
    ],
    noticeLink: "Read NTA's Session 1 application notice",
    stepsTitle: "From registration to confirmation",
    steps: [
      "Open the Session 1 application link on the NTA portal and register with contact details you can access.",
      "Enter your personal and academic details, choose the paper and exam cities, and upload documents in the formats NTA asks for.",
      "Review the preview, pay the applicable fee and download the confirmation page. Keep the application number and payment record.",
    ],
    formLead: "Need help understanding the steps?",
    formDisclosure: "This optional DekhoCampus form is for guidance and updates. It is not an NTA application form.",
    formTitle: "Get JEE Main guidance from DekhoCampus",
    formSubtitle: "Your exam application must still be completed on the official NTA portal.",
    videoTitle: "Watch the application steps",
    videoNote: "DekhoCampus visual guide. Follow the current NTA notice if any date or instruction changes.",
    correctionTitle: "Made a mistake in an existing form?",
    correctionText: "NTA's 30 October clarification says the last fully paid form with a confirmation page is valid. If a new form is left unpaid or has no confirmation page, an earlier completed form remains valid. The earlier fee is neither refunded nor transferred to a fresh form. For changes allowed through correction, use NTA's separate correction instructions.",
    imageAlt: "NTA notice dated 30 October 2026 on valid JEE Main applications, previous fees and correction",
    imageCaption: "National Testing Agency public notice, 30 October 2026.",
    correctionLink: "Read the complete NTA clarification",
    faqTitle: "JEE Main 2027 application questions",
    faqs: [
      { question: "Where do I submit the JEE Main 2027 form?", answer: "Submit it only through the application link on jeemain.nta.nic.in. A DekhoCampus guidance form does not create an NTA application." },
      { question: "Is an application number enough to complete registration?", answer: "No. Complete the applicable payment and save the confirmation page from the NTA portal." },
      { question: "Will a previous fee transfer if I start a fresh form?", answer: "No. NTA's 30 October clarification says the earlier fee is neither refunded nor adjusted against a fresh application." },
      { question: "Which JEE Main paper should an engineering applicant choose?", answer: "Paper 1 is for B.E. and B.Tech. Paper 2A is for B.Arch, while Paper 2B is for B.Planning. Choose the paper that matches your intended course." },
      { question: "Are the previous-year question papers free to open?", answer: "Yes. The 106-paper collection and individual PDFs are hosted by DekhoCampus. Individual PDFs open directly without OTP. The complete ZIP requires mobile OTP verification and form completion." },
      { question: "Does completing JEE Main registration secure a college seat?", answer: "No. Registration lets you apply for the examination. Admission depends on the institution's eligibility rules and the applicable counselling or selection process." },
    ],
    footer: "Independent student guidance by DekhoCampus. Official exam applications are handled by NTA.",
  },
  hi: {
    title: "JEE Main 2027 आवेदन: तारीखें और आधिकारिक फॉर्म",
    meta: "JEE Main 2027 Session 1 का आवेदन केवल NTA पोर्टल पर करें। अंतिम तारीख, फीस, पुष्टि पृष्ठ और सुधार के नियम समझें।",
    eyebrow: "DekhoCampus आवेदन मार्गदर्शिका",
    intro: "जनवरी सेशन के लिए आवेदन कर रहे हैं? फॉर्म NTA की वेबसाइट पर ही जमा करें। यहाँ तारीखें और आवेदन पूरा होने का प्रमाण समझें।",
    officialButton: "NTA के आधिकारिक आवेदन पोर्टल पर जाएँ",
    independent: "DekhoCampus एक स्वतंत्र मार्गदर्शन वेबसाइट है। नीचे दिया फॉर्म आपका JEE Main आवेदन NTA को नहीं भेजता।",
    scheduleTitle: "आवेदन की समय सीमा समझें",
    scheduleIntro: "NTA की 24 अक्टूबर 2026 की सूचना में Session 1 के लिए ये तारीखें दी गई हैं। भुगतान से पहले पोर्टल पर नया अपडेट देखें।",
    schedule: [
      ["सामान्य आवेदन और भुगतान", "22 नवंबर 2026, रात 11:50 बजे IST तक"],
      ["₹500 विलंब शुल्क के साथ आवेदन", "23 से 26 नवंबर 2026, रात 11:50 बजे IST तक"],
      ["फॉर्म में सुधार", "27 से 29 नवंबर 2026"],
    ],
    noticeLink: "NTA की Session 1 आवेदन सूचना पढ़ें",
    stepsTitle: "रजिस्ट्रेशन से पुष्टि पृष्ठ तक",
    steps: [
      "NTA पोर्टल पर Session 1 आवेदन लिंक खोलें और ऐसे मोबाइल नंबर व ईमेल से पंजीकरण करें जिन तक आपकी पहुँच हो।",
      "निजी और शैक्षणिक विवरण भरें, पेपर व परीक्षा शहर चुनें और NTA के बताए प्रारूप में दस्तावेज अपलोड करें।",
      "फॉर्म का पूर्वावलोकन जाँचें, लागू शुल्क का भुगतान करें और पुष्टि पृष्ठ डाउनलोड करें। आवेदन संख्या और भुगतान का रिकॉर्ड रखें।",
    ],
    formLead: "आवेदन के चरण समझने में मदद चाहिए?",
    formDisclosure: "यह DekhoCampus का वैकल्पिक मार्गदर्शन फॉर्म है, NTA का आवेदन फॉर्म नहीं।",
    formTitle: "DekhoCampus से JEE Main मार्गदर्शन पाएँ",
    formSubtitle: "परीक्षा का आवेदन आधिकारिक NTA पोर्टल पर ही पूरा करें।",
    videoTitle: "आवेदन के चरण वीडियो में देखें",
    videoNote: "DekhoCampus की दृश्य मार्गदर्शिका। किसी तारीख या नियम में बदलाव होने पर NTA की नई सूचना मानें।",
    correctionTitle: "पहले भरे फॉर्म में गलती है?",
    correctionText: "NTA के 30 अक्टूबर के स्पष्टीकरण के अनुसार, भुगतान और पुष्टि पृष्ठ वाला सबसे नया फॉर्म मान्य है। नया फॉर्म अधूरा या बिना भुगतान के रह जाए तो पहले पूरा किया गया आवेदन मान्य रहता है। पुरानी फीस न लौटाई जाती है, न नए फॉर्म में समायोजित होती है। सुधार के लिए NTA के अलग निर्देश देखें।",
    imageAlt: "30 अक्टूबर 2026 की NTA सूचना में मान्य आवेदन, पुरानी फीस और सुधार के नियम",
    imageCaption: "राष्ट्रीय परीक्षा एजेंसी की सार्वजनिक सूचना, 30 अक्टूबर 2026।",
    correctionLink: "NTA का पूरा स्पष्टीकरण पढ़ें",
    faqTitle: "JEE Main 2027 आवेदन से जुड़े सवाल",
    faqs: [
      { question: "JEE Main 2027 का फॉर्म कहाँ जमा करें?", answer: "आवेदन केवल jeemain.nta.nic.in पर दिए गए आधिकारिक लिंक से जमा करें। DekhoCampus का मार्गदर्शन फॉर्म NTA आवेदन नहीं बनाता।" },
      { question: "क्या केवल आवेदन संख्या मिलने से फॉर्म पूरा हो जाता है?", answer: "नहीं। लागू शुल्क का भुगतान पूरा करें और NTA पोर्टल से पुष्टि पृष्ठ डाउनलोड करें।" },
      { question: "नया फॉर्म भरने पर पुरानी फीस समायोजित होगी?", answer: "नहीं। NTA के 30 अक्टूबर के स्पष्टीकरण के अनुसार पुरानी फीस न लौटती है, न नए आवेदन में समायोजित होती है।" },
    ],
    footer: "DekhoCampus का स्वतंत्र छात्र मार्गदर्शन। परीक्षा आवेदन NTA के पोर्टल पर ही होते हैं।",
  },
} as const;

function JeeGuidanceForm({ id }: { id: string }) {
  return <section id={id} className="rounded border border-blue-100 bg-[#e9f3ff] p-4 sm:p-5" aria-label="JEE Main guidance form">
    <div className="mx-auto max-w-xl [&_img]:h-auto [&_img]:w-40 [&>div>div:first-child>div]:w-full [&>div>div:first-child>div]:flex-col [&>div>div:first-child>div]:text-center">
      <h3 className="text-base font-bold text-blue-900 sm:text-lg">Free JEE Main papers and 2027 exam alerts</h3>
      <p className="mb-4 mt-2 text-sm leading-6 text-slate-700">Sign up with us for previous-year question papers and important updates on applications, admit cards and exam dates.</p>
      <LeadCaptureForm variant="card" brandLogoUrl="/assets/nta-logo-official-link.png?v=20261102" brandName="National Testing Agency" title="" subtitle="" source="JEE-paid" interestedExamSlug="jee-main" interestLabel="Programme" interestOptions={["B.Tech / B.E.", "B.Arch", "B.Planning"]} unbrandedConsent simple contactOnly />
    </div>
    <p className="mt-3 text-center text-xs leading-5 text-slate-600">Optional DekhoCampus guidance form. This does not submit an application to NTA.</p>
  </section>;
}

function AdmissionCarousel() {
  const carousel = useCarouselNav();
  return <section aria-labelledby="admission-options-title" className="min-w-0">
    <h2 id="admission-options-title" className="font-bold text-blue-900">Apply directly. Explore <span className="text-orange-600">up to 100% scholarships.</span></h2>
    <p className="mt-2 text-xs leading-5 text-slate-600">Explore early application options. <a href="https://www.amity.edu/scholarships/" target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">Amity scholarships</a> are subject to the applicable admission year, merit, eligibility and renewal conditions; early application does not guarantee an award.</p>
    <div ref={carousel.ref} onScroll={carousel.recompute} className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" aria-label="College logos">
      {COLLEGE_APPLICATIONS.map(college => <a key={college.slug} href={college.href} data-college-destination aria-label={`Explore ${college.name}`} className="flex h-24 w-32 shrink-0 snap-start items-center justify-center rounded-lg border border-slate-200 bg-white p-3 transition hover:border-blue-500 focus-visible:outline-blue-600 sm:h-28 sm:w-36">
        <img src={college.logo_url} alt={`${college.name} logo`} className="h-full w-full object-contain" loading="lazy" decoding="async" />
      </a>)}
    </div>
    <CarouselControls pages={carousel.pages} active={carousel.active} canLeft={carousel.canLeft} canRight={carousel.canRight} onPrev={() => carousel.scrollByDir("left")} onNext={() => carousel.scrollByDir("right")} onDot={carousel.goToPage} label="college logos" />
  </section>;
}

function EnglishAdPage() {
  const [destination, setDestination] = useState<{ url: string; label: string; year?: number } | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const years = useCarouselNav();
  const now = Date.now();
  const regularOpen = now <= REGULAR_APPLICATION_CLOSES;
  const lateOpen = now >= LATE_APPLICATION_OPENS && now <= VIDEO_CLOSES;
  const registrationOpen = regularOpen || lateOpen;
  const openApplication = () => {
    if (hasSubmittedLead()) window.location.assign(OFFICIAL_FORM);
    else setDestination({ url: OFFICIAL_FORM, label: "NTA application page" });
  };
  const gateExternalLink = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.closest('[aria-label="Share this page"]') || anchor.hasAttribute("data-official-resource")) return;
    const url = new URL(anchor.href);
    if (!["https:", "http:"].includes(url.protocol) || (url.origin === window.location.origin && !anchor.hasAttribute("data-college-destination"))) return;
    if (hasSubmittedLead()) return;
    event.preventDefault();
    setDestination({ url: url.href, label: anchor.getAttribute("aria-label") || anchor.textContent?.trim() || "Selected resource" });
  };
  return <div className="min-h-screen bg-[#f7f8fb] pb-16 text-slate-900 sm:pb-0" lang="en" data-lead-link-handler="jee-main" onClick={gateExternalLink} onAuxClick={event => { if (event.button === 1) gateExternalLink(event); }}>
    <Navbar />

    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span><Link to="/" className="hover:underline">Home</Link> / JEE Main 2027 application</span><Link to="/ad/jee-main-2027-hi" lang="hi" className="font-semibold text-blue-800 underline">हिन्दी में पढ़ें</Link></nav>
        <h1 className="mt-4 max-w-5xl text-[1.65rem] font-bold leading-snug sm:text-[2.1rem]">JEE Main 2027 application form: Session 1 registration</h1>
        <AuthorByline authorId="43d5f8f3-192f-483e-9760-a96f04b94489" fallbackName="Geethika Reddy" className="mt-3" />
      </header>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_260px]">
        <article className="min-w-0 space-y-7 rounded-lg border border-slate-200 bg-white p-4 text-[15px] leading-7 sm:p-7 [&_section]:scroll-mt-40 [&_section>h2]:text-[22px] [&_section>h2]:leading-snug">
          <section id="registration" aria-label="JEE Main registration update">
            <div className="flex items-start gap-3">
              {registrationOpen ? <img src="/assets/nta-registration-symbol.png" alt="National Testing Agency" width="44" height="44" className="mt-1 h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11" /> : <Info aria-hidden="true" className="mt-1 h-9 w-9 shrink-0 text-slate-500 sm:h-11 sm:w-11" />}
              <p className="min-w-0 text-base leading-7">
                <strong>{regularOpen ? "JEE Main 2027 registration is now LIVE!" : lateOpen ? "JEE Main 2027 late-fee registration is open." : "JEE Main 2027 regular registration has closed."}</strong>{" "}
                {regularOpen ? "NTA is accepting Session 1 applications for the January attempt. Complete your application on the official portal before the deadline." : now <= VIDEO_CLOSES ? "The announced late-fee window runs from 23 to 26 November 2026, with an additional fee of ₹500." : "The announced Session 1 application window ended on 26 November 2026. Check NTA for any further updates."}
              </p>
            </div>
            <p className="mt-5 rounded-md bg-red-700 px-4 py-3 text-base leading-7 text-white"><strong>{regularOpen ? "Last date without late fee:" : "Last date with late fee:"}</strong>{" "}<time dateTime={regularOpen ? "2026-11-22T23:50:00+05:30" : "2026-11-26T23:50:00+05:30"}>{regularOpen ? "22 November 2026" : "26 November 2026"}, 11:50 PM IST</time>.</p>
            <p className="mt-5 text-sm leading-6 text-slate-700"><strong>{registrationOpen ? "Ready to apply?" : "Need the latest status?"}</strong>{" "}<a data-official-resource href={OFFICIAL_FORM} target="_blank" rel="noopener noreferrer" className="font-bold text-orange-700 underline hover:text-orange-800">Use the official NTA portal</a>.</p>
            <h2 className="mt-5 border-t border-slate-200 pt-5 font-bold">JEE Main 2027 registration: <span className={registrationOpen ? "text-red-600" : "text-slate-600"}>Session 1</span></h2>
            <a href={OFFICIAL_FORM} target="_blank" rel="noopener noreferrer" aria-label="View the official JEE Main Session 1 registration portal" className="mt-4 block overflow-hidden rounded border border-slate-200 focus-visible:outline-blue-600">
              <img src="/assets/jee-main-2027-registration-portal.png" alt="JEE Main 2027 Session 1 official portal showing new registration, application steps and candidate login" width="2048" height="807" className="h-auto w-full" loading="eager" />
            </a>
          </section>

          <JeeGuidanceForm id="jee-registration-form" />

          <section id="question-papers" aria-labelledby="papers-title" className="rounded-md border border-blue-100 border-t-[3px] border-t-blue-700 bg-[#f7fafc] p-3 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">DekhoCampus paper collection</p>
            <h2 id="papers-title" className="mt-1 font-bold">JEE Main question papers: last 5 years</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">Download all 106 papers from 2022 to 2026 in one ZIP, or choose a year, exam date and shift. Share your name, mobile and email once to access individual papers without OTP. Your details are remembered for this session. Only the full ZIP requires mobile OTP verification.</p>
            <button type="button" onClick={() => setDestination({ url: PAPERS_ZIP, label: "All 106 JEE Main question papers (ZIP)" })} className="mt-4 flex min-h-11 w-full items-center justify-center rounded border border-blue-800 bg-blue-800 px-3 py-2 text-center text-sm font-bold text-white hover:bg-blue-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800">
              Download all 106 papers (.zip)
            </button>
            <div ref={years.ref} onScroll={years.recompute} aria-label="Choose a question-paper year" className="mt-4 grid auto-cols-[minmax(112px,1fr)] grid-flow-col gap-2 overflow-x-auto snap-x snap-mandatory pb-2">
              {QUESTION_PAPERS.map(({ year, dates }) => <button key={year} type="button" aria-expanded={selectedYear === year} aria-controls={`papers-${year}`} onClick={() => {
                if (selectedYear === year || hasSubmittedLead()) setSelectedYear(selectedYear === year ? null : year);
                else setDestination({ url: "", label: `${year} JEE Main question papers`, year });
              }} className={`snap-start rounded-xl border px-3 py-4 text-center transition focus-visible:outline-blue-700 ${selectedYear === year ? "border-blue-700 bg-blue-700 text-white" : "border-blue-200 bg-white text-blue-900 hover:bg-blue-50"}`}>
                <span className="block text-lg font-extrabold">{year}</span><span className="inline-flex items-center justify-center gap-1 text-xs">{dates.reduce((count, date) => count + Number(!!date.morning) + Number(!!date.evening), 0)} papers<ChevronDown aria-hidden="true" className={`h-4 w-4 text-orange-600 transition-transform ${selectedYear === year ? "rotate-180" : ""}`} /></span>
              </button>)}
            </div>
            <CarouselControls pages={years.pages} active={years.active} canLeft={years.canLeft} canRight={years.canRight} onPrev={() => years.scrollByDir("left")} onNext={() => years.scrollByDir("right")} onDot={years.goToPage} label="paper years" />
            {QUESTION_PAPERS.map(({ year, dates }) => <div key={year} id={`papers-${year}`} hidden={selectedYear !== year} className="mt-3 overflow-hidden rounded-xl border border-blue-200 bg-white">
              <h3 className="px-3 py-3 font-bold text-blue-900">{year} question papers</h3>
                <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                  <thead className="bg-blue-50"><tr><th className="px-3 py-2">Exam date</th><th className="px-3 py-2">Morning shift</th><th className="px-3 py-2">Evening shift</th></tr></thead>
                  <tbody className="divide-y divide-blue-50">{dates.map(date => <tr key={date.date}>
                    <th scope="row" className="px-3 py-2 font-medium">{date.date} {year}</th>
                    {(["morning", "evening"] as const).map(shift => <td key={shift} className="px-3 py-2">{date[shift] ? <a data-paper-download href={date[shift]} target="_blank" rel="noopener noreferrer" aria-label={`JEE Main ${year}, ${date.date}, ${shift} shift question paper PDF`} className="inline-flex min-h-11 items-center font-semibold text-blue-800 underline">Download PDF</a> : <span className="text-slate-500">Not in collection</span>}</td>)}
                  </tr>)}</tbody>
                </table></div>
            </div>)}
          </section>

          <AdmissionCarousel />
          <JeeGuidanceForm id="jee-guidance-form" />

          <nav aria-label="JEE Main official resources" className="overflow-hidden rounded border border-slate-200 text-sm">
            <h2 className="bg-slate-100 px-3 py-2 text-base font-bold">JEE Main 2027: official application resources</h2>
            <ul className="divide-y divide-slate-200"><li className="flex justify-between gap-3 px-3 py-2"><span>Information bulletin</span><a href={BULLETIN} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">Read PDF</a></li><li className="flex justify-between gap-3 px-3 py-2"><span>Session 1 application dates</span><a href={APPLICATION_NOTICE} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">Read notice</a></li><li className="flex justify-between gap-3 px-3 py-2"><span>Starting a fresh application</span><a href={FRESH_FORM_NOTICE} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">Read NTA's clarification</a></li></ul>
          </nav>

          <section id="application-form">
            <h2 className="font-bold">JEE Main 2027 application form</h2>
            <p className="mt-2">Before you start, keep the application stages separate. Registering creates your login; submitting the details, uploading documents and paying the fee complete the examination application.</p>
            <ul className="mt-3 list-disc space-y-2 pl-5"><li>Apply online through the Session 1 link on NTA's JEE Main website.</li><li>Use a mobile number and email address you can access throughout the application process.</li><li>Enter your personal and academic details, paper choice and examination-city preferences carefully.</li><li>Follow the live-photograph and scanned-document instructions in the bulletin.</li><li>Review the application before paying. Save the confirmation page and payment record together.</li></ul>
            <p className="mt-3">A fresh form requires its own payment. Read NTA's clarification before starting again, or use the correction facility for changes it permits.</p>
          </section>

          <section id="documents">
            <h2 className="font-bold">Prepare these documents before you start</h2>
            <p className="mt-2 leading-7 text-slate-700">Keep your files ready. NTA asks for a live photograph as well as a recent scanned colour photograph, your signature and a Class 10 certificate or marksheet. Disability or UDID documents apply only to candidates who need them; foreign nationals, including OCI candidates, must also upload their non-Indian passport.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5">{["Live photograph and recent scanned photo", "Scanned signature", "Class 10 certificate or marksheet", "Applicable disability or passport document"].map(item => <li key={item} className="leading-7">{item}</li>)}</ul>
            <p className="mt-3 text-sm text-slate-600">Use the bulletin's file formats and size limits. Keep your registration mobile number and email accessible for messages and account recovery.</p>
            <a href={BULLETIN} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-blue-800 underline">Open NTA's 2027 information bulletin</a>
          </section>

          <section id="application-fee">
            <h2 className="font-bold">Application fee for one paper at an Indian centre</h2>
            <p className="mt-2 leading-7 text-slate-700">The amount depends on category and gender. The table below covers one paper at a centre in India; combined papers and centres outside India have different fees.</p>
            <div className="mt-4 overflow-x-auto rounded border border-slate-200"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-100"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Male</th><th className="px-4 py-3">Female</th></tr></thead><tbody className="divide-y divide-slate-200"><tr><td className="px-4 py-3">General</td><td className="px-4 py-3">₹1,000</td><td className="px-4 py-3">₹800</td></tr><tr><td className="px-4 py-3">Gen-EWS or OBC-NCL</td><td className="px-4 py-3">₹900</td><td className="px-4 py-3">₹800</td></tr><tr><td className="px-4 py-3">SC, ST, PwD or PwBD</td><td className="px-4 py-3">₹500</td><td className="px-4 py-3">₹500</td></tr></tbody></table></div>
            <p className="mt-3 text-sm text-slate-600">Third gender candidates pay ₹500 for one paper at an Indian centre. Bank processing charges and GST may be extra. Use the <a href={BULLETIN} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">official fee table</a> for your exact choice.</p>
          </section>

          {Date.now() < VIDEO_CLOSES && <section>
            <h2 className="font-bold">Watch the form steps</h2>
            <p className="mt-2 leading-7 text-slate-700">This DekhoCampus video shows the overall flow. Follow the portal and NTA's latest instructions when you fill the form.</p>
            <video className="mt-4 aspect-video w-full rounded-xl bg-slate-950" controls playsInline preload="metadata" aria-label="DekhoCampus JEE Main application video"><source src="/videos/jee-main-2027-application-en.mp4" type="video/mp4" /></video>
          </section>}

          <section id="correction">
            <h2 className="font-bold">Need to correct or restart a form?</h2>
            <p className="mt-2 leading-7 text-slate-700">A fresh form means paying again. NTA's 30 October clarification allows another Session 1 application, but the fee paid for an earlier form is neither refunded nor adjusted. Use the correction facility for changes it permits.</p>
            <p className="mt-3 leading-7 text-slate-700">Only the latest form with successful fee payment and a generated confirmation page counts. If you leave a new form unfinished, the earlier completed application stays valid. A fresh form also requires a new application number and all details and uploads again; it doesn't give you another attempt in the same session.</p>
            <figure className="mt-4 overflow-hidden rounded border border-slate-200 bg-slate-50"><img src={NOTICE_IMAGE} alt="NTA notice dated 30 October 2026 on valid JEE Main applications, previous fees and correction" loading="lazy" className="h-auto w-full" /><figcaption className="p-3 text-sm leading-6 text-slate-600">National Testing Agency public notice, 30 October 2026. <a href={FRESH_FORM_NOTICE} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">Read the original PDF</a>.</figcaption></figure>
          </section>

          <section id="eligibility">
            <h2 className="font-bold">Who can appear in JEE Main 2027?</h2>
            <p className="mt-2 leading-7 text-slate-700">You can appear if you passed Class 12 or an equivalent exam in 2025 or 2026, or are appearing in 2027. The first year you passed matters: passing in 2024 or earlier makes you ineligible for JEE Main 2027, even if you take an improvement exam later.</p>
            <p className="mt-3 leading-7 text-slate-700">NTA sets no age limit for the examination. A college can still have its own admission conditions, including subject and age requirements. Exam eligibility doesn't guarantee admission.</p>
            <a href={BULLETIN} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-blue-800 underline">Read the official eligibility chapter</a>
          </section>

          <section id="application-dates">
            <h2 className="font-bold">JEE Main 2027 application dates</h2>
            <p className="mt-2 leading-7 text-slate-700">NTA's Session 1 notice sets these dates. The extra ₹500 late fee is payable in addition to the examination fee.</p>
            <div className="mt-4 overflow-x-auto rounded border border-slate-200"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-100 text-slate-900"><tr><th className="px-4 py-3">Stage</th><th className="px-4 py-3">NTA date</th></tr></thead><tbody className="divide-y divide-slate-200"><tr><td className="px-4 py-3">Regular application and fee payment</td><td className="px-4 py-3">24 October to 22 November 2026, 11:50 pm IST</td></tr><tr><td className="px-4 py-3">Application with late fee</td><td className="px-4 py-3">23 to 26 November 2026, 11:50 pm IST</td></tr><tr><td className="px-4 py-3">Correction facility</td><td className="px-4 py-3">27 to 29 November 2026, 11:50 pm IST</td></tr></tbody></table></div>
            <a href={APPLICATION_NOTICE} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold text-blue-800 underline">Read NTA's dated application notice</a>
          </section>

          <section id="application-steps">
            <h2 className="font-bold">How to apply for JEE Main 2027</h2>
            <p className="mt-2">Use NTA's own application page for the examination form. The DekhoCampus form above is an optional guidance request and does not register you for JEE Main.</p>
            <ol className="mt-3 list-decimal space-y-3 pl-5"><li><strong>Open the application:</strong> Visit the JEE Main portal and choose the 2027 Session 1 application link.</li><li><strong>Register:</strong> Enter the requested contact details, create your login and keep the application number and password safely.</li><li><strong>Complete the form:</strong> Fill in your personal and academic details, choose the paper for your intended course and enter the examination-city preferences.</li><li><strong>Upload the files:</strong> Capture the live photograph and upload the scanned images and certificates NTA asks for. Check the accepted formats and sizes in the bulletin.</li><li><strong>Review:</strong> Compare the preview with your records. Check the paper choice, name, date of birth and contact details before moving to payment.</li><li><strong>Pay the applicable fee:</strong> Follow the payment options displayed on the NTA portal. The amount depends on your category, gender, paper combination and examination centre.</li><li><strong>Save the confirmation:</strong> After successful payment, download the confirmation page. Keep it with your payment record; do not share your password or one-time codes.</li></ol>
          </section>

          <section id="application-faqs"><FAQSection page="ad" itemSlug="jee-main-2027" title="JEE Main 2027 application questions" fallback={[...copy.en.faqs]} compact /></section>
        </article>

        <aside className="hidden space-y-5 lg:block" aria-label="JEE Main guide sidebar">
          <nav className="rounded border border-slate-200 bg-white p-4" aria-label="On this page"><h2 className="border-b border-slate-200 pb-2 text-base font-bold">On this page</h2><ul className="mt-2 divide-y divide-slate-100 text-sm leading-6">{[["registration", "JEE Main registration"], ["question-papers", "Last 5 years' question papers"], ["documents", "Documents required"], ["application-fee", "Application fee"], ["correction", "Correction and fresh forms"], ["eligibility", "Eligibility"], ["application-dates", "Application dates"], ["application-steps", "How to apply"], ["application-faqs", "Application FAQs"]].map(([id, label]) => <li key={id} className="py-2"><a href={`#${id}`} className="text-blue-800 hover:underline">{label}</a></li>)}</ul></nav>
          <div className="rounded border border-slate-200 bg-white p-4"><h2 className="text-base font-bold">Before you submit</h2><p className="mt-2 text-sm leading-6 text-slate-700">Regular deadline: <strong>22 November 2026, 11:50 pm IST</strong>. Keep the NTA confirmation page after payment.</p><a href="#jee-guidance-form" className="mt-3 inline-block text-sm font-semibold text-blue-800 underline">Get free guidance</a></div>
        </aside>
      </div>
    </main>

    <Footer />
    <LeadGateDialog className="[&>div>div:first-child>div]:flex-col [&>div>div:first-child>div]:text-center [&_h3]:pr-0 [&_h3+p]:pr-0 [&_input]:min-h-11 max-h-[calc(100dvh-2rem)] overflow-y-auto [&_img]:h-auto [&_img]:w-32" otpDownload={destination?.url === PAPERS_ZIP ? "jee-main-106-papers" : undefined} open={!!destination} onOpenChange={open => { if (!open) setDestination(null); }} forceShow simple contactOnly unbrandedConsent title={destination?.url === PAPERS_ZIP ? "Verify your mobile to download the ZIP" : "Access JEE Main papers and resources"} subtitle={destination?.url === PAPERS_ZIP ? "Your saved details are prefilled. Verify your mobile once while your verification remains valid." : "Share your name, mobile and email once. No OTP is required. This is an optional DekhoCampus form, not an NTA application."} source="JEE-paid" interestedExamSlug="jee-main" brandLogoUrl="/assets/nta-logo-official-link.png?v=20261102" brandName="National Testing Agency" interestLabel="Programme" interestOptions={["B.Tech / B.E.", "B.Arch", "B.Planning"]} onSuccess={(_leadId, downloadUrl) => { if (destination) { if (destination.year) setSelectedYear(destination.year); else { if (destination.url === PAPERS_ZIP && !downloadUrl) return; window.location.assign(downloadUrl || destination.url); } setDestination(null); } }} />
    <nav aria-label="JEE Main quick actions" className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-slate-200 bg-white p-2 shadow-lg sm:hidden"><button type="button" onClick={openApplication} className="flex-1 rounded-lg bg-blue-600 px-2 py-3 text-center text-sm font-bold text-white">Open the official form</button><a href="#jee-guidance-form" className="flex-1 rounded-lg border border-blue-700 px-2 py-3 text-center text-sm font-bold text-blue-800">Get free guidance</a></nav>
  </div>;
}

export default function JeeMainAdPage() {
  const { slug } = useParams<{ slug: string }>();
  const hindi = slug === "jee-main-2027-hi";
  const valid = slug === "jee-main-2027" || slug === "jee-main-2027-application" || hindi;
  const language = hindi ? "hi" : "en";
  const c = copy[language];
  useSEO({ title: c.title, exactTitle: true, description: c.meta, canonical: hindi ? "/ad/jee-main-2027-hi" : "/ad/jee-main-2027", language, robots: "noindex, follow, noarchive" });

  if (!valid) return <main className="mx-auto max-w-3xl px-5 py-20"><h1>Page not found</h1><Link to="/">Go to DekhoCampus</Link></main>;
  if (!hindi) return <EnglishAdPage />;

  return <div className="min-h-screen bg-[#f5f7fb] text-slate-900" lang={language}>
    <Navbar />
      <div className="mx-auto flex max-w-6xl items-center justify-end px-4 py-3 sm:px-6">
        <nav aria-label="Language" className="flex gap-2 text-sm font-semibold">
          <Link to="/ad/jee-main-2027" lang="en" aria-current={!hindi ? "page" : undefined} className={`rounded-full px-3 py-2 ${!hindi ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>English</Link>
          <Link to="/ad/jee-main-2027-hi" lang="hi" aria-current={hindi ? "page" : undefined} className={`rounded-full px-3 py-2 ${hindi ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>हिन्दी</Link>
        </nav>
      </div>

    <main>
      <section className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <p className="text-sm font-bold uppercase tracking-widest text-orange-300">{c.eyebrow}</p>
          <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">{c.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-200 sm:text-lg">{c.intro}</p>
          <a href={NTA_PORTAL} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex max-w-full items-center rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-bold text-white hover:bg-orange-600 sm:text-base">{c.officialButton}</a>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">{c.independent}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">{c.scheduleTitle}</h2>
          <p className="mt-3 leading-7 text-slate-700">{c.scheduleIntro}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {c.schedule.map(([label, value]) => <div key={label} className="rounded-xl bg-blue-50 p-4"><h3 className="text-sm font-bold text-blue-950">{label}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{value}</p></div>)}
          </div>
          <a href={APPLICATION_NOTICE} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-blue-800 underline underline-offset-2">{c.noticeLink}</a>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">{c.stepsTitle}</h2>
          <ol className="mt-5 space-y-4">
            {c.steps.map((step, i) => <li key={step} className="flex gap-4 leading-7 text-slate-700"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800">{i + 1}</span><span>{step}</span></li>)}
          </ol>
        </section>

        <div className="my-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label={c.formLead}>
            <h2 className="text-xl font-bold">{c.formLead}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{c.formDisclosure}</p>
            <div className="mt-4"><LeadCaptureForm variant="card" title={c.formTitle} subtitle={c.formSubtitle} source={`ad_jee_main_2027_${language}`} interestLabel="Programme" interestOptions={["B.Tech / B.E.", "B.Arch", "B.Planning"]} simple /></div>
          </section>
          {Date.now() < VIDEO_CLOSES && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">{c.videoTitle}</h2>
            <video className="mt-4 aspect-video w-full rounded-xl bg-slate-950" controls playsInline preload="metadata" aria-label={c.videoTitle}>
              <source src={`/videos/jee-main-2027-application-${language}.mp4`} type="video/mp4" />
            </video>
            <p className="mt-3 text-sm leading-6 text-slate-600">{c.videoNote}</p>
          </section>}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-bold">{c.correctionTitle}</h2>
          <p className="mt-3 leading-7 text-slate-700">{c.correctionText}</p>
          <figure className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <img src={NOTICE_IMAGE} alt={c.imageAlt} loading="lazy" className="h-auto w-full" />
            <figcaption className="p-3 text-sm leading-6 text-slate-600">{c.imageCaption} <a href={FRESH_FORM_NOTICE} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline underline-offset-2">{c.correctionLink}</a></figcaption>
          </figure>
        </section>

        <FAQSection page="ad" itemSlug={slug} title={c.faqTitle} fallback={[...c.faqs]} compact />
      </div>
    </main>

    <Footer />
  </div>;
}
