import { LoadingStatus, Sk } from '../../ui/feedback';
import { PAGE_WIDTH, PageHeroSkeleton } from '../../site/PageHero';

/** The job page while it loads: the same boxes as the real page, faded in only if loading takes a moment. */
export function JobSkeleton() {
  return (
    <>
      <LoadingStatus />
      <PageHeroSkeleton overlap />
      <main aria-hidden="true" className={`relative ${PAGE_WIDTH} min-h-svh pb-20`}>
        <div className="skeleton-in -mt-12 grid grid-cols-2 gap-5 rounded-card border border-line bg-white p-5 sm:-mt-14 sm:p-6 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`flex items-center gap-3 ${i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <Sk w={34} h={34} round className="max-sm:hidden" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Sk w="60%" h={11} />
                <Sk w="85%" h={14} />
              </div>
            </div>
          ))}
        </div>
        <div className="skeleton-in mt-12 flex max-w-[680px] flex-col gap-3">
          <Sk w={220} h={28} />
          <Sk w="100%" h={14} />
          <Sk w="94%" h={14} />
          <Sk w="70%" h={14} />
        </div>
      </main>
    </>
  );
}
