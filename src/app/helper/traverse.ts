import babelTraverse from '@babel/traverse';
import * as t from '@babel/types';
import { AstWithPath, ComponentMap } from '../interfaces';
import { traverseClassComponent } from './traverseClassComponent';
import { traverseFunctionComponent } from './traverseFunctionComponent';
import {
  getComponentDependency,
  getComponentFileFromImportPath,
  getImportPathFromImportSpecifier,
  isReactClassComponent,
  isReactFunctionComponent
} from './traverseHelper';

export function traverse(asts: AstWithPath[], fileName: string) {
  const ast: t.File = asts.find(theAst => theAst.srcPath === fileName).ast;
  const components: ComponentMap = {};
  let defaultExport: string = null;

  if (!ast) {
    console.error('AST not found:', fileName);
  }

  babelTraverse(ast, {
    ClassDeclaration: path => {
      if (isReactClassComponent(path, asts, fileName)) {
        path.skip();
        const classComponentName = path.node.id.name;
        components[classComponentName] = traverseClassComponent(
          path,
          classComponentName,
          fileName,
          asts
        );
      }
    },
    FunctionDeclaration: path => {
      if (isReactFunctionComponent(path)) {
        path.skip();
        const functionComponentName = path.node.id.name;
        components[functionComponentName] = traverseFunctionComponent(
          path,
          functionComponentName,
          fileName,
          asts
        );
      }
    },
    'FunctionExpression|ArrowFunctionExpression': path => {
      if (!path.parentPath.isVariableDeclarator() && !path.parentPath.isCallExpression()) {
        return;
      }
      if (isReactFunctionComponent(path)) {
        path.skip();
        const functionComponentName = path.findParent(p => p.isVariableDeclarator()).node.id.name;
        components[functionComponentName] = traverseFunctionComponent(
          path,
          functionComponentName,
          fileName,
          asts
        );
      }
    },
    ExportDefaultDeclaration: path => {
      if (path.node.declaration.id) {
        defaultExport = path.node.declaration.id.name;
      } else if (
        path.get('declaration').isAssignmentExpression() &&
        path.get('declaration.left').isIdentifier()
      ) {
        defaultExport = path.node.declaration.left.name;
      } else if (path.get('declaration').isIdentifier()) {
        defaultExport = path.node.declaration.name;

        const binding = path.scope.getBinding(defaultExport);
        let name = '';
        if (binding.path.isImportDefaultSpecifier()) {
          name = 'default';
        } else if (binding.path.isImportSpecifier()) {
          name = defaultExport;
        } else {
          return;
        }
        const source = getImportPathFromImportSpecifier(
          binding.path,
          defaultExport,
          asts,
          fileName
        );

        const componentFile = getComponentFileFromImportPath(source, asts);

        if (!componentFile) {
          console.error('Component file not found', source);
          return;
        }

        const componentPath = componentFile.srcPath;

        defaultExport = `${componentPath}#${name}`;
      } else if (path.get('declaration').isCallExpression()) {
        const identifierArgument = path
          .get('declaration.arguments')
          .find(argument => argument.isIdentifier());
        if (identifierArgument) {
          defaultExport = identifierArgument.node.name;
        }
      } else if (
        path.get('declaration').isFunctionDeclaration() &&
        isReactFunctionComponent(path.get('declaration'))
      ) {
        defaultExport = path.node.id.name;
      }
    },
    CallExpression: path => {
      if (
        !path.parentPath.isVariableDeclarator() ||
        !path.get('callee').isCallExpression() ||
        path.node.callee.callee.name !== 'connect' ||
        path.get('arguments').length === 0
      ) {
        return;
      }

      const arg = path.get('arguments')[0];

      if (arg.isIdentifier()) {
        const componentDependency = getComponentDependency(arg, fileName, asts);
        if (!componentDependency) {
          return;
        }
        const componentName = path.parentPath.node.id.name;
        components[componentName] = {
          dependencies: [componentDependency]
        };
      }
    }
  });

  return { components, defaultExport };
}
