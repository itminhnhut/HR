import { foldVietnamese } from './format.js';
import { OFFICE } from './job-template.js';

/** Where a job is, split for schema.org PostalAddress (Google for Jobs ranks mainly on this). */
export interface JobLocation {
  /** Street (and ward) when the address names one. */
  street: string | null;
  /** District (quận/huyện) or town: PostalAddress.addressLocality. */
  district: string | null;
  /** City or province: PostalAddress.addressRegion. */
  city: string | null;
}

/** Cities HR is likely to type, with the spellings people use (matched without accents). */
const CITIES: { name: string; short: string; aliases: string[] }[] = [
  { name: 'TP. Hồ Chí Minh', short: 'TP. HCM', aliases: ['ho chi minh', 'hcm', 'sai gon', 'saigon'] },
  { name: 'Hà Nội', short: 'Hà Nội', aliases: ['ha noi', 'hanoi'] },
  { name: 'Đà Nẵng', short: 'Đà Nẵng', aliases: ['da nang'] },
  { name: 'Hải Phòng', short: 'Hải Phòng', aliases: ['hai phong'] },
  { name: 'Cần Thơ', short: 'Cần Thơ', aliases: ['can tho'] },
  { name: 'Bình Dương', short: 'Bình Dương', aliases: ['binh duong'] },
  { name: 'Đồng Nai', short: 'Đồng Nai', aliases: ['dong nai'] },
];

/** A trailing ", Việt Nam" says nothing about the city. */
const COUNTRY = /^(viet ?nam|vn)$/;
/** A note in brackets: "(tầng 3)", "(Phường An Nhơn thuộc quận Gò Vấp cũ)". */
const NOTE = /\(([^)]*)\)/g;
/** "quận Gò Vấp cũ" in a note: the district the place belonged to before the 2025 merger of wards. */
const OLD_DISTRICT = /(quận|huyện|thị xã|thành phố|tp\.?)\s+(.+?)\s+cũ(?!\p{L})/iu;
/** TopCV writes the city first: "Hồ Chí Minh: 110/20/2 Đường Số 30, …". No digits or commas before the colon. */
const CITY_PREFIX = /^([^:,\d]{2,40}):\s*(.*)$/u;
/** "Địa chỉ: …" is a label, not a city: dropped. */
const LABEL = /^(dia chi|noi lam viec|dia diem|van phong|address|location)\b/;
/** A part that starts with a house number is a street, never a district. */
const STREET = /^\d/;

const knownCity = (part: string) => {
  const folded = foldVietnamese(part);
  return CITIES.find((city) => city.aliases.some((alias) => folded.includes(alias))) ?? null;
};
const cityName = (part: string) => knownCity(part)?.name ?? part;

/** "Gò Vấp" from "… thuộc quận Gò Vấp cũ"; "Quận 1" from "quận 1 cũ" (a bare number names nothing). */
function oldDistrict(notes: string[]): string | null {
  for (const note of notes) {
    const match = OLD_DISTRICT.exec(note);
    const name = match?.[2]?.trim();
    if (match && name) return /^\d+$/.test(name) ? `Quận ${name}` : name;
  }
  return null;
}

interface CleanAddress {
  /** Comma parts without notes, empty parts or the country. */
  parts: string[];
  notes: string[];
  /** From a "City:" prefix. */
  prefixCity: string | null;
}

function cleanAddress(address: string): CleanAddress {
  const firstLine = address.split('\n').find((line) => line.trim()) ?? '';
  const notes = [...firstLine.matchAll(NOTE)].map((match) => match[1] ?? '');
  const withoutNotes = firstLine.replace(NOTE, ' ').trim();
  const prefix = CITY_PREFIX.exec(withoutNotes);
  const rest = prefix ? (prefix[2] ?? '') : withoutNotes;
  const parts = rest
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part && !COUNTRY.test(foldVietnamese(part)));
  const label = (prefix?.[1] ?? '').trim();
  return { parts, notes, prefixCity: label && !LABEL.test(foldVietnamese(label)) ? cityName(label) : null };
}

/** The parts before the city, small to large: the last one the district, unless a note names it. */
function streetAndDistrict(parts: string[], noted: string | null): Pick<JobLocation, 'street' | 'district'> {
  if (noted) {
    const street = parts.filter((part, i) => i < parts.length - 1 || foldVietnamese(part) !== foldVietnamese(noted));
    return { street: street.join(', ') || null, district: noted };
  }
  const last = parts[parts.length - 1];
  if (last === undefined) return { street: null, district: null };
  if (parts.length === 1 && STREET.test(last)) return { street: last, district: null };
  return { street: parts.slice(0, -1).join(', ') || null, district: last };
}

/**
 * Reads the job's free-text address. Usually written from small to large ("12 Bạch Đằng, Hải Châu, Đà Nẵng"):
 * last part the city, the part before it the district, anything earlier the street. TopCV style
 * ("Hồ Chí Minh: 110/20/2 Đường Số 30, Phường An Nhơn (… thuộc quận Gò Vấp cũ)") names the city first and the
 * old district in a note; notes never reach the street. No address: the company office.
 */
export function jobLocation(address: string | null): JobLocation {
  const { parts, notes, prefixCity } = cleanAddress(address ?? '');
  const noted = oldDistrict(notes);
  if (parts.length === 0 && !prefixCity) return { street: null, district: OFFICE.district, city: OFFICE.city };
  if (prefixCity) {
    const last = parts[parts.length - 1];
    const before = last !== undefined && knownCity(last) ? parts.slice(0, -1) : parts;
    return { ...streetAndDistrict(before, noted), city: prefixCity };
  }
  const last = parts[parts.length - 1] ?? '';
  return { ...streetAndDistrict(parts.slice(0, -1), noted), city: cityName(last) };
}

/** "TP. Hồ Chí Minh" → "TP. HCM" for cards; other cities are short already. */
const shortCity = (city: string) => CITIES.find((known) => known.name === city)?.short ?? city;

/**
 * Short place for cards: the office, "district, city" when the address names both ("Gò Vấp, TP. HCM" for a
 * long TopCV address), or the address as HR typed it.
 */
export function placeLabel(address: string | null): string {
  const typed = address?.trim();
  if (!typed) return OFFICE.label;
  const place = jobLocation(typed);
  return place.district && place.city ? `${place.district}, ${shortCity(place.city)}` : typed;
}
