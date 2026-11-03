/** Fixed company details of the mail design. HR edits texts, not these. */
export const MAIL_COMPANY = {
  name: 'Top Flow',
  officeName: 'Văn phòng Công ty Top Flow',
  officeAddress: '110/20/2 Đường Số 30, P. An Nhơn, TP. HCM',
  mapUrl:
    'https://www.google.com/maps/search/?api=1&query=110%2F20%2F2+%C4%90%C6%B0%E1%BB%9Dng+S%E1%BB%91+30%2C+An+Nh%C6%A1n%2C+H%E1%BB%93+Ch%C3%AD+Minh',
  hrEmail: 'hr@topflow.vn',
  hotline: '0937 705 533',
  website: 'topflow.vn',
  careersSite: 'www.lee-hr.com',
  careersUrl: 'https://www.lee-hr.com',
  privacyPage: 'www.lee-hr.com/chinh-sach-du-lieu',
  privacyUrl: 'https://www.lee-hr.com/chinh-sach-du-lieu',
  tagline: 'Top Solution, Top Choice',
  defaultInterviewer: 'Quản lý bộ phận (Team Manager)',
  defaultDuration: '30 – 45 phút',
  defaultCallDuration: '10 – 15 phút',
  hrHonorific: 'Ms.',
} as const;

/** On every text element: a browser drops `<body>` when it copies a mail, and its font with it. */
export const MAIL_FONT = "font-family:'Times New Roman',Times,serif;";

/** Images hosted on the site; sending through Outlook passes `cid:` urls instead. */
export const MAIL_LOGO_URLS = {
  logo: 'https://www.lee-hr.com/images/mail/top-flow-logo.png',
  mark: 'https://www.lee-hr.com/images/mail/top-flow-mark.png',
} as const;
