import { TEMPLATE_KEYS, TEMPLATE_LABEL, type TemplateKey } from '@careers/shared';
import { useState } from 'react';
import { useMessageTemplates } from '../../api/queries';
import { usePageMeta } from '../../lib/hooks';
import { ErrorState, LoadingStatus, Sk, useDelayedFlag } from '../../ui/feedback';
import { TemplateEditor } from './mail/TemplateEditor';
import type { IconName } from '../../ui/icons';
import type { Tone } from './design/tone';
import { apiMessage, FilterTabs, PageHeading, type TabItem } from './parts';

const TEMPLATE_LOOK: Record<TemplateKey, { icon: IconName; tone: Tone }> = {
  interview_onsite: { icon: 'calendar', tone: 'orange' },
  interview_online: { icon: 'video', tone: 'sky' },
  rejection: { icon: 'xCircle', tone: 'rose' },
  rejection_interview: { icon: 'mail', tone: 'slate' },
  call: { icon: 'phone', tone: 'green' },
  payslip: { icon: 'mail', tone: 'sky' },
};

export function HrMessagesPage() {
  usePageMeta('Mẫu thư');
  const query = useMessageTemplates();
  const showSkeleton = useDelayedFlag(query.isPending);
  const [tab, setTab] = useState<TemplateKey>(TEMPLATE_KEYS[0]);
  const tabs: TabItem<TemplateKey>[] = TEMPLATE_KEYS.map((key) => ({
    key,
    label: TEMPLATE_LABEL[key],
    ...TEMPLATE_LOOK[key],
  }));
  const template = query.data?.templates.find((t) => t.key === tab);

  return (
    <>
      <PageHeading
        title="Mẫu thư"
        titleHiddenOnPhone
        subtitle="Thư HR gửi cho ứng viên: dán vào Outlook, mở bằng Gmail hoặc dán vào Zalo. Mọi HR dùng chung các mẫu này."
      />
      <FilterTabs items={tabs} value={tab} onChange={setTab} label="Chọn mẫu thư" className="border-b border-line" />
      {query.isPending && (
        <>
          <LoadingStatus />
          {showSkeleton && <Sk w="100%" h={420} />}
        </>
      )}
      {query.isError && <ErrorState onRetry={() => query.refetch()} message={apiMessage(query.error)} />}
      {template && (
        <TemplateEditor
          key={template.key}
          template={template}
          customized={query.data?.customized.includes(template.key) ?? false}
        />
      )}
    </>
  );
}

export default HrMessagesPage;
