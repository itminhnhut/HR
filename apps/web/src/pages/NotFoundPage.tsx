import { NotFoundView } from '../site/NotFoundView';
import { ButtonLink } from '../ui/Button';

export function NotFoundPage() {
  return (
    <NotFoundView
      crumbs={[{ label: 'Không tìm thấy trang' }]}
      title="Không tìm thấy trang này"
      intro="Link có thể đã cũ hoặc gõ nhầm. Thử một trong các trang dưới đây."
      actions={
        <ButtonLink to="/" variant="brand" size="lg" icon="briefcase">
          Xem vị trí đang mở
        </ButtonLink>
      }
    />
  );
}

export default NotFoundPage;
