"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronDown,
  ClipboardCheck,
  Shield,
  History,
  FileSpreadsheet,
  CreditCard,
  Zap,
  Link2,
  Menu,
  X,
  FileText,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CheckditBalance } from "@/components/checkdit-balance";

function VersionStamp() {
  const hash = process.env.NEXT_PUBLIC_GIT_HASH;
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME;

  if (!hash || !buildTime) return null;

  const date = new Date(buildTime);
  const formatted = date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 select-none" title={`Commit ${hash} · Deployed ${formatted}`}>
      <span className="font-mono bg-slate-100 rounded px-1.5 py-0.5 text-slate-500">{hash}</span>
      <span>·</span>
      <span>{formatted}</span>
    </div>
  );
}

interface AppNavProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  prefixes: string[];
}

const navGroups: NavGroup[] = [
  {
    label: "Check",
    icon: ClipboardCheck,
    prefixes: ["/app/check", "/app/bulk-jobs"],
    items: [
      { href: "/app/check", label: "New Check", icon: ClipboardCheck },
      { href: "/app/bulk-jobs", label: "Bulk Jobs", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Results",
    icon: History,
    prefixes: ["/app/checks", "/app/integrations"],
    items: [
      { href: "/app/checks", label: "Compliance History", icon: History },
      { href: "/app/integrations", label: "Integrations", icon: Link2 },
    ],
  },
  {
    label: "Resources",
    icon: BookOpen,
    prefixes: ["/app/brief", "/app/learn"],
    items: [
      { href: "/app/brief", label: "Compliance Brief", icon: FileText },
      { href: "/app/learn", label: "Policy Library", icon: BookOpen },
    ],
  },
];

function isGroupActive(group: NavGroup, pathname: string) {
  return group.prefixes.some((p) =>
    p === "/app/check" ? pathname === "/app/check" : pathname.startsWith(p)
  );
}

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = isGroupActive(group, pathname);
  const Icon = group.icon;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "text-[#1A56DB] border-b-2 border-[#1A56DB] rounded-none"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md"
        )}
      >
        <Icon className="h-4 w-4" />
        {group.label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-50">
          {group.items.map((item) => {
            const ItemIcon = item.icon;
            const itemActive =
              item.href === "/app/check"
                ? pathname === "/app/check"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  itemActive
                    ? "text-[#1A56DB] bg-[#1A56DB]/5 font-medium"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <ItemIcon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo + hamburger */}
          <div className="flex items-center gap-4 md:gap-8">
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-md hover:bg-slate-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5 text-slate-600" /> : <Menu className="h-5 w-5 text-slate-600" />}
            </button>

            <Link href="/app/dashboard" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="AUX" className="h-8 w-auto" />
              <div className="hidden sm:block leading-tight">
                <p className="text-sm font-semibold text-slate-900">
                  Ad Compliance <span className="text-[#1A56DB]">Pro</span>
                </p>
                <p className="text-[10px] text-[#1A56DB] -mt-0.5">by AUX</p>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {/* Dashboard — standalone link */}
              <Link
                href="/app/dashboard"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                  pathname === "/app/dashboard"
                    ? "text-[#1A56DB] border-b-2 border-[#1A56DB] rounded-none"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md"
                )}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              {/* Grouped nav items */}
              {navGroups.map((group) => (
                <NavDropdown key={group.label} group={group} pathname={pathname} />
              ))}

              {user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith("/admin")
                      ? "text-[#1A56DB] border-b-2 border-[#1A56DB] rounded-none"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <VersionStamp />
            <CheckditBalance />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 h-9">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                    {user.name?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-32 truncate">
                    {user.name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-slate-900">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app/billing" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Billing & Credits
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/settings/connections" className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Connections
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Account Settings
                  </Link>
                </DropdownMenuItem>
                {user.role === "ADMIN" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin Portal
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600 cursor-pointer"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <nav className="flex flex-col px-4 py-3 space-y-1">
            {/* Dashboard */}
            <Link
              href="/app/dashboard"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname === "/app/dashboard"
                  ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <LayoutDashboard className="h-4.5 w-4.5" />
              Dashboard
            </Link>

            {/* Grouped sections */}
            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const active = isGroupActive(group, pathname);
              return (
                <div key={group.label}>
                  <div className="border-t border-slate-100 my-1" />
                  <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive =
                      item.href === "/app/check"
                        ? pathname === "/app/check"
                        : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          itemActive
                            ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        )}
                      >
                        <ItemIcon className="h-4.5 w-4.5" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}

            {user.role === "ADMIN" && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <Link
                  href="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Shield className="h-4.5 w-4.5" />
                  Admin Portal
                </Link>
              </>
            )}

            <div className="border-t border-slate-100 my-1" />
            <Link
              href="/app/billing"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/app/billing")
                  ? "bg-[#1A56DB]/10 text-[#1A56DB]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <CreditCard className="h-4.5 w-4.5" />
              Billing & Credits
            </Link>
            <Link
              href="/app/settings"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Settings className="h-4.5 w-4.5" />
              Account Settings
            </Link>
            <button
              onClick={() => {
                setMobileOpen(false);
                signOut({ callbackUrl: "/login" });
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full text-left"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign Out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
