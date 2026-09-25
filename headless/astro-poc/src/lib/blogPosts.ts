import additionSubtractionGrade1 from '../data/blog-posts/addition-subtraction-grade-1.json';
import aiTutorAgentFree from '../data/blog-posts/ai-tutor-agent-free.json';
import annualReviewGrade7 from '../data/blog-posts/annual-review-grade-7.json';
import assessment1Grade7 from '../data/blog-posts/assessment-1-grade-7.json';
import boxAndCubeGrade7 from '../data/blog-posts/box-and-cube-grade-7.json';
import challengeExercisesGrade4 from '../data/blog-posts/challenge-exercises-grade-4.json';
import commonFactorAndMinusParenthesesGrade7 from '../data/blog-posts/common-factor-and-minus-parentheses-grade-7.json';
import compositePolygonsAreaGrade7 from '../data/blog-posts/composite-polygons-area-grade-7.json';
import congruentPolygonsTransformationsGrade7 from '../data/blog-posts/congruent-polygons-transformations-grade-7.json';
import coordinateAxesPracticeGuide from '../data/blog-posts/coordinate-axes-practice-guide.json';
import dataCollectionReadingGrade7 from '../data/blog-posts/data-collection-reading-grade-7.json';
import decimalsPracticeGrade6 from '../data/blog-posts/decimals-practice-grade-6.json';
import distributivePropertyParenthesesGrade7 from '../data/blog-posts/distributive-property-parentheses-grade-7.json';
import educationalAiMath from '../data/blog-posts/educational-ai-math.json';
import equationsGrade8Practice from '../data/blog-posts/equations-grade-8-practice.json';
import equationsParenthesesEquivalenceGrade7 from '../data/blog-posts/equations-parentheses-equivalence-grade-7.json';
import equilateralTriangleAdvancedGrade7 from '../data/blog-posts/equilateral-triangle-advanced-grade-7.json';
import examPrepGrade57Days from '../data/blog-posts/exam-prep-grade-5-7-days.json';
import firstQuadrantGraphPointsGrade7 from '../data/blog-posts/first-quadrant-graph-points-grade-7.json';
import focusedMathReviewOnline from '../data/blog-posts/focused-math-review-online.json';
import fractionsPracticeGrade4 from '../data/blog-posts/fractions-practice-grade-4.json';
import freeWorksheetsAllGradesAi from '../data/blog-posts/free-worksheets-all-grades-ai.json';
import frequencyTablesGrade7 from '../data/blog-posts/frequency-tables-grade-7.json';
import functionsGrade9Graphs from '../data/blog-posts/functions-grade-9-graphs.json';
import geometryGrade6Exams from '../data/blog-posts/geometry-grade-6-exams.json';
import grade1WorksheetsConfidence from '../data/blog-posts/grade-1-worksheets-confidence.json';
import homeworkWorksheets from '../data/blog-posts/homework-worksheets.json';
import learningGapsMath from '../data/blog-posts/learning-gaps-math.json';
import mathForKidsConfidencePractice from '../data/blog-posts/math-for-kids-confidence-practice.json';
import mathThinkingPractice from '../data/blog-posts/math-thinking-practice.json';
import multiplicationTableWorksheets from '../data/blog-posts/multiplication-table-worksheets.json';
import noamAiWorksheetsHowToStart from '../data/blog-posts/noam-ai-worksheets-how-to-start.json';
import oneStepEquationsGrade7 from '../data/blog-posts/one-step-equations-grade-7.json';
import orderOfOperationsGuide from '../data/blog-posts/order-of-operations-guide.json';
import parallelogramTrapezoidAreaGrade7 from '../data/blog-posts/parallelogram-trapezoid-area-grade-7.json';
import patternsGrade7 from '../data/blog-posts/patterns-grade-7.json';
import percentagesExercisesGrade7 from '../data/blog-posts/percentages-exercises-grade-7.json';
import perimeterComplexShapesAlgebraGrade7 from '../data/blog-posts/perimeter-complex-shapes-algebra-grade-7.json';
import powersRootsMiddleGuide from '../data/blog-posts/powers-roots-middle-guide.json';
import probabilityIntroductionGrade7 from '../data/blog-posts/probability-introduction-grade-7.json';
import readingGraphsForKids from '../data/blog-posts/reading-graphs-for-kids.json';
import rectangleSquareAreaAdvancedGrade7 from '../data/blog-posts/rectangle-square-area-advanced-grade-7.json';
import relativeFrequencyExperimentsGrade7 from '../data/blog-posts/relative-frequency-experiments-grade-7.json';
import relativeFrequencyIntroductionGrade7 from '../data/blog-posts/relative-frequency-introduction-grade-7.json';
import simplifyThenSolveEquationsGrade7 from '../data/blog-posts/simplify-then-solve-equations-grade-7.json';
import strugglingStudentsPractice from '../data/blog-posts/struggling-students-practice.json';
import substitutionInAlgebraicExpressionsGrade7 from '../data/blog-posts/substitution-in-algebraic-expressions-grade-7.json';
import threeRepresentationsEquationSolutionGrade7 from '../data/blog-posts/three-representations-equation-solution-grade-7.json';
import triangularPrismSurfaceAreaGrade7 from '../data/blog-posts/triangular-prism-surface-area-grade-7.json';
import triangularPrismVolumeGrade7 from '../data/blog-posts/triangular-prism-volume-grade-7.json';
import twoStepEquationsGrade7 from '../data/blog-posts/two-step-equations-grade-7.json';
import unknownOnBothSidesGrade7 from '../data/blog-posts/unknown-on-both-sides-grade-7.json';
import variablesAndAlgebraicModelingGrade7 from '../data/blog-posts/variables-and-algebraic-modeling-grade-7.json';
import whatIsAnEquationSolutionGrade7 from '../data/blog-posts/what-is-an-equation-solution-grade-7.json';
import whenLearnPercentagesGrade6 from '../data/blog-posts/when-learn-percentages-grade-6.json';
import wordProblemsStepByStep from '../data/blog-posts/word-problems-step-by-step.json';
import wordProblemsWithEquationsGrade7 from '../data/blog-posts/word-problems-with-equations-grade-7.json';
import workbooksVsPracticeSheets from '../data/blog-posts/workbooks-vs-practice-sheets.json';
import worksheetsForTeachers from '../data/blog-posts/worksheets-for-teachers.json';
import worksheetsNoRegistration from '../data/blog-posts/worksheets-no-registration.json';

