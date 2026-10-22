import { Link } from "@/i18n/navigation";

/**
 * Home hero: a dark alpine panel with an inline SVG skyline (no image download). Fixed colours, so the
 * white text keeps its contrast in light and dark themes alike.
 */
export function Hero({
  title,
  subtitle,
  primary,
  secondary,
}: {
  title: string;
  subtitle: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#0b3a6e_0%,#0e1f33_55%,#0e1620_100%)] px-6 pt-10 pb-36 text-white shadow-card sm:px-10 sm:pt-14 sm:pb-44">
      <div className="relative z-10 max-w-2xl space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {title}
        </h1>
        <p className="text-lg text-white/85">{subtitle}</p>
        <p className="flex flex-wrap gap-3 pt-2">
          <Link
            href={primary.href}
            className="rounded-full bg-white px-5 py-2.5 font-semibold text-[#0e1620] hover:bg-white/90"
          >
            {primary.label}
          </Link>
          <Link
            href={secondary.href}
            className="rounded-full border border-white/50 px-5 py-2.5 font-semibold text-white hover:bg-white/10"
          >
            {secondary.label}
          </Link>
        </p>
      </div>
      <svg
        viewBox="0 0 1200 220"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-32 w-full sm:h-40"
      >
        <polygon
          points="0,220 0,150 140,70 230,130 360,30 470,120 560,80 700,160 820,50 930,120 1040,70 1200,150 1200,220"
          fill="#3b5a78"
          opacity="0.55"
        />
        <polygon
          points="360,30 395,62 380,58 368,72 352,60 338,64"
          fill="#f4f8fb"
          opacity="0.8"
        />
        <polygon
          points="820,50 850,78 836,74 822,88 808,76 796,80"
          fill="#f4f8fb"
          opacity="0.8"
        />
        <polygon
          points="0,220 0,190 180,120 300,175 450,100 600,180 760,110 900,170 1060,120 1200,180 1200,220"
          fill="#1d3550"
        />
        <polygon
          points="450,100 480,125 466,122 452,134 438,124 426,127"
          fill="#f4f8fb"
        />
        <polygon
          points="760,110 788,133 775,130 762,141 749,132 737,134"
          fill="#f4f8fb"
        />
      </svg>
    </section>
  );
}
