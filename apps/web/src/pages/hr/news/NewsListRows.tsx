import { newsPath, type HrNewsRowDto } from '@careers/shared';
import { Link } from 'react-router';
import { Icon } from '../../../ui/icons';
import { CategoryName, formatDateTime } from './parts';
import { RowStatus, type RowNotice } from './RowStatus';

/** Row callbacks: delete (asks first), the status picker's messages, and ticking drafts for bulk delete. */
export interface RowHandlers {
  onDelete: (row: HrNewsRowDto) => void;
  onNotice: (notice: RowNotice | null) => void;
  selected: ReadonlySet<string>;
  onSelect: (id: string, on: boolean) => void;
}

const untitled = (row: HrNewsRowDto) => row.title || 'chưa có tiêu đề';

const iconLink =
  'inline-flex size-11 items-center justify-center rounded-control border-0 bg-transparent text-body transition-colors hover:bg-tint hover:text-navy lg:size-10';

/** Phones: words next to the icons, and delete set apart on the right so it is not tapped by mistake. */
const labeled =
  'inline-flex min-h-11 items-center gap-1.5 rounded-control border-0 bg-transparent px-2.5 text-sm text-navy no-underline hover:bg-tint';

function RowActionsPhone({ row, onDelete }: { row: HrNewsRowDto; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <Link to={`/hr/tin-tuc/${row.id}`} className={labeled}>
        <Icon name="pencil" size={16} stroke={1.5} />
        Sửa
      </Link>
      {row.status === 'published' && (
        <a href={newsPath(row.slug)} target="_blank" rel="noopener" className={labeled}>
          <Icon name="external" size={16} stroke={1.5} />
          Xem trên trang
        </a>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Xoá bài ${untitled(row)}`}
        className={`${labeled} ml-auto text-error hover:bg-error-soft`}
      >
        <Icon name="trash" size={16} stroke={1.5} />
        Xoá
      </button>
    </div>
  );
}

function RowActions({ row, onDelete }: { row: HrNewsRowDto; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-0.5 lg:justify-end">
      <Link to={`/hr/tin-tuc/${row.id}`} aria-label={`Sửa bài ${untitled(row)}`} title="Sửa bài" className={iconLink}>
        <Icon name="pencil" size={17} stroke={1.5} />
      </Link>
      {row.status === 'published' && (
        <a
          href={newsPath(row.slug)}
          target="_blank"
          rel="noopener"
          aria-label={`Xem bài ${row.title} trên trang (mở thẻ mới)`}
          title="Xem trên trang"
          className={iconLink}
        >
          <Icon name="external" size={17} stroke={1.5} />
        </a>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Xoá bài ${untitled(row)}`}
        title="Xoá bài"
        className={`${iconLink} hover:bg-error-soft hover:text-error`}
      >
        <Icon name="trash" size={17} stroke={1.5} />
      </button>
    </div>
  );
}

/** The cover, small (4:3), or a grey box when the post has none yet. Decorative: the title is next to it. */
function Thumb({ row }: { row: HrNewsRowDto }) {
  const box = 'h-12 w-16 shrink-0 rounded-control border border-line';
  if (!row.cover) {
    return (
      <span aria-hidden="true" className={`${box} flex items-center justify-center bg-tint text-muted`}>
        <Icon name="newspaper" size={18} />
      </span>
    );
  }
  return <img src={row.cover.url} alt="" loading="lazy" decoding="async" className={`${box} bg-line object-cover`} />;
}

/** Drafts only: published and hidden posts are deleted one at a time, after reading what it will do. */
function SelectBox({ row, selected, onSelect }: { row: HrNewsRowDto } & Pick<RowHandlers, 'selected' | 'onSelect'>) {
  if (row.status !== 'draft') return <span className="inline-block size-11" />;
  return (
    <label className="inline-flex size-11 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        checked={selected.has(row.id)}
        onChange={(e) => onSelect(row.id, e.target.checked)}
        aria-label={`Chọn bài ${row.title || 'Chưa có tiêu đề'}`}
        className="size-[18px] accent-accent"
      />
    </label>
  );
}

function TitleLink({ row }: { row: HrNewsRowDto }) {
  return (
    <Link to={`/hr/tin-tuc/${row.id}`} className="text-[15px] font-semibold text-navy no-underline hover:underline">
      {row.title || <span className="font-normal italic text-muted">Chưa có tiêu đề</span>}
    </Link>
  );
}

const th = 'border-b border-line-soft px-4 py-3.5 text-left text-xs font-medium text-muted';
const td = 'border-b border-line-soft px-4 py-3 align-middle';

const HEADERS: [label: string, width: string, extra?: string][] = [
  ['Chọn', 'w-[60px]', 'pl-[14px] pr-0'],
  ['Tiêu đề', 'w-[36%]'],
  ['Trạng thái', 'w-[15%]'],
  ['Chuyên mục', 'w-[15%]'],
  ['Ngày sửa', 'w-[14%]'],
  ['Người sửa', 'w-[12%]'],
  ['Thao tác', 'w-[132px]', 'pr-[22px] text-right'],
];

export function NewsTable({ rows, onDelete, onNotice, selected, onSelect }: { rows: HrNewsRowDto[] } & RowHandlers) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          {HEADERS.map(([label, width]) => (
            <col key={label} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {HEADERS.map(([label, , extra]) => (
              <th key={label} scope="col" className={`${th} ${extra ?? ''}`}>
                {label === 'Chọn' ? <span className="sr-only">Chọn bản nháp</span> : label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition-colors hover:bg-hover">
              <td className={`${td} pl-[14px] pr-0`}>
                <SelectBox row={row} selected={selected} onSelect={onSelect} />
              </td>
              <td className={td}>
                <span className="flex items-center gap-3">
                  <Thumb row={row} />
                  <TitleLink row={row} />
                </span>
              </td>
              <td className={td}>
                <RowStatus row={row} onNotice={onNotice} />
              </td>
              <td className={`${td} text-body`}>
                <CategoryName name={row.categoryName} />
              </td>
              <td className={`${td} whitespace-nowrap text-body`}>{formatDateTime(row.updatedAt)}</td>
              <td className={`${td} truncate text-body`} title={row.updatedBy ?? undefined}>
                {row.updatedBy ?? '—'}
              </td>
              <td className={`${td} py-2 pr-[22px]`}>
                <RowActions row={row} onDelete={() => onDelete(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NewsCards({ rows, onDelete, onNotice, selected, onSelect }: { rows: HrNewsRowDto[] } & RowHandlers) {
  return (
    <ul className="m-0 list-none p-0 lg:hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex gap-3 border-b border-line-soft px-4 pb-1.5 pt-4 sm:px-5">
          <Thumb row={row} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <TitleLink row={row} />
              <RowStatus row={row} onNotice={onNotice} />
            </span>
            <span className="text-[13px] text-slate">
              <CategoryName name={row.categoryName} empty="Chưa chọn chuyên mục" /> · Sửa{' '}
              {formatDateTime(row.updatedAt)}
              {row.updatedBy ? ` · ${row.updatedBy}` : ''}
            </span>
            <div className="-mx-2.5 flex items-center">
              {row.status === 'draft' && <SelectBox row={row} selected={selected} onSelect={onSelect} />}
              <div className="flex-1">
                <RowActionsPhone row={row} onDelete={() => onDelete(row)} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
