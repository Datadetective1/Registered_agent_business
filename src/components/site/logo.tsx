import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  name,
  monogram,
  logoUrl,
  href = "/",
  className,
}: {
  name: string;
  monogram: string;
  logoUrl?: string;
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 text-ink", className)} aria-label={`${name} home`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={name} className="h-8 w-auto" />
      ) : (
        <>
          <span
            aria-hidden
            className="inline-flex size-8 items-center justify-center rounded-md bg-brand font-serif text-sm font-semibold tracking-wide text-white"
          >
            {monogram.slice(0, 3)}
          </span>
          <span className="font-serif text-lg font-semibold tracking-tight">{name}</span>
        </>
      )}
    </Link>
  );
}
