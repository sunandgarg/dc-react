import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import diyaLogo from "@/assets/diya-ai-logo-small.webp";

const guidancePoints = [
  "Compare the right-fit options",
  "Understand fees and outcomes",
  "Plan the next admission step",
] as const;

export function AskDiyaBand() {
  const location = useLocation();
  const navigate = useNavigate();

  const openDiya = () => {
    const botIsHidden = location.pathname.startsWith("/news")
      || location.pathname.startsWith("/articles")
      || location.pathname.startsWith("/premium-programs");

    if (botIsHidden) {
      window.sessionStorage.setItem("dc:open-diya-after-navigation", "footer");
      navigate("/");
      return;
    }

    window.dispatchEvent(new CustomEvent("dc:open-diya"));
  };

  return (
    <section className="border-t border-border bg-[#151b2b] text-white" aria-labelledby="ask-diya-heading">
      <div className="container grid gap-6 px-4 py-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10 md:py-10">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-[#ff7a24]">
            <img src={diyaLogo} alt="" className="h-7 w-7 object-contain" loading="lazy" decoding="async" />
            Personal guidance, when you need it
          </div>
          <h2 id="ask-diya-heading" className="text-2xl font-black leading-tight sm:text-3xl">
            Still deciding? Ask Diya.
          </h2>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
            {guidancePoints.map((point) => (
              <span key={point} className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openDiya}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ff7a24] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#e96713] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#151b2b] md:w-auto"
          aria-label="Ask Diya for education guidance"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          Ask Diya
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
