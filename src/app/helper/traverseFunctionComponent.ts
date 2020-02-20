import { Component, Graph, Import } from '../interfaces';
import { findReportWithGraph } from './findReport';
import {
  getComponentDependencies,
  getLinesJSX,
  isFunction,
  isFunctionWithName,
  postProcessing,
  pushUniqueDependencies,
  pushUniqueLink
} from './traverseHelper';

export function traverseFunctionComponent(
  componentPath,
  name,
  fileName,
  asts,
  fullReport
): Component {
  const graph: Graph = {
    nodes: [],
    links: []
  };
  const aliases: { [alias: string]: string } = {};
  const dependencies: Import[] = [];
  const lineStart: number = componentPath.node.loc.start.line;
  const lineEnd: number = componentPath.node.loc.end.line;
  let linesJSX = 0;

  // Node: FunctionComponent
  graph.nodes.push({
    id: `${name}#${componentPath.node.loc.start.line}`,
    label: name,
    group: 1,
    lineStart,
    lineEnd,
    type: 'component',
    kind: 'FunctionComponent'
  });

  const functionComponentTraverse = {
    'FunctionExpression|ArrowFunctionExpression': (path, state) => {
      if (path.parentPath.isVariableDeclarator()) {
        const functionParentPath = path.getFunctionParent();

        if (isFunctionWithName(functionParentPath, state.name)) {
          // Node: InnerFunction
          graph.nodes.push({
            id: path.parentPath
              ? `${path.parentPath.node.id.name}#${path.parentPath.node.id.loc.start.line}`
              : `${path.node.id.name}#${path.node.id.loc.start.line}`,
            label: path.parentPath ? path.parentPath.node.id.name : path.node.id.name,
            group: 3,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            type: 'innerFunction',
            kind: 'FunctionComponent'
          });
        }
      }
    },
    Identifier: (path, state) => {
      if (path.parentPath.isVariableDeclarator()) {
        return;
      }

      const binding = path.scope.getBinding(path.node.name);

      if (!binding) {
        return;
      }

      const functionParentPath = binding.path.getFunctionParent();

      if (!functionParentPath) {
        return;
      }

      if (isFunctionWithName(functionParentPath, state.name)) {
        const target = path.node.name;
        const targetLine = binding.identifier.loc.start.line;

        const parent = path.findParent(
          p =>
            // is function with declaration
            ((isFunction(p.node) && p.parentPath.isVariableDeclarator()) ||
              p.isFunctionDeclaration()) &&
            // is inner function in FunctionComponent
            (isFunctionWithName(p.getFunctionParent(), state.name) ||
              // is FunctionComponent
              isFunctionWithName(p, state.name))
        );

        if (!parent) {
          return;
        }

        let source;
        let sourceLine;

        if (parent.isFunctionDeclaration()) {
          source = parent.node.id.name;
          sourceLine = parent.node.id.loc.start.line;
        } else {
          source = parent.parent.id.name;
          sourceLine = parent.parent.id.loc.start.line;
        }

        if (source) {
          // Link: InnerFunction/FunctionComponent -> InnerFunction
          pushUniqueLink(
            {
              source: `${source}#${sourceLine}`,
              target: `${target}#${targetLine}`
            },
            graph.links
          );
        }
      }
    },
    JSXOpeningElement: path => {
      const newDependencies = getComponentDependencies(path, fileName, asts);
      // Component Dependency
      pushUniqueDependencies(newDependencies, dependencies);
    },
    JSXElement: path => {
      linesJSX += getLinesJSX(path);
    }
  };

  componentPath.traverse(functionComponentTraverse, { name });
  postProcessing(graph, aliases);

  const report = findReportWithGraph(graph, fullReport, fileName, name);
  if (report.aggregate) {
    report.aggregate.sloc.jsx = linesJSX;
  } else {
    report.sloc.jsx = linesJSX;
  }

  return {
    graph,
    dependencies,
    lineStart,
    lineEnd,
    kind: 'FunctionComponent'
  };
}
