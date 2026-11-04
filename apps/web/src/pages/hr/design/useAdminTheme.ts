import { useLayoutEffect } from 'react';

/**
 * Turns on the admin colours (admin.css) while an HR page is open. On the body and not a wrapper, so menus and popovers
 * rendered straight into the body match too; removed on leaving, so the public site keeps its own look.
 */
export function useAdminTheme(): void {
  useLayoutEffect(() => {
    document.body.classList.add('hr-admin');
    return () => document.body.classList.remove('hr-admin');
  }, []);
}
