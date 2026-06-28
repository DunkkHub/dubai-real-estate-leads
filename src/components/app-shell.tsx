import Link from "next/link";
import {
  BarChart3,
  ClipboardList,
  FileUp,
  Gauge,
  Home,
  KeyRound,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/opportunities", label: "Opportunities", icon: ClipboardList },
  { href: "/outreach", label: "Outreach", icon: Megaphone },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/imports", label: "Imports", icon: FileUp },
  { href: "/sources", label: "Sources", icon: KeyRound },
  { href: "/settings/compliance", label: "Compliance", icon: ShieldCheck },
];

export function AppShell({ children, userName }: { children: React.ReactNode; userName?: string | null }) {
  return (
    <div className="min-h-dvh bg-stone-100">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex min-h-11 items-center gap-3 text-stone-950">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-700 text-white">
              <Gauge className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Dubai Lead CRM</span>
              <span className="block text-xs text-stone-500">Consent-first pipeline</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/landing" className="hidden text-sm font-medium text-stone-600 underline hover:text-stone-950 sm:inline">
              Public form
            </Link>
            <span className="hidden text-sm text-stone-500 md:inline">{userName}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)]">
          <nav className="grid gap-1 rounded-lg border border-stone-200 bg-white p-2 shadow-sm lg:block">
            <Link
              href="/landing"
              className="mb-1 flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 lg:hidden"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Public pages
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 hover:text-stone-950"
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
