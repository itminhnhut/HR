const WEEKDAYS: Record<string, string> = {
  Mon: 'THỨ HAI',
  Tue: 'THỨ BA',
  Wed: 'THỨ TƯ',
  Thu: 'THỨ NĂM',
  Fri: 'THỨ SÁU',
  Sat: 'THỨ BẢY',
  Sun: 'CHỦ NHẬT',
};

const VIETNAM_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface InterviewParts {
  weekday: string;
  day: string;
  monthYear: string;
  time: string;
  date: string;
}

/** The pieces of the date tile, always in Vietnam time. Throws RangeError on a string that is not a date. */
export function vietnamInterviewParts(iso: string): InterviewParts {
  const parts = new Map(VIETNAM_PARTS.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? '';
  const monthYear = `${part('month')}/${part('year')}`;
  return {
    weekday: WEEKDAYS[part('weekday')] ?? '',
    day: part('day'),
    monthYear,
    time: `${part('hour')}:${part('minute')}`,
    date: `${part('day')}/${monthYear}`,
  };
}
