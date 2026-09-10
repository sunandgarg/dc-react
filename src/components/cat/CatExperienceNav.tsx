import { BrainCircuit, Download, GraduationCap } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/cat-universe/cat-2026-preparation-kit", label: "Preparation kit", icon: Download },
  { to: "/cat-universe/ai-interview-practice", label: "AI interview", icon: BrainCircuit },
  { to: "/cat-universe/ai-coach", label: "AI coach", icon: GraduationCap },
];

export function CatExperienceNav() {
  return (
    <nav aria-label="CAT 2026 tools" className="border-y border-border bg-background">
      <div className="container flex min-h-14 items-center gap-1 overflow-x-auto py-2">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-semibold transition sm:gap-2 sm:px-3 ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