export type BlogInlineSegment =
  | { type: 'text'; text: string }
  | { type: 'a'; text: string; href: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string };

export type BlogListItem = {
  text: string;
  href?: string;
  linkText?: string;
  segments?: BlogInlineSegment[];
};

export type BlogBodyBlock =
  | { type: 'h2' | 'h3' | 'h4'; text: string }
  | { type: 'p'; text: string; segments?: BlogInlineSegment[] }
  | { type: 'blockquote'; text: string }
  | { type: 'ul' | 'ol'; items: BlogListItem[] }
  | { type: 'figure'; src: string; alt: string; caption?: string }
  | { type: 'img'; src: string; alt: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'a'; text: string; href: string };

export type BlogPostContent = {
  path: string;
  pathSlug: string;
  decodedSlug: string;
  fileSlug: string;
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  h1: string;
  author: string;
  datePublished?: string;
  dateModified?: string;
  dateDisplay?: string;
  readingTime?: string;
  /** Visible author avatar next to byline (live AX). */
  authorAvatar?: { src: string; alt: string };
  coverImage?: string;
  coverAlt?: string;
  blocks: BlogBodyBlock[];
  /** Topic chips near author/editor (when present on source). */
  related: Array<{ text: string; href: string }>;
  categories: Array<{ text: string; href: string }>;
  authorEditor?: {
    text: string;
    aboutHref?: string | null;
    aboutLabel?: string | null;
    relatedHeading?: string | null;
    relatedLinks?: Array<{ text: string; href: string }>;
  };
  faq?: {
    heading: string;
    items: Array<{ question: string; answer: string }>;
  };
  whatsapp?: {
    heading: string;
    body: string;
    ctaLabel?: string | null;
    ctaHref?: string | null;
    note?: string | null;
  };
  postCategory?: { text: string; href: string };
  recentPosts?: {
    heading: string;
    viewAllLabel?: string | null;
    viewAllHref?: string | null;
    items: Array<{
      title: string;
      href: string;
      description?: string;
      imageSrc?: string;
      imageAlt?: string;
    }>;
  };
  jsonLd?: unknown[];
  featureKey?: string;
  clusterSize?: number;
  batch?: string;
  categoryHint?: string;
  skippedEmbeds?: Array<{ src: string; reason: string }>;
  source: { liveUrl: string; capturedAt: string; bodyChars?: number };
};

