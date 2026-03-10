"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  FileText,
  BookOpen,
  Scan,
  Link2,
  Shield,
  LogOut,
  Settings,
  CreditCard,
  Menu,
  X,
  Zap,
} from "lucide-react";

interface AppSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: "exact" | "prefix";
}

const mainNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, match: "exact" },
  { href: "/app/check", label: "New Check", icon: ClipboardCheck, match: "exact" },
  { href: "/app/bulk-jobs", label: "Bulk Jobs", icon: FileSpreadsheet },
  { href: "/app/checks", label: "Results", icon: History },
  { href: "/app/brief", label: "Compliance Brief", icon: FileText },
  { href: "/app/learn", label: "Policy Library", icon: BookOpen },
];

const secondaryNav: NavItem[] = [
  { href: "/app/site-scanner", label: "Site Scanner", icon: Scan },
  { href: "/app/integrations", label: "Integrations", icon: Link2 },
];

function isActive(pathname: string, href: string, match?: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname.startsWith(href);
}

function RadarLogo() {
  return (
    <svg className="aug-logo-mark" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="27" stroke="#0e9488" strokeWidth="0.8" strokeOpacity="0.3" fill="none" />
      <circle cx="32" cy="32" r="19" stroke="#0e9488" strokeWidth="1" strokeOpacity="0.45" fill="none" />
      <circle cx="32" cy="32" r="11" stroke="#0e9488" strokeWidth="1.2" strokeOpacity="0.6" fill="none" />
      <line x1="32" y1="5" x2="32" y2="59" stroke="#0e9488" strokeWidth="0.5" strokeOpacity="0.2" />
      <line x1="5" y1="32" x2="59" y2="32" stroke="#0e9488" strokeWidth="0.5" strokeOpacity="0.2" />
      <g style={{ transformOrigin: "32px 32px", animation: "augRadarSpin 4s linear infinite" }}>
        <line x1="32" y1="32" x2="32" y2="5" stroke="url(#sidebarGrad)" strokeWidth="1.8" strokeLinecap="round" />
      </g>
      <circle cx="32" cy="32" r="2.5" fill="#2dd4bf" />
      <defs>
        <linearGradient id="sidebarGrad" x1="32" y1="32" x2="32" y2="5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity="1" />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CheckditsPill() {
  const [credits, setCredits] = useState<number | null>(null);

  async function fetchBalance() {
    try {
      const res = await fetch("/api/user/checkdits");
      if (!res.ok) return;
      const data = await res.json();
      setCredits(data.creditBalance);
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    fetchBalance();
    window.addEventListener("focus", fetchBalance);
    window.addEventListener("checkdit-used", fetchBalance);
    return () => {
      window.removeEventListener("focus", fetchBalance);
      window.removeEventListener("checkdit-used", fetchBalance);
    };
  }, []);

  if (credits === null) return null;

  return (
    <Link href="/app/billing" className="aug-checkdits-pill">
      <Zap style={{ width: 12, height: 12 }} />
      {credits.toLocaleString()} Checkdits remaining
    </Link>
  );
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initials = user.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const sidebar = (
    <>
      {/* Logo */}
      <Link href="/app/dashboard" className="aug-sidebar-logo" style={{ textDecoration: "none" }}>
        <RadarLogo />
        <span className="aug-logo-name">Augur</span>
      </Link>

      {/* Main nav */}
      <nav className="aug-sidebar-nav">
        {mainNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href, item.match);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`aug-nav-item${active ? " active" : ""}`}
            >
              <Icon className="aug-nav-icon" />
              {item.label}
            </Link>
          );
        })}

        <div className="aug-nav-divider" />

        {secondaryNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href, item.match);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`aug-nav-item${active ? " active" : ""}`}
            >
              <Icon className="aug-nav-icon" />
              {item.label}
            </Link>
          );
        })}

        {user.role === "ADMIN" && (
          <>
            <div className="aug-nav-divider" />
            <Link
              href="/admin"
              className={`aug-nav-item${pathname.startsWith("/admin") ? " active" : ""}`}
            >
              <Shield className="aug-nav-icon" />
              Admin
            </Link>
          </>
        )}
      </nav>

      {/* Bottom section */}
      <div className="aug-sidebar-bottom">
        <div className="aug-user-pill" style={{ position: "relative" }}>
          <div className="aug-user-av">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="aug-user-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name}
            </div>
            <div className="aug-user-role">{user.email}</div>
          </div>
        </div>

        {/* Quick links under user pill */}
        <div style={{ display: "flex", gap: 4, marginTop: 8, fontSize: 10 }}>
          <Link
            href="/app/settings"
            style={{ color: "var(--aug-dim)", textDecoration: "none", padding: "3px 6px", borderRadius: 4 }}
            className="aug-settings-link"
          >
            <Settings style={{ width: 10, height: 10, display: "inline", marginRight: 3, verticalAlign: "middle" }} />
            Settings
          </Link>
          <Link
            href="/app/billing"
            style={{ color: "var(--aug-dim)", textDecoration: "none", padding: "3px 6px", borderRadius: 4 }}
          >
            <CreditCard style={{ width: 10, height: 10, display: "inline", marginRight: 3, verticalAlign: "middle" }} />
            Billing
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ color: "var(--aug-dim)", background: "none", border: "none", cursor: "pointer", padding: "3px 6px", borderRadius: 4, fontSize: 10 }}
          >
            <LogOut style={{ width: 10, height: 10, display: "inline", marginRight: 3, verticalAlign: "middle" }} />
            Sign out
          </button>
        </div>

        <CheckditsPill />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="aug-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="aug-mobile-overlay open" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`aug-sidebar${mobileOpen ? " open" : ""}`}>
        {sidebar}
      </aside>
    </>
  );
}
