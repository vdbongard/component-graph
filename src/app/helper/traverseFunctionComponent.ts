import { Component, Graph, Import } from '../interfaces';
import { findReportWithGraph } from './findReport';
import {
  getComponentDependencies,
  getLinesOfCode,
  getMaxJSXNesting,
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
  let maxJSXNesting = 0;

  // Node: FunctionComponent
  graph.nodes.push({
    id: `${name}#${componentPath.node.loc.start.line}`,
    label: name,
    lineStart,
    lineEnd,
    type: 'component',
    kind: 'FunctionComponent'
  });

  const functionComponentTraverse = {
    'FunctionExpression|ArrowFunctionExpression': (path, state) => {
      const allowedFunctionWrapper = ['useCallback'];
      if (
        path.parentPath.isCallExpression() &&
        path.parentPath.parentPath.isVariableDeclarator() &&
        allowedFunctionWrapper.includes(path.parentPath.node.callee.name)
      ) {
        const functionParentPath = path.getFunctionParent();

        if (isFunctionWithName(functionParentPath, state.name)) {
          // Node: InnerFunction
          graph.nodes.push({
            id: `${path.parentPath.parentPath.node.id.name}#${path.parentPath.parentPath.node.id.loc.start.line}`,
            label: path.parentPath.parentPath.node.id.name,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            type: 'innerFunction',
            kind: 'FunctionComponent'
          });
        }
      }
      if (path.parentPath.isVariableDeclarator()) {
        const functionParentPath = path.getFunctionParent();

        if (isFunctionWithName(functionParentPath, state.name)) {
          // Node: InnerFunction
          graph.nodes.push({
            id: path.parentPath
              ? `${path.parentPath.node.id.name}#${path.parentPath.node.id.loc.start.line}`
              : `${path.node.id.name}#${path.node.id.loc.start.line}`,
            label: path.parentPath ? path.parentPath.node.id.name : path.node.id.name,
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
    'JSXElement|JSXFragment': path => {
      // skip if not root level JSXElement aka has parent JSXElement
      if (path.findParent(p => p.isJSXElement() || p.isJSXFragment())) {
        return 0;
      }
      linesJSX += getLinesOfCode(path);
      maxJSXNesting = Math.max(getMaxJSXNesting(path), maxJSXNesting);
    }
  };

  componentPath.traverse(functionComponentTraverse, { name });
  postProcessing(graph, aliases);

  const componentReport = findReportWithGraph(graph, fullReport, fileName, name);
  const report = componentReport.aggregate ? componentReport.aggregate : componentReport;

  report.sloc.jsx = linesJSX;
  report.maxJsxNesting = maxJSXNesting;

  return {
    graph,
    dependencies,
    lineStart,
    lineEnd,
    kind: 'FunctionComponent'
  };
}
