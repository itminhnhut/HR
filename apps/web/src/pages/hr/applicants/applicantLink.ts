import type { TabKey } from './useApplicantQueue';

/** Always with the tab: without it the page opens on "Mới" or "Tất cả", where the person may not be listed. */
export const applicantLink = (id: string, tab: TabKey) => `/hr/ho-so?trang-thai=${tab}&id=${id}`;
