// Marks special react methods, e.g. lifecycle methods.
// The array order defines the order on the x-axis in the graph.
export const reactMethods = [
  // mounting
  'constructor',
  'getDerivedStateFromProps',
  'componentDidMount',
  // updating
  'shouldComponentUpdate',
  'getSnapshotBeforeUpdate',
  'componentDidUpdate',
  // unmounting
  'componentWillUnmount',
  // error
  'getDerivedStateFromError',
  'componentDidCatch',
  // deprecated
  'UNSAFE_componentWillUpdate',
  'UNSAFE_componentWillReceiveProps',
  'UNSAFE_componentWillMount',
  'componentWillUpdate',
  'componentWillReceiveProps',
  'componentWillMount',
  // render
  'render'
];

export const deprecatedMethods = [
  'UNSAFE_componentWillUpdate',
  'UNSAFE_componentWillReceiveProps',
  'UNSAFE_componentWillMount',
  'componentWillUpdate',
  'componentWillReceiveProps',
  'componentWillMount'
];
