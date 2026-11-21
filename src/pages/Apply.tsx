import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";
import { INDIA_STATE_PATHS, INDIA_VIEWBOX } from "@/data/indiaStatePaths";
import { DELHI_NCR_UNIVERSITIES, SPOTLIGHT_UNIVERSITIES, UNIVERSITIES_BY_STATE } from "@/data/applyUniversities";
import styles from "./Apply.module.css";

const stateNames: string[] = INDIA_STATE_PATHS.map((state) => state.name).sort((a, b) => a.localeCompare(b));
const mapColours = ["#dce6f7", "#afc4e9", "#7da1d9", "#3f73bf", "#285bad", "#c6d6f0"];
const highlightedStates = new Set(SPOTLIGHT_UNIVERSITIES.map((item) => item.state));
const ncrCities = ["All cities", ...new Set(DELHI_NCR_UNIVERSITIES.map((item) => item.city))];

export default function Apply() {
  const [selectedState, setSelectedState] = useState("Delhi");
  const [stateSearch, setStateSearch] = useState("");
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [selectedCity, setSelectedCity] = useState("All cities");
  const resultsRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const ncrRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash && stateNames.includes(hash)) setSelectedState(hash);
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % SPOTLIGHT_UNIVERSITIES.length), 3000);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    const rail = spotlightRef.current;
    const card = rail?.children[slide] as HTMLElement | undefined;
    if (!rail || !card) return;
    const left = card.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    rail.scrollTo({ left, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [slide]);

  useEffect(() => {
    ncrRailRef.current?.scrollTo({ left: 0, behavior: "instant" });
  }, [selectedCity]);

  const chooseState = (name: string) => {
    setSelectedState(name);
    window.history.replaceState(null, "", `${window.location.pathname}#${encodeURIComponent(name)}`);
    if (resultsRef.current) {
      const top = resultsRef.current.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top, behavior: "instant" });
    }
  };
  const visibleStates = useMemo(() => stateNames.filter((name) => name.toLowerCase().includes(stateSearch.trim().toLowerCase())), [stateSearch]);
  const universities = UNIVERSITIES_BY_STATE[selectedState] ?? [];
  const ncrUniversities = useMemo(() => selectedCity === "All cities" ? DELHI_NCR_UNIVERSITIES : DELHI_NCR_UNIVERSITIES.filter((item) => item.city === selectedCity), [selectedCity]);
  const ncrColumns = useMemo(() => Array.from({ length: Math.ceil(ncrUniversities.length / 6) }, (_, index) => ncrUniversities.slice(index * 6, index * 6 + 6)), [ncrUniversities]);
  const advance = (step: number) => setSlide((index) => (index + step + SPOTLIGHT_UNIVERSITIES.length) % SPOTLIGHT_UNIVERSITIES.length);
  const moveNcr = (step: number) => {
    const rail = ncrRailRef.current;
    const column = rail?.firstElementChild as HTMLElement | null;
    if (rail && column) rail.scrollBy({ left: step * (column.getBoundingClientRect().width + 16), behavior: "smooth" });
  };

  return (
    <div className={styles.page}>
      <SEO
        title="Top Universities in India by State | Official Links | DekhoCampus"
        description="Explore handpicked universities on an interactive India map. Browse Delhi NCR by city and open each university's official website."
        canonical="/apply"
        jsonLd={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Top universities in India by state", url: "https://dekhocampus.com/apply", description: "A handpicked starting list of Indian universities with links to their official websites." }}
      />
      <Navbar />
      <main>
        <section className={styles.hero} aria-labelledby="apply-title">
          <div className={styles.intro}>
            <h1 id="apply-title">Only top universities of India,<br /><em>all in one place for you.</em></h1>
          </div>

          <div className={styles.mapArea}>
            <div className={styles.mapTopline}><span>India, state by state</span><span>28 states · 8 union territories</span></div>
            <svg className={styles.map} viewBox={INDIA_VIEWBOX} role="group" aria-label="Interactive map of Indian states and union territories">
              {INDIA_STATE_PATHS.map((state, index) => state.name === "Lakshadweep" ? (
                <g key={state.name} role="button" tabIndex={0} aria-label="Explore universities in Lakshadweep" aria-pressed={selectedState === state.name} className={styles.islandGroup} onClick={() => chooseState(state.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseState(state.name); } }}>
                  <title>Lakshadweep</title>
                  <circle cx="105" cy="477" r="17" fill="transparent" />
                  {[[98,447],[103,458],[105,473],[106,488],[113,511]].map(([cx, cy]) => <circle key={cy} cx={cx} cy={cy} r="2" fill={selectedState === state.name ? "#174f9d" : "#7da1d9"} />)}
                </g>
              ) : (
                <path
                  key={state.name}
                  d={state.path}
                  fill={selectedState === state.name ? (highlightedStates.has(state.name) ? "#b94f1e" : "#174f9d") : highlightedStates.has(state.name) ? "#e78046" : mapColours[(index * 7 + 3) % mapColours.length]}
                  className={`${styles.statePath} ${highlightedStates.has(state.name) ? styles.orangeState : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Explore universities in ${state.name}`}
                  aria-pressed={selectedState === state.name}
                  onClick={() => chooseState(state.name)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseState(state.name); } }}
                >
                  <title>{state.name}</title>
                </path>
              ))}
            </svg>
            <p className={styles.mapHint}>Orange states have a handpicked spotlight university. Tap any state for official links.</p>
            <a className={styles.mapCredit} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Map data © OpenStreetMap contributors</a>
          </div>

          <section className={styles.spotlight} aria-labelledby="spotlight-title">
            <div className={styles.spotlightTop}>
              <div><span className={styles.kicker}>HANDPICKED FOR YOU</span><h2 id="spotlight-title">One standout university in every orange state.</h2></div>
              <div className={styles.spotlightControls}>
                <span>{String(slide + 1).padStart(2, "0")} / {SPOTLIGHT_UNIVERSITIES.length}</span>
                <button type="button" onClick={() => advance(-1)} aria-label="Previous university"><ChevronLeft size={19} /></button>
                <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play university spotlight" : "Pause university spotlight"}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
                <button type="button" onClick={() => advance(1)} aria-label="Next university"><ChevronRight size={19} /></button>
              </div>
            </div>
            <div ref={spotlightRef} className={styles.spotlightRail} role="region" aria-label="Handpicked universities, swipe to see more" onPointerDown={() => setPaused(true)}>
              {SPOTLIGHT_UNIVERSITIES.map(({ state, university, logo }, index) => (
                <a key={state} className={`${styles.spotlightCard} ${slide === index ? styles.activeSpotlight : ""}`} href={university.url} target="_blank" rel="noopener noreferrer" aria-label={`${university.name}, ${state}, official website, opens in a new tab`}>
                  <span className={styles.spotlightLogo}><span className={styles.logoFallback}>{university.name.split(" ").slice(0, 2).map((word) => word[0]).join("")}</span><img src={logo} alt="" width="150" height="88" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /></span>
                  <span className={styles.spotlightText}><small>{state}</small><strong>{university.name}</strong><span>{university.city} <ArrowUpRight size={15} aria-hidden="true" /></span></span>
                </a>
              ))}
            </div>
          </section>
        </section>

        <section className={styles.ncrSection} aria-labelledby="ncr-title">
          <div className={styles.ncrInner}>
            <div className={styles.ncrTop}>
              <div><span className={styles.kicker}>A CLOSER LOOK</span><h2 id="ncr-title">Delhi <em>NCR</em></h2><p>18 handpicked universities across 9 cities. Every link takes you to the university's own website.</p></div>
              <div className={styles.ncrControls}>
                <span>SWIPE TO EXPLORE</span>
                <button type="button" onClick={() => moveNcr(-1)} aria-label="Scroll Delhi NCR universities left"><ChevronLeft size={20} /></button>
                <button type="button" onClick={() => moveNcr(1)} aria-label="Scroll Delhi NCR universities right"><ChevronRight size={20} /></button>
              </div>
            </div>
            <div ref={ncrRailRef} className={styles.ncrRail} role="region" aria-label="Delhi NCR university lists, scroll horizontally">
              {ncrColumns.map((column, columnIndex) => (
                <div className={styles.ncrColumn} key={`${selectedCity}-${columnIndex}`}>
                  <div className={styles.ncrColumnTop}><span>{String(columnIndex * 6 + 1).padStart(2, "0")} - {String(columnIndex * 6 + column.length).padStart(2, "0")}</span><span>OFFICIAL WEBSITES</span></div>
                  {column.map((university) => (
                    <a key={university.url} className={styles.ncrRow} href={university.url} target="_blank" rel="noopener noreferrer" aria-label={`${university.name}, ${university.city}, official website, opens in a new tab`}>
                      <span><strong>{university.name}</strong><small>{university.city}</small></span><ArrowUpRight size={18} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              ))}
            </div>
            <div className={styles.cityBar}>
              <span>EXPLORE BY CITY</span>
              <div className={styles.cityChips} role="group" aria-label="Filter Delhi NCR universities by city">
                {ncrCities.map((city) => <button type="button" key={city} className={selectedCity === city ? styles.activeCity : ""} onClick={() => setSelectedCity(city)} aria-pressed={selectedCity === city}>{city}</button>)}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.directory} id="universities" aria-labelledby="directory-title">
          <div className={styles.directoryIntro}>
            <span className={styles.kicker}>EXPLORE BY PLACE</span>
            <h2 id="directory-title">One state. A clearer shortlist.</h2>
            <p>Choose where you want to study. Each link below goes to the university itself, so you can check the details at the source.</p>
          </div>
          <div className={styles.directoryGrid}>
            <div className={styles.statePicker} aria-label="Choose a state or union territory">
              <label htmlFor="apply-state-search">Find a state or union territory</label>
              <div className={styles.searchWrap}><Search size={17} aria-hidden="true" /><input id="apply-state-search" type="search" value={stateSearch} onChange={(event) => setStateSearch(event.target.value)} placeholder="Search states" /></div>
              <div className={styles.stateList}>
                {visibleStates.length ? visibleStates.map((name) => (
                  <button className={`${styles.stateButton} ${selectedState === name ? styles.activeState : ""}`} type="button" key={name} onClick={() => chooseState(name)} aria-pressed={selectedState === name}>
                    <span>{name}</span><ArrowRight size={15} aria-hidden="true" />
                  </button>
                )) : <p className={styles.noState}>No matching state. Try another spelling.</p>}
              </div>
            </div>
            <div ref={resultsRef} className={styles.resultsPanel} aria-live="polite">
              <div className={styles.resultsEyebrow}>UNIVERSITIES IN</div>
              <h3>{selectedState}</h3>
              <p className={styles.resultLead}>{universities.length ? `A starting list of ${universities.length} universities in ${selectedState}. Open an official website to check courses, admissions and current dates.` : `We have not added a verified university headquarters in ${selectedState} to this shortlist yet. Use the UGC directory to check recognised universities and their latest details.`}</p>
              {universities.length > 0 && <div className={styles.universityList}>
                {universities.map((university, index) => (
                  <a key={university.url} className={styles.universityRow} href={university.url} target="_blank" rel="noopener noreferrer" aria-label={`${university.name}, official website, opens in a new tab`}>
                    <span className={styles.rowNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.rowText}><strong>{university.name}</strong><small>{university.city} · Official website</small></span>
                    <ArrowUpRight className={styles.rowArrow} size={20} aria-hidden="true" />
                  </a>
                ))}
              </div>}
              <div className={styles.resultsFoot}>This is an editorial starting list, not a ranking or a complete register. <a href="https://www.ugc.gov.in/universitydetails/" target="_blank" rel="noopener noreferrer">Check the full UGC university directory <ArrowUpRight size={14} /></a></div>
            </div>
          </div>
        </section>
        <section className={styles.note}>
          <span className={styles.noteNumber}>01 / BEFORE YOU APPLY</span>
          <p>Shortlist the course first. Then check eligibility, fees, entrance tests and deadlines on the university's own website before you submit a form or make a payment.</p>
        </section>
      </main>
      <footer className={styles.footer}><Link to="/" className={styles.footerBrand}>Dekho<span>Campus</span></Link><p>Find the right place to study, then confirm every detail at the source.</p><div><Link to="/colleges">Explore colleges</Link><Link to="/about-us">About us</Link><a href="mailto:outreach@dekhocampus.com">Contact</a></div></footer>
    </div>
  );
}
