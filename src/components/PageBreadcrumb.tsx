import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function PageBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="py-3 md:py-4">
      <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm text-muted-foreground">
        <li className="shrink-0">
          <Link to="/" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className={`flex min-w-0 items-center gap-1.5 ${i === items.length - 1 ? "flex-1" : "shrink-0"}`}>
            <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
            {item.href ? (
              <Link to={item.href} className="block max-w-[96px] truncate transition-colors hover:text-foreground sm:max-w-none">
                {item.label}
              </Link>
            ) : (
              <span className="block min-w-0 truncate font-medium text-foreground">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
