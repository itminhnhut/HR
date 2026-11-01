import type { JobSection } from '@careers/shared';
import type { ReactNode } from 'react';
import { COLOR_CLASSES } from '../../lib/colors';
import { Icon } from '../../ui/icons';
import { groupHeadingParts } from './groupHeading';
import { requirementLook, type ItemLook } from './itemIcons';

/**
 * "Mô tả công việc", "Yêu cầu" and "Ưu tiên" as HR grouped them (JobSection): each group its own card, its
 * heading on top, so a long job reads as a few short blocks. A field without headings is one card, as before.
 */

/** A coloured round badge with the line's own icon (see itemIcons). */
export function ItemBadge({ look, small }: { look: ItemLook; small?: boolean }) {
  const tone = COLOR_CLASSES[look.color];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center border ${tone.soft} ${tone.line} ${tone.text} ${
        small ? 'size-7 rounded-lg' : 'size-9 rounded-[10px]'
      }`}
    >
      <Icon name={look.icon} size={small ? 15 : 18} stroke={1.9} />
    </span>
  );
}

/** The group's heading: its number ("1. …") in a navy chip, otherwise an accent bar, then the title. */
function GroupHeading({ title, line, hasItems }: { title: string; line: string; hasItems: boolean }) {
  const { number, text } = groupHeadingParts(title);
  return (
    <h3
      className={`m-0 flex items-start gap-3 px-5 pt-4 text-base font-semibold leading-snug text-navy sm:px-6 ${
        hasItems ? `border-b pb-3.5 ${line}` : 'pb-4'
      }`}
    >
      {number ? (
        <span
          aria-hidden="true"
          className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-navy px-2 text-[13px] font-semibold tabular-nums text-white"
        >
          {number}
        </span>
      ) : (
        <span aria-hidden="true" className="mt-0.5 h-5 w-1 shrink-0 rounded-full bg-accent" />
      )}
      <span className={number ? 'pt-[3px]' : ''}>{text}</span>
    </h3>
  );
}

interface GroupsProps {
  sections: JobSection[];
  /** Card look: border and background classes, and the heading's divider colour. */
  card: string;
  line: string;
  children: (items: string[], group: number) => ReactNode;
}

function Groups({ sections, card, line, children }: GroupsProps) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((section, group) => (
        // Index keys: two groups may share a title, and the list never reorders.
        <div key={group} className={`overflow-hidden rounded-card border ${card}`}>
          {section.title != null && (
            <GroupHeading title={section.title} line={line} hasItems={section.items.length > 0} />
          )}
          {section.items.length > 0 && children(section.items, group)}
        </div>
      ))}
    </div>
  );
}

/** "Mô tả công việc": numbered tasks, so the job reads as a to-do list; numbering restarts in every group. */
export function TaskList({ sections }: { sections: JobSection[] }) {
  return (
    <Groups sections={sections} card="border-line bg-white" line="border-line-soft">
      {(items) => (
        <ol className="m-0 list-none divide-y divide-line-soft p-0">
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-4 px-5 py-4 sm:px-6">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-control bg-tint text-[13px] font-semibold tabular-nums text-accent"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="pt-1 text-[15px] leading-relaxed text-body">{t}</span>
            </li>
          ))}
        </ol>
      )}
    </Groups>
  );
}

/**
 * "Yêu cầu" (must-haves: each line with an icon and colour for its topic: experience, degree, languages…) or
 * "Ưu tiên (không bắt buộc)" (nice-to-haves: stars on a soft amber card), so candidates tell at a glance what is
 * required and what is only a plus.
 */
export function CheckList({ sections, variant }: { sections: JobSection[]; variant: 'required' | 'preferred' }) {
  const preferred = variant === 'preferred';
  return (
    <Groups
      sections={sections}
      card={preferred ? 'border-cat-amber-line bg-cat-amber-soft' : 'border-line bg-white'}
      line={preferred ? 'border-cat-amber-line' : 'border-line-soft'}
    >
      {(items) => (
        <ul className={`m-0 grid list-none gap-x-8 gap-y-3.5 p-5 sm:p-6 ${items.length > 3 ? 'md:grid-cols-2' : ''}`}>
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-body">
              {preferred ? (
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white text-cat-amber"
                >
                  <Icon name="star" size={13} stroke={2.2} />
                </span>
              ) : (
                <ItemBadge look={requirementLook(t)} />
              )}
              <span className={preferred ? '' : 'pt-1.5'}>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </Groups>
  );
}
