import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/auth";
import {
  LayoutDashboard,
  Tag,
  Globe,
  MonitorPlay,
  ShieldCheck,
  ShieldAlert,
  MapPin,
  GitPullRequest,
  Radar,
  Users,
  LogOut,
  BrainCircuit,
  Mail,
  Building2,
  BarChart3,
  Ban,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usage", label: "Usage", icon: BarChart3 },
  { href: "/admin/credits", label: "Credit Management", icon: Coins },
  { href: "/admin/organisations", label: "Organisations", icon: Building2 },
  { href: "/admin/invites", label: "Invites", icon: Mail },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/countries", label: "Countries", icon: Globe },
  { href: "/admin/channel-requirements", label: "Channel Requirements", icon: MonitorPlay },
  { href: "/admin/platform-rules", label: "Platform Rules", icon: ShieldCheck },
  { href: "/admin/geo-rules", label: "Geographic Rules", icon: MapPin },
  { href: "/admin/certifications", label: "Certifications", icon: ShieldAlert },
  { href: "/admin/proposed-changes", label: "Proposed Changes", icon: GitPullRequest },
  { href: "/admin/scan-sources", label: "Scan Sources", icon: Radar },
  { href: "/admin/prohibitions", label: "Prohibitions", icon: Ban },
  { href: "/admin/ai-training", label: "AI Training", icon: BrainCircuit },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/403");

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-700">
          <Link href="/admin" className="flex items-center gap-3">
            <div className="bg-white rounded-md px-1.5 py-1 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="AUX" className="h-6 w-auto" />
            </div>
            <p className="text-xs text-slate-400 leading-none">Admin Portal</p>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          <AdminNav />
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-700 px-4 py-3">
          <p className="text-xs font-medium text-slate-300 truncate">{session.user.name}</p>
          <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="mt-2 w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 px-0"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

// Client component for active nav highlighting would require "use client"
// Instead we use a server component with a simpler approach — no active highlighting
// (Active state is handled via CSS or can be added with a client nav component later)
function AdminNav() {
  return (
    <ul className="space-y-0.5 px-2">
      {navItems.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
