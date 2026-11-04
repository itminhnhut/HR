/**
 * The admin's colour families (no purple): one word per family, so a screen says "orange" and every part of it matches.
 * Text and white-on-solid pairs reach 4.5:1 on their own backgrounds. What each one is for: spec-admin-design.md.
 */
export type Tone = 'blue' | 'sky' | 'teal' | 'green' | 'amber' | 'orange' | 'rose' | 'red' | 'slate';

export interface ToneClasses {
  /** The square behind an icon. */
  tile: string;
  /** A coloured word or icon on white. */
  text: string;
  /** A small pill. */
  pill: string;
  /** A filled badge, white text. */
  solid: string;
  /** The underline of the active tab. */
  underline: string;
  /** A row of a chart or a progress bar. */
  bar: string;
  /** An icon button or a nav item on hover. */
  hover: string;
}

export const TONE: Record<Tone, ToneClasses> = {
  blue: {
    tile: 'bg-blue-100 text-blue-700',
    text: 'text-blue-700',
    pill: 'border-blue-200 bg-blue-50 text-blue-700',
    solid: 'bg-blue-600 text-white',
    underline: 'border-blue-600',
    bar: 'bg-blue-500',
    hover: 'hover:bg-blue-50 hover:text-blue-700',
  },
  sky: {
    tile: 'bg-sky-100 text-sky-700',
    text: 'text-sky-700',
    pill: 'border-sky-200 bg-sky-50 text-sky-700',
    solid: 'bg-sky-700 text-white',
    underline: 'border-sky-600',
    bar: 'bg-sky-500',
    hover: 'hover:bg-sky-50 hover:text-sky-700',
  },
  teal: {
    tile: 'bg-teal-100 text-teal-700',
    text: 'text-teal-700',
    pill: 'border-teal-200 bg-teal-50 text-teal-700',
    solid: 'bg-teal-700 text-white',
    underline: 'border-teal-600',
    bar: 'bg-teal-500',
    hover: 'hover:bg-teal-50 hover:text-teal-700',
  },
  green: {
    tile: 'bg-green-100 text-green-800',
    text: 'text-green-700',
    pill: 'border-green-200 bg-green-50 text-green-700',
    solid: 'bg-green-700 text-white',
    underline: 'border-green-600',
    bar: 'bg-green-500',
    hover: 'hover:bg-green-50 hover:text-green-700',
  },
  amber: {
    tile: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
    pill: 'border-amber-200 bg-amber-50 text-amber-700',
    solid: 'bg-amber-700 text-white',
    underline: 'border-amber-500',
    bar: 'bg-amber-500',
    hover: 'hover:bg-amber-50 hover:text-amber-700',
  },
  orange: {
    tile: 'bg-orange-100 text-orange-700',
    text: 'text-orange-700',
    pill: 'border-orange-200 bg-orange-50 text-orange-700',
    solid: 'bg-orange-700 text-white',
    underline: 'border-orange-600',
    bar: 'bg-orange-500',
    hover: 'hover:bg-orange-50 hover:text-orange-700',
  },
  rose: {
    tile: 'bg-rose-100 text-rose-700',
    text: 'text-rose-700',
    pill: 'border-rose-200 bg-rose-50 text-rose-700',
    solid: 'bg-rose-600 text-white',
    underline: 'border-rose-600',
    bar: 'bg-rose-500',
    hover: 'hover:bg-rose-50 hover:text-rose-700',
  },
  red: {
    tile: 'bg-red-100 text-red-700',
    text: 'text-red-700',
    pill: 'border-red-200 bg-red-50 text-red-700',
    solid: 'bg-red-600 text-white',
    underline: 'border-red-600',
    bar: 'bg-red-500',
    hover: 'hover:bg-red-50 hover:text-red-700',
  },
  slate: {
    tile: 'bg-slate-200 text-slate-700',
    text: 'text-slate-600',
    pill: 'border-slate-200 bg-slate-100 text-slate-700',
    solid: 'bg-slate-600 text-white',
    underline: 'border-slate-600',
    bar: 'bg-slate-400',
    hover: 'hover:bg-slate-100 hover:text-slate-800',
  },
};