/** Required post-chrome presence derived from live capture (parity gate). */
export function expectedChromeFlags(post: BlogPostContent) {
  return {
    readingTime: !!post.readingTime,
    authorEditor: !!post.authorEditor?.text,
    faq: !!(post.faq?.items && post.faq.items.length > 0),
    whatsapp: !!post.whatsapp?.heading,
    postCategory: !!post.postCategory?.text,
    recentPosts: !!(post.recentPosts?.items && post.recentPosts.items.length > 0),
  };
}

/**
 * Frozen live-visible chrome expectations for served blog posts (M25–M29 + OPEN-07-FIX; all 60).
 * Prevents a falsely green gate when fixture fields are dropped.
 */
export const LIVE_CHROME_BASELINE: Record<
  string,
  {
    readingTime: boolean;
    authorEditor: boolean;
    faq: boolean;
    whatsapp: boolean;
    postCategory: boolean;
    recentPosts: boolean;
  }
> = {
  'addition-subtraction-grade-1': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'learning-gaps-math': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'ai-tutor-agent-free': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'annual-review-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'assessment-1-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'box-and-cube-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'challenge-exercises-grade-4': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'common-factor-and-minus-parentheses-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'composite-polygons-area-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'congruent-polygons-transformations-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'coordinate-axes-practice-guide': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'data-collection-reading-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'decimals-practice-grade-6': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'distributive-property-parentheses-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'educational-ai-math': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'equations-grade-8-practice': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'equations-parentheses-equivalence-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'equilateral-triangle-advanced-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'exam-prep-grade-5-7-days': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'first-quadrant-graph-points-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'focused-math-review-online': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'fractions-practice-grade-4': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'free-worksheets-all-grades-ai': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'frequency-tables-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'functions-grade-9-graphs': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'geometry-grade-6-exams': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'grade-1-worksheets-confidence': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'homework-worksheets': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'math-for-kids-confidence-practice': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'math-thinking-practice': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'multiplication-table-worksheets': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'noam-ai-worksheets-how-to-start': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'one-step-equations-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'order-of-operations-guide': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'parallelogram-trapezoid-area-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'patterns-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'percentages-exercises-grade-7': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'perimeter-complex-shapes-algebra-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'powers-roots-middle-guide': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'probability-introduction-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'reading-graphs-for-kids': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'rectangle-square-area-advanced-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'relative-frequency-experiments-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'relative-frequency-introduction-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'simplify-then-solve-equations-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'struggling-students-practice': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'substitution-in-algebraic-expressions-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'three-representations-equation-solution-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'triangular-prism-surface-area-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'triangular-prism-volume-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'two-step-equations-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'unknown-on-both-sides-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'variables-and-algebraic-modeling-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'what-is-an-equation-solution-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'when-learn-percentages-grade-6': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'word-problems-step-by-step': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'word-problems-with-equations-grade-7': {
    readingTime: true,
    authorEditor: true,
    faq: true,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'workbooks-vs-practice-sheets': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: false,
    recentPosts: true,
  },
  'worksheets-for-teachers': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
  'worksheets-no-registration': {
    readingTime: true,
    authorEditor: false,
    faq: false,
    whatsapp: true,
    postCategory: true,
    recentPosts: true,
  },
};

