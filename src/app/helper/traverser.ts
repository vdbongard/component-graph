import { Graph, Link } from '../interfaces';
import { reactMethods } from '../constants/special-methods';
import babelTraverse from '@babel/traverse';
import * as t from '@babel/types';

export function traverse(ast: t.File, fileName: string) {
  const graph: Graph = {
    nodes: [],
    links: []
  };
  const aliases: { [alias: string]: string } = {};
  const dependencies = new Set<string>();
  let superClass = null;

  babelTraverse(ast, {
    ClassDeclaration: path => {
      // Node: Class
      graph.nodes.push({ id: path.node.id.name, group: 2 });

      // SuperClass
      superClass = getSuperClass(path, fileName);
    },
    ClassMethod: path => {
      const methodName = path.node.key.name;
      const isReactMethod = reactMethods.includes(methodName);

      // Node: ClassMethod
      graph.nodes.push({ id: methodName, group: isReactMethod ? 3 : 1 });

      // Link: Class -> ReactMethod
      if (isReactMethod) {
        graph.links.push({
          source: getParentClassName(path),
          target: methodName
        });
      }
    },
    ClassProperty: ({ node }) => {
      if (isFunctionBind(node)) {
        const bindFunctionName = node.value.callee.object.property.name;
        const classPropertyName = node.key.name;
        // Node: ClassMethod
        graph.nodes.push({ id: classPropertyName });
        // Alias
        aliases[classPropertyName] = bindFunctionName;
      }
    },
    MemberExpression: path => {
      if (
        t.isThisExpression(path.node.object) &&
        t.isIdentifier(path.node.property)
      ) {
        const classMethodPath = path.findParent(p => p.isClassMethod());
        if (!classMethodPath) {
          return;
        }
        const classMethodName = classMethodPath.node.key.name;
        pushUniqueLink(
          {
            source: classMethodName,
            target: path.node.property.name
          },
          graph.links
        );
      }
    },
    JSXOpeningElement: path => {
      if (t.isJSXIdentifier(path.node.name)) {
        const importPath = getImportPath(path, path.node.name.name, fileName);
        if (importPath) {
          dependencies.add(importPath);
        }
      }
    }
  });

  // filter out links that have a source/target that is not found in nodes
  graph.links = graph.links.filter(
    link =>
      graph.nodes.find(node => node.id === link.source) &&
      graph.nodes.find(node => node.id === link.target)
  );

  mergeAliasesWithOriginals(graph, aliases);

  return {
    graph,
    dependencies,
    extends: superClass
  };
}

function mergeAliasesWithOriginals(
  graph: Graph,
  aliases: { [alias: string]: string }
) {
  const linkIndexesToRemove = [];

  graph.nodes = graph.nodes.filter(
    node => !Object.keys(aliases).includes(node.id)
  );

  graph.links = graph.links.map((link, index) => {
    if (Object.keys(aliases).includes(link.source)) {
      link.source = aliases[link.source];
    }
    if (Object.keys(aliases).includes(link.target)) {
      link.target = aliases[link.target];
    }
    if (link.source === link.target) {
      linkIndexesToRemove.push(index);
    }
    return link;
  });

  linkIndexesToRemove.forEach(index => {
    graph.links.splice(index, 1);
  });
}

export function pushUniqueLink(link: Link, links: Link[]) {
  if (link.source === link.target) {
    return;
  }

  if (
    links.find(
      searchLink =>
        searchLink.source === link.source && searchLink.target === link.target
    )
  ) {
    return;
  }

  links.push(link);
}

function getAbsolutePath(relativePath: string, basePath: string) {
  const stack = basePath.split('/');
  const parts = relativePath.split('/');

  stack.pop(); // remove current file name

  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '.') {
      continue;
    }
    if (parts[i] === '..') {
      stack.pop();
    } else {
      stack.push(parts[i]);
    }
  }

  return stack.join('/');
}

function getImportPath(path, importName: string, fileName: string) {
  const binding = path.scope.getBinding(importName);

  if (!binding) {
    return;
  }

  if (
    t.isImportDeclaration(binding.path.parent) &&
    t.isStringLiteral(binding.path.parent.source)
  ) {
    const importPath = (binding.path.parentPath.node.source as t.StringLiteral)
      .value;

    // npm module import
    if (!importPath.startsWith('.')) {
      return importPath;
    }

    return getAbsolutePath(importPath, fileName);
  }
}

function getSuperClass(path, fileName: string) {
  if (!path.node.superClass) {
    return;
  }

  let superClassName = '';

  if (t.isIdentifier(path.node.superClass)) {
    superClassName = path.node.superClass.name;
  } else if (t.isMemberExpression(path.node.superClass)) {
    superClassName = path.node.superClass.property.name;
  }

  if (superClassName === 'Component') {
    return;
  }

  return getImportPath(path, superClassName, fileName);
}

function getParentClassName(path) {
  return path.findParent(p => p.isClassDeclaration()).node.id.name;
}

function isFunctionBind(node) {
  return (
    t.isCallExpression(node.value) &&
    t.isMemberExpression(node.value.callee) &&
    t.isIdentifier(node.value.callee.property, { name: 'bind' })
  );
}
