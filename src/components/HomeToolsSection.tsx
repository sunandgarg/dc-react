import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, BarChart3, Brain, Building2, ChevronLeft, ChevronRight, FileCheck, Percent, Target } from "lucide-react";
import { Link } from "react-router-dom";

const tools = [
  { title: "Compare colleges", description: "See fees, rankings and placements together", icon: Building2, href: "/tools/compare-colleges", tone: "bg-orange-50 text-orange-700" },
  { title: "Predict my rank", description: "Get a useful estimate from your score", icon: BarChart3, href: "/tools/rank-predictor", tone: "bg-emerald-50 text-emerald-700" },
  { title: "Check eligibility", description: "Know where you can apply before you start", icon: FileCheck, href: "/tools/eligibility-checker", tone: "bg-rose-50 text-rose-700" },
  { title: "Find my career fit", description: "Explore paths that match how you think", icon: Brain, href: "/tools/psychometric-test", tone: "bg-violet-50 text-violet-700" },
  { title: "Plan my target", description: "Turn a dream college into clear next steps", icon: Target, href: "/lock-target", tone: "bg-blue-50 text-blue-700" },
  { title: "Convert my CGPA", description: "Translate grades into percentage quickly", icon: Percent, href: "/tools/cgpa-converter", tone: "bg-amber-50 text-amber-700" },
] as const;

export function HomeToolsSection() {
  const reduceMotion = useReducedMotion();
  const carouselRef = useRef<HTMLDivElement>(null);

  const moveCarousel = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({ left: direction * Math.max(260, carousel.clientWidth * 0.72), behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section className="bg-background py-9 md:py-12" aria-labelledby="home-tools-heading">
      <div className="container">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-accent">Free student toolkit</p>
            <h2 id="home-tools-heading" className="mt-1 text-2xl font-black tracking-tight text-foreground md:text-3xl">Small tools for big decisions</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick what you need today. No complicated setup.</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button type="button" onClick={() => moveCarousel(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Previous student tools">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => moveCarousel(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Next student tools">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link to="/tools" className="flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              All tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <motion.div
          ref={carouselRef}
          className="grid snap-x snap-mandatory grid-flow-col auto-cols-[84%] gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:auto-cols-[48%] lg:auto-cols-[32%]"
          aria-label="Free student tools"
          initial={reduceMotion ? false : "hidden"}
          whileInView={reduceMotion ? undefined : "show"}
          viewport={{ once: true, amount: 0.2 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.055 } } }}
        >
          {tools.map(({ title, description, icon: Icon, href, tone }) => (
            <motion.div
              key={title}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } }}
              whileHover={reduceMotion ? undefined : { y: -4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.99 }}
            >
              <Link
                to={href}
                className="group relative flex min-h-[112px] h-full snap-start items-start gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3.5 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/25 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:p-4"
              >
                <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100" aria-hidden="true" />
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone} transition-transform duration-300 group-hover:scale-105`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-1 text-sm font-extrabold leading-5 text-foreground group-hover:text-primary">
                    {title}
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-60 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary group-hover:opacity-100" aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">{description}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <Link to="/tools" className="mt-4 flex min-h-11 items-center justify-center gap-1 rounded-xl border border-border text-sm font-bold text-primary sm:hidden">
          View all tools <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
