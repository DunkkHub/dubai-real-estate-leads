import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  hot: "border-red-200 bg-red-50 text-red-800",
  warm: "border-amber-200 bg-amber-50 text-amber-800",
  cold: "border-sky-200 bg-sky-50 text-sky-800",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  withdrawn: "border-stone-300 bg-stone-100 text-stone-700",
  new: "border-cyan-200 bg-cyan-50 text-cyan-800",
  default: "border-stone-200 bg-stone-50 text-stone-700",
};

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", styles[tone.toLowerCase()] ?? styles.default, className)}>
      {children}
    </span>
  );
}
