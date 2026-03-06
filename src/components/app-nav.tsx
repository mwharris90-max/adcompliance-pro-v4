"use client";

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

const navLinks = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/app/check",
    label: "New Check",
    icon: ClipboardCheck,
  },
  {
    href: "/app/bulk-jobs",
    label: "Bulk Jobs",
    icon: FileSpreadsheet,
  },
  {
    href: "/app/checks",
    label: "Compliance",
    icon: History,
  },
  {
    href: "/app/integrations",
    label: "Integrations",
    icon: Link2,
  },
  {
    href: "/app/billing",
    label: "Billing",
    icon: CreditCard,
  },
];

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
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

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive =
                link.href === "/app/checks"
                  ? pathname.startsWith("/app/checks")
                  : link.href === "/app/check"
                  ? pathname === "/app/check"
                  : link.href === "/app/bulk-jobs"
                  ? pathname.startsWith("/app/bulk-jobs")
                  : link.href === "/app/integrations"
                  ? pathname.startsWith("/app/integrations")
                  : link.href === "/app/billing"
                  ? pathname.startsWith("/app/billing")
                  : pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "text-[#1A56DB] border-b-2 border-[#1A56DB] rounded-none"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-md"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}

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
                  Admin Portal
                </Link>
              )}
            </nav>
          </div>

          {/* Version stamp */}
          <VersionStamp />

          {/* Checkdit balance */}
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
                  <Zap className="h-4 w-4" />
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
    </header>
  );
}
