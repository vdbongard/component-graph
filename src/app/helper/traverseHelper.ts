import babelTraverse from '@babel/traverse';
import * as t from '@babel/types';
import { NodePath } from 'babel-traverse';
import { reactMethods } from '../constants/special-methods';
import { AstWithPath, Graph, Import, Link } from '../interfaces';

export function postProcessing(graph: Graph, aliases: { [p: string]: string }) {
  mergeAliasesWithOriginals(graph, aliases);
  filterInvalidLinks(graph);
}

export function mergeAliasesWithOriginals(graph: Graph, aliases: { [alias: string]: string }) {
  graph.nodes = graph.nodes.filter(node => !Object.keys(aliases).includes(node.id));

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

export function filterInvalidLinks(graph: Graph, logging = false) {
  graph.links = graph.links.filter(link => {
    if (
      link &&
      graph.nodes.find(node => node.id === link.source) &&
      graph.nodes.find(node => node.id === link.target)
    ) {
      return true;
    } else {
      if (logging) {
        console.warn('Found invalid link:', link);
      }
      return false;
    }
  });
  return graph;
}

export function pushUniqueLink(link: Link, links: Link[]) {
  if (link.source === link.target) {
    return;
  }

  if (
    links.find(searchLink => searchLink.source === link.source && searchLink.target === link.target)
  ) {
    return;
  }

  links.push(link);
}

export function pushUniqueDependencies(newDependencies: Import[], dependencies: Import[]) {
  newDependencies.forEach(dependency => pushUniqueDependency(dependency, dependencies));
}

export function pushUniqueDependency(dependency: Import, dependencies: Import[]) {
  if (!dependency) {
    return;
  }

  if (
    dependencies.find(
      searchDependency =>
        searchDependency.source === dependency.source && searchDependency.name === dependency.name
    )
  ) {
    return;
  }

  dependencies.push(dependency);
}

export function getImportPathFromBinding(binding) {
  if (
    !binding ||
    !t.isImportDeclaration(binding.path.parent) ||
    !t.isStringLiteral(binding.path.parent.source)
  ) {
    return;
  }

  return binding.path;
}

export function getImportBindingPath(path, importName) {
  const binding = path.scope.getBinding(importName);
  return getImportPathFromBinding(binding);
}

export function getImportPath(path, importName: string, asts: AstWithPath[], fileName?: string) {
  const importBindingPath = getImportBindingPath(path, importName);

  if (!importBindingPath) {
    return;
  }

  return getImportPathFromImportSpecifier(importBindingPath, importName, asts, fileName);
}

export function getImportPathFromImportSpecifier(
  importSpecifierPath,
  importName: string,
  asts: AstWithPath[],
  fileName?: string
) {
  const importSource: string = importSpecifierPath.parentPath.node.source.value;

  if (!fileName) {
    return importSource;
  }

  if (!importSource.startsWith('.')) {
    const componentFile = getComponentFileFromImportPath(importSource, asts);

    if (!componentFile) {
      return;
    }

    return componentFile.srcPath;
  }

  return getAbsolutePath(importSource, fileName);
}

export function getAbsolutePath(relativePath: string, basePath: string) {
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

export function getSuperClass(path, fileName: string, asts: AstWithPath[]) {
  if (!path.node.superClass) {
    return;
  }

  let superClassName = '';

  if (t.isIdentifier(path.node.superClass)) {
    superClassName = path.node.superClass.name;
  } else if (t.isMemberExpression(path.node.superClass)) {
    superClassName = path.node.superClass.property.name;
  }

  if (['Component', 'PureComponent'].includes(superClassName)) {
    return;
  }

  return {
    name: superClassName,
    source: getImportPath(path, superClassName, asts, fileName) || fileName
  };
}

export function getParentClassName(path) {
  return path.findParent(p => p.isClassDeclaration()).node.id.name;
}

export function isFunctionBind(node) {
  return (
    t.isCallExpression(node.value) &&
    t.isMemberExpression(node.value.callee) &&
    t.isIdentifier(node.value.callee.property, { name: 'bind' })
  );
}

export function isThisMemberExpression(node) {
  return t.isThisExpression(node.object) && t.isIdentifier(node.property);
}

export function isFunction(node) {
  return t.isArrowFunctionExpression(node) || t.isFunctionExpression(node);
}

export function isClassPropertyFunction(node) {
  return t.isClassProperty(node) && isFunction(node.value);
}

export function isReactClassComponent(path, asts: AstWithPath[], fileName: string) {
  if (!path.node.superClass) {
    return false;
  }

  // check if extends <Class>
  if (t.isIdentifier(path.node.superClass)) {
    const superClassName = path.node.superClass.name;
    const importPath = getImportPath(path, superClassName, asts);

    if (!importPath) {
      return false;
    }

    // check if extends Component/PureComponent
    if (importPath === 'react' && ['Component', 'PureComponent'].includes(superClassName)) {
      return true;
    }

    if (!importPath.startsWith('.')) {
      return false;
    }

    const absolutePath = getAbsolutePath(importPath, fileName);
    const file = getComponentFileFromImportPath(absolutePath, asts);

    if (!file) {
      return false;
    }

    let superClassPath;
    babelTraverse(file.ast, {
      enter: enterPath => {
        const binding = enterPath.scope.getBinding(superClassName);
        if (binding) {
          superClassPath = binding.path;
        }
        enterPath.stop();
      }
    });

    return superClassPath ? isReactClassComponent(superClassPath, asts, fileName) : false;
  }
  // check if extends <Import>.<Class>
  else if (
    t.isMemberExpression(path.node.superClass) &&
    t.isIdentifier(path.node.superClass.object)
  ) {
    const left = path.node.superClass.object.name;
    const right = path.node.superClass.property.name;
    // check if extends React.Component/PureComponent
    if (
      left === 'React' &&
      getImportPath(path, left, asts) === 'react' &&
      ['Component', 'PureComponent'].includes(right)
    ) {
      return true;
    }
  }

  const renderMethodPath = path
    .get('body.body')
    .find(method => method.isClassMethod() && method.get('key').isIdentifier({ name: 'render' }));

  return renderMethodPath && isReturningJSX(renderMethodPath);
}

export function isReactFunctionComponent(path) {
  return (
    !path.getFunctionParent() &&
    !path.findParent(p => p.isClassDeclaration()) &&
    isReturningJSX(path)
  );
}

export function isReturningJSX(path, skipPath = true) {
  if (!t.isBlockStatement(path.node.body)) {
    return false;
  }

  let returnsAtLeastOnce = false;
  let returnsJSXOrNull = true;
  let returnsJSXOnce = false;

  if (skipPath) {
    path.skip();
  }

  path.traverse({
    ReturnStatement: returnStatementPath => {
      returnsAtLeastOnce = true;
      if (
        !returnStatementPath.get('argument').isJSXElement() &&
        !returnStatementPath.get('argument').isJSXFragment() &&
        !returnStatementPath.get('argument').isNullLiteral()
      ) {
        returnStatementPath.stop();
        returnsJSXOrNull = false;
        return;
      }
      if (
        returnStatementPath.get('argument').isJSXElement() ||
        returnStatementPath.get('argument').isJSXFragment()
      ) {
        returnsJSXOnce = true;
      }
      if (
        returnStatementPath.get('argument').isCallExpression() &&
        returnStatementPath.get('argument.callee').isIdentifier()
      ) {
        const callBind = returnStatementPath.scope.getBinding(
          returnStatementPath.node.argument.callee.name
        );
        if (!callBind) {
          returnStatementPath.stop();
          returnsJSXOrNull = false;
          return;
        }
        if (callBind.path.isFunctionDeclaration()) {
          returnsJSXOrNull = isReturningJSX(callBind.path);
          if (!returnsJSXOrNull) {
            returnStatementPath.stop();
            return;
          }
        } else if (callBind.path.isVariableDeclarator() && isFunction(callBind.path.node.init)) {
          returnsJSXOrNull = isReturningJSX(callBind.path.get('init'));
          if (!returnsJSXOrNull) {
            returnStatementPath.stop();
            return;
          }
        } else if (callBind.constantViolations.length === 0) {
          returnsJSXOrNull = false;
          returnStatementPath.stop();
          return;
        } else if (callBind.constantViolations.length > 0) {
          callBind.constantViolations.forEach(constantViolation => {
            if (
              constantViolation.isAssignmentExpression() &&
              isFunction(constantViolation.node.right)
            ) {
              returnsJSXOrNull = isReturningJSX(constantViolation.get('right'));
              if (!returnsJSXOrNull) {
                returnStatementPath.stop();
                return;
              }
            } else {
              returnsJSXOrNull = false;
              returnStatementPath.stop();
              return;
            }
          });
        }
      }
    },
    'FunctionExpression|ArrowFunctionExpression': functionPath => {
      functionPath.skip();
    },
    FunctionDeclaration: functionDeclarationPath => {
      functionDeclarationPath.skip();
    }
  });

  return returnsAtLeastOnce && (returnsJSXOrNull || returnsJSXOnce);
}

export function isFunctionWithName(path, functionComponentName: string) {
  return (
    path &&
    ((isFunction(path.node) &&
      path.parentPath.isVariableDeclarator() &&
      path.parentPath.node.id.name === functionComponentName) ||
      (path.isFunctionDeclaration() && path.node.id.name === functionComponentName))
  );
}

export function getComponentDependencies(path, fileName: string, asts: AstWithPath[]) {
  const dependencies = [];

  const dependency = getComponentDependency(path, fileName, asts);

  if (dependency) {
    dependencies.push(dependency);
  }

  path.traverse({
    Identifier: identifierPath => {
      if (identifierPath.parentPath.isTSTypeReference()) {
        return;
      }

      const innerDependency = getComponentDependency(identifierPath, fileName, asts);
      if (innerDependency) {
        dependencies.push(innerDependency);
      }
    }
  });

  return dependencies;
}

export function getComponentDependency(path, fileName: string, asts: AstWithPath[]) {
  let importName;

  if (t.isJSXIdentifier(path.node.name)) {
    importName = path.node.name.name;
  } else if (t.isIdentifier(path.node)) {
    importName = path.node.name;
  } else {
    return;
  }

  return getComponentDependencyByName(importName, path, fileName, asts);
}

export function getComponentDependencyByName(
  name: string,
  path,
  fileName: string,
  asts: AstWithPath[]
) {
  const binding = path.scope.getBinding(name);

  if (!binding) {
    return;
  }

  // check if dependency is in the same file
  if (
    (binding.path.isVariableDeclarator() && isReactFunctionComponent(binding.path.get('init'))) ||
    (binding.path.isClassDeclaration() && isReactClassComponent(binding.path, asts, fileName)) ||
    (binding.path.isFunctionDeclaration() && isReactFunctionComponent(binding.path))
  ) {
    return {
      name,
      source: fileName
    };
  }

  // check if dependency has a type annotation
  if (binding.path.isVariableDeclarator()) {
    const typeName = binding.path.node?.id?.typeAnnotation?.typeAnnotation?.typeName?.name;

    if (typeName) {
      return getComponentDependencyByName(typeName, binding.path, fileName, asts);
    }
  }

  const importBindingPath = getImportPathFromBinding(binding);

  if (!importBindingPath) {
    return;
  }

  const importPath = getImportPathFromImportSpecifier(importBindingPath, name, asts, fileName);

  if (!importPath) {
    return;
  }

  if (!isComponentFileImport(importPath, asts)) {
    return;
  }

  let defaultImport = false;
  if (importBindingPath.isImportDefaultSpecifier()) {
    defaultImport = true;
  }

  return {
    name: defaultImport ? 'default' : name,
    source: importPath
  };
}

export function isComponentFileImport(importPath: string, asts: AstWithPath[]) {
  return !!getComponentFileFromImportPath(importPath, asts);
}

export function getComponentFileFromImportPath(
  importPath: string,
  asts: AstWithPath[]
): AstWithPath {
  if (!importPath.startsWith('/')) {
    const searchString = '/src/';
    const index = asts[0].srcPath.indexOf(searchString);
    if (index >= 0) {
      const srcPath = asts[0].srcPath.substr(0, index + searchString.length);
      return getComponentFileFromImportPath(srcPath + importPath, asts);
    }
    return;
  }

  const filePath = importPath.includes('.') ? importPath : importPath + '.';

  let file = asts.find(componentFile => componentFile.srcPath.startsWith(filePath));

  if (!file) {
    const indexPath = importPath + '/index.';
    file = asts.find(componentFile => componentFile.srcPath.startsWith(indexPath));
  }

  return file;
}

export function findCallExpressionInnerArgument(path) {
  const identifierArgument = path.get('arguments').find(argument => argument.isIdentifier());

  if (!identifierArgument) {
    const innerCallExpression = path.get('arguments').find(argument => argument.isCallExpression());

    if (innerCallExpression) {
      return findCallExpressionInnerArgument(innerCallExpression);
    }
  }

  return identifierArgument;
}

export function getLinesOfCode(path: NodePath) {
  return path.node.loc.end.line - path.node.loc.start.line + 1;
}

export function getMaxJSXNesting(path) {
  let level = 1;

  if (path.isJSXElement() || path.isJSXFragment()) {
    let maxNestedLevel = 0;
    path.get('children').forEach(childPath => {
      maxNestedLevel = Math.max(getMaxJSXNesting(childPath), maxNestedLevel);
    });
    level += maxNestedLevel;
  } else if (path.isJSXExpressionContainer()) {
    let maxNestedLevel = 0;
    path.traverse({
      JSXElement: childPath => {
        childPath.skip();
        maxNestedLevel = Math.max(getMaxJSXNesting(childPath), maxNestedLevel);
      }
    });
    level += maxNestedLevel;
  }

  return level;
}

export function isUsingThis(path) {
  let foundThis = false;

  path.traverse({
    ThisExpression: () => {
      foundThis = true;
    }
  });

  return foundThis;
}

export function addInnerFunctionToGraph(
  graph: Graph,
  functionExpressionPath,
  methodName: string,
  noLink?: boolean
) {
  const isReactMethod = reactMethods.includes(methodName);
  // Node inner function
  graph.nodes.push({
    id: methodName,
    lineStart: functionExpressionPath.node.loc.start.line,
    lineEnd: functionExpressionPath.node.loc.end.line,
    returnsJSX: isReturningJSX(functionExpressionPath, false),
    type: 'innerFunction',
    special: isReactMethod,
    kind: 'ClassComponent',
    isUsingThis: isUsingThis(functionExpressionPath)
  });
  // Link: Class -> ReactMethod
  if (isReactMethod && !noLink) {
    graph.links.push({
      source: getParentClassName(functionExpressionPath),
      target: methodName
    });
  }
}

export function addThisExpressionLink(path, graph: Graph) {
  // no this.foobar = ...
  if (path.parentPath.isAssignmentExpression() && path.parentKey === 'left') {
    return;
  }

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
