import { FileMap, Graph, Import, Node } from '../interfaces';
import { FileWithPath } from './getFilesAsync';
import { filterInvalidLinks, pushUniqueLink } from './traverseHelper';

export function generateAppGraph(fileMap: FileMap, componentFiles: FileWithPath[]): Graph {
  const nodes: Node[] = [];
  const links = [];

  for (const [fileName, file] of Object.entries(fileMap)) {
    if (!file.components) {
      return;
    }
    for (const [componentName, component] of Object.entries(file.components)) {
      const functions = [...component.graph.nodes].sort(previewCircleCompare);
      functions.shift(); // remove component node

      nodes.push({
        id: `${fileName}#${componentName}`,
        label: componentName
          .split('/')
          .pop()
          .split('.')[0],
        group: 1,
        functions,
        type: component.type
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
          console.warn('Dependency not found:', dependency);
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

function previewCircleCompare(a: Node, b: Node) {
  if (a.group !== b.group) {
    return a.group - b.group;
  }

  // React functions
  if (a.returnsJSX && a.group === 2) {
    return 1;
  }

  if (b.returnsJSX && b.group === 2) {
    return -1;
  }

  // other functions
  if (a.returnsJSX && a.group === 3) {
    return -1;
  }

  if (b.returnsJSX && b.group === 3) {
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
