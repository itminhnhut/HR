import logoCompact from '../assets/logo/top-flow-logo-compact.svg';
import logoLight from '../assets/logo/top-flow-logo-light.svg';
import logo from '../assets/logo/top-flow-logo.svg';

/**
 * The company's logo, as a vector with a clear background: waves, tagline and name. `onDark` is the reversed version for
 * navy and blue surfaces: a white name and lighter waves, since the dark wave and the red name would fade. `isCompact`
 * leaves out the tagline, for places where it would be too small to read.
 */
export function Logo({
  className = 'h-9',
  onDark = false,
  isCompact = false,
}: {
  className?: string;
  onDark?: boolean;
  isCompact?: boolean;
}) {
  const src = isCompact ? logoCompact : onDark ? logoLight : logo;
  const height = isCompact ? 180 : 212;
  return <img src={src} alt="TOP FLOW" width={1361} height={height} className={`block w-auto ${className}`} />;
}
