import { Link } from 'react-router';
import { usePageMeta } from '../../lib/hooks';
import { Icon } from '../../ui/icons';
import { RecruitmentLog } from './applicants/RecruitmentLog';

/** "Nhật ký tuyển dụng": a page of its own under Hồ sơ ứng viên (spec-nhat-ky-ho-so.md). */
export function HrRecruitmentLogPage() {
  usePageMeta('Nhật ký tuyển dụng');
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Link
        to="/hr/ho-so"
        className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium text-link lg:min-h-9"
      >
        <Icon name="chevronLeft" size={16} />
        Hồ sơ ứng viên
      </Link>
      <h1 className="m-0 text-xl font-semibold text-navy">Nhật ký tuyển dụng</h1>
      <RecruitmentLog />
    </div>
  );
}

export default HrRecruitmentLogPage;
