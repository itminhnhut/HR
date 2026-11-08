import { useMutation } from '@tanstack/react-query';
import { api } from '../../../api';
import { zaloLink, type ApplicationDetailDto, type TemplateKey } from '@careers/shared';
import { useState, type ReactNode } from 'react';
import { useApplication } from '../../../api/queries';
import { telLink } from '../../../lib/site';
import { CopyButton } from '../../../ui/CopyButton';
import { ErrorState, LoadingStatus, Notice, Sk, useDelayedFlag } from '../../../ui/feedback';
import { Icon } from '../../../ui/icons';
import { apiMessage, Avatar } from '../parts';
import { ComposeMessage } from './ComposeMessage';
import { TONE } from '../design/tone';
import { CvAction } from './CvAction';
import { DetailFacts } from './DetailFacts';
import { StatusControl } from './StatusControl';

/**
 * `wide`: the panel beside the list, with the contact actions in the header. `sheet`: the phone and tablet sheet, with
 * the contact actions pinned at the bottom.
 */
export type DetailLayout = 'wide' | 'sheet';

const CONTACT_BASE = 'inline-flex items-center justify-center rounded-control font-medium no-underline';
const CONTACT_SIZE: Record<DetailLayout, string> = {
  wide: 'min-h-11 gap-1.5 whitespace-nowrap px-3 text-sm',
  sheet: 'min-h-12 flex-col gap-0.5 px-1 text-center text-[12px] leading-tight',
};

function ContactActions({
  app,
  layout,
  composeRequest,
  onComposeDone,
}: {
  app: ApplicationDetailDto;
  layout: DetailLayout;
  composeRequest: TemplateKey | null;
  onComposeDone: () => void;
}) {
  const shape = `${CONTACT_BASE} ${CONTACT_SIZE[layout]}`;
  // The press is noted in the log; the link still opens the phone's app whether or not that call succeeds.
  const reach = useMutation({ mutationFn: (via: 'call' | 'zalo') => api.hrLogReach(app.id, via) });
  const outline = `${shape} border border-field bg-white text-navy`;
  return (
    <>
      <a
        href={telLink(app.phone)}
        onClick={() => reach.mutate('call')}
        className={`${shape} bg-green-700 font-semibold text-white hover:bg-green-800 hover:text-white`}
      >
        <Icon name="phone" size={16} />
        Gọi
      </a>
      <a
        href={zaloLink(app.phone)}
        onClick={() => reach.mutate('zalo')}
        target="_blank"
        rel="noopener noreferrer"
        className={`${outline} ${TONE.blue.hover}`}
      >
        <Icon name="chat" size={16} className={TONE.blue.text} />
        Zalo
      </a>
      <ComposeMessage
        app={app}
        request={composeRequest}
        onRequestDone={onComposeDone}
        triggerClassName={`${outline} ${TONE.amber.hover} [&_svg]:text-amber-700`}
      />
      <CvAction app={app} shape={`${shape} ${TONE.teal.hover} [&_svg]:text-teal-700`} />
    </>
  );
}

/** Name and position, and the status (with the contact actions on the wide layout). Never scrolls away. */
function DetailHeader({
  app,
  layout,
  children,
}: {
  app: ApplicationDetailDto;
  layout: DetailLayout;
  /** The status control. */
  children: ReactNode;
}) {
  const isWide = layout === 'wide';
  return (
    <header className={`relative z-10 flex-none border-b border-line ${isWide ? 'px-4 py-2.5' : 'px-[18px] pb-2.5'}`}>
      {/* Room on the right for the previous/next (and on the sheet the close) buttons, placed there by the page. */}
      <div className={`flex min-h-11 items-center gap-2.5 ${isWide ? 'pr-[120px]' : 'pr-[160px]'}`}>
        {isWide && <Avatar name={app.fullName} size={40} solid />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-0.5">
            <h2
              title={app.fullName}
              className={`m-0 min-w-0 truncate font-serif font-medium leading-[1.35] ${isWide ? 'text-[20px] xl:text-[22px]' : 'text-[18px]'}`}
            >
              {app.fullName}
            </h2>
            {isWide && <CopyButton text={app.fullName} label="họ tên" className="-my-1 size-8" />}
          </span>
          <span title={app.jobTitle} className="truncate text-[13px] leading-[18px] text-slate">
            {app.jobTitle}
          </span>
        </div>
      </div>
      <div className="mt-1">{children}</div>
    </header>
  );
}

/** One scroller in the detail: the blocks inside are only laid out in columns, nothing scrolls by itself. */
const BODY: Record<DetailLayout, string> = {
  wide: 'min-h-0 flex-1 pane-scroll p-4',
  sheet: 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-[18px] py-3',
};

function DetailBody({
  app,
  layout,
  onDeleted,
}: {
  app: ApplicationDetailDto;
  layout: DetailLayout;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [composeRequest, setComposeRequest] = useState<TemplateKey | null>(null);
  const contact = (
    <ContactActions
      app={app}
      layout={layout}
      composeRequest={composeRequest}
      onComposeDone={() => setComposeRequest(null)}
    />
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DetailHeader app={app} layout={layout}>
        <StatusControl
          app={app}
          onError={setError}
          onCompose={setComposeRequest}
          aside={layout === 'wide' ? contact : undefined}
        />
      </DetailHeader>
      {error && (
        <div className="flex-none px-3 pt-2">
          <Notice tone="error" icon="alert">
            <span role="alert">{error}</span>
          </Notice>
        </div>
      )}
      <div className={BODY[layout]}>
        <DetailFacts app={app} onError={setError} onDeleted={onDeleted} />
      </div>
      {layout === 'sheet' && (
        <footer className="grid flex-none grid-cols-4 gap-1.5 border-t border-line bg-white px-[18px] pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5">
          {contact}
        </footer>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-[18px] p-5">
      <span className="flex flex-col gap-2">
        <Sk w={200} h={22} />
        <Sk w={150} h={13} />
      </span>
      <Sk w="100%" h={44} />
      <Sk w="85%" h={13} />
      <Sk w="100%" h={80} />
    </div>
  );
}

export function ApplicantDetail({
  id,
  layout = 'sheet',
  onDeleted,
}: {
  id: string;
  layout?: DetailLayout;
  onDeleted: () => void;
}) {
  const detail = useApplication(id);
  const showSkeleton = useDelayedFlag(detail.isPending, 400);
  if (detail.isPending) {
    return (
      <>
        <LoadingStatus />
        {showSkeleton && <DetailSkeleton />}
      </>
    );
  }
  if (detail.isError) return <ErrorState onRetry={() => detail.refetch()} message={apiMessage(detail.error)} />;
  return <DetailBody app={detail.data} layout={layout} onDeleted={onDeleted} />;
}
