import { QualityMetrics } from '../interfaces';

export const qualityMetrics: QualityMetrics = {
  'sloc.physical': {
    name: 'Lines of Code',
    description: 'The number of lines of code including comments.',
    thresholds: { component: 200, innerFunction: 40, 'innerFunction.render': 60 }
  },
  // 'sloc.logical': {
  //   name: 'Lines of Code (logical)',
  //   description: 'The count of imperative statements.',
  //   thresholds: { component: 150, innerFunction: 30, 'innerFunction.render': 45 }
  // },
  'sloc.jsx': {
    name: 'Lines of JSX Code',
    description: 'The line count of root level JSX elements',
    thresholds: { component: 65 },
    componentOnly: true
  },
  maxJsxNesting: {
    name: 'Maximum JSX nesting',
    description:
      'JSX nesting is counted by the number of nested JSX children or JSX elements in JSX ' +
      'expressions starting with 1 for the top level',
    thresholds: { component: 8 },
    componentOnly: true
  },
  cyclomatic: {
    name: 'Cyclomatic Complexity',
    description: 'The number of distinct paths through a block of code',
    thresholds: { component: 30, innerFunction: 8, 'innerFunction.render': 12 }
  },
  'halstead.difficulty': {
    name: 'Halstead Difficulty',
    description: 'The difficulty to write or understand the program, e.g. when doing code review.',
    thresholds: { component: 50, innerFunction: 15 }
  },
  'halstead.bugs': {
    name: 'Halstead Bugs',
    description: 'An estimate for the number of errors in the implementation.',
    thresholds: { component: 1, innerFunction: 0.4 }
  },
  // 'halstead.effort': {
  //   name: 'Halstead Effort',
  //   description:
  //     'Measures the amount of mental activity needed to translate the existing algorithm into implementation',
  //   thresholds: { component: 150000, innerFunction: 15000 }
  // },
  // 'halstead.length': {
  //   name: 'Halstead Length',
  //   description: 'The total number of operator and operand occurrences.',
  //   thresholds: { component: 500, innerFunction: 200 }
  // },
  // 'halstead.time': {
  //   name: 'Halstead Time',
  //   description:
  //     'Shows time (in seconds) needed to translate the existing algorithm into implementation',
  //   thresholds: { component: 7000, innerFunction: 800 }
  // },
  // 'halstead.vocabulary': {
  //   name: 'Halstead Vocabulary',
  //   description: 'The total number of unique operator and operand occurrences.',
  //   thresholds: { component: 120, innerFunction: 60 }
  // },
  // 'halstead.volume': {
  //   name: 'Halstead Volume',
  //   description:
  //     'Proportional to program size, represents the size, in bits, of space necessary for storing the program.',
  //   thresholds: { component: 3000, innerFunction: 1000 }
  //   // The volume of a function should be at least 20 and at most 1000.
  //   // The volume of a parameter-less one-line function that is not empty; is about 20.
  //   // A volume greater than 1000 tells that the function probably does too many things.
  //   // Source: https://www.verifysoft.com/en_halstead_metrics.html
  // },
  paramCount: {
    name: 'Parameter Count',
    description:
      'The number of parameters, analysed statically from the function signature ' +
      '(ignoring the arguments object).',
    thresholds: { component: 20, innerFunction: 6 }
  }
};

export const warningThreshold = 0.8;
export const sizeConstant = 16000; // circle area if metric = threshold
