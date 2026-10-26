import { foldVietnamese } from './format.js';
import { OFFICE } from './job-template.js';

/** Where a job is, split for schema.org PostalAddress (Google for Jobs ranks mainly on this). */
export interface JobLocation {
  /** Only when the address names one before the district. */
  street: string | null;
  /** District (quận/huyện) or town: PostalAddress.addressLocality. */
  district: string | null;
  /** City or province: PostalAddress.addressRegion. */
  city: string | null;
}

/** Cities HR is likely to type, with the spellings people use (matched without accents). */
const CITIES: { name: string; aliases: string[] }[] = [
  { name: 'TP. Hồ Chí Minh', aliases: ['ho chi minh', 'hcm', 'sai gon', 'saigon'] },
  { name: 'Hà Nội', aliases: ['ha noi', 'hanoi'] },
  { name: 'Đà Nẵng', aliases: ['da nang'] },
  { name: 'Hải Phòng', aliases: ['hai phong'] },
  { name: 'Cần Thơ', aliases: ['can tho'] },
  { name: 'Bình Dương', aliases: ['binh duong'] },
  { name: 'Đồng Nai', aliases: ['dong nai'] },
];

/** A trailing ", Việt Nam" says nothing about the city. */
const COUNTRY = /^(viet ?nam|vn)$/;

const knownCity = (part: string): string | null => {
  const folded = foldVietnamese(part);
  return CITIES.find((city) => city.aliases.some((alias) => folded.includes(alias)))?.name ?? null;
};

/**
 * Reads the job's free-text address ("12 Bạch Đằng, Hải Châu, Đà Nẵng"), written from small to large as usual
 * in Vietnam: last part the city, the part before it the district, anything earlier the street.
 * No address: the company office.
 */
export function jobLocation(address: string | null): JobLocation {
  const parts = (address ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !COUNTRY.test(foldVietnamese(part)));
  if (parts.length === 0) return { street: null, district: OFFICE.district, city: OFFICE.city };
  const last = parts[parts.length - 1] ?? '';
  return {
    street: parts.length > 2 ? parts.slice(0, -2).join(', ') : null,
    district: parts.length > 1 ? (parts[parts.length - 2] ?? null) : null,
    city: knownCity(last) ?? last,
  };
}
