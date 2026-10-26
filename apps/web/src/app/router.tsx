import { createBrowserRouter, createHashRouter, Navigate, useLocation, type RouteObject } from 'react-router';
import { PublicLayout, PublicShell } from '../site/PublicLayout';
import { NotFoundPage } from '../pages/NotFoundPage';
import { JobsPage } from '../pages/JobsPage';
import { JobPage } from '../pages/JobPage';

/** Lazy-load a page module so HR code never ships to candidates. */
const lazy = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

/** Keeps "?tiep=" so a sign-in started elsewhere still comes back there. */
function ToAccount() {
  const { search } = useLocation();
  return <Navigate to={`/ho-so-cua-toi${search}`} replace />;
}

const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    // First visit to a lazy page: header and footer while its code loads, instead of a blank screen.
    hydrateFallbackElement: <PublicShell />,
    children: [
      { index: true, element: <JobsPage /> },
      { path: 'viec-lam/:slug', element: <JobPage /> },
      { path: 'gioi-thieu', lazy: lazy(() => import('../pages/AboutPage')) },
      { path: 'chinh-sach-du-lieu', lazy: lazy(() => import('../pages/PrivacyPage')) },
      { path: 'tra-cuu-ho-so', lazy: lazy(() => import('../pages/LookupPage')) },
      { path: 'tin-tuc', lazy: lazy(() => import('../pages/news/NewsListPage')) },
      { path: 'tin-tuc/chuyen-muc/:slug', lazy: lazy(() => import('../pages/news/NewsListPage')) },
      { path: 'tin-tuc/the/:tag', lazy: lazy(() => import('../pages/news/NewsListPage')) },
      { path: 'tin-tuc/:slug', lazy: lazy(() => import('../pages/news/NewsPostPage')) },
      // Old link: signing in now happens on "Hồ sơ của tôi" itself.
      { path: 'dang-nhap', element: <ToAccount /> },
      { path: 'ho-so-cua-toi', lazy: lazy(() => import('../pages/candidate/CandidateAccountPage')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: 'hr/dang-nhap', lazy: lazy(() => import('../pages/hr/HrLoginPage')) },
  {
    path: 'hr',
    lazy: lazy(() => import('../pages/hr/HrLayout')),
    children: [
      { index: true, lazy: lazy(() => import('../pages/hr/HrDashboardPage')) },
      { path: 'tin', lazy: lazy(() => import('../pages/hr/HrJobsPage')) },
      { path: 'tin/moi', lazy: lazy(() => import('../pages/hr/HrJobFormPage')) },
      { path: 'tin/:id', lazy: lazy(() => import('../pages/hr/HrJobFormPage')) },
      { path: 'ho-so', lazy: lazy(() => import('../pages/hr/HrApplicantsPage')) },
      { path: 'mau-tin', lazy: lazy(() => import('../pages/hr/HrTemplatePage')) },
      { path: 'mau-thu', lazy: lazy(() => import('../pages/hr/HrMessagesPage')) },
      { path: 'tai-khoan', lazy: lazy(() => import('../pages/hr/HrAccountsPage')) },
      { path: 'tin-tuc', lazy: lazy(() => import('../pages/hr/news/HrNewsListPage')) },
      // One route for /moi and /:id: after the first autosave /moi becomes /:id without remounting the editor.
      { path: 'tin-tuc/:id', lazy: lazy(() => import('../pages/hr/news/HrNewsEditPage')) },
    ],
  },
];

/** The preview build is opened from a static file host, so it uses #/ routes. */
export const router = import.meta.env.MODE === 'preview' ? createHashRouter(routes) : createBrowserRouter(routes);