/** M25 pilot: one post per live feature cluster (8). */
export const BLOG_POST_M25_PILOT_PATHS = [
  '/post/annual-review-grade-7',
  '/post/%D7%90%D7%99%D7%9A-%D7%9C%D7%AA%D7%A8%D7%92%D7%9C-%D7%92%D7%90%D7%95%D7%9E%D7%98%D7%A8%D7%99%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%95-%D7%95%D7%9C%D7%94%D7%A6%D7%9C%D7%99%D7%97-%D7%91%D7%9E%D7%91%D7%97%D7%A0%D7%99%D7%9D',
  '/post/%D7%90%D7%99%D7%9A-%D7%A4%D7%95%D7%AA%D7%A8%D7%99%D7%9D-%D7%A1%D7%93%D7%A8-%D7%A4%D7%A2%D7%95%D7%9C%D7%95%D7%AA-%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%91%D7%9C%D7%99-%D7%9C%D7%94%D7%AA%D7%91%D7%9C%D7%91%D7%9C',
  '/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9C%D7%90-%D7%94%D7%A8%D7%A9%D7%9E%D7%94-%D7%9C%D7%9B%D7%9C-%D7%9B%D7%99%D7%AA%D7%94-%D7%95%D7%A0%D7%95%D7%A9%D7%90',
  '/post/%D7%91%D7%99%D7%A0%D7%94-%D7%97%D7%99%D7%A0%D7%95%D7%9B%D7%99%D7%AA-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%AA-%D7%9B%D7%9C-%D7%AA%D7%9C%D7%9E%D7%99%D7%93-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94',
  '/post/%D7%91%D7%A2%D7%99%D7%95%D7%AA-%D7%9E%D7%99%D7%9C%D7%95%D7%9C%D7%99%D7%95%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A4%D7%95%D7%AA%D7%A8%D7%99%D7%9D-%D7%A9%D7%9C%D7%91-%D7%90%D7%97%D7%A8-%D7%A9%D7%9C%D7%91',
  '/post/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%A7%D7%A8%D7%99%D7%90%D7%AA-%D7%92%D7%A8%D7%A4%D7%99%D7%9D-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%91%D7%A6%D7%95%D7%A8%D7%94-%D7%A4%D7%A9%D7%95%D7%98%D7%94',
  '/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%97%D7%A9%D7%99%D7%91%D7%94-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%AA-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%A9%D7%91%D7%95%D7%A0%D7%94-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F',
] as const;

/** M27 batch: 15 additional posts. */
export const BLOG_POST_M27_PATHS = [
  '/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9C%D7%95%D7%97-%D7%94%D7%9B%D7%A4%D7%9C-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA',
  '/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9E%D7%95%D7%A8%D7%99%D7%9D-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A9%D7%9E%D7%A7%D7%A6%D7%A8%D7%99%D7%9D-%D7%94%D7%9B%D7%A0%D7%94-%D7%9C%D7%A9%D7%99%D7%A2%D7%95%D7%A8',
  '/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%A9%D7%99%D7%A2%D7%95%D7%A8%D7%99-%D7%91%D7%99%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%99%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F',
  '/post/%D7%94%D7%9B%D7%A0%D7%94-%D7%9C%D7%9E%D7%91%D7%97%D7%9F-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%94-%D7%91-7-%D7%99%D7%9E%D7%99%D7%9D',
  '/post/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A6%D7%99%D7%A8%D7%99%D7%9D-%D7%A7%D7%95%D7%90%D7%95%D7%A8%D7%93%D7%99%D7%A0%D7%98%D7%95%D7%AA-%D7%A9%D7%9E%D7%AA%D7%97%D7%99%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F',
  '/post/%D7%A1%D7%95%D7%9B%D7%9F-ai-%D7%9C%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99%D7%9D-%D7%9B%D7%9E%D7%95-%D7%9E%D7%95%D7%A8%D7%94-%D7%A4%D7%A8%D7%98%D7%99-%D7%95%D7%94%D7%9B%D7%95%D7%9C-%D7%91%D7%97%D7%99%D7%A0%D7%9D',
  '/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%A1%D7%A4%D7%A8%D7%99%D7%9D-%D7%A2%D7%A9%D7%A8%D7%95%D7%A0%D7%99%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%95-%D7%91%D7%91%D7%99%D7%AA-%D7%95%D7%91%D7%9B%D7%99%D7%AA%D7%94',
  '/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%AA%D7%9C%D7%9E%D7%99%D7%93%D7%99%D7%9D-%D7%9E%D7%AA%D7%A7%D7%A9%D7%99%D7%9D-%D7%A9%D7%9E%D7%A7%D7%93%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F',
  '/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A9%D7%91%D7%A8%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%93-%D7%A9%D7%9E%D7%97%D7%96%D7%A7-%D7%94%D7%91%D7%A0%D7%94-%D7%95%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F',
  '/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%97%D7%99%D7%91%D7%95%D7%A8-%D7%95%D7%97%D7%99%D7%A1%D7%95%D7%A8-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F-%D7%91%D7%91%D7%99%D7%AA',
  '/post/box-and-cube-grade-7',
  '/post/equations-parentheses-equivalence-grade-7',
  '/post/first-quadrant-graph-points-grade-7',
  '/post/unknown-on-both-sides-grade-7',
  '/post/variables-and-algebraic-modeling-grade-7',
] as const;

