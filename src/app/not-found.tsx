import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh items-center">
      <Container className="max-w-xl py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">404</p>
        <h1 className="mt-3 text-3xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-muted">The page may have moved, or you may not have access to it.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/">Go to homepage</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Contact us
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
