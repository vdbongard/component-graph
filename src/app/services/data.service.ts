import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import escomplexProject from 'typhonjs-escomplex-project';
import data from '../constants/data';
import { generateAppGraph } from '../helper/generateAppGraph';
import { FileWithPath } from '../helper/getFilesAsync';
import { isComponentFile } from '../helper/isComponentFile';
import { parse } from '../helper/parser';
import { traverse } from '../helper/traverse';
import { AstWithPath, FileMap, Graph, Node, NodeSelection } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  graphData$ = new Subject<Graph>();
  selectedNodes$ = new BehaviorSubject<NodeSelection[]>(undefined);
  progress$ = new BehaviorSubject<number>(undefined);
  fileMap$ = new BehaviorSubject<FileMap>(undefined);

  private componentFiles: FileWithPath[];
  private appGraph: Graph = { nodes: [], links: [] };
  private report;

  constructor() {}

  async setFiles(files: FileWithPath[]) {
    console.log('Loaded files count:', files.length);
    this.resetData();
    this.componentFiles = files.filter(isComponentFile);
    console.log('Component files:', this.componentFiles);
    const asts: AstWithPath[] = [];
    let fileMap: FileMap = {};
    const progressPercent = (1 / this.componentFiles.length) * 50;

    for (const file of this.componentFiles) {
      const { ast, code } = await this.parseFile(file);
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
      this.appGraph = generateAppGraph(this.fileMap$.value, this.componentFiles);
    }
    this.progress$.next(undefined);
    this.setComponentGraph();
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

  hasSingleComponent() {
    return (
      Object.keys(this.fileMap$.value).length === 1 &&
      Object.values(this.fileMap$.value)[0].components &&
      Object.keys(Object.values(this.fileMap$.value)[0].components).length === 1
    );
  }

  getComponentName(fileName: string) {
    const file = this.fileMap$.value[fileName];

    if (!file || Object.keys(file.components).length !== 1) {
      return;
    }
    return Object.keys(file.components)[0];
  }

  private async parseFile(file: FileWithPath) {
    const code = await file.file.text();
    const ast = parse(code, file.path);
    return { ast, code };
  }

  private resetData(): void {
    this.componentFiles = [];
    this.fileMap$.next({});
    this.appGraph = {
      nodes: [],
      links: []
    };
  }

  private async increaseProgress(amountInPercent: number) {
    return new Promise(resolve =>
      setTimeout(
        () => resolve(this.progress$.next((this.progress$.value || 0) + amountInPercent)),
        0
      )
    );
  }

  private findNamesById(componentId: string, nodeId?: string) {
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

  private findComponentOrFunctionById(componentId: string, nodeId?: string) {
    const { fileName, componentName, functionName } = this.findNamesById(componentId, nodeId);
    const component = this.fileMap$.value[fileName].components[componentName];

    if (functionName) {
      return component.graph.nodes.find(n => n.id === functionName);
    }
    return component;
  }

  // TODO make private once it is not used in graph component anymore
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

    const classReport = moduleReport.classes.find(report => report.name === componentName);

    if (classReport) {
      // ClassComponent
      if (functionName && functionName !== componentName) {
        const classFunctionReport = classReport.methods.find(
          method => method.name === functionName
        );

        if (!classFunctionReport) {
          const component = this.fileMap$.value[fileName].components[componentName];
          const functionNode = component.graph.nodes.find(node => node.id === functionName);

          if (!functionNode) {
            return;
          }

          const lineStart = functionNode.lineStart;
          return classReport.methods.find(method => method.lineStart === lineStart);
        }

        return classFunctionReport;
      }
      return classReport;
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

  private findCode(nodeId: string, componentId?: string) {
    const { fileName } = this.findNamesById(componentId, nodeId);
    const file = this.fileMap$.value[fileName];
    return file && file.code;
  }
}