/** M28 batch: 18 additional posts. */
export const BLOG_POST_M28_PATHS = [
  '/post/assessment-1-grade-7',
  '/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%90%D7%AA%D7%92%D7%A8-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%93-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%99%D7%9D-%D7%97%D7%A9%D7%99%D7%91%D7%94',
  '/post/common-factor-and-minus-parentheses-grade-7',
  '/post/composite-polygons-area-grade-7',
  '/post/congruent-polygons-transformations-grade-7',
  '/post/data-collection-reading-grade-7',
  '/post/distributive-property-parentheses-grade-7',
  '/post/%D7%9E%D7%A9%D7%95%D7%95%D7%90%D7%95%D7%AA-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%97-%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A9%D7%9E%D7%A1%D7%93%D7%A8-%D7%90%D7%AA-%D7%94%D7%93%D7%A8%D7%9A',
  '/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%91%D7%97%D7%99%D7%A0%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%95%D7%AA-%D7%90-%D7%98-%D7%9C%D7%91%D7%99%D7%AA-%D7%95%D7%91%D7%A7%D7%A8%D7%95%D7%91-%D7%92%D7%9D-%D7%A1%D7%95%D7%9B%D7%9F-ai-%D7%AA%D7%95%D7%9E%D7%9A',
  '/post/%D7%A4%D7%95%D7%A0%D7%A7%D7%A6%D7%99%D7%95%D7%AA-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%98-%D7%9C%D7%94%D7%91%D7%99%D7%9F-%D7%92%D7%A8%D7%A4%D7%99%D7%9D-%D7%95%D7%9C%D7%A4%D7%AA%D7%95%D7%A8-%D7%A0%D7%9B%D7%95%D7%9F',
  '/post/%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%90-%D7%A9%D7%9E%D7%97%D7%96%D7%A7%D7%99%D7%9D-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94',
  '/post/%D7%91%D7%A7%D7%A8%D7%95%D7%91-%D7%A1%D7%95%D7%9B%D7%9F-%D7%91%D7%99%D7%A0%D7%94-%D7%9E%D7%9C%D7%90%D7%9B%D7%95%D7%AA%D7%99%D7%AA-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%93%D7%A4%D7%99-%D7%A2%D7%91%D7%95%D7%93%D7%94',
  '/post/one-step-equations-grade-7',
  '/post/%D7%AA%D7%A8%D7%92%D7%99%D7%9C%D7%99-%D7%90%D7%97%D7%95%D7%96%D7%99%D7%9D-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%96-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%91%D7%98%D7%95%D7%97-%D7%95%D7%9E%D7%93%D7%95%D7%99%D7%A7',
  '/post/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%97%D7%96%D7%A7%D7%95%D7%AA-%D7%95%D7%A9%D7%95%D7%A8%D7%A9%D7%99%D7%9D-%D7%91%D7%97%D7%98%D7%99%D7%91%D7%94-%D7%9C%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%91%D7%98%D7%95%D7%97',
  '/post/simplify-then-solve-equations-grade-7',
  '/post/%D7%9E%D7%AA%D7%99-%D7%9C%D7%95%D7%9E%D7%93%D7%99%D7%9D-%D7%90%D7%97%D7%95%D7%96%D7%99%D7%9D-%D7%95%D7%90%D7%99%D7%9A-%D7%91%D7%95%D7%A0%D7%99%D7%9D-%D7%94%D7%91%D7%A0%D7%94-%D7%A0%D7%9B%D7%95%D7%A0%D7%94-%D7%91%D7%9B%D7%99%D7%AA%D7%94-%D7%95',
  '/post/%D7%97%D7%95%D7%91%D7%A8%D7%95%D7%AA-%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%9E%D7%95%D7%9C-%D7%93%D7%A4%D7%99-%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%9E%D7%94-%D7%9E%D7%AA%D7%90%D7%99%D7%9D-%D7%9C%D7%99%D7%9C%D7%93',
] as const;

