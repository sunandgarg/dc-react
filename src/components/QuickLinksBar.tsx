import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  GraduationCap, BookOpen, FileText, Globe, Laptop, Calculator, Newspaper,
  Layers, Star, Image as ImageIcon, Compass, Sparkles, MapPin,
  Briefcase, ShieldCheck, HelpCircle, Building2,
} from "lucide-react";

type QL =
  | { icon: any; label: string; href: string; external?: boolean }
  | { icon: any; label: string; sectionId: string; fallbackHref: string };

const links: QL[] = [
  // Priority order requested
  { icon: Laptop, label: "Online Degrees", sectionId: "online-education-heading", fallbackHref: "/courses" },
  { icon: Sparkles, label: "Earn IIT/IIM/Dr. Tag", sectionId: "trending-programs-heading", fallbackHref: "/premium-programs" },
  { icon: Globe, label: "Study Abroad", sectionId: "online-education-heading", fallbackHref: "/courses" },
  // Then the rest
  { icon: GraduationCap, label: "Top Colleges", href: "/colleges" },
  { icon: BookOpen, label: "Courses", href: "/courses" },
  { icon: FileText, label: "Exams", href: "/exams" },
  { icon: Star, label: "Live Scholarships", href: "/scholarships" },
  { icon: Layers, label: "Explore by Category", sectionId: "explore-heading", fallbackHref: "/colleges" },
  { icon: Star, label: "Featured Colleges", sectionId: "top-colleges-heading", fallbackHref: "/colleges" },
  { icon: ImageIcon, label: "Recommended", sectionId: "recommended-colleges-heading", fallbackHref: "/colleges" },
  { icon: Compass, label: "Explore More", sectionId: "explore-cta-heading", fallbackHref: "/colleges" },
  { icon: MapPin, label: "By City", sectionId: "city-search-heading", fallbackHref: "/colleges" },
  { icon: Briefcase, label: "Career Scope", sectionId: "career-scope-heading", fallbackHref: "/careers" },
  { icon: Calculator, label: "Tools", sectionId: "tools-heading", fallbackHref: "/tools" },
  { icon: Newspaper, label: "News", sectionId: "news-heading", fallbackHref: "/news" },
  { icon: BookOpen, label: "Study Material", sectionId: "study-material-heading", fallbackHref: "/study-material" },
  { icon: ShieldCheck, label: "Why Us", sectionId: "features-heading", fallbackHref: "/about-us" },
  { icon: HelpCircle, label: "FAQs", sectionId: "faq-heading", fallbackHref: "/about-us" },
  { icon: Building2, label: "Trusted Partners", sectionId: "trusted-heading", fallbackHref: "/colleges" },
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return false;
  const top = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top, behavior: "smooth" });
  return true;
}

const cls = "flex items-center gap-2 rounded-full border border-border/60 bg-card px-3.5 py-2 text-xs font-semibold whitespace-nowrap shadow-sm transition-all hover:border-primary hover:bg-primary/5 hover:text-primary hover:shadow-md md:px-4 md:py-2.5 md:text-sm";

function Item({ link }: { link: QL }) {
  const Icon = link.icon;
  const location = useLocation();
  const navigate = useNavigate();
  const inner = (<><Icon className="w-4 h-4" />{link.label}</>);
  if ("sectionId" in link) {
    const onClick = () => {
      if (location.pathname === "/") {
        if (!scrollToId(link.sectionId)) navigate(link.fallbackHref);
      } else {
        // Navigate home then scroll once the section mounts
        navigate(`/#${link.sectionId}`);
        setTimeout(() => {
          if (!scrollToId(link.sectionId)) navigate(link.fallbackHref);
        }, 400);
      }
    };
    return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  }
  if (link.external) {
    return <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  }
  return <Link to={link.href} className={cls}>{inner}</Link>;
}

export function QuickLinksBar({ compact = false }: { compact?: boolean } = {}) {
  return (
    <section
      className={compact ? "border-y border-border/60 bg-background py-3" : "border-y border-border/60 bg-gradient-to-b from-background to-card/30 py-5 md:py-6"}
      aria-label="Quick Links"
    >
      <div className="overflow-x-auto scrollbar-thin -mx-3 px-3">
        <div className="flex flex-nowrap items-center gap-2.5 w-max mx-auto">
          {links.map((link, i) => <Item key={i} link={link} />)}
        </div>
      </div>
    </section>
  );
}
