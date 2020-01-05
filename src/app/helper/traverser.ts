import { Graph, Import, Link, Node } from '../interfaces';
import { reactMethods } from '../constants/special-methods';
import babelTraverse from '@babel/traverse';
import * as t from '@babel/types';

export function traverse(ast: t.File, fileName: string) {
  const graph: Graph = {
    nodes: [],
    links: []
  };
  const aliases: { [alias: string]: string } = {};
  const imports = [];
  const dependencies = new Set<string>();
  let superClass = null;

  babelTraverse(ast, {
    ClassDeclaration: ({ node }) => {
      // Node: Class
      graph.nodes.push({ id: node.id.name, group: 2 });

      // SuperClass
      superClass = getSuperClass(node, imports, fileName);
    },
    ClassMethod: path => {
      const methodName = path.node.key.name;
      const isReactMethod = reactMethods.includes(methodName);

      // Node: ClassMethod
      graph.nodes.push({ id: methodName, group: isReactMethod ? 3 : 1 });

      // Link: Class -> ReactMethod
      if (isReactMethod) {
        graph.links.push({ source: getClassName(path), target: methodName });
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
    'ImportSpecifier|ImportDefaultSpecifier': path => {
      imports.push({
        name: path.node.local.name,
        source: path.parent.source.value
      });
    }
  });

  babelTraverse(ast, {
    MemberExpression: path => {
      if (
        path.node.object.type === 'ThisExpression' &&
        path.node.property.type === 'Identifier' &&
        graph.nodes.find(node => node.id === path.node.property.name)
      ) {
        const classMethodName = getClassMethodName(path);

        if (!classMethodName) {
          return;
        }

        pushUniqueLink(
          {
            source: classMethodName,
            target: path.node.property.name
          },
          graph.links
        );
      }
    },
    CallExpression: path => {
      const calleeName = getCalleeName(path.node.callee);

      if (graph.nodes.find(node => node.id === calleeName)) {
        const classMethodName = getClassMethodName(path);

        if (!classMethodName) {
          return;
        }

        pushUniqueLink(
          {
            source: classMethodName,
            target: calleeName
          },
          graph.links
        );
      }
    },
    JSXIdentifier: path => {
      if (path.container.type === 'JSXOpeningElement') {
        const foundImport = imports.find(
          theImport => theImport.name === path.node.name
        );

        if (foundImport) {
          const importPath = getImportPath(foundImport, fileName);
          dependencies.add(importPath);
        }
      }
    }
  });

  mergeAliasesWithOriginals(graph, aliases);

  return {
    imports,
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

function getCalleeName(callee) {
  if (callee.type === 'MemberExpression') {
    return callee.property.name;
  } else if (callee.type === 'Identifier') {
    return callee.name;
  }
}

function getClassMethodName(path) {
  let currentPath = path;

  while (currentPath.scope.block.type !== 'ClassMethod') {
    currentPath = currentPath.parentPath;

    if (!currentPath) {
      return;
    }
  }

  return currentPath.scope.block.key.name;
}

export function pushUniqueNode(node: Node, nodes: Node[]) {
  if (!nodes.find(searchNode => searchNode.id === node.id)) {
    nodes.push(node);
  }
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

function getImportPath(theImport: Import, basePath: string) {
  // npm module import
  if (!theImport.source.startsWith('.')) {
    return theImport.source;
  }

  return getAbsolutePath(theImport.source, basePath);
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

function getSuperClass(
  node,
  imports: { name: string; source: string }[],
  fileName: string
) {
  if (!node.superClass) {
    return;
  }

  const superClassName =
    node.superClass.name ||
    (node.superClass.property && node.superClass.property.name);
  if (superClassName === 'Component') {
    return;
  }
  const extendsImport = imports.find(
    theImport => theImport.name === superClassName
  );
  if (!extendsImport) {
    return;
  }
  return getImportPath(extendsImport, fileName);
}

function getClassName(path) {
  return path.findParent(p => p.isClassDeclaration()).node.id.name;
}

function isFunctionBind(node) {
  return (
    t.isCallExpression(node.value) &&
    t.isMemberExpression(node.value.callee) &&
    t.isIdentifier(node.value.callee.property, { name: 'bind' })
  );
}
