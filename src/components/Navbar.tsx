import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, User, Shield, LogOut, Home, Gift, FileText, Settings } from "lucide-react";
import logo from "@/assets/dekhocampus-logo-small.webp";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { MegaMenu, MobileMegaMenu } from "@/components/MegaMenu";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { AnnouncementBar } from "@/components/AnnouncementBar";


export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, isAdmin, canAccess, signOut } = useAuth();
  const { data: profile } = useUserProfile();
  const { pathname } = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsMobileMenuOpen(false); setIsUserMenuOpen(false); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const displayName = [profile?.name, user?.user_metadata?.display_name, user?.user_metadata?.full_name, user?.email?.split("@")[0]]
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const hasContentAdminAccess = isAdmin || ["colleges", "courses", "exams", "articles"].some((module) => canAccess(module as any));
  const adminHref = isAdmin ? "/admin" : "/admin/colleges";

  const userMenuItems = [
    { label: "Dashboard", icon: Home, href: "/dashboard" },
    { label: "My Profile", icon: User, href: "/dashboard" },
    { label: "Refer & Earn", icon: Gift, href: "/dashboard" },
    { label: "Documents", icon: FileText, href: "/dashboard" },
    { label: "Settings", icon: Settings, href: "/dashboard" },
  ];

  return (
    <>
    <header id="site-header" className={`sticky top-0 isolate w-full has-[[data-menu][aria-expanded=true]]:z-[130] ${isMobileMenuOpen ? "z-[130]" : "z-[70]"}`}>
      <AnnouncementBar />
      <nav className="border-b border-border bg-white/[0.98]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-8 xl:h-[72px]">
          <Link to="/" className="flex shrink-0 items-center" aria-label="DekhoCampus Home">
            <img src={logo} alt="DekhoCampus" className="h-auto w-[145px] 2xl:w-[170px]" />
          </Link>

          <MegaMenu />

          <div className="flex shrink-0 items-center gap-2">
            {hasContentAdminAccess && (
              <Button asChild variant="outline" size="sm" className="hidden md:flex gap-2 rounded-xl border-amber-200 text-amber-600 hover:bg-amber-50">
                <Link to={adminHref}>
                  <Shield className="w-4 h-4" />
                  {isAdmin ? "Admin" : "Content Admin"}
                </Link>
              </Button>
            )}

            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-label="Open account menu"
                  aria-expanded={isUserMenuOpen}
                  className="hidden md:flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-secondary transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {initial}
                  </div>
                  <span className="hidden 2xl:block text-sm font-medium text-foreground max-w-24 truncate">{displayName}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </button>

                {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl border border-border shadow-lg overflow-hidden z-50">
                      <div className="p-4 bg-muted/50 border-b border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
                            {initial}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Hi, {displayName}!</p>
                            <Link
                              to="/dashboard"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="text-xs text-primary hover:underline"
                            >
                              Edit profile
                            </Link>
                          </div>
                        </div>
                      </div>
                      <div className="py-2">
                        {userMenuItems.map(item => (
                          <Link
                            key={item.label}
                            to={item.href}
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                          >
                            <item.icon className="w-4 h-4 text-muted-foreground" />
                            {item.label}
                          </Link>
                        ))}
                      </div>
                      <div className="border-t border-border py-2">
                        <button
                          onClick={() => { signOut(); setIsUserMenuOpen(false); }}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 w-full transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                )}
              </div>
            ) : (
              <>
                <Button asChild variant="outline" className="hidden md:flex gap-2 rounded-xl focus-ring">
                  <Link to="/auth">
                    <User className="w-4 h-4" />
                    Sign In
                  </Link>
                </Button>
                <Button asChild className="hidden md:flex rounded-md bg-primary text-primary-foreground">
                  <Link to="/auth">
                    Get Started
                  </Link>
                </Button>
              </>
            )}

            {!user && (
              <Button asChild variant="ghost" size="icon" className="md:hidden focus-ring">
                <Link to="/auth" aria-label="Sign in">
                  <User className="w-5 h-5" />
                </Link>
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="xl:hidden focus-ring"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation-panel"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {isMobileMenuOpen && (
            <div id="mobile-navigation-panel" className="xl:hidden border-t border-border">
              <div className="container py-4 space-y-1 bg-card max-h-[calc(100dvh-120px)] overflow-y-auto overscroll-contain">
                <MobileMegaMenu onNavigate={() => setIsMobileMenuOpen(false)} />

                {user && (
                  <Link
                    to="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-primary hover:bg-primary/10 rounded-xl transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    My Dashboard
                  </Link>
                )}

                {hasContentAdminAccess && (
                  <Link
                    to={adminHref}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    {isAdmin ? "Admin Panel" : "Content Admin"}
                  </Link>
                )}

                <div className="pt-4 flex flex-col gap-2 border-t border-border">
                  {user ? (
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      onClick={() => { signOut(); setIsMobileMenuOpen(false); }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="outline" className="w-full rounded-xl">
                        <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                          <User className="w-4 h-4 mr-2" />
                          Sign In
                        </Link>
                      </Button>
                      <Button asChild className="w-full gradient-primary text-primary-foreground rounded-xl">
                        <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                          Get Started
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
        )}
      </nav>
    </header>
    {pathname !== "/" && <div id="global-internal-ad-top-anchor" />}
    {!pathname.startsWith("/admin") && !pathname.startsWith("/auth") && (
      <div className="border-b border-border/70 bg-white px-3 py-2">
        <div className="container px-0">
          <GlobalSearchBar variant="header" />
        </div>
      </div>
    )}
    </>
  );
}
