import { QualityMetrics } from '../interfaces';

export const qualityMetrics: QualityMetrics = {
  'sloc.physical': {
    name: 'Lines of Code',
    thresholds: { component: 200, function: 40, 'function.render': 60 }
  },
  'sloc.logical': {
    name: 'Lines of Code (logical)',
    thresholds: { component: 150, function: 30, 'function.render': 45 }
  },
  cyclomatic: {
    name: 'Cyclomatic Complexity',
    thresholds: { component: 30, function: 8, 'function.render': 12 }
  },
  'halstead.difficulty': {
    name: 'Halstead Difficulty',
    thresholds: { component: 50, function: 15 }
  },
  'halstead.bugs': {
    name: 'Halstead Bugs',
    thresholds: { component: 1, function: 0.4 }
  },
  'halstead.effort': {
    name: 'Halstead Effort',
    thresholds: { component: 150000, function: 15000 }
  },
  'halstead.length': {
    name: 'Halstead Length',
    thresholds: { component: 500, function: 200 }
  },
  'halstead.time': {
    name: 'Halstead Time',
    thresholds: { component: 7000, function: 800 }
  },
  'halstead.vocabulary': {
    name: 'Halstead Vocabulary',
    thresholds: { component: 100, function: 45 }
  },
  'halstead.volume': {
    name: 'Halstead Volume',
    thresholds: { component: 3000, function: 1000 }
  },
  paramCount: {
    name: 'Parameter Count',
    thresholds: { component: 20, function: 5 }
  }
};
