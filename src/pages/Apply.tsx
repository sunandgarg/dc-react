import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Link } from "react-router-dom";
import { INDIA_STATE_PATHS, INDIA_VIEWBOX } from "@/data/indiaStatePaths";
import { FEATURED_UNIVERSITIES, UNIVERSITIES_BY_STATE } from "@/data/applyUniversities";
import styles from "./Apply.module.css";

const stateNames: string[] = INDIA_STATE_PATHS.map((state) => state.name).sort((a, b) => a.localeCompare(b));
const mapColours = ["#dce6f7", "#afc4e9", "#7da1d9", "#3f73bf", "#285bad", "#c6d6f0"];
const featured = FEATURED_UNIVERSITIES.map((university) => ({
  ...university,
  state: Object.entries(UNIVERSITIES_BY_STATE).find(([, entries]) => entries.includes(university))?.[0] ?? "India",
}));

export default function Apply() {
  const [selectedState, setSelectedState] = useState("Delhi");
  const [stateSearch, setStateSearch] = useState("");
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash && stateNames.includes(hash)) setSelectedState(hash);
  }, []);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setSlide((current) => (current + 1) % featured.length), 3000);
    return () => window.clearInterval(timer);
  }, [paused]);

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
  const current = featured[slide];
  const advance = (step: number) => setSlide((index) => (index + step + featured.length) % featured.length);

  return (
    <div className={styles.page}>
      <SEO
        title="Find Universities by State in India | Official Links | DekhoCampus"
        description="Choose a state on the India map to explore selected universities and open their official websites. Check the university's own admission notice before applying."
        canonical="/apply"
        jsonLd={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "Find universities by state in India", url: "https://dekhocampus.com/apply", description: "A state-by-state starting list of Indian universities with links to their official websites." }}
      />
      <Navbar />
      <main>
        <section className={styles.hero} aria-labelledby="apply-title">
          <div className={styles.intro}>
            <span className={styles.kicker}>THE UNIVERSITY DIRECTORY</span>
            <h1 id="apply-title">Find your university.<br /><em>Start with a state.</em></h1>
            <p>Explore universities across India, then go straight to their official websites for courses, eligibility and the latest admission notice.</p>
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
                  fill={selectedState === state.name ? "#174f9d" : mapColours[(index * 7 + 3) % mapColours.length]}
                  className={styles.statePath}
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
            <p className={styles.mapHint}>Select a state on the map to see its universities.</p>
            <a className={styles.mapCredit} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Map data © OpenStreetMap contributors</a>
          </div>

          <div className={styles.featuredBar} aria-label="Featured universities">
            <div className={styles.featuredLabel}><span className={styles.liveDot} /> UNIVERSITY SPOTLIGHT</div>
            <div className={styles.featuredContent} key={slide}>
              <strong>{current.name}</strong><span>{current.city}, {current.state}</span>
            </div>
            <a className={styles.featuredLink} href={current.url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${current.name} official website`}>Official website <ArrowUpRight size={17} /></a>
            <div className={styles.featuredControls}>
              <button type="button" onClick={() => advance(-1)} aria-label="Previous university"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play university spotlight" : "Pause university spotlight"}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
              <button type="button" onClick={() => advance(1)} aria-label="Next university"><ChevronRight size={18} /></button>
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
