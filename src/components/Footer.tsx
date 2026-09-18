import { Facebook, Twitter, Instagram, Linkedin, Youtube, Mail, Phone, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { GoogleGLogo } from "@/components/GoogleGLogo";
import logo from "@/assets/dekhocampus-footer-logo.png";
import dcLogo from "@/assets/dc-logo-small.webp";
import { QuickLinksBar } from "@/components/QuickLinksBar";
import { GlobalInternalAds } from "@/components/GlobalInternalAds";

const footerLinks = {
  explore: [
    { label: "Colleges", href: "/colleges" },
    { label: "Courses", href: "/courses" },
    { label: "Exams", href: "/exams" },
    { label: "Rankings", href: "#" },
    { label: "Compare", href: "#" },
  ],
  resources: [
    { label: "Articles", href: "/news" },
    { label: "News", href: "/news" },
    { label: "Career Scope", href: "/careers" },
    { label: "AI Tools", href: "/tools" },
    { label: "Refer & Earn", href: "/dashboard/refer" },
  ],
  company: [
    { label: "About Us", href: "/about-us" },
    { label: "Careers", href: "/vacancies" },
    { label: "Press", href: "/about-us#press" },
    { label: "Partners", href: "#" },
    { label: "Contact", href: "#" },
  ],
  legal: [
    { label: "Disclaimer", href: "/legal/disclaimer" },
    { label: "Privacy Policy", href: "/legal/privacy-policy" },
    { label: "Terms & Conditions", href: "/legal/terms-of-service" },
    { label: "Data Protection", href: "/legal/data-protection-policy" },
    { label: "Editorial Policy", href: "/legal/editorial-policy" },
    { label: "Cookie Policy", href: "/legal/cookie-policy" },
    { label: "Accessibility", href: "/legal/accessibility" },
  ],
};

const socialLinks = [
  { icon: Facebook, href: "#", label: "Facebook" },
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Youtube, href: "#", label: "YouTube" },
];

const popularFooterGroups = [
  {
    title: "Engineering College Rankings",
    links: [
      ["Top Engineering Colleges in India 2026", "/colleges/top-engineering-colleges-in-india"],
      ["Top Engineering Colleges in Delhi NCR 2026", "/colleges/top-engineering-colleges-in-delhi-ncr"],
      ["Top Engineering Colleges in Uttar Pradesh 2026", "/colleges/top-engineering-colleges-in-uttar-pradesh"],
      ["Top Engineering Colleges in Punjab 2026", "/colleges/top-engineering-colleges-in-punjab"],
      ["Top Engineering Colleges in Haryana 2026", "/colleges/top-engineering-colleges-in-haryana"],
      ["Top Engineering Colleges in Rajasthan 2026", "/colleges/top-engineering-colleges-in-rajasthan"],
      ["Top Engineering Colleges in Bihar 2026", "/colleges/top-engineering-colleges-in-bihar"],
      ["Top Engineering Colleges in Gujarat 2026", "/colleges/top-engineering-colleges-in-gujarat"],
      ["Top Engineering Colleges in Maharashtra 2026", "/colleges/top-engineering-colleges-in-maharashtra"],
      ["Top Engineering Colleges in Telangana 2026", "/colleges/top-engineering-colleges-in-telangana"],
      ["Top Engineering Colleges in Andhra Pradesh 2026", "/colleges/top-engineering-colleges-in-andhra-pradesh"],
      ["Top Engineering Colleges in Karnataka 2026", "/colleges/top-engineering-colleges-in-karnataka"],
    ],
  },
  {
    title: "MBA College Rankings",
    links: [
      ["Top MBA Colleges in India 2026", "/colleges/top-mba-colleges-in-india"],
      ["Top MBA Colleges in Delhi NCR 2026", "/colleges/top-mba-colleges-in-delhi-ncr"],
      ["Top MBA Colleges in Uttar Pradesh 2026", "/colleges/top-mba-colleges-in-uttar-pradesh"],
      ["Top MBA Colleges in Punjab 2026", "/colleges/top-mba-colleges-in-punjab"],
      ["Top MBA Colleges in Haryana 2026", "/colleges/top-mba-colleges-in-haryana"],
      ["Top MBA Colleges in Rajasthan 2026", "/colleges/top-mba-colleges-in-rajasthan"],
      ["Top MBA Colleges in Assam 2026", "/colleges/top-mba-colleges-in-assam"],
      ["Top MBA Colleges in Madhya Pradesh 2026", "/colleges/top-mba-colleges-in-madhya-pradesh"],
      ["Top MBA Colleges in Maharashtra 2026", "/colleges/top-mba-colleges-in-maharashtra"],
      ["Top MBA Colleges in Telangana 2026", "/colleges/top-mba-colleges-in-telangana"],
      ["Top MBA Colleges in Odisha 2026", "/colleges/top-mba-colleges-in-odisha"],
      ["Top MBA Colleges in Tamil Nadu 2026", "/colleges/top-mba-colleges-in-tamil-nadu"],
    ],
  },
  {
    title: "Important Entrance Exams",
    links: [
      ["JEE Main 2027", "/exams?search=JEE%20Main"],
      ["NEET 2027", "/exams?search=NEET"],
      ["XAT 2027", "/exams?search=XAT"],
      ["CLAT 2027", "/exams?search=CLAT"],
      ["CAT 2026-27", "/exams?search=CAT"],
      ["AEEE 2026", "/exams?search=AEEE"],
      ["VITEEE 2026", "/exams?search=VITEEE"],
      ["UGC NET 2026", "/exams?search=UGC%20NET"],
      ["NDA 2027", "/exams?search=NDA"],
      ["JEECUP 2027", "/exams?search=JEECUP"],
      ["AP EAPCET 2027", "/exams?search=AP%20EAPCET"],
      ["TG EAPCET 2027", "/exams?search=TG%20EAPCET"],
    ],
  },
] as const;