/** M29 batch: remaining 18 posts (completes all 59). */
export const BLOG_POST_M29_PATHS = [
  '/post/equilateral-triangle-advanced-grade-7',
  '/post/%D7%97%D7%96%D7%A8%D7%94-%D7%9E%D7%9E%D7%95%D7%A7%D7%93%D7%AA-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%90%D7%95%D7%A0%D7%9C%D7%99%D7%99%D7%9F-%D7%A9%D7%9E%D7%A7%D7%93%D7%9E%D7%AA-%D7%91%D7%90%D7%9E%D7%AA',
  '/post/frequency-tables-grade-7',
  '/post/%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%A9%D7%91%D7%95%D7%A0%D7%94-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F-%D7%95%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%A0%D7%9B%D7%95%D7%9F',
  '/post/parallelogram-trapezoid-area-grade-7',
  '/post/patterns-grade-7',
  '/post/perimeter-complex-shapes-algebra-grade-7',
  '/post/probability-introduction-grade-7',
  '/post/rectangle-square-area-advanced-grade-7',
  '/post/relative-frequency-experiments-grade-7',
  '/post/relative-frequency-introduction-grade-7',
  '/post/substitution-in-algebraic-expressions-grade-7',
  '/post/three-representations-equation-solution-grade-7',
  '/post/triangular-prism-surface-area-grade-7',
  '/post/triangular-prism-volume-grade-7',
  '/post/two-step-equations-grade-7',
  '/post/what-is-an-equation-solution-grade-7',
  '/post/word-problems-with-equations-grade-7',
] as const;

/** OPEN-07-FIX: post published on the live site after the M29 capture (60th). */
export const BLOG_POST_OPEN07_PATHS = [
  '/post/%D7%A4%D7%A2%D7%A8%D7%99%D7%9D-%D7%9C%D7%99%D7%9E%D7%95%D7%93%D7%99%D7%99%D7%9D-%D7%91%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%A7%D7%94-%D7%9B%D7%9A-%D7%A1%D7%95%D7%92%D7%A8%D7%99%D7%9D-%D7%90%D7%95%D7%AA%D7%9D-%D7%A0%D7%9B%D7%95%D7%9F',
] as const;

/** All locally served blog post paths (M25–M29 = 59, + OPEN-07-FIX = 60). */
export const BLOG_POST_SERVED_PATHS = [
  ...BLOG_POST_M25_PILOT_PATHS,
  ...BLOG_POST_M27_PATHS,
  ...BLOG_POST_M28_PATHS,
  ...BLOG_POST_M29_PATHS,
  ...BLOG_POST_OPEN07_PATHS,
] as const;

/** Covered in M26 (blog archives). Kept for docs/history. */
export const BLOG_M25_DEFERRED = [] as const;

/** Remaining after M29: 0 post bodies; 5 topic-SEO exclusions remain. */
export const BLOG_M29_DEFERRED_POSTS_NOTE =
  '0 remaining /post/* bodies; 60 posts + 4 archives are served locally. 5 topic exclusions remain.';

/** @deprecated use BLOG_M29_DEFERRED_POSTS_NOTE */
export const BLOG_M28_DEFERRED_POSTS_NOTE = BLOG_M29_DEFERRED_POSTS_NOTE;
/** @deprecated use BLOG_M29_DEFERRED_POSTS_NOTE */
export const BLOG_M27_DEFERRED_POSTS_NOTE = BLOG_M29_DEFERRED_POSTS_NOTE;
/** @deprecated use BLOG_M29_DEFERRED_POSTS_NOTE */
export const BLOG_M26_DEFERRED_POSTS_NOTE = BLOG_M29_DEFERRED_POSTS_NOTE;

