import { usePageMeta } from '../lib/hooks';
import { NavyHero } from '../site/PublicLayout';
import { ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/feedback';

export function NotFoundPage() {
  usePageMeta('Không tìm thấy trang');
  return (
    <>
      <NavyHero waves={false} />
      <main className="mx-auto w-full max-w-[1160px] px-5 py-16">
        <EmptyState
          icon="search"
          title="Không tìm thấy trang này"
          actions={
            <ButtonLink to="/" icon="briefcase">
              Xem vị trí đang mở
            </ButtonLink>
          }
        >
          Link có thể đã cũ hoặc gõ nhầm.
        </EmptyState>
      </main>
    </>
  );
}

export default NotFoundPage;
