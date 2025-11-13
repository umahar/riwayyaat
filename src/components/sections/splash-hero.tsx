import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { siteConfig } from "@/lib/site";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function SplashHero() {
  return (
    <section className="relative isolate flex min-h-svh max-h-svh flex-col items-center justify-center gap-12 overflow-hidden overflow-y-auto px-6 py-16 text-[var(--text-primary)] scrollbar-hide md:px-12 lg:px-20">
      <AuroraBackground />
      <ThemeToggle className="absolute right-6 top-6 border-[var(--border-soft)]" />
      <Logo className="animate-fade-in-up delay-75" />

      <div className="flex max-w-3xl flex-col items-center text-center">
        <p className="text-sm font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--text-muted)]">
          {siteConfig.tagline} • {siteConfig.byline}
        </p>
        <h1 className="mt-6 text-balance text-4xl font-bold leading-tight tracking-[var(--tracking-tight)] text-[var(--text-primary)] sm:text-5xl">
          {siteConfig.heroHeadline}
        </h1>
        <p className="mt-6 text-lg text-[var(--text-secondary)] sm:text-xl">
          {siteConfig.heroSubcopy}
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href={siteConfig.primaryCta.href}
          className="group inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold shadow-lg shadow-[var(--shadow-panel)] transition hover:bg-[var(--cta-primary-hover)]"
          style={{
            backgroundColor: "var(--cta-primary-bg)",
            color: "var(--cta-primary-text)",
          }}
        >
          {siteConfig.primaryCta.label}
          <span className="ml-2 transition group-hover:translate-x-1">↗</span>
        </Link>
        <Link
          href={siteConfig.secondaryCta.href}
          className="inline-flex items-center justify-center rounded-full border px-8 py-3 text-base font-semibold transition hover:border-[var(--cta-secondary-hover-border)] hover:text-[var(--text-primary)]"
          style={{
            borderColor: "var(--cta-secondary-border)",
            color: "var(--cta-secondary-text)",
          }}
        >
          {siteConfig.secondaryCta.label}
        </Link>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 text-left sm:grid-cols-2">
        <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-6 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--text-muted)]">
            Masters Research Project
          </p>
          <div className="mt-4 space-y-1 text-sm text-[var(--text-secondary)]">
            <p className="text-2xl font-semibold text-[var(--text-primary)]">
              Umair Abdullah
            </p>
            <p>B01007607</p>
            <p>
              <a
                href="mailto:Abdullah-U@ulster.ac.uk"
                className="underline-offset-2 hover:underline"
              >
                Abdullah-U@ulster.ac.uk
              </a>
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-panel)] p-6 shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--text-muted)]">
            Supervised by
          </p>
          <p className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">
            Dr. Marwan M Radwan
          </p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            School of Computing, Ulster University
          </p>
        </div>
      </div>

      <dl className="grid w-full max-w-4xl grid-cols-1 gap-6 text-center text-[var(--text-primary)] sm:grid-cols-3">
        {siteConfig.stats.map((item) => (
          <div
            key={item.label}
            className="rounded-3xl border px-6 py-5 shadow-xl backdrop-blur"
            style={{
              borderColor: "var(--border-soft)",
              backgroundColor: "var(--surface-card)",
              boxShadow: `0 20px 60px -25px var(--shadow-panel)`,
            }}
          >
            <dt className="text-sm uppercase tracking-[0.4em] text-[var(--text-muted)]">
              {item.label}
            </dt>
            <dd className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
