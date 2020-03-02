import * as t from '@babel/types';
import { Component, Graph, Import } from '../interfaces';
import { findReportWithGraph } from './findReport';
import {
  addInnerFunctionToGraph,
  getComponentDependencies,
  getLinesOfCode,
  getMaxJSXNesting,
  getSuperClass,
  isClassPropertyFunction,
  isFunction,
  isFunctionBind,
  isThisMemberExpression,
  postProcessing,
  pushUniqueDependencies,
  pushUniqueLink
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
      addInnerFunctionToGraph(graph, path);
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
          addInnerFunctionToGraph(graph, path);
        }
      }
    },
    MemberExpression: path => {
      if (isThisMemberExpression(path.node)) {
        let parentPath = path.findParent(p => p.isClassMethod() || p.isClassProperty());
        if (!parentPath) {
          return;
        }

        if (
          parentPath.isClassProperty() &&
          !isClassPropertyFunction(parentPath.node) &&
          path.parentPath.isCallExpression()
        ) {
          parentPath = parentPath.findParent(p => p.isClassDeclaration());
        }

        const parentName = parentPath.isClassDeclaration()
          ? parentPath.node.id.name
          : parentPath.node.key.name;
        // Link: Method/Class -> MemberExpression (this.<property>)
        pushUniqueLink(
          {
            source: parentName,
            target: path.node.property.name
          },
          graph.links
        );
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
