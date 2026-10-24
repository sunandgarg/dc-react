import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight, BookOpen, GraduationCap, Home, Newspaper, SearchX, Trophy } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useSEO } from "@/hooks/useSEO";

const destinations = [
  { to: "/colleges", label: "Explore colleges", description: "Compare colleges and their admission details.", icon: GraduationCap },
  { to: "/courses", label: "Browse courses", description: "Find a course that fits your plans.", icon: BookOpen },
  { to: "/exams", label: "Check entrance exams", description: "See exam guides and important updates.", icon: Trophy },
  { to: "/news", label: "Read education news", description: "Catch up on admissions and exam notices.", icon: Newspaper },
];

const NotFound = () => {
  const location = useLocation();
  useSEO({ title: "Page Not Found", description: "The requested DekhoCampus page could not be found.", canonical: location.pathname });

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]') || document.head.appendChild(document.createElement("meta"));
    robots.setAttribute("name", "robots");
    robots.setAttribute("content", "noindex, follow");
    return () => robots.setAttribute("content", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-orange-50 via-background to-background px-4 pb-12 pt-16 sm:pt-20">
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center rounded-3xl border border-orange-200 bg-white text-primary shadow-lg shadow-orange-100/70">
              <SearchX className="h-10 w-10" aria-hidden="true" />
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">404 · Page not found</p>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Oops! Page not found</h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              The link may have changed, or the page may no longer be available. You can head home or continue exploring DekhoCampus below.
            </p>
            <Link
              to="/"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Home className="h-5 w-5" aria-hidden="true" />
              Return to Home
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6" aria-labelledby="browse-heading">
          <div className="mb-6 text-center">
            <h2 id="browse-heading" className="text-2xl font-bold text-foreground">Find what you were looking for</h2>
            <p className="mt-2 text-sm text-muted-foreground">These are good places to pick up where you left off.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map(({ to, label, description, icon: Icon }) => (
              <Link key={to} to={to} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="flex items-center justify-between gap-2 font-semibold text-foreground">
                  {label}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted-foreground">{description}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default NotFound;
