import type { ReactNode } from 'react';
import type { IconName } from '../../../ui/icons';
import { SectionTitle } from '../design/SectionTitle';
import type { Tone } from '../design/tone';

export function Panel({
  title,
  icon,
  tone,
  action,
  children,
}: {
  title: string;
  icon: IconName;
  tone: Tone;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0">
          <SectionTitle icon={icon} tone={tone}>
            {title}
          </SectionTitle>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
