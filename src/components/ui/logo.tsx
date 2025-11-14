import Image from "next/image";
import { siteConfig } from "@/content/site";

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  return (
    <div
      className={`inline-flex items-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)] px-4 py-2 text-[var(--text-primary)] backdrop-blur ${className ?? ""}`}
    >
      {siteConfig.logoPath ? (
        <Image
          src={siteConfig.logoPath}
          alt={siteConfig.logoAlt ?? siteConfig.name}
          width={160}
          height={40}
          className="h-9 w-auto object-contain"
          priority
        />
      ) : (
        <span
          className="text-base font-semibold tracking-wide"
          style={{
            color: "var(--accent-contrast)",
          }}
        >
          {siteConfig.shortName}
        </span>
      )}
    </div>
  );
}
