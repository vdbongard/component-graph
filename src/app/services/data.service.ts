import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  AstWithPath,
  FileMap,
  Graph,
  Import,
  Node,
  NodeSelection
} from '../interfaces';
import { FileWithPath } from '../helper/getFilesAsync';
import { excludedFolders, supportedExtensions } from '../constants/files';
import escomplexProject from 'typhonjs-escomplex-project';
import { parse } from '../helper/parser';
import {
  filterInvalidLinks,
  pushUniqueLink,
  traverse
} from '../helper/traverser';
import data from '../constants/data';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  files: FileWithPath[] = [];
  componentFiles: FileWithPath[];

  fileMap: FileMap = {};
  appGraph: Graph = {
    nodes: [],
    links: []
  };
  report;

  graphData$ = new Subject<Graph>();
  selectedNode$ = new BehaviorSubject<NodeSelection>(undefined);
  progress$ = new BehaviorSubject<number>(undefined);

  constructor() {}

  async setFiles(files: FileWithPath[]) {
    console.log('Loaded files count:', files.length);
    this.resetData();
    this.componentFiles = files.filter(this.isComponentFile);
    console.log('Component files:', this.componentFiles);
    const asts: AstWithPath[] = [];

    for (const [index, file] of this.componentFiles.entries()) {
      const { ast, code } = await this.setFile(file);
      asts.push({ ast, srcPath: file.path });
      this.fileMap[file.path] = { code };
      this.progress$.next(((index + 1) / this.componentFiles.length) * 50);
    }

    for (const [index, file] of this.componentFiles.entries()) {
      const { components, defaultExport } = await new Promise(resolve =>
        setTimeout(() => resolve(traverse(asts, file.path)), 0)
      );
      this.fileMap[file.path].components = components;
      this.fileMap[file.path].defaultExport = defaultExport;
      this.progress$.next(((index + 1) / this.componentFiles.length) * 50 + 50);
    }

    // filter out files that have no components or default component export
    this.fileMap = Object.entries(this.fileMap)
      .filter(
        ([_, file]) =>
          file.components ||
          (file.defaultExport && file.defaultExport.startsWith('/'))
      )
      .reduce((acc, [key, val]) => Object.assign(acc, { [key]: val }), {});

    console.log('FileMap:', this.fileMap);
    this.report = escomplexProject.analyze(asts);
    console.log('Report:', this.report);
    if (!this.hasSingleComponent()) {
      this.appGraph = this.generateAppGraph(this.fileMap);
    }
    this.progress$.next(undefined);
    this.setComponentGraph();
  }

  async setFile(file: FileWithPath) {
    const code = await file.file.text();
    const ast = parse(code, file.path);
    return { ast, code };
  }

  setComponentGraph(componentId?: string) {
    if (componentId) {
      const [fileName, componentName] = componentId.split('#');

      if (
        this.fileMap[fileName] &&
        this.fileMap[fileName].components[componentName]
      ) {
        this.graphData$.next(
          this.fileMap[fileName].components[componentName].graph
        );
        return;
      }
    }

    // if only one component show it's graph instead of the app graph
    if (this.hasSingleComponent()) {
      this.graphData$.next(
        Object.values(Object.values(this.fileMap)[0].components)[0].graph
      );
      return;
    }

    this.graphData$.next(this.appGraph);
  }

  selectNode(node: Node, componentId: string) {
    const selectedNode = {
      id: node.id,
      label: node.label,
      report: this.findReport(node.id, componentId)
    };
    console.log('Select node: ', selectedNode);
    this.selectedNode$.next(selectedNode);
  }

  private generateAppGraph(fileMap: FileMap): Graph {
    const nodes = [];
    const links = [];

    for (const [fileName, file] of Object.entries(fileMap)) {
      if (!file.components) {
        return;
      }
      for (const [componentName, component] of Object.entries(
        file.components
      )) {
        nodes.push({
          id: `${fileName}#${componentName}`,
          label: componentName
            .split('/')
            .pop()
            .split('.')[0]
        });

        if (component.extends) {
          component.extends.source = this.getCompleteFilePath(
            component.extends.source,
            fileName
          );
        }

        component.dependencies = [...component.dependencies]
          .map(dependency => {
            dependency.source = this.getCompleteFilePath(
              dependency.source,
              fileName
            );
            return dependency.source && dependency;
          })
          .filter(d => d);

        component.dependencies.forEach(dependency => {
          if (!dependency.source.startsWith('/')) {
            return;
          }

          if (
            !Object.keys(fileMap).find(name =>
              name.startsWith(dependency.source)
            )
          ) {
            console.warn('Dependency not found:', dependency);
            return;
          }

          if (dependency.name === 'default') {
            const defaultDependency = this.getDefaultExport(
              fileMap,
              dependency,
              fileName
            );

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
              target: `${fileName}#${componentName}`
            },
            links
          );
        }
      }
    }

    return filterInvalidLinks({ nodes, links }, true);
  }

  saveToLocalStorage() {
    if (this.report) {
      console.log('Saving to local storage...');
      window.localStorage.setItem('graph', JSON.stringify(this.appGraph));
      window.localStorage.setItem('components', JSON.stringify(this.fileMap));
      window.localStorage.setItem('report', JSON.stringify(this.report));
    }
  }

  restoreFromLocalStorage() {
    console.log('Restoring from local storage...');

    if (window.localStorage.getItem('graph')) {
      this.appGraph = JSON.parse(window.localStorage.getItem('graph'));

      this.fileMap =
        JSON.parse(window.localStorage.getItem('components')) || {};
      console.log('FileMap: ', this.fileMap);

      this.report = JSON.parse(window.localStorage.getItem('report'));
      console.log('Report: ', this.report);
    } else {
      this.appGraph = {
        nodes: data.nodes,
        links: data.links
      };
    }
  }

  private resetData(): void {
    this.componentFiles = [];
    this.fileMap = {};
    this.appGraph = {
      nodes: [],
      links: []
    };
  }

  private isComponentFile(file: FileWithPath): boolean {
    if (excludedFolders.some(folder => file.path.includes(folder))) {
      return;
    }

    const fileParts = file.path.split('.');
    return (
      fileParts.length >= 2 &&
      fileParts[fileParts.length - 2] !== 'test' &&
      supportedExtensions.includes(fileParts[fileParts.length - 1])
    );
  }

  private getCompleteFilePath(importPath: string, fileName: string) {
    const hasExtension = importPath.includes('.');
    const filePath = hasExtension ? importPath : importPath + '.';

    let file = this.componentFiles.find(componentFile =>
      componentFile.path.startsWith(filePath)
    );

    if (!file && !hasExtension) {
      const indexPath = importPath + '/index.';
      file = this.componentFiles.find(componentFile =>
        componentFile.path.startsWith(indexPath)
      );
    }

    if (!file && importPath.startsWith('/')) {
      console.error(`File path not found: ${importPath} (${fileName})`);
      return;
    }

    return file ? file.path : importPath;
  }

  private hasSingleComponent() {
    return (
      Object.keys(this.fileMap).length === 1 &&
      Object.values(this.fileMap)[0].components &&
      Object.keys(Object.values(this.fileMap)[0].components).length === 1
    );
  }

  private findReport(nodeId: string, componentId: string) {
    if (!this.report) {
      return;
    }

    if (!componentId && this.hasSingleComponent()) {
      const fileName = Object.keys(this.fileMap)[0];
      const componentName = Object.keys(
        Object.values(this.fileMap)[0].components
      )[0];

      componentId = `${fileName}#${componentName}`;
    }

    if (componentId) {
      const fileName = componentId.split('#')[0];
      const componentName = componentId.split('#')[1];

      const moduleReport = this.report.modules.find(
        module => module.srcPath === fileName
      );
      const report = moduleReport.classes.find(
        classReport => classReport.name === componentName
      );

      if (report) {
        if (nodeId === componentName) {
          return report;
        } else if (nodeId) {
          return report.methods.find(method => method.name === nodeId);
        }
      } else {
        if (nodeId.includes('#')) {
          const lineStart = parseInt(nodeId.split('#')[1], 10);
          return moduleReport.methods.find(
            method => method.lineStart === lineStart
          );
        } else {
          return moduleReport;
        }
      }
    } else {
      const fileName = nodeId.split('#')[0];
      const componentName = nodeId.split('#')[1];

      const moduleReport = this.report.modules.find(
        module => module.srcPath === fileName
      );
      return moduleReport.classes.find(
        classReport => classReport.name === componentName
      );
    }
  }

  private getDefaultExport(
    fileMap: FileMap,
    dependency: Import,
    currentFileName: string
  ): Import {
    const fileName = Object.keys(fileMap).find(
      name => name === dependency.source
    );

    if (!fileName || !fileMap[fileName].defaultExport) {
      console.error(
        `Default export not found: ${dependency.source} (${currentFileName})`
      );
      return;
    }

    const defaultExport = fileMap[fileName].defaultExport;

    // default export is an import
    if (defaultExport.startsWith('/')) {
      const parts = defaultExport.split('#');
      const importPath = parts[0];
      const importName = parts[1];

      if (importName === 'default') {
        return this.getDefaultExport(
          fileMap,
          { source: importPath, name: importName },
          currentFileName
        );
      }
    }

    dependency.name = defaultExport;
    return dependency;
  }
}