const ALL_POSTS: BlogPostContent[] = [
  additionSubtractionGrade1,
  aiTutorAgentFree,
  annualReviewGrade7,
  assessment1Grade7,
  boxAndCubeGrade7,
  challengeExercisesGrade4,
  commonFactorAndMinusParenthesesGrade7,
  compositePolygonsAreaGrade7,
  congruentPolygonsTransformationsGrade7,
  coordinateAxesPracticeGuide,
  dataCollectionReadingGrade7,
  decimalsPracticeGrade6,
  distributivePropertyParenthesesGrade7,
  educationalAiMath,
  equationsGrade8Practice,
  equationsParenthesesEquivalenceGrade7,
  equilateralTriangleAdvancedGrade7,
  examPrepGrade57Days,
  firstQuadrantGraphPointsGrade7,
  focusedMathReviewOnline,
  fractionsPracticeGrade4,
  freeWorksheetsAllGradesAi,
  frequencyTablesGrade7,
  functionsGrade9Graphs,
  geometryGrade6Exams,
  grade1WorksheetsConfidence,
  homeworkWorksheets,
  learningGapsMath,
  mathForKidsConfidencePractice,
  mathThinkingPractice,
  multiplicationTableWorksheets,
  noamAiWorksheetsHowToStart,
  oneStepEquationsGrade7,
  orderOfOperationsGuide,
  parallelogramTrapezoidAreaGrade7,
  patternsGrade7,
  percentagesExercisesGrade7,
  perimeterComplexShapesAlgebraGrade7,
  powersRootsMiddleGuide,
  probabilityIntroductionGrade7,
  readingGraphsForKids,
  rectangleSquareAreaAdvancedGrade7,
  relativeFrequencyExperimentsGrade7,
  relativeFrequencyIntroductionGrade7,
  simplifyThenSolveEquationsGrade7,
  strugglingStudentsPractice,
  substitutionInAlgebraicExpressionsGrade7,
  threeRepresentationsEquationSolutionGrade7,
  triangularPrismSurfaceAreaGrade7,
  triangularPrismVolumeGrade7,
  twoStepEquationsGrade7,
  unknownOnBothSidesGrade7,
  variablesAndAlgebraicModelingGrade7,
  whatIsAnEquationSolutionGrade7,
  whenLearnPercentagesGrade6,
  wordProblemsStepByStep,
  wordProblemsWithEquationsGrade7,
  workbooksVsPracticeSheets,
  worksheetsForTeachers,
  worksheetsNoRegistration,
] as BlogPostContent[];

export function listPilotBlogPosts(): BlogPostContent[] {
  const byPath = new Map(ALL_POSTS.map((p) => [p.path, p]));
  return BLOG_POST_M25_PILOT_PATHS.map((path) => {
    const p = byPath.get(path);
    if (!p) throw new Error(`Missing pilot blog post fixture for ${path}`);
    return p;
  });
}

export function listM27BlogPosts(): BlogPostContent[] {
  const byPath = new Map(ALL_POSTS.map((p) => [p.path, p]));
  return BLOG_POST_M27_PATHS.map((path) => {
    const p = byPath.get(path);
    if (!p) throw new Error(`Missing M27 blog post fixture for ${path}`);
    return p;
  });
}

export function listM28BlogPosts(): BlogPostContent[] {
  const byPath = new Map(ALL_POSTS.map((p) => [p.path, p]));
  return BLOG_POST_M28_PATHS.map((path) => {
    const p = byPath.get(path);
    if (!p) throw new Error(`Missing M28 blog post fixture for ${path}`);
    return p;
  });
}

export function listM29BlogPosts(): BlogPostContent[] {
  const byPath = new Map(ALL_POSTS.map((p) => [p.path, p]));
  return BLOG_POST_M29_PATHS.map((path) => {
    const p = byPath.get(path);
    if (!p) throw new Error(`Missing M29 blog post fixture for ${path}`);
    return p;
  });
}

