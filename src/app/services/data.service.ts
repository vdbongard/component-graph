import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import escomplexProject from 'typhonjs-escomplex-project';
import data from '../constants/data';
import { findReport } from '../helper/findReport';
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
  private report: any;

  constructor() {}

  async setFiles(files: FileWithPath[]) {
    console.log('Loaded files count:', files.length);
    this.resetData();
    this.componentFiles = files.filter(isComponentFile);
    console.log('Component files:', this.componentFiles);
    const asts: AstWithPath[] = [];
    let fileMap: FileMap = {};
    const progressPercent = (1 / this.componentFiles.length) * 50;

    // parse files
    for (const file of this.componentFiles) {
      const { ast, code } = await this.parseFile(file);
      asts.push({ ast, srcPath: file.path });
      fileMap[file.path] = { code };
      await this.increaseProgress(progressPercent);
    }

    // generate report
    this.report = escomplexProject.analyze(asts);

    // traverse files
    for (const file of this.componentFiles) {
      const { components, defaultExport } = await new Promise(resolve =>
        setTimeout(() => resolve(traverse(asts, file.path, this.report)), 0)
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

    console.log('Report:', this.report);

    // add report to component graph nodes
    for (const [fileName, file] of Object.entries(fileMap)) {
      for (const [componentName, component] of Object.entries(file.components || {})) {
        if (!component.graph) {
          continue;
        }
        component.graph.nodes = component.graph.nodes.map(node => {
          node.report = findReport(this.report, fileMap, fileName, componentName, node.id);
          return node;
        });
      }
    }

    this.fileMap$.next(fileMap);
    console.log('FileMap:', this.fileMap$.value);

    if (!this.hasSingleComponent()) {
      this.appGraph = generateAppGraph(fileMap, this.componentFiles, this.report);
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

  selectNode({ id, label, type, report, icons }: Node, componentId: string) {
    const componentOrFunction = this.findComponentOrFunctionById(componentId, id);

    const selectedNode: NodeSelection = {
      id,
      label,
      type,
      report,
      icons,
      code: this.findCode(id, componentId),
      lineStart: componentOrFunction.lineStart,
      lineEnd: componentOrFunction.lineEnd
    };
    console.log('Select node: ', selectedNode);
    this.selectedNodes$.next([selectedNode]);
  }

  deselectNodes() {
    this.selectedNodes$.next(null);
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
          report: findReport(this.report, this.fileMap$.value, fileName, componentName),
          icons: [], // TODO
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

  private findCode(nodeId: string, componentId?: string) {
    const { fileName } = this.findNamesById(componentId, nodeId);
    const file = this.fileMap$.value[fileName];
    return file && file.code;
  }
}
