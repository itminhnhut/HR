import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router';
import { PublicLayout } from '../site/PublicLayout';
import { NotFoundPage } from '../pages/NotFoundPage';
import { JobsPage } from '../pages/JobsPage';
import { JobPage } from '../pages/JobPage';

/** Lazy-load a page module so HR code never ships to candidates. */
const lazy = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <JobsPage /> },
      { path: 'viec-lam/:slug', element: <JobPage /> },
      { path: 'gioi-thieu', lazy: lazy(() => import('../pages/AboutPage')) },
      { path: 'chinh-sach-du-lieu', lazy: lazy(() => import('../pages/PrivacyPage')) },
      { path: 'dang-nhap', lazy: lazy(() => import('../pages/candidate/CandidateLoginPage')) },
      { path: 'ho-so-cua-toi', lazy: lazy(() => import('../pages/candidate/CandidateAccountPage')) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: 'hr/dang-nhap', lazy: lazy(() => import('../pages/hr/HrLoginPage')) },
  {
    path: 'hr',
    lazy: lazy(() => import('../pages/hr/HrLayout')),
    children: [
      { index: true, lazy: lazy(() => import('../pages/hr/HrJobsPage')) },
      { path: 'tin/moi', lazy: lazy(() => import('../pages/hr/HrJobFormPage')) },
      { path: 'tin/:id', lazy: lazy(() => import('../pages/hr/HrJobFormPage')) },
      { path: 'ho-so', lazy: lazy(() => import('../pages/hr/HrApplicantsPage')) },
      { path: 'nguoi-cho-tin', lazy: lazy(() => import('../pages/hr/HrSubscribersPage')) },
    ],
  },
];

/** The preview build is opened from a static file host, so it uses #/ routes. */
export const router = import.meta.env.MODE === 'preview' ? createHashRouter(routes) : createBrowserRouter(routes);
