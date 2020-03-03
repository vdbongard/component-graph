import * as t from '@babel/types';
import { Component, Graph, Import } from '../interfaces';
import { findReportWithGraph } from './findReport';
import {
  addInnerFunctionToGraph,
  addThisExpressionLink,
  getComponentDependencies,
  getLinesOfCode,
  getMaxJSXNesting,
  getSuperClass,
  isFunction,
  isFunctionBind,
  isThisMemberExpression,
  postProcessing,
  pushUniqueDependencies
} from './traverseHelper';

export function traverseClassComponent(componentPath, name, fileName, asts, fullReport): Component {
  const graph: Graph = {
    nodes: [],
    links: []
  };
  const aliases: { [alias: string]: string } = {};
  const dependencies: Import[] = [];
  // SuperClass
  const superClass: Import = getSuperClass(componentPath, fileName, asts);
  const lineStart: number = componentPath.node.loc.start.line;
  const lineEnd: number = componentPath.node.loc.end.line;
  let linesJSX = 0;
  let maxJSXNesting = 0;

  // Node: Class
  graph.nodes.push({
    id: name,
    lineStart,
    lineEnd,
    type: 'component',
    kind: 'ClassComponent'
  });

  const classComponentTraverse = {
    ClassMethod: path => {
      // filter out getter and setter functions
      if (['get', 'set'].includes(path.node.kind)) {
        return;
      }
      // Node: ClassMethod
      // Link: Class -> ReactMethod
      addInnerFunctionToGraph(graph, path, path.node.key.name);
    },
    ClassProperty: path => {
      const { node } = path;
      if (isFunctionBind(node)) {
        const bindFunctionName = node.value.callee.object.property.name;
        const classPropertyName = node.key.name;
        // Alias classProperty = this.classMethod.bind(this)
        aliases[classPropertyName] = bindFunctionName;
      } else if (isFunction(node.value)) {
        if (
          t.isCallExpression(node.value.body) &&
          t.isMemberExpression(node.value.body.callee) &&
          isThisMemberExpression(node.value.body.callee)
        ) {
          // Alias classProperty = args => this.classMethod(args)
          aliases[node.key.name] = node.value.body.callee.property.name; // pipe function name
        } else {
          // Node classProperty = () => {}
          // Link: Class -> ReactMethod
          addInnerFunctionToGraph(graph, path, path.node.key.name);
        }
      }
    },
    MemberExpression: path => {
      if (isThisMemberExpression(path.node)) {
        // Link: Method/Class -> MemberExpression (this.<property>)
        addThisExpressionLink(path, graph);

        const functionParent = path.getFunctionParent();

        // not in constructor scope
        if (!functionParent || !functionParent.get('key').isIdentifier({ name: 'constructor' })) {
          return;
        }

        // no function expression
        if (!isFunction(path.parentPath.get('right').node)) {
          return;
        }

        // Node MemberExpression (this.<property>) in constructor
        addInnerFunctionToGraph(graph, path.parentPath.get('right'), path.node.property.name, true);
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

  componentPath.traverse(classComponentTraverse, { name });
  postProcessing(graph, aliases);

  const componentReport = findReportWithGraph(graph, fullReport, fileName, name);
  const report = componentReport.aggregate ? componentReport.aggregate : componentReport;

  report.sloc.jsx = linesJSX;
  report.maxJsxNesting = maxJSXNesting;

  return {
    graph,
    dependencies,
    extends: superClass,
    lineStart,
    lineEnd,
    kind: 'ClassComponent'
  };
}