export function Footer() {
  return (
    <>
    <GlobalInternalAds area="bottom" />
    <QuickLinksBar />
    <footer className="bg-foreground text-background" role="contentinfo">
      {/* Built by IIT Delhi Alumni strip - shown on every page */}
      <div className="bg-background text-foreground border-b border-border/40">
        <div className="container py-3.5 md:py-4 flex flex-col items-center text-center gap-0.5">
          <div className="inline-flex items-center gap-2">
            <img src={dcLogo} alt="DekhoCampus" className="w-5 h-5 md:w-6 md:h-6 object-contain" />
            <span className="text-sm md:text-base font-bold tracking-tight text-primary">Built by IIT Delhi Alumni</span>
          </div>
          <p className="text-[11px] md:text-xs text-muted-foreground max-w-md leading-snug">
            We went through the same journey - now we've built the system to simplify yours.
          </p>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container py-10 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={logo} alt="DekhoCampus" className="h-8 md:h-10" />
            </Link>
            <p className="text-background/70 text-sm mb-6 max-w-xs">
              India's #1 AI-powered education platform helping students find their perfect career path.
            </p>
            <div className="space-y-3 text-sm text-background/70">
              <a
                href="mailto:outreach@dekhocampus.com"
                className="flex items-center gap-2 hover:text-accent transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>outreach@dekhocampus.com</span>
              </a>
              <a href="tel:+919990109797" className="flex items-center gap-2 hover:text-accent transition-colors">
                <Phone className="w-4 h-4" />
                <span>+91-9990109797</span>
              </a>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>New Delhi, India</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <nav aria-label="Explore">
            <h4 className="font-bold text-background mb-4 text-sm">Explore</h4>
            <ul className="space-y-2.5">
              {footerLinks.explore.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-background/70 hover:text-accent transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Resources">
            <h4 className="font-bold text-background mb-4 text-sm">Resources</h4>
            <ul className="space-y-2.5">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-background/70 hover:text-accent transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Company">
            <h4 className="font-bold text-background mb-4 text-sm">Company</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-background/70 hover:text-accent transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h4 className="font-bold text-background mb-4 text-sm">Legal</h4>
            <ul className="space-y-2.5">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="text-background/70 hover:text-accent transition-colors text-sm">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <section className="border-t border-background/10" aria-labelledby="popular-education-links">
        <div className="container py-8 md:py-10">
          <div className="mb-6 max-w-2xl">
            <h2 id="popular-education-links" className="text-xl font-extrabold text-background md:text-2xl">Explore education by interest</h2>
            <p className="mt-1 text-sm leading-6 text-background/65">Direct paths to popular colleges, courses, entrance exams and student resources.</p>
          </div>
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
            {popularFooterGroups.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h3 className="mb-3 text-sm font-extrabold text-background">{group.title}</h3>
                <ul className="space-y-2.5 md:space-y-3">
                  {group.links.map(([label, href]) => (
                    <li key={href}>
                      <Link to={href} className="text-sm leading-5 text-background/70 transition-colors hover:text-accent">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Bar */}
      <div className="border-t border-background/10">
        <div className="container py-4 md:py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs md:text-sm text-background/70">
            © {new Date().getFullYear()} DekhoCampus. Made with ❤️ for students in India
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <a
              href="#google-reviews"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/10 hover:bg-background/15 transition-colors"
              aria-label="4.9 star Google reviews"
            >
              <GoogleGLogo className="w-4 h-4" />
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-background">4.9</span>
              <span className="text-[10px] text-background/70 hidden sm:inline">Google Rating</span>
            </a>
            <div className="flex items-center gap-2.5">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="w-9 h-9 rounded-lg bg-background/10 flex items-center justify-center hover:bg-accent hover:text-foreground transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
    </>
  );
}
