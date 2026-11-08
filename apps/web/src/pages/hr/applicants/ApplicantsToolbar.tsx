import { useNavigate } from 'react-router';
import { Button } from '../../../ui/Button';
import { SelectField } from '../shadcn/Select';
import { Icon } from '../../../ui/icons';
import { MenuButton } from '../MenuButton';
import { MenuItem } from '../parts';
import { SourceFilter } from '../sources/SourceFilter';

function SearchBox({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="field-focus relative flex min-h-11 w-full min-w-0 items-center gap-2 rounded-control border border-field bg-white px-3 sm:w-auto sm:min-w-[120px] sm:flex-[2] lg:max-w-[340px]">
      <Icon name="search" size={16} className="shrink-0 text-slate" />
      <span className="sr-only">Tìm hồ sơ</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        placeholder="Tìm tên, SĐT"
        className="w-full min-w-0 flex-1 border-0 bg-transparent text-sm text-navy outline-none placeholder:text-placeholder"
      />
    </label>
  );
}

function JobSelect({
  value,
  jobs,
  onChange,
}: {
  value: string | undefined;
  jobs: { id: string; title: string }[];
  onChange: (id: string | null) => void;
}) {
  return (
    <SelectField
      label="Lọc theo vị trí"
      hideLabel
      className="min-w-[128px] flex-[1_1_0]"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">Tất cả vị trí</option>
      {jobs.map((j) => (
        <option key={j.id} value={j.id}>
          {j.title}
        </option>
      ))}
    </SelectField>
  );
}

function SortToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label
      title="Xếp theo % phù hợp với yêu cầu"
      className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-control border border-field bg-white px-3 text-sm text-body"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[18px] accent-accent"
      />
      Xếp theo %
    </label>
  );
}

export interface ToolbarFilters {
  search: string;
  onSearch: (value: string) => void;
  onSearchCommit: () => void;
  jobId: string | undefined;
  jobs: { id: string; title: string }[];
  onJob: (id: string | null) => void;
  source: string | undefined;
  onSource: (key: string | null) => void;
  byMatch: boolean;
  onByMatch: (checked: boolean) => void;
}

export interface ToolbarActions {
  onAdd: () => void;
  /** Absent while there is nobody to pick, or while already picking. */
  onPickForReview?: () => void;
  onManageSources: () => void;
}

function Actions({ onAdd, onPickForReview, onManageSources }: ToolbarActions) {
  const navigate = useNavigate();
  return (
    <span className="ml-auto flex items-center gap-2">
      {/* No icon where the row is tight: phones, and small laptops with the sidebar. */}
      <Button
        icon="plus"
        size="compact"
        onClick={onAdd}
        className="whitespace-nowrap max-sm:[&>svg]:hidden lg:max-xl:[&>svg]:hidden"
      >
        Thêm hồ sơ
      </Button>
      <MenuButton label="Thêm">
        {(close) => (
          <>
            {onPickForReview && (
              <MenuItem
                onClick={() => {
                  close();
                  onPickForReview();
                }}
              >
                <Icon name="checkSquare" size={16} />
                Gửi sếp duyệt
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                close();
                onManageSources();
              }}
            >
              <Icon name="pencil" size={16} />
              Quản lý nguồn
            </MenuItem>
            <MenuItem
              onClick={() => {
                close();
                navigate('/hr/ho-so/nhat-ky');
              }}
            >
              <Icon name="clock" size={16} />
              Nhật ký tuyển dụng
            </MenuItem>
          </>
        )}
      </MenuButton>
    </span>
  );
}

/** The one row above the list: search and filters, then "Thêm hồ sơ" and the "Thêm" menu. */
export function ApplicantsToolbar({ filters, actions }: { filters: ToolbarFilters; actions: ToolbarActions }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchBox value={filters.search} onChange={filters.onSearch} onCommit={filters.onSearchCommit} />
      <JobSelect value={filters.jobId} jobs={filters.jobs} onChange={filters.onJob} />
      <SourceFilter
        value={filters.source}
        onChange={filters.onSource}
        className="min-w-[120px] flex-[1_1_0] lg:max-w-[170px]"
      />
      <SortToggle checked={filters.byMatch} onChange={filters.onByMatch} />
      <Actions {...actions} />
    </div>
  );
}
