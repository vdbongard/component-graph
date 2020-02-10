import { QualityMetrics } from '../interfaces';

export const qualityMetrics: QualityMetrics = {
  'sloc.physical': {
    name: 'Lines of Code',
    thresholds: { component: 200, function: 40 }
  },
  'sloc.logical': {
    name: 'Lines of Code (logical)',
    thresholds: { component: 200, function: 40 }
  },
  cyclomatic: {
    name: 'Cyclomatic Complexity',
    thresholds: { component: 20, function: 5, 'function.render': 100 }
  },
  cyclomaticDensity: {
    name: 'Cyclomatic Density',
    thresholds: { component: 100, function: 100 }
  },
  'halstead.difficulty': {
    name: 'Halstead Difficulty',
    thresholds: { component: 30, function: 8 }
  }
};
