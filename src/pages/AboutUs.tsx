import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, CheckCircle2, Compass, ExternalLink, Linkedin, Twitter } from "lucide-react";
import diyaAiLogo from "@/assets/diya-ai-logo-small.webp";
import dekhocampusLogo from "@/assets/dekhocampus-logo.png";
import { backendClient } from "@/integrations/backend/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";

type AboutData = { page: Record<string, any> | null; stats: any[]; values: any[]; founders: any[]; team: any[]; milestones: any[]; press: any[] };
const empty: AboutData = { page: null, stats: [], values: [], founders: [], team: [], milestones: [], press: [] };
const externalHref = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = /^https?:\/\//i.test(value) ? value : /^www\./i.test(value) ? `https://${value}` : "";
  try { const url = new URL(candidate); return url.protocol === "https:" || url.protocol === "http:" ? url.href : null; } catch { return null; }
};
const linkedInProfiles: Record<string, string> = {
  "mahima gupta": "https://www.linkedin.com/in/mahima-gupta-18849716a/",
  "sunand garg": "https://www.linkedin.com/in/sunandgarg/",
  "chetan garg": "https://www.linkedin.com/in/chetangarg75/",
};
const normalizePersonName = (name: unknown) => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
const mahimaBio = "Mahima is a co-founder of DekhoCampus and an RCI-licensed clinical psychologist. Her background in clinical psychology, counselling and psychological assessment brings a human perspective to how we guide students through important education decisions.";

