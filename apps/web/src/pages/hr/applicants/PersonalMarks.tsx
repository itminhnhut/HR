import { ageOf, todayInVietnam, type CvGender } from '@careers/shared';
import { Icon } from '../../../ui/icons';

const GENDER = {
  male: { word: 'Nam', icon: 'mars', tone: 'text-blue-700' },
  female: { word: 'Nữ', icon: 'venus', tone: 'text-rose-700' },
} as const;

/** Gender and age as the CV writes them, each with its icon and word; nothing at all when the CV says neither. */
export function PersonalMarks({ gender, birth }: { gender: CvGender | null; birth: string | null }) {
  if (!gender && !birth) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-medium text-body">
      {gender && (
        <span className={`inline-flex items-center gap-0.5 ${GENDER[gender].tone}`}>
          <Icon name={GENDER[gender].icon} size={13} />
          {GENDER[gender].word}
        </span>
      )}
      {birth && (
        <span className="inline-flex items-center gap-0.5">
          <Icon name="cake" size={13} className="text-amber-700" />
          {ageOf(birth, todayInVietnam())} tuổi
        </span>
      )}
    </span>
  );
}
