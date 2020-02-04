import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import escomplexProject from 'typhonjs-escomplex-project';
import data from '../constants/data';
import { excludedFolders, supportedExtensions } from '../constants/files';
import { FileWithPath } from '../helper/getFilesAsync';
import { parse } from '../helper/parser';
import { traverse } from '../helper/traverse';
import { filterInvalidLinks, pushUniqueLink } from '../helper/traverseHelper';
import { AstWithPath, FileMap, Graph, Import, Node, NodeSelection } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  files: FileWithPath[] = [];
  componentFiles: FileWithPath[];

  appGraph: Graph = {
    nodes: [],
    links: []
  };
  report;

  graphData$ = new Subject<Graph>();
  selectedNodes$ = new BehaviorSubject<NodeSelection[]>(undefined);
  progress$ = new BehaviorSubject<number>(undefined);
  fileMap$ = new BehaviorSubject<FileMap>(undefined);

  constructor() {}

  async setFiles(files: FileWithPath[]) {
    console.log('Loaded files count:', files.length);
    this.resetData();
    this.componentFiles = files.filter(this.isComponentFile);
    console.log('Component files:', this.componentFiles);
    const asts: AstWithPath[] = [];
    let fileMap: FileMap = {};
    const progressPercent = (1 / this.componentFiles.length) * 50;

    for (const file of this.componentFiles) {
      const { ast, code } = await this.setFile(file);
      asts.push({ ast, srcPath: file.path });
      fileMap[file.path] = { code };
      await this.increaseProgress(progressPercent);
    }

    for (const file of this.componentFiles) {
      const { components, defaultExport } = await new Promise(resolve =>
        setTimeout(() => resolve(traverse(asts, file.path)), 0)
      );
      fileMap[file.path].components = components;
      fileMap[file.path].defaultExport = defaultExport;
      await this.increaseProgress(progressPercent);
    }

    // filter out files that have no components or default component export
    fileMap = Object.entries(fileMap)
      .filter(
        ([_, file]) =>
          (file.components && Object.keys(file.components).length > 0) ||
          (file.defaultExport && file.defaultExport.startsWith('/'))
      )
      // Object.fromEntries
      .reduce((acc, [key, val]) => Object.assign(acc, { [key]: val }), {});

    this.fileMap$.next(fileMap);

    console.log('FileMap:', this.fileMap$.value);
    this.report = escomplexProject.analyze(asts);
    console.log('Report:', this.report);
    if (!this.hasSingleComponent()) {
      this.appGraph = this.generateAppGraph(this.fileMap$.value);
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
        this.fileMap$.value[fileName] &&
        this.fileMap$.value[fileName].components[componentName]
      ) {
        this.graphData$.next(this.fileMap$.value[fileName].components[componentName].graph);
        return;
      }
    }

    // if only one component show it's graph instead of the app graph
    if (this.hasSingleComponent()) {
      this.graphData$.next(
        Object.values(Object.values(this.fileMap$.value)[0].components)[0].graph
      );
      return;
    }

    this.graphData$.next(this.appGraph);
  }

  selectNode(node: Node, componentId: string) {
    const componentOrFunction = this.findComponentOrFunctionById(componentId, node.id);

    const selectedNode: NodeSelection = {
      id: node.id,
      label: node.label,
      type: componentId && node.group !== 1 ? 'function' : 'component',
      report: this.findReportById(componentId, node.id),
      code: this.findCode(node.id, componentId),
      lineStart: componentOrFunction.lineStart,
      lineEnd: componentOrFunction.lineEnd
    };
    console.log('Select node: ', selectedNode);
    this.selectedNodes$.next([selectedNode]);
  }

  selectFile(fileName: string) {
    const file = this.fileMap$.value[fileName];

    const selectedNodes: NodeSelection[] = [];

    if (file && file.components) {
      Object.keys(file.components).forEach(componentName => {
        selectedNodes.push({
          id: `${fileName}#${componentName}`,
          label: componentName,
          type: 'component',
          report: this.findReport(fileName, componentName),
          code: file.code,
          lineStart: file.components[componentName].lineStart,
          lineEnd: file.components[componentName].lineEnd
        });
      });
    }

    console.log('Select file -> nodes: ', selectedNodes);
    this.selectedNodes$.next(selectedNodes);
  }

  private generateAppGraph(fileMap: FileMap): Graph {
    const nodes: Node[] = [];
    const links = [];

    for (const [fileName, file] of Object.entries(fileMap)) {
      if (!file.components) {
        return;
      }
      for (const [componentName, component] of Object.entries(file.components)) {
        const functions = [...component.graph.nodes].sort((a, b) => a.group - b.group);
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
          component.extends.source = this.getCompleteFilePath(component.extends.source, fileName);
        }

        component.dependencies = [...component.dependencies]
          .map(dependency => {
            dependency.source = this.getCompleteFilePath(dependency.source, fileName);
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
            const defaultDependency = this.getDefaultExport(fileMap, dependency, fileName);

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

  saveToLocalStorage() {
    if (this.report) {
      console.log('Saving to local storage...');
      window.localStorage.setItem('graph', JSON.stringify(this.appGraph));
      window.localStorage.setItem('components', JSON.stringify(this.fileMap$.value));
      window.localStorage.setItem('report', JSON.stringify(this.report));
    }
  }

  restoreFromLocalStorage() {
    console.log('Restoring from local storage...');

    if (window.localStorage.getItem('graph')) {
      this.appGraph = JSON.parse(window.localStorage.getItem('graph'));

      this.fileMap$.next(JSON.parse(window.localStorage.getItem('components')) || {});
      console.log('FileMap: ', this.fileMap$.value);

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
    this.fileMap$.next({});
    this.appGraph = {
      nodes: [],
      links: []
    };
  }

  private async increaseProgress(progressPercent: number) {
    return new Promise(resolve =>
      setTimeout(
        () => resolve(this.progress$.next((this.progress$.value || 0) + progressPercent)),
        0
      )
    );
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

    let file = this.componentFiles.find(componentFile => componentFile.path.startsWith(filePath));

    if (!file && !hasExtension) {
      const indexPath = importPath + '/index.';
      file = this.componentFiles.find(componentFile => componentFile.path.startsWith(indexPath));
    }

    if (!file && importPath.startsWith('/')) {
      console.error(`File path not found: ${importPath} (${fileName})`);
      return;
    }

    return file ? file.path : importPath;
  }

  hasSingleComponent() {
    return (
      Object.keys(this.fileMap$.value).length === 1 &&
      Object.values(this.fileMap$.value)[0].components &&
      Object.keys(Object.values(this.fileMap$.value)[0].components).length === 1
    );
  }

  findNamesById(componentId: string, nodeId?: string) {
    let fileName: string;
    let componentName: string;
    let functionName: string;

    if (this.hasSingleComponent()) {
      fileName = Object.keys(this.fileMap$.value)[0];
      componentName = Object.keys(this.fileMap$.value[fileName].components)[0];
      functionName = nodeId;
    } else if (componentId) {
      [fileName, componentName] = componentId.split('#');
      functionName = nodeId;
    } else if (nodeId) {
      [fileName, componentName] = nodeId.split('#');
    }

    return { fileName, componentName, functionName };
  }

  findComponentOrFunctionById(componentId: string, nodeId?: string) {
    const { fileName, componentName, functionName } = this.findNamesById(componentId, nodeId);
    const component = this.fileMap$.value[fileName].components[componentName];

    if (functionName) {
      return component.graph.nodes.find(n => n.id === functionName);
    }
    return component;
  }

  findReportById(componentId: string, nodeId?: string) {
    if (!this.report) {
      return;
    }
    const { fileName, componentName, functionName } = this.findNamesById(componentId, nodeId);
    return this.findReport(fileName, componentName, functionName);
  }

  private findReport(fileName: string, componentName: string, functionName?: string) {
    const moduleReport = this.report.modules.find(module => module.srcPath === fileName);

    if (!moduleReport) {
      console.error('File report not found', fileName);
      return;
    }

    const report = moduleReport.classes.find(classReport => classReport.name === componentName);

    if (report) {
      // ClassComponent
      if (functionName && functionName !== componentName) {
        const classFunctionReport = report.methods.find(method => method.name === functionName);

        if (!classFunctionReport) {
          const component = this.fileMap$.value[fileName].components[componentName];
          const functionNode = component.graph.nodes.find(node => node.id === functionName);

          if (!functionNode) {
            return;
          }

          const lineStart = functionNode.lineStart;
          return report.methods.find(method => method.lineStart === lineStart);
        }

        return classFunctionReport;
      }
      return report;
    } else {
      // FunctionComponent
      let lineStart: number;

      if (!functionName) {
        const component = this.fileMap$.value[fileName].components[componentName];
        const componentNode = component.graph.nodes.find(node => node.label === componentName);

        if (!componentNode) {
          return;
        }

        lineStart = parseInt(componentNode.id.split('#')[1], 10);
      } else if (functionName.includes('#')) {
        lineStart = parseInt(functionName.split('#')[1], 10);
      }

      return moduleReport.methods.find(method => method.lineStart === lineStart);
    }
  }

  private getDefaultExport(fileMap: FileMap, dependency: Import, currentFileName: string): Import {
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

  private findCode(nodeId: string, componentId?: string) {
    const { fileName } = this.findNamesById(componentId, nodeId);
    const file = this.fileMap$.value[fileName];
    return file && file.code;
  }

  getComponentName(fileName: string) {
    const file = this.fileMap$.value[fileName];

    if (!file || Object.keys(file.components).length !== 1) {
      return;
    }
    return Object.keys(file.components)[0];
  }
}