export default function AboutUs() {
  const [data, setData] = useState<AboutData>(empty);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const client: any = backendClient;
      const [page, stats, values, founders, team, milestones, press] = await Promise.all([
        client.from("about_page").select("*").maybeSingle(),
        ...["about_stats", "about_values", "about_founders", "about_team", "about_milestones", "about_press"].map(table => client.from(table).select("*").eq("is_active", true).order("display_order")),
      ]);
      if (active) setData({ page: page.data, stats: stats.data || [], values: values.data || [], founders: founders.data || [], team: team.data || [], milestones: milestones.data || [], press: press.data || [] });
    };
    void load();
    return () => { active = false; };
  }, []);

  const p = data.page || {};
  const visibleStats = data.stats.filter(stat => String(stat.label || "").trim().toLowerCase() !== "students helped");
  const people = [...data.founders, ...data.team].map(person => {
    const name = normalizePersonName(person.name);
    return {
      ...person,
      ...(name === "mahima gupta" ? { title: "Co-founder", department: "RCI-licensed clinical psychologist", bio: mahimaBio, photo: "/founders/mahima-gupta.webp" } : {}),
      linkedin_url: linkedInProfiles[name] || person.linkedin_url,
    };
  });
  for (const person of [
    { id: "sunand-garg-preview", name: "Sunand Garg" },
    { id: "chetan-garg-preview", name: "Chetan Garg" },
    { id: "mahima-gupta-preview", name: "Mahima Gupta", title: "Co-founder", department: "RCI-licensed clinical psychologist", bio: mahimaBio, photo: "/founders/mahima-gupta.webp" },
  ]) {
    if (!people.some(existing => normalizePersonName(existing.name) === normalizePersonName(person.name))) {
      people.push({ ...person, linkedin_url: linkedInProfiles[normalizePersonName(person.name)] });
    }
  }
  return <div className="min-h-screen overflow-x-hidden bg-[#f8f9fc] text-[#17233d]">
    <SEO title={p.meta_title || "About DekhoCampus - Clearer college decisions"} description={p.meta_description || "Meet the people and purpose behind DekhoCampus and see how we help students make informed education decisions."} canonical="/about-us" />
    <Navbar />
    <main>
      <section aria-labelledby="about-statement-title" className="relative isolate overflow-hidden border-b border-[#e7e2da] bg-[#fff9e9] px-5 py-16 sm:py-20 lg:py-24">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-28 -z-10 hidden h-80 w-80 rounded-full bg-[#fa4e1e] lg:block" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-16 -z-10 hidden gap-0 sm:flex">
          <span className="h-48 w-24 rounded-b-full bg-[#5652f4] lg:h-64 lg:w-32" />
          <span className="h-48 w-24 rounded-b-full bg-[#5652f4] lg:h-64 lg:w-32" />
          <span className="h-48 w-24 rounded-b-full bg-[#5652f4] lg:h-64 lg:w-32" />
        </div>
        <div className="relative mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a9542b]">About us</p>
            <h1 id="about-statement-title" className="mx-auto mt-5 max-w-4xl text-[1.75rem] font-bold leading-[1.25] tracking-tight text-[#17233d] sm:text-4xl lg:text-5xl">
              We believe every student deserves a guided, stress-free journey to the right college, and we’re building smarter tools and human support to make that possible.
            </h1>
          </div>
          <div className="mt-12 grid gap-8 border-t border-[#dcd5c8] pt-8 md:grid-cols-2 md:gap-12">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[.14em] text-[#a9542b]">Our mission</h2>
              <p className="mt-3 text-base leading-7 text-[#38455a]">To guide every student towards the college that truly fits their goals, profile, and future through smarter technology, Diya AI, reliable information, and personalised support from qualified counsellors.</p>
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[.14em] text-[#a9542b]">Our vision</h2>
              <p className="mt-3 text-base leading-7 text-[#38455a]">To make choosing the right college simpler, clearer, and more accessible for every student in India.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e7e2da] bg-[#fffdfa] text-[#17233d]">
        <div className="container relative grid min-h-[590px] items-center gap-12 pb-20 pt-12 lg:grid-cols-[1.15fr_.85fr] lg:py-28">
          <div className="max-w-3xl">
            <p className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[.24em] text-[#d66a31]"><span className="h-px w-9 bg-[#f68b4b]" />{p.hero_eyebrow || "The people behind DekhoCampus"}</p>
            <h2 className="text-[2.1rem] font-extrabold leading-[1.1] tracking-[-.05em] sm:text-6xl lg:text-[76px]">{p.hero_title || "Big decisions deserve clearer answers."}</h2>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#53627a] sm:text-xl">{p.hero_subtitle || "Choosing a college should feel like a decision you understand, not a gamble you make under pressure. We bring the information, comparisons and human guidance together in one place."}</p>
            <div className="mt-10 flex flex-wrap gap-3"><Link to="/colleges" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90">Explore colleges <ArrowUpRight className="h-4 w-4" /></Link><a href="#our-approach" className="inline-flex items-center gap-2 rounded-full border border-[#cdd9eb] bg-white px-6 py-3 font-semibold text-[#3156a8] transition hover:border-primary hover:bg-[#f4f8ff]">How we help <ArrowDown className="h-4 w-4" /></a></div>
          </div>
          <div className="mx-auto hidden w-full max-w-[480px] lg:block">
            {p.hero_image ? <div className="overflow-hidden rounded-[2rem] border border-[#dfe8f7] bg-white p-2 shadow-xl shadow-[#264b91]/10"><img src={p.hero_image} alt="DekhoCampus student guidance" className="aspect-[4/4.5] w-full rounded-[1.5rem] object-cover" /></div> : <div className="aspect-square rounded-[2rem] border border-[#dfe8f7] bg-white p-8 shadow-xl shadow-[#264b91]/10"><div className="flex h-full flex-col justify-between rounded-3xl border border-[#e2eafa] bg-gradient-to-br from-[#f5f8ff] to-[#fff4e9] p-8"><Compass className="h-12 w-12 text-primary" strokeWidth={1.4} /><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#d66a31]">A clearer route forward</p><p className="mt-4 text-4xl font-bold leading-tight tracking-tight">Explore.<br />Compare.<br /><span className="text-primary">Decide.</span></p></div><div className="flex items-center gap-3 border-t border-[#d8e4f5] pt-5 text-sm text-[#53627a]"><CheckCircle2 className="h-5 w-5 text-[#e9793b]" /> Better questions. Better decisions.</div></div></div>}
          </div>
        </div>
      </section>

      {visibleStats.length > 0 && <section aria-label="DekhoCampus at a glance" className="border-b border-[#e4e9f1] bg-white py-9"><div className="container grid grid-cols-1 gap-8 sm:grid-cols-3">{visibleStats.map(s => <div key={s.id} className="border-l-2 border-[#f68b4b] pl-5"><p className="text-3xl font-extrabold tracking-tight md:text-4xl">{s.value}</p><p className="mt-1 text-sm font-bold">{s.label}</p>{s.description && <p className="mt-1 text-xs leading-5 text-[#6e7c94]">{s.description}</p>}</div>)}</div></section>}

      <section id="our-approach" className="container grid gap-10 py-20 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 lg:py-28"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e06c2c]">Why we exist</p><h2 className="mt-5 text-4xl font-extrabold leading-tight tracking-[-.04em] md:text-5xl">The choice is personal.<br /><span className="text-[#e9793b]">The information should be clear.</span></h2></div><div className="space-y-6 text-lg leading-8 text-[#53627a]"><p>Course names can sound similar while eligibility, fees and admission steps are very different. Students and parents deserve a way to check the details before making a decision that affects years of their lives.</p><p>We help you move from a long list of possibilities to a shortlist grounded in the details that matter to you.</p></div></section>

      <section className="border-y border-[#e7e2da] bg-[#faf8f4] py-12 lg:py-14"><div className="container"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#a9542b]">How we help</p><h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Help at every step</h2><p className="mt-2 text-sm leading-6 text-[#586578]">Explore on your own, then talk to someone when you need to.</p></div><div className="mt-6 grid max-w-5xl gap-3 md:grid-cols-2">{[
        { title: "Find colleges that fit", body: "Compare programs by your goals, grades, budget and preferences.", href: "/colleges", link: "Find colleges" },
        { title: "Ask Diya AI", body: "Get quick answers about courses, fees, eligibility and admissions.", href: "/tools", link: "Explore Diya AI", diya: true },
        { title: "Talk to a counsellor", body: "Get one-to-one help with shortlisting, applications and admission choices.", href: "/colleges", link: "Explore your options" },
        { title: "Guidance shaped by IIT Delhi alumni", body: "Our team brings a thoughtful, student-first approach to college decisions.", href: "/about-us#our-approach", link: "How we work" },
      ].map(({ title, body, href, link, diya }) => <article key={title} className="flex flex-col justify-between border border-[#dedbd5] bg-[#fffdfa] p-4 sm:p-5"><div><div className="flex items-center gap-2.5">{diya && <img src={diyaAiLogo} alt="" className="h-7 w-7 shrink-0 object-contain" />}<h3 className="text-base font-semibold leading-snug text-[#17233d]">{title}</h3></div><p className="mt-2 text-sm leading-5 text-[#586578]">{body}</p></div><Link className="mt-3 w-fit text-sm font-semibold text-[#a9542b] underline decoration-[#d8b9a6] underline-offset-4 hover:text-[#713714]" to={href}>{link}</Link></article>)}</div></div></section>

      <section className="container grid items-center gap-12 py-20 lg:grid-cols-2 lg:gap-20 lg:py-28"><div className="order-2 lg:order-1"><div className="flex min-h-[240px] items-center justify-center rounded-[2rem] bg-[#e8effb] p-6 sm:aspect-[5/3] sm:p-10"><img src={dekhocampusLogo} alt="DekhoCampus" className="h-full w-full object-contain" /></div></div><div className="order-1 lg:order-2"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e06c2c]">Our story</p><h2 className="mt-5 text-4xl font-extrabold tracking-[-.04em] md:text-5xl">The idea behind DekhoCampus.</h2><p className="mt-7 whitespace-pre-line text-lg leading-8 text-[#5c6b82]">{p.story || "DekhoCampus started with a simple question: how can students compare education options without losing the important details along the way? We are building a place where college, course and exam research is easier to navigate, so families can spend less time searching and more time asking the right questions."}</p><Link to="/legal/editorial-policy" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-[#d66830] hover:underline">Read our editorial policy <ArrowUpRight className="h-4 w-4" /></Link></div></section>

      {data.values.length > 0 && <section className="border-y border-[#dfe8f7] bg-[#f2f7ff] py-20 lg:py-24"><div className="container"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#d66a31]">How we work</p><h2 className="mt-4 max-w-2xl text-4xl font-extrabold tracking-[-.04em] md:text-5xl">The principles behind the advice.</h2><div className="mt-12 grid gap-4 md:grid-cols-3">{data.values.map((v, i) => <div key={v.id} className="rounded-[1.5rem] border border-[#dfe8f7] bg-white p-8 shadow-sm"><span className="text-sm font-bold text-primary">0{i + 1}</span><h3 className="mt-8 text-2xl font-bold">{v.title}</h3>{v.description && <p className="mt-4 leading-7 text-[#627189]">{v.description}</p>}</div>)}</div></div></section>}

      {people.length > 0 && <section className="container py-20 lg:py-28"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e06c2c]">Real people</p><h2 className="mt-4 text-4xl font-extrabold tracking-[-.04em] md:text-5xl">Meet the people behind the platform.</h2><p className="mt-5 text-lg leading-8 text-[#64738a]">Knowing who stands behind the information matters. Here are the people building and shaping DekhoCampus.</p></div><div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{people.map(person => <article key={person.id} className="rounded-[1.5rem] border border-[#dfe8f7] bg-white p-6 shadow-sm"><div className="flex items-center gap-5">{person.photo ? <img src={person.photo} alt={person.name} className="h-20 w-20 rounded-2xl object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#e8effb] text-2xl font-bold text-primary">{person.name?.charAt(0)}</div>}<div><h3 className="text-xl font-bold">{person.name}</h3><p className="mt-1 text-sm font-medium text-[#e9793b]">{person.title || person.role}</p>{person.department && <p className="text-xs text-[#53627a]">{person.department}</p>}</div></div>{person.bio && <p className="mt-5 text-sm leading-6 text-[#627189]">{person.bio}</p>}<div className="mt-5 flex gap-3">{externalHref(person.linkedin_url) && <a href={externalHref(person.linkedin_url)!} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on LinkedIn`} className="text-[#53627a] hover:text-primary"><Linkedin className="h-4 w-4" /></a>}{externalHref(person.twitter_url) && <a href={externalHref(person.twitter_url)!} target="_blank" rel="noopener noreferrer" aria-label={`${person.name} on Twitter`} className="text-[#53627a] hover:text-primary"><Twitter className="h-4 w-4" /></a>}</div></article>)}</div></section>}

      {data.milestones.length > 0 && <section className="border-y border-[#e4e9f1] bg-white py-20 lg:py-24"><div className="container grid gap-10 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e06c2c]">Our journey</p><h2 className="mt-4 text-4xl font-extrabold tracking-[-.04em]">Built one step at a time.</h2></div><ol>{data.milestones.map(m => <li key={m.id} className="grid grid-cols-[85px_1fr] gap-5 border-t border-[#e4e9f1] py-6 first:border-t-0"><span className="font-bold text-[#e9793b]">{m.year}</span><div><h3 className="text-xl font-bold">{m.title}</h3>{m.description && <p className="mt-2 leading-7 text-[#627189]">{m.description}</p>}</div></li>)}</ol></div></section>}

      {data.press.some(pr => externalHref(pr.url)) && <section id="press" className="container py-20"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e06c2c]">Coverage</p><h2 className="mt-4 text-4xl font-extrabold tracking-[-.04em]">DekhoCampus in the press.</h2><div className="mt-10 grid gap-4 md:grid-cols-3">{data.press.filter(pr => externalHref(pr.url)).map(pr => <a key={pr.id} href={externalHref(pr.url)!} target="_blank" rel="noopener noreferrer" className="group rounded-2xl border border-[#e4e9f1] bg-white p-6 transition hover:border-[#f1b58e] hover:shadow-lg"><div className="flex items-center justify-between">{pr.logo ? <img src={pr.logo} alt={pr.outlet} className="max-h-9 max-w-32 object-contain" /> : <span className="font-bold text-[#2754aa]">{pr.outlet}</span>}<ExternalLink className="h-4 w-4 text-[#7d8aa0]" /></div><h3 className="mt-7 font-semibold leading-6 group-hover:text-[#d66830]">{pr.headline}</h3>{pr.published_on && <p className="mt-3 text-xs text-[#7d8aa0]">{pr.published_on}</p>}</a>)}</div></section>}

      <section className="border-t border-[#dfe8f7] bg-gradient-to-r from-[#eef5ff] to-[#fff3e8] py-20 lg:py-24"><div className="container flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.22em] text-[#a7552d]">Your next step</p><h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-[-.04em] md:text-5xl">{p.cta_title || "Your future is worth a closer look."}</h2><p className="mt-5 text-lg leading-8 text-[#5c6b82]">{p.cta_subtitle || "Start with the options. Ask better questions. Make a decision you can explain with confidence."}</p></div><Link to="/colleges" className="inline-flex shrink-0 items-center gap-3 rounded-full bg-primary px-7 py-4 font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90">Start exploring <ArrowUpRight className="h-5 w-5" /></Link></div></section>
    </main><Footer />
  </div>;
}
