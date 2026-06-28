import Link from "next/link";
import { Building2 } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

export function PublicNav() {
  return (
    <header className="absolute left-0 right-0 top-0 z-20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/landing" className="flex min-h-11 items-center gap-3 text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white/95 text-emerald-800">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold">Dubai Property Match</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/calculator" className="hidden text-sm font-medium text-white underline sm:inline">ROI calculator</Link>
          <Link href="/login" className={buttonClassName("secondary", "sm", "bg-white/95")}>Agent login</Link>
        </nav>
      </div>
    </header>
  );
}
