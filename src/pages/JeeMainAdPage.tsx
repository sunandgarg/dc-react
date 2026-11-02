import { Link, useParams } from "react-router-dom";
import { LeadCaptureForm } from "@/components/LeadCaptureForm";
import { FAQSection } from "@/components/FAQSection";
import { useSEO } from "@/hooks/useSEO";
import logo from "@/assets/dekhocampus-logo-small.webp";

const NTA_PORTAL = "https://jeemain.nta.nic.in/";
const APPLICATION_NOTICE = "https://nta.ac.in/Download/Notice/Notice_20261024220013.pdf";
const FRESH_FORM_NOTICE = "https://nta.ac.in/Download/Notice/Notice_20261030202143.pdf";
const BULLETIN = "https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/10/202610241890224107.pdf";
const NOTICE_IMAGE = "https://aws-origin.dekhocampus.com/storage/v1/object/public/admin-uploads/editor/1793377152584-fljho1.webp";
const VIDEO_CLOSES = Date.parse("2026-11-26T18:20:00Z");

const copy = {
  en: {
    title: "JEE Main 2027 Session 1 application: use the official NTA portal",
    meta: "Check the official NTA application route, Session 1 deadlines, confirmation page and correction rules before you submit your JEE Main 2027 form.",
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
    ],
    footer: "Independent student guidance by DekhoCampus. Official exam applications are handled by NTA.",
  },
  hi: {
    title: "JEE Main 2027 Session 1 आवेदन: आधिकारिक NTA पोर्टल से फॉर्म भरें",
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

function EnglishAdPage() {
  return <div className="min-h-screen bg-white pb-16 text-slate-900 sm:pb-0" lang="en">
    <header className="border-b border-slate-200 bg-white">
      <nav aria-label="Main navigation" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" aria-label="DekhoCampus home"><img src={logo} alt="DekhoCampus" className="h-10 w-auto max-w-[165px] object-contain" /></Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-slate-700">
          <Link to="/" className="hover:text-orange-700">Home</Link>
          <Link to="/exams/jee-main" className="hover:text-orange-700">JEE Main</Link>
          <Link to="/news" className="hover:text-orange-700">News</Link>
          <Link to="/ad/jee-main-2027-hi" lang="hi" className="hover:text-orange-700">हिन्दी</Link>
        </div>
      </nav>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500"><Link to="/" className="hover:underline">Home</Link> / JEE Main 2027 application</nav>
      <h1 className="mt-6 max-w-5xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">JEE Main 2027 Session 1 application: official link, dates and form steps</h1>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700">NTA is accepting Session 1 applications on its official portal. The regular application and payment window ends on 22 November 2026 at 11:50 pm IST. Here is what to prepare and how to finish with a confirmation page.</p>

      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="min-w-0 space-y-9">
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:p-7" aria-label="Official NTA application link">
            <p className="text-sm font-bold uppercase tracking-wide text-blue-900">Application link is active for Session 1</p>
            <p className="mt-2 leading-7 text-slate-800">Apply only at NTA. DekhoCampus offers independent guidance and cannot submit or process your examination form.</p>
            <a href={NTA_PORTAL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex max-w-full items-center gap-3 rounded-lg border border-blue-200 bg-white p-3 hover:border-blue-400" aria-label="Visit the official NTA JEE Main portal">
              <img src="/assets/nta-logo-official-link.png?v=20261102" alt="National Testing Agency logo" className="h-auto w-36 object-contain sm:w-48" />
              <span className="text-sm font-semibold text-blue-900 underline">Official NTA website ↗</span>
            </a>
            <a href={NTA_PORTAL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex max-w-full rounded-lg bg-orange-600 px-6 py-3 text-center font-bold text-white hover:bg-orange-700">Go to the official NTA application portal</a>
            <p className="mt-3 text-sm text-slate-600">Check the portal for any newer notice before paying.</p>
          </section>

          <section id="jee-guidance-form" className="scroll-mt-6 rounded-2xl border border-blue-200 bg-[#e9f3ff] p-5 sm:p-7" aria-label="DekhoCampus JEE Main guidance form">
            <h2 className="text-2xl font-bold">Get JEE Main guidance and updates</h2>
            <p className="mt-2 leading-7 text-slate-700">Questions about the process? Leave your details for DekhoCampus guidance.</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">This optional DekhoCampus form is for guidance and updates. It is not an NTA application form.</p>
            <div className="mt-4 max-w-xl"><LeadCaptureForm variant="card" title="Get JEE Main guidance from DekhoCampus" subtitle="Complete your exam application separately on the official NTA portal." source="JEE-paid" interestedExamSlug="jee-main" interestLabel="Programme" interestOptions={["B.Tech / B.E.", "B.Arch", "B.Planning"]} simple /></div>
          </section>

          <section>
            <h2 className="text-2xl font-bold">JEE Main 2027 application dates</h2>
            <p className="mt-2 leading-7 text-slate-700">NTA's Session 1 notice sets these dates. The extra ₹500 late fee is payable in addition to the examination fee.</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-100 text-slate-900"><tr><th className="px-4 py-3">Stage</th><th className="px-4 py-3">NTA date</th></tr></thead><tbody className="divide-y divide-slate-200"><tr><td className="px-4 py-3">Regular application and fee payment</td><td className="px-4 py-3">24 October to 22 November 2026, 11:50 pm IST</td></tr><tr><td className="px-4 py-3">Application with late fee</td><td className="px-4 py-3">23 to 26 November 2026, 11:50 pm IST</td></tr><tr><td className="px-4 py-3">Correction facility</td><td className="px-4 py-3">27 to 29 November 2026, 11:50 pm IST</td></tr></tbody></table></div>
            <a href={APPLICATION_NOTICE} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block font-semibold text-blue-800 underline">Read NTA's dated application notice</a>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Prepare these documents before you start</h2>
            <p className="mt-2 leading-7 text-slate-700">The 2027 information bulletin asks candidates to capture a live photograph and upload a recent scanned colour photograph, signature and Class 10 certificate or marksheet. A disability or UDID certificate and a non-Indian passport are required only where applicable. Keep access to the mobile number and email address you use for registration.</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">{["Live photograph and recent scanned photo", "Scanned signature", "Class 10 certificate or marksheet", "Applicable disability or passport document"].map(item => <li key={item} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">{item}</li>)}</ul>
            <p className="mt-3 text-sm text-slate-600">Check the bulletin for accepted file formats and sizes before uploading.</p>
            <a href={BULLETIN} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-blue-800 underline">Open NTA's 2027 information bulletin</a>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Application fee for one paper at an Indian centre</h2>
            <p className="mt-2 leading-7 text-slate-700">The amount depends on category and gender. The table below covers one paper at a centre in India; combined papers and centres outside India have different fees.</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[520px] text-left text-sm"><thead className="bg-slate-100"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Male</th><th className="px-4 py-3">Female</th></tr></thead><tbody className="divide-y divide-slate-200"><tr><td className="px-4 py-3">General</td><td className="px-4 py-3">₹1,000</td><td className="px-4 py-3">₹800</td></tr><tr><td className="px-4 py-3">Gen-EWS or OBC-NCL</td><td className="px-4 py-3">₹900</td><td className="px-4 py-3">₹800</td></tr><tr><td className="px-4 py-3">SC, ST, PwD or PwBD</td><td className="px-4 py-3">₹500</td><td className="px-4 py-3">₹500</td></tr></tbody></table></div>
            <p className="mt-3 text-sm text-slate-600">Third gender candidates pay ₹500 for one paper at an Indian centre. Bank processing charges and GST may be extra. Use the <a href={BULLETIN} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">official fee table</a> for your exact choice.</p>
          </section>

          {Date.now() < VIDEO_CLOSES && <section>
            <h2 className="text-2xl font-bold">Watch the form steps</h2>
            <p className="mt-2 leading-7 text-slate-700">This DekhoCampus video shows the overall flow. Follow the portal and NTA's latest instructions when you fill the form.</p>
            <video className="mt-4 aspect-video w-full rounded-xl bg-slate-950" controls playsInline preload="metadata" aria-label="DekhoCampus JEE Main application video"><source src="/videos/jee-main-2027-application-en.mp4" type="video/mp4" /></video>
          </section>}

          <section>
            <h2 className="text-2xl font-bold">Who can appear in JEE Main 2027?</h2>
            <p className="mt-2 leading-7 text-slate-700">NTA's bulletin has no age limit for appearing in the exam. Students who passed Class 12 or an equivalent exam in 2025 or 2026, and those appearing in 2027, can appear. Students who first passed in 2024 or earlier are not eligible for JEE Main 2027. Admission to a particular institute may have additional rules, so check those separately.</p>
            <a href={BULLETIN} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-blue-800 underline">Read the official eligibility chapter</a>
          </section>

          <section>
            <h2 className="text-2xl font-bold">How to complete the application</h2>
            <ol className="mt-4 space-y-3 leading-7 text-slate-700"><li><strong>1. Register:</strong> Open the Session 1 link on the NTA portal and keep the application number and password.</li><li><strong>2. Fill and upload:</strong> Enter the personal, academic, paper and exam city details. Upload the documents NTA requests.</li><li><strong>3. Pay and save:</strong> Review the preview, pay through an approved online method, then download the confirmation page. An application number alone is not proof of completion.</li></ol>
          </section>

          <section>
            <h2 className="text-2xl font-bold">Need to correct or restart a form?</h2>
            <p className="mt-2 leading-7 text-slate-700">NTA's 30 October clarification permits a fresh Session 1 form. Only the latest form with successful fee payment and a generated confirmation page is valid. If a new form remains incomplete, the earlier completed form stays valid. The earlier fee is not refunded or adjusted against a fresh form, so use the correction window when it covers the detail you need to change.</p>
            <figure className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={NOTICE_IMAGE} alt="NTA notice dated 30 October 2026 on valid JEE Main applications, previous fees and correction" loading="lazy" className="h-auto w-full" /><figcaption className="p-3 text-sm leading-6 text-slate-600">National Testing Agency public notice, 30 October 2026. <a href={FRESH_FORM_NOTICE} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-800 underline">Read the original PDF</a>.</figcaption></figure>
          </section>

          <FAQSection page="ad" itemSlug="jee-main-2027" title="JEE Main 2027 application questions" fallback={[...copy.en.faqs]} compact />
        </article>

        <aside className="hidden lg:block"><div className="sticky top-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-bold">Application essentials</h2><p className="mt-3 text-sm leading-6">Regular deadline: <strong>22 November 2026</strong></p><p className="mt-2 text-sm leading-6">Late fee window ends: <strong>26 November 2026</strong></p><a href={NTA_PORTAL} target="_blank" rel="noopener noreferrer" className="mt-5 block rounded-lg bg-orange-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-orange-700">Apply at NTA</a><p className="mt-3 text-xs leading-5 text-slate-600">The DekhoCampus form on this page is for guidance only.</p></div></aside>
      </div>
    </main>

    <footer className="mt-12 border-t border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm leading-7 text-slate-600"><p>Independent student guidance by DekhoCampus. Official exam applications are handled by NTA.</p><a href={NTA_PORTAL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-lg bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-700">Apply at NTA's official website ↗</a><p className="mt-3"><Link to="/about-us" className="underline">About DekhoCampus</Link> · <Link to="/legal/privacy-policy" className="underline">Privacy Policy</Link></p></footer>
    <nav aria-label="JEE Main quick actions" className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-slate-200 bg-white p-2 shadow-lg sm:hidden"><a href={NTA_PORTAL} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg bg-orange-600 px-2 py-3 text-center text-sm font-bold text-white">Apply at NTA ↗</a><a href="#jee-guidance-form" className="flex-1 rounded-lg border border-blue-700 px-2 py-3 text-center text-sm font-bold text-blue-800">Get free guidance</a></nav>
  </div>;
}

export default function JeeMainAdPage() {
  const { slug } = useParams<{ slug: string }>();
  const hindi = slug === "jee-main-2027-hi";
  const valid = slug === "jee-main-2027" || hindi;
  const language = hindi ? "hi" : "en";
  const c = copy[language];
  useSEO({ title: c.title, exactTitle: true, description: c.meta, canonical: `/ad/${slug}`, language, robots: "noindex, follow, noarchive" });

  if (!valid) return <main className="mx-auto max-w-3xl px-5 py-20"><h1>Page not found</h1><Link to="/">Go to DekhoCampus</Link></main>;
  if (!hindi) return <EnglishAdPage />;

  return <div className="min-h-screen bg-[#f5f7fb] text-slate-900" lang={language}>
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" aria-label="DekhoCampus home"><img src={logo} alt="DekhoCampus" className="h-10 w-auto max-w-[170px] object-contain" /></Link>
        <nav aria-label="Language" className="flex gap-2 text-sm font-semibold">
          <Link to="/ad/jee-main-2027" lang="en" aria-current={!hindi ? "page" : undefined} className={`rounded-full px-3 py-2 ${!hindi ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>English</Link>
          <Link to="/ad/jee-main-2027-hi" lang="hi" aria-current={hindi ? "page" : undefined} className={`rounded-full px-3 py-2 ${hindi ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>हिन्दी</Link>
        </nav>
      </div>
    </header>

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

    <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center text-sm leading-7 text-slate-600">
      <p>{c.footer}</p>
      <p className="mt-2"><Link to="/about-us" className="underline">About DekhoCampus</Link> · <Link to="/legal/privacy-policy" className="underline">Privacy Policy</Link> · <a href="mailto:outreach@dekhocampus.com" className="underline">outreach@dekhocampus.com</a></p>
    </footer>
  </div>;
}
