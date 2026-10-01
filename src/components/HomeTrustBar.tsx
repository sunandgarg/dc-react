import { Link } from "react-router-dom";
import { InstitutionLogo } from "@/components/InstitutionLogo";
import { useTrustedPartners } from "@/hooks/useTrustedPartners";
import { buildCollegeHref } from "@/lib/entityUrls";

export function HomeTrustBar() {
  const { data: partners = [] } = useTrustedPartners();

  return (
    <section id="trusted-partners" className="scroll-mt-24 border-y border-border/60 bg-background py-7" aria-labelledby="trust-heading">
      <div className="container flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
        <div className="flex shrink-0 items-center gap-3">
          <div>
            <h2 id="trust-heading" className="text-sm font-extrabold text-foreground">Explore college partners</h2>
            <p className="text-xs text-muted-foreground">Find institutions and compare your options.</p>
          </div>
        </div>

        {partners.length > 0 && (
          <div className="min-w-0 pt-1 lg:flex-1 lg:pt-0">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground sm:text-xs">Working with leading institutions</p>
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0" aria-label="Trusted college partners">
              {partners.slice(0, 6).map((partner) => (
                <Link
                  key={partner.id}
                  to={buildCollegeHref({ slug: partner.college_slug })}
                  className="flex min-h-11 min-w-max items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <InstitutionLogo src={partner.logo_url} alt="" className="h-7 w-7 rounded-lg bg-muted" imageClassName="p-0.5" />
                  {partner.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
