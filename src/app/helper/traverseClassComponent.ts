import * as t from '@babel/types';
import { reactMethods } from '../constants/special-methods';
import { Component, Graph, Import } from '../interfaces';
import { findReportWithGraph } from './findReport';
import {
  getComponentDependencies,
  getLinesJSX,
  getParentClassName,
  getSuperClass,
  isClassPropertyFunction,
  isFunction,
  isFunctionBind,
  isReturningJSX,
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

  // Node: Class
  graph.nodes.push({
    id: name,
    group: 1,
    lineStart,
    lineEnd,
    type: 'component',
    kind: 'ClassComponent'
  });

  const classComponentTraverse = {
    ClassMethod: path => {
      if (['get', 'set'].includes(path.node.kind)) {
        return;
      }
      const methodName = path.node.key.name;
      const isReactMethod = reactMethods.includes(methodName);
      // Node: ClassMethod
      graph.nodes.push({
        id: methodName,
        group: isReactMethod ? 2 : 3,
        lineStart: path.node.loc.start.line,
        lineEnd: path.node.loc.end.line,
        returnsJSX: isReturningJSX(path, false),
        type: 'innerFunction',
        kind: 'ClassComponent'
      });
      // Link: Class -> ReactMethod
      if (isReactMethod) {
        graph.links.push({
          source: getParentClassName(path),
          target: methodName
        });
      }
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
          graph.nodes.push({
            id: node.key.name,
            lineStart: node.loc.start.line,
            lineEnd: node.loc.end.line,
            group: 3,
            returnsJSX: isReturningJSX(path, false),
            type: 'innerFunction',
            kind: 'ClassComponent'
          });
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
    JSXElement: path => {
      linesJSX += getLinesJSX(path);
    }
  };

  componentPath.traverse(classComponentTraverse, { name });
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
    extends: superClass,
    lineStart,
    lineEnd,
    kind: 'ClassComponent'
  };
}
