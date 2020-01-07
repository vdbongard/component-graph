import { ComponentMap, Graph, Import, Link } from '../interfaces';
import { reactMethods } from '../constants/special-methods';
import babelTraverse from '@babel/traverse';
import * as t from '@babel/types';

export function traverse(ast: t.File, fileName: string) {
  const components: ComponentMap = {};

  babelTraverse(ast, {
    ClassDeclaration: path => {
      if (isReactClassComponent(path)) {
        path.skip();
        const classComponentName = path.node.id.name;
        components[classComponentName] = traverseClassComponent(
          path,
          classComponentName,
          fileName
        );
      }
    },
    FunctionDeclaration: path => {
      if (isReactFunctionComponent(path)) {
        path.skip();
        const functionComponentName = path.node.id.name;
        console.log('FunctionComponent:', functionComponentName);
        components[functionComponentName] = traverseFunctionComponent(
          path,
          functionComponentName,
          fileName
        );
      }
    },
    'FunctionExpression|ArrowFunctionExpression': path => {
      if (
        isReactFunctionComponent(path) &&
        path.parentPath.isVariableDeclarator()
      ) {
        path.skip();
        const functionComponentName = path.parentPath.node.id.name;
        console.log('FunctionComponent:', functionComponentName);
        components[functionComponentName] = traverseFunctionComponent(
          path,
          functionComponentName,
          fileName
        );
      }
    }
  });

  return components;
}

function traverseClassComponent(componentPath, name, fileName) {
  const graph: Graph = {
    nodes: [],
    links: []
  };
  const aliases: { [alias: string]: string } = {};
  const dependencies = new Set<Import>();
  // SuperClass
  const superClass: Import = getSuperClass(componentPath, fileName);

  // Node: Class
  graph.nodes.push({ id: name, group: 2 });

  const classComponentTraverse = {
    ClassMethod: path => {
      if (['get', 'set'].includes(path.node.kind)) {
        return;
      }
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
          graph.nodes.push({ id: node.key.name });
        }
      }
    },
    MemberExpression: path => {
      if (isThisMemberExpression(path.node)) {
        let parentPath = path.findParent(
          p => p.isClassMethod() || p.isClassProperty()
        );
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
      const dependency = getComponentDependency(path, fileName);
      if (dependency) {
        // Component Dependency
        dependencies.add(dependency);
      }
    }
  };

  componentPath.traverse(classComponentTraverse, { name });
  postProcessing(graph, aliases);

  return {
    graph,
    dependencies,
    extends: superClass
  };
}

