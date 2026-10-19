import Link from "next/link";
import { Container } from "@/components/ui/layout";
import { LEGAL_DOCS } from "@/config/legal";
import { getSettings } from "@/server/settings";

export async function SiteFooter() {
  const s = await getSettings();
  const a = s.contact.address;
  const year = new Date().getFullYear();
  const columns = [
    {
      title: "Services",
      links: [
        { href: "/registered-agent", label: "Registered Agent" },
        { href: "/start-an-llc-texas", label: "Start a Texas LLC" },
        { href: "/texas-registered-agent", label: "Texas Registered Agent" },
        { href: "/texas-llc", label: "Texas LLC Guide" },
        { href: "/business-address", label: "Business Address" },
        { href: "/pricing", label: "Pricing" },
        { href: "/registered-agent/states", label: "Coverage by State" },
      ],
    },
    {
      title: "Company",
      links: [
        { href: "/about", label: "About" },
        { href: "/how-it-works", label: "How It Works" },
        { href: "/faq", label: "FAQ" },
        { href: "/guides", label: "Guides" },
        { href: "/contact", label: "Contact" },
      ],
    },
    {
      title: "Legal",
      links: LEGAL_DOCS.map((d) => ({ href: `/legal/${d.slug}`, label: d.shortTitle })),
    },
  ];

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <Container className="py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="font-serif text-lg font-semibold">{s.brand.name}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.brand.tagline}</p>
            <div className="mt-4 space-y-1 text-sm text-muted">
              <p>
                <a className="hover:text-ink" href={`mailto:${s.contact.supportEmail}`}>
                  {s.contact.supportEmail}
                </a>
              </p>
              {s.contact.supportPhone ? (
                <p>
                  <a className="hover:text-ink" href={`tel:${s.contact.supportPhone.replace(/[^\d+]/g, "")}`}>
                    {s.contact.supportPhone}
                  </a>
                </p>
              ) : null}
              <p>{s.contact.supportHours}</p>
            </div>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-sm font-semibold text-ink">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 space-y-3 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          <p>
            {s.brand.name} is not a law firm and does not provide legal, tax, or accounting advice. Using this website or our
            services does not create an attorney–client relationship. For advice about your specific situation, consult a
            licensed attorney or tax professional.
          </p>
          <p>
            © {year} {s.brand.legalName}
            {a.line1 ? ` · ${[a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`].filter(Boolean).join(", ")}` : ""}
          </p>
        </div>
      </Container>
    </footer>
  );
}
