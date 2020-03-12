import { FileMap, Graph, Import, Node } from '../interfaces';
import { findReport } from './findReport';
import { FileWithPath } from './getFilesAsync';
import { filterInvalidLinks, pushUniqueLink } from './traverseHelper';

export function generateAppGraph(
  fileMap: FileMap,
  componentFiles: FileWithPath[],
  fullReport: any
): Graph {
  const nodes: Node[] = [];
  const links = [];

  for (const [fileName, file] of Object.entries(fileMap)) {
    if (!file.components) {
      return;
    }
    for (const [componentName, component] of Object.entries(file.components)) {
      if (!component.graph) {
        continue;
      }

      // remove the component node which is the first element
      const functions = [...component.graph.nodes.slice(1)].sort(previewCircleCompare);

      nodes.push({
        id: `${fileName}#${componentName}`,
        label: componentName
          .split('/')
          .pop()
          .split('.')[0],
        functions,
        type: 'component',
        kind: component.kind,
        report: findReport(fullReport, fileMap, fileName, componentName),
        extends: !!component.extends
      });

      if (component.extends) {
        component.extends.source = getCompleteFilePath(
          component.extends.source,
          fileName,
          componentFiles
        );
      }

      component.dependencies = [...component.dependencies]
        .map(dependency => {
          dependency.source = getCompleteFilePath(dependency.source, fileName, componentFiles);
          return dependency.source && dependency;
        })
        .filter(d => d);

      component.dependencies.forEach(dependency => {
        if (!dependency.source.startsWith('/')) {
          return;
        }

        if (!Object.keys(fileMap).find(name => name.startsWith(dependency.source))) {
          // console.warn('Dependency not found:', dependency);
          return;
        }

        if (dependency.name === 'default') {
          const defaultDependency = getDefaultExport(fileMap, dependency, fileName);

          if (!defaultDependency) {
            return;
          }

          dependency = defaultDependency;
        }

        const source = `${fileName}#${componentName}`;
        const target = `${dependency.source}#${dependency.name}`;
        pushUniqueLink({ source, target }, links);
      });

      if (component.extends) {
        const name = component.extends.name;
        const source = component.extends.source;

        pushUniqueLink(
          {
            source: `${source}#${name}`,
            target: `${fileName}#${componentName}`,
            inherits: true
          },
          links
        );
      }
    }
  }

  return filterInvalidLinks({ nodes, links }, true);
}

/**
 * Sorts nodes by special functions and functions returning JSX:
 * [special, no jsx] -> [special, jsx] -> [no special, jsx] -> [no special, no jsx]
 */
function previewCircleCompare(a: Node, b: Node) {
  if (a.special && !b.special) {
    return -1;
  }

  if (!a.special && b.special) {
    return 1;
  }

  if (a.returnsJSX && a.special) {
    return 1;
  }

  if (b.returnsJSX && b.special) {
    return -1;
  }

  if (a.returnsJSX && !a.special) {
    return -1;
  }

  if (b.returnsJSX && !b.special) {
    return 1;
  }
}

function getCompleteFilePath(importPath: string, fileName: string, componentFiles: FileWithPath[]) {
  const hasExtension = importPath.includes('.');
  const filePath = hasExtension ? importPath : importPath + '.';

  let file = componentFiles.find(componentFile => componentFile.path.startsWith(filePath));

  if (!file && !hasExtension) {
    const indexPath = importPath + '/index.';
    file = componentFiles.find(componentFile => componentFile.path.startsWith(indexPath));
  }

  if (!file && importPath.startsWith('/')) {
    console.error(`File path not found: ${importPath} (${fileName})`);
    return;
  }

  return file ? file.path : importPath;
}

function getDefaultExport(fileMap: FileMap, dependency: Import, currentFileName: string): Import {
  const fileName = Object.keys(fileMap).find(name => name === dependency.source);

  if (!fileName || !fileMap[fileName].defaultExport) {
    console.error(`Default export not found: ${dependency.source} (${currentFileName})`);
    return;
  }

  const defaultExport = fileMap[fileName].defaultExport;

  // default export is an import
  if (defaultExport.startsWith('/')) {
    const parts = defaultExport.split('#');
    const importPath = parts[0];
    const importName = parts[1];

    if (importName === 'default') {
      return getDefaultExport(fileMap, { source: importPath, name: importName }, currentFileName);
    }
  }

  dependency.name = defaultExport;
  return dependency;
}