export function listOpen07BlogPosts(): BlogPostContent[] {
  const byPath = new Map(ALL_POSTS.map((p) => [p.path, p]));
  return BLOG_POST_OPEN07_PATHS.map((path) => {
    const p = byPath.get(path);
    if (!p) throw new Error(`Missing OPEN-07 blog post fixture for ${path}`);
    return p;
  });
}

export function listServedBlogPosts(): BlogPostContent[] {
  return [
    ...listPilotBlogPosts(),
    ...listM27BlogPosts(),
    ...listM28BlogPosts(),
    ...listM29BlogPosts(),
    ...listOpen07BlogPosts(),
  ];
}

function normPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

function pathsEqual(a: string, b: string): boolean {
  if (a === b) return true;
  try {
    return decodeURIComponent(a) === decodeURIComponent(b);
  } catch {
    return false;
  }
}

/** Resolve /post/... path variants (encoded or decoded). */
export function loadBlogPostByPath(pathname: string): BlogPostContent | null {
  const norm = normPath(pathname);
  for (const p of ALL_POSTS) {
    if (pathsEqual(p.path, norm)) return p;
    if (pathsEqual(`/post/${p.pathSlug}`, norm)) return p;
    if (pathsEqual(`/post/${p.decodedSlug}`, norm)) return p;
    if (pathsEqual(`/post/${encodeURIComponent(p.decodedSlug)}`, norm)) return p;
  }
  return null;
}

/** True when this preview serves the blog post path (all M25–M29 posts). */
export function isPilotBlogPath(pathname: string): boolean {
  const norm = normPath(pathname);
  return (BLOG_POST_SERVED_PATHS as readonly string[]).some((p) => pathsEqual(p, norm));
}

export const isLocalBlogPostPath = isPilotBlogPath;

// Re-export the single general resolver (M32). Placed after BLOG_POST_SERVED_PATHS
// so resolveSiteHref can import that constant without a circular init failure.
export {
  isLocallyServedPath,
  resolveSiteHrefString as localizeBlogHref,
} from './resolveSiteHref';

/** Collect every navigational href stored on a blog post fixture. */
export function collectBlogPostHrefs(post: BlogPostContent): Array<{ where: string; href: string }> {
  const out: Array<{ where: string; href: string }> = [];
  const add = (where: string, href?: string | null) => {
    if (href) out.push({ where, href });
  };
  for (const b of post.blocks) {
    if (b.type === 'a') add('block-a', b.href);
    if (b.type === 'p' && b.segments) {
      for (const s of b.segments) if (s.type === 'a') add('block-seg', s.href);
    }
    if (b.type === 'ul' || b.type === 'ol') {
      for (const item of b.items) {
        add('list', item.href);
        if (item.segments) {
          for (const s of item.segments) if (s.type === 'a') add('list-seg', s.href);
        }
      }
    }
  }
  for (const r of post.related) add('related', r.href);
  add('about', post.authorEditor?.aboutHref);
  for (const r of post.authorEditor?.relatedLinks || []) add('ae-rel', r.href);
  add('whatsapp', post.whatsapp?.ctaHref);
  add('category', post.postCategory?.href);
  add('recent-viewAll', post.recentPosts?.viewAllHref);
  for (const item of post.recentPosts?.items || []) add('recent', item.href);
  return out;
}

/** Skim ordered body for parity checks. */
export function skimBlogBody(blocks: BlogBodyBlock[]): string[] {
  return blocks.map((b) => {
    if (b.type === 'h2' || b.type === 'h3' || b.type === 'h4') return `${b.type}:${b.text}`;
    if (b.type === 'p') return `p:${b.text.slice(0, 80)}`;
    if (b.type === 'blockquote') return `bq:${b.text.slice(0, 80)}`;
    if (b.type === 'ul' || b.type === 'ol')
      return `${b.type}:${b.items.length}:${b.items[0]?.text?.slice(0, 40) || ''}`;
    if (b.type === 'figure' || b.type === 'img') return `${b.type}:${b.alt || b.src.slice(0, 40)}`;
    if (b.type === 'a') return `a:${b.text}`;
    if (b.type === 'table') return `table:${b.rows.length}`;
    return 'unknown';
  });
}
