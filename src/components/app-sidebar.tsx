"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  match?: "exact" | "prefix";
  color: string;
}

const mainNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard, match: "exact", color: "#2dd4bf" },
  { href: "/app/check", label: "New Check", icon: ClipboardCheck, match: "exact", color: "#60a5fa" },
  { href: "/app/bulk-jobs", label: "Bulk Jobs", icon: FileSpreadsheet, color: "#a78bfa" },
  { href: "/app/checks", label: "Results", icon: History, color: "#fbbf24" },
  { href: "/app/brief", label: "Compliance Brief", icon: FileText, color: "#38bdf8" },
  { href: "/app/learn", label: "Policy Library", icon: BookOpen, color: "#4ade80" },
];

const secondaryNav: NavItem[] = [
  { href: "/app/site-scanner", label: "Site Scanner", icon: Scan, color: "#fb923c" },
  { href: "/app/integrations", label: "Integrations", icon: Link2, color: "#f87171" },
];

function isActive(pathname: string, href: string, match?: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname.startsWith(href);
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

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`aug-nav-item${active ? " active" : ""}`}
      style={active ? {
        "--nav-color": item.color,
        borderLeftColor: item.color,
        color: item.color,
        background: `${item.color}0d`,
      } as React.CSSProperties : {}}
    >
      <Icon
        className="aug-nav-icon"
        style={active ? { color: item.color, opacity: 1 } : { color: item.color, opacity: 0.5 }}
      />
      {item.label}
    </Link>
  );
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const initials = user.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  const sidebar = (
    <>
      {/* Logo lockup */}
      <Link href="/app/dashboard" className="aug-sidebar-logo" style={{ textDecoration: "none", padding: "20px 16px 18px" }}>
        <Image
          src="/augur-teal-lockup.svg"
          alt="Augur"
          width={200}
          height={54}
          priority
          style={{ height: 54, width: "auto" }}
        />
      </Link>

      {/* Main nav */}
      <nav className="aug-sidebar-nav">
        {mainNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href, item.match)} />
        ))}

        <div className="aug-nav-divider" />

        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href, item.match)} />
        ))}

        {user.role === "ADMIN" && (
          <>
            <div className="aug-nav-divider" />
            <NavLink
              item={{ href: "/admin", label: "Admin", icon: Shield, color: "#c4b5fd" }}
              active={pathname.startsWith("/admin")}
            />
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

        <div style={{ display: "flex", gap: 4, marginTop: 8, fontSize: 10 }}>
          <Link
            href="/app/settings"
            style={{ color: "var(--aug-dim)", textDecoration: "none", padding: "3px 6px", borderRadius: 4 }}
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

        {/* AUX branding */}
        <a
          href="https://www.theaux.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: 12,
            padding: "6px 0",
            fontSize: 9,
            color: "var(--aug-dim)",
            textDecoration: "none",
            letterSpacing: "0.04em",
          }}
        >
          <span style={{ opacity: 0.5 }}>An</span>
          <span style={{ fontWeight: 700, color: "var(--aug-mid)", letterSpacing: "0.12em", fontSize: 10 }}>AUX</span>
          <span style={{ opacity: 0.5 }}>product</span>
        </a>
      </div>
    </>
  );

  return (
    <>
      <button
        className="aug-mobile-toggle"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
      </button>

      {mobileOpen && (
        <div className="aug-mobile-overlay open" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`aug-sidebar${mobileOpen ? " open" : ""}`}>
        {sidebar}
      </aside>
    </>
  );
}
