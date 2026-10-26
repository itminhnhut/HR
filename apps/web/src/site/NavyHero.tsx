import { SiteHeader } from './SiteHeader';

/** Waves at the bottom of navy heroes. Decorative only. */
export function Waves({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 360"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 size-full ${className}`}
    >
      <path
        d="M0 330 C 260 270, 520 390, 780 320 S 1240 260, 1440 300"
        fill="none"
        stroke="#C5CFDC"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      <path
        d="M0 352 C 280 292, 540 412, 800 342 S 1260 282, 1440 322"
        fill="none"
        stroke="#C5CFDC"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Navy band with the site header, two soft colour glows and the waves. Page heroes render inside it. */
export function NavyHero({
  children,
  waves = true,
  className = '',
}: {
  children?: React.ReactNode;
  waves?: boolean;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden bg-navy text-white ${className}`}>
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute inset-0" />
      {waves && <Waves />}
      <SiteHeader />
      {children}
    </section>
  );
}
