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

/** Canonical site origin used in homepage JSON-LD. */
export const HOME_SITE_ORIGIN = 'https://www.noamdoronmath.co.il';

/**
 * Homepage structured data.
 * LocalBusiness and WebSite match the live Wix blocks. EducationalOrganization
 * is added here (not in BaseLayout) and points at the about page via subjectOf.
 */
export function homePageJsonLd(): Record<string, unknown>[] {
  const origin = HOME_SITE_ORIGIN;
  return [
    {
      '@context': 'https://schema.org/',
      '@type': 'LocalBusiness',
      name: 'נועם דורון מתמטיקה',
      url: origin,
      image:
        'https://static.wixstatic.com/media/d8e7ad_12988010be694a34866bae3abba88878~mv2.png',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'IL',
        addressLocality: 'Bet Shemesh',
      },
    },
    {
      '@context': 'https://schema.org/',
      '@type': 'WebSite',
      name: 'נועם דורון - מתמטיקה דפי מתמטיקה בחינם',
      url: origin,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'נועם דורון',
      alternateName: 'נועם דורון מתמטיקה',
      url: `${origin}/`,
      logo: `${origin}/brand/noam-doron-math-logo-cropped.png`,
      subjectOf: {
        '@type': 'AboutPage',
        url: `${origin}/aboutus`,
      },
    },
  ];
}

/** Same-origin hrefs the homepage must expose for parity gates. */
export function homePageRequiredHrefs(home: HomePageContent = loadHomePage()): string[] {
  const hrefs = [
    '/',
    '/aboutus',
    '/blog',
    '/math-tools',
    '/high-school-math',
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
