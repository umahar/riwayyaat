type AuroraBackgroundProps = {
  className?: string;
  showSheen?: boolean;
};

export function AuroraBackground({
  className = "",
  showSheen = true,
}: AuroraBackgroundProps) {
  return (
    <>
      <div
        className={`absolute inset-0 transition-colors duration-700 ${className}`}
        style={{ backgroundColor: "var(--background)" }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at top, var(--aurora-top), transparent 55%)`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at bottom, var(--aurora-bottom), transparent 60%)`,
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-700">
        <div
          className="absolute -left-32 top-10 h-72 w-72 rotate-6 rounded-full blur-[120px]"
          style={{ backgroundColor: "var(--aurora-blur-one)" }}
        />
        <div
          className="absolute -bottom-20 right-0 h-80 w-80 rounded-full blur-[120px]"
          style={{ backgroundColor: "var(--aurora-blur-two)" }}
        />
      </div>
      {showSheen ? (
        <div
          className="absolute inset-0 animate-sheen transition-opacity duration-700"
          style={{
            background: `linear-gradient(120deg, transparent 0%, var(--sheen) 33%, transparent 66%)`,
          }}
        />
      ) : null}
    </>
  );
}
