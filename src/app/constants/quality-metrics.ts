import { QualityMetrics } from '../interfaces';

export const qualityMetrics: QualityMetrics = {
  'sloc.physical': {
    name: 'Lines of Code',
    thresholds: { component: 200, innerFunction: 40, 'innerFunction.render': 60 }
  },
  'sloc.logical': {
    name: 'Lines of Code (logical)',
    thresholds: { component: 150, innerFunction: 30, 'innerFunction.render': 45 }
  },
  cyclomatic: {
    name: 'Cyclomatic Complexity',
    thresholds: { component: 30, innerFunction: 8, 'innerFunction.render': 12 }
  },
  'halstead.difficulty': {
    name: 'Halstead Difficulty',
    thresholds: { component: 50, innerFunction: 15 }
  },
  'halstead.bugs': {
    name: 'Halstead Bugs',
    thresholds: { component: 1, innerFunction: 0.4 }
  },
  'halstead.effort': {
    name: 'Halstead Effort',
    thresholds: { component: 150000, innerFunction: 15000 }
  },
  'halstead.length': {
    name: 'Halstead Length',
    thresholds: { component: 500, innerFunction: 200 }
  },
  'halstead.time': {
    name: 'Halstead Time',
    thresholds: { component: 7000, innerFunction: 800 }
  },
  'halstead.vocabulary': {
    name: 'Halstead Vocabulary',
    thresholds: { component: 100, innerFunction: 45 }
  },
  'halstead.volume': {
    name: 'Halstead Volume',
    thresholds: { component: 3000, innerFunction: 1000 }
  },
  paramCount: {
    name: 'Parameter Count',
    thresholds: { component: 20, innerFunction: 5 }
  }
};

export const warningThreshold = 0.8;
