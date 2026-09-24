import homePageJson from '../data/home-page.json';

export type HomeGrade = {
  grade: number;
  label: string;
  href: string;
  ai: boolean;
  aiLabel?: string;
};

export type HomePageContent = {
  title: string;
  description: string;
  devNotice: { title: string; body: string };
  hero: {
    eyebrow: string;
    titleLine: string;
    titleEm: string;
    lede: string;
    searchCta: { label: string; href: string; note?: string };
  };
  grades: HomeGrade[];
  learning: {
    googleLabel: string;
    googleHref: string;
    learningLabel: string;
    learningHref: string;
    noteLocal: string;
    noteGoogle: string;
  };
  valueSections: {
    heading: string;
    items: { title: string; body: string; href: string }[];
  };
  whatsapp: {
    kicker: string;
    heading: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
    note: string;
    qrAlt: string;
    qrSrc: string;
    qrCaption: string;
  };
  footer: {
    brandName: string;
    brandBlurb: string;
    contactHeading: string;
    contactBody: string;
    email: string;
    quickNavHeading: string;
    quickNav: { label: string; href: string }[];
    legal: { label: string; href?: string | null; note?: string; knownGap?: boolean }[];
    copyright: string;
    disclaimer: string;
    privacyNote: string;
    previewNote: string;
  };
};

export function loadHomePage(): HomePageContent {
  return homePageJson as HomePageContent;
}

/** Same-origin hrefs the homepage must expose for parity gates. */
export function homePageRequiredHrefs(home: HomePageContent = loadHomePage()): string[] {
  const hrefs = [
    '/',
    '/aboutus',
    '/blog',
    '/math-tools',
    '/high-school-math-1',
    '/worksheets',
    '/learning.html',
    '/learning.html?signin=google',
    '/conditionforfreeworksheets',
    '/terms',
    '/accessibilityadaptation',
    home.whatsapp.ctaHref,
    `mailto:${home.footer.email}`,
    ...home.grades.map((g) => g.href),
    ...home.valueSections.items.map((i) => i.href),
    ...home.footer.quickNav.map((i) => i.href),
    ...home.footer.legal.map((i) => i.href).filter((h): h is string => !!h),
  ];
  return [...new Set(hrefs)];
}