function traverseFunctionComponent(componentPath, name, fileName) {
  const graph: Graph = {
    nodes: [],
    links: []
  };
  const aliases: { [alias: string]: string } = {};
  const dependencies = new Set<Import>();

  // Node: FunctionComponent
  graph.nodes.push({ id: name, group: 2 });

  const functionComponentTraverse = {
    'FunctionExpression|ArrowFunctionExpression': (path, state) => {
      if (path.parentPath.isVariableDeclarator()) {
        const functionParentPath = path.getFunctionParent();

        if (isInnerFunction(functionParentPath, state.name)) {
          // Node: InnerFunction
          graph.nodes.push({
            id: path.parentPath
              ? path.parentPath.node.id.name
              : path.node.id.name,
            group: 1
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

      if (isInnerFunction(functionParentPath, state.name)) {
        const target = path.node.name;

        const parent = path.findParent(
          p =>
            (isFunction(p.node) && p.parentPath.isVariableDeclarator()) ||
            p.isFunctionDeclaration()
        );

        if (!parent) {
          return;
        }

        const source = parent.isFunctionDeclaration()
          ? parent.node.id.name
          : parent.parent.id.name;

        if (source) {
          // Link: InnerFunction/FunctionComponent -> InnerFunction
          pushUniqueLink({ source, target }, graph.links);
        }
      }
    },
    JSXOpeningElement: path => {
      const dependency = getComponentDependency(path, fileName);
      if (dependency) {
        // Component Dependency
        dependencies.add(dependency);
      }
    }
  };

  componentPath.traverse(functionComponentTraverse, { name });
  postProcessing(graph, aliases);

  return {
    graph,
    dependencies
  };
}

function postProcessing(graph: Graph, aliases: { [p: string]: string }) {
  mergeAliasesWithOriginals(graph, aliases);

  // filter out links that have a source/target that is not found in nodes
  graph.links = graph.links.filter(
    link =>
      link &&
      graph.nodes.find(node => node.id === link.source) &&
      graph.nodes.find(node => node.id === link.target)
  );
}

function mergeAliasesWithOriginals(
  graph: Graph,
  aliases: { [alias: string]: string }
) {
  graph.nodes = graph.nodes.filter(
    node => !Object.keys(aliases).includes(node.id)
  );

  graph.links = graph.links
    .map(link => {
      if (Object.keys(aliases).includes(link.source)) {
        link.source = aliases[link.source];
      }
      if (Object.keys(aliases).includes(link.target)) {
        link.target = aliases[link.target];
      }
      if (link.source === link.target) {
        return;
      }
      return link;
    })
    .filter(link => link); // filter out links that are undefined
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

function getImportPath(path, importName: string, fileName?: string) {
  const binding = path.scope.getBinding(importName);

  if (
    !binding ||
    !t.isImportDeclaration(binding.path.parent) ||
    !t.isStringLiteral(binding.path.parent.source)
  ) {
    return;
  }

  const importPath: string = binding.path.parentPath.node.source.value;

  // npm module import
  if (!importPath.startsWith('.')) {
    return importPath;
  }

  if (!fileName) {
    return importPath;
  }

  return getAbsolutePath(importPath, fileName);
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

  return {
    name: superClassName,
    source: getImportPath(path, superClassName, fileName) || fileName
  };
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

function isThisMemberExpression(node) {
  return t.isThisExpression(node.object) && t.isIdentifier(node.property);
}

function isFunction(node) {
  return t.isArrowFunctionExpression(node) || t.isFunctionExpression(node);
}

function isClassPropertyFunction(node) {
  return t.isClassProperty(node) && isFunction(node.value);
}

function isReactClassComponent(path) {
  if (!path.node.superClass) {
    return false;
  }

  // check if extends Component
  if (t.isIdentifier(path.node.superClass)) {
    const superClassName = path.node.superClass.name;
    const importPath = getImportPath(path, superClassName);
    if (importPath === 'react' && superClassName === 'Component') {
      return true;
    }
  }
  // check if extends React.Component
  else if (
    t.isMemberExpression(path.node.superClass) &&
    t.isIdentifier(path.node.superClass.object)
  ) {
    const left = path.node.superClass.object.name;
    const right = path.node.superClass.property.name;
    if (
      left === 'React' &&
      getImportPath(path, left) === 'react' &&
      right === 'Component'
    ) {
      return true;
    }
  }

  const renderMethod = path.node.body.body.find(
    method =>
      t.isClassMethod(method) && t.isIdentifier(method.key, { name: 'render' })
  );

  return renderMethod && isReturningJSX(renderMethod);
}

function isReactFunctionComponent(path) {
  return (
    !path.getFunctionParent() &&
    !path.findParent(p => p.isClassDeclaration()) &&
    isReturningJSX(path.node)
  );
}

function isReturningJSX(path) {
  if (!t.isBlockStatement(path.body)) {
    return false;
  }

  const returnStatements = path.body.body.filter(body =>
    t.isReturnStatement(body)
  );

  if (returnStatements.length === 0) {
    return false;
  }

  return returnStatements.every(
    returnStatement =>
      t.isJSXElement(returnStatement.argument) ||
      t.isJSXFragment(returnStatement.argument) ||
      t.isStringLiteral(returnStatement.argument) ||
      t.isNullLiteral(returnStatement.argument)
  );
}

function isInnerFunction(path, functionComponentName: string) {
  return (
    (isFunction(path.node) &&
      path.parentPath.isVariableDeclarator() &&
      path.parentPath.node.id.name === functionComponentName) ||
    (path.isFunctionDeclaration() &&
      path.node.id.name === functionComponentName)
  );
}

function getComponentDependency(path: any, fileName: string) {
  if (t.isJSXIdentifier(path.node.name)) {
    const importName = path.node.name.name;
    const importPath = getImportPath(path, importName, fileName);

    if (!importPath) {
      return;
    }

    return {
      name: importName,
      source: importPath
    };
  }
}
