import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  AstWithPath,
  ComponentMap,
  Graph,
  Node,
  NodeSelection
} from '../interfaces';
import { FileWithPath } from '../helper/getFilesAsync';
import { excludedFolders, supportedExtensions } from '../constants/files';
import { JSONToSet, SetToJSON } from '../helper/SetToJson';
import escomplexProject from 'typhonjs-escomplex-project';
import { parse } from '../helper/parser';
import { pushUniqueLink, traverse } from '../helper/traverser';
import data from '../constants/data';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  files: FileWithPath[] = [];
  componentFiles: FileWithPath[];

  componentMap: ComponentMap = {};
  appGraph: Graph = {
    nodes: [],
    links: []
  };
  report;

  graphData$ = new Subject<Graph>();
  selectedNode$ = new BehaviorSubject<NodeSelection>(undefined);
  progress$ = new BehaviorSubject<number>(undefined);

  constructor() {}

  saveToLocalStorage() {
    if (this.report) {
      console.log('Saving to local storage...');
      window.localStorage.setItem('graph', JSON.stringify(this.appGraph));
      window.localStorage.setItem(
        'components',
        JSON.stringify(this.componentMap, SetToJSON)
      );
      window.localStorage.setItem('report', JSON.stringify(this.report));
    }
  }

  restoreFromLocalStorage() {
    console.log('Restoring from local storage...');

    if (window.localStorage.getItem('graph')) {
      this.appGraph = JSON.parse(window.localStorage.getItem('graph'));

      this.componentMap =
        JSON.parse(window.localStorage.getItem('components'), JSONToSet) || {};
      console.log('ComponentMap: ', this.componentMap);

      this.report = JSON.parse(window.localStorage.getItem('report'));
      console.log('Report: ', this.report);
    } else {
      this.appGraph = {
        nodes: data.nodes,
        links: data.links
      };
    }
  }

  async setFiles(files: FileWithPath[]) {
    console.log('Loaded files count:', files.length);
    this.resetData();
    this.componentFiles = files.filter(this.isComponentFile);
    console.log('Component files:', this.componentFiles);
    const asts: AstWithPath[] = [];

    for (const [index, file] of this.componentFiles.entries()) {
      const { ast, component } = await this.setFile(file);
      asts.push({ ast, srcPath: file.path });
      this.componentMap[file.path] = component;
      this.progress$.next(((index + 1) / this.componentFiles.length) * 100);
    }

    console.log('ComponentMap:', this.componentMap);
    this.report = escomplexProject.analyze(asts);
    console.log('Report:', this.report);
    this.appGraph = this.generateAppGraph(this.componentMap);
    this.progress$.next(undefined);
    this.setComponentGraph();
  }

  async setFile(file: FileWithPath) {
    const code = await file.file.text();
    const ast = parse(code, file.path);
    const component = traverse(ast, file.path);
    return { ast, component };
  }

  setComponentGraph(componentId?: string) {
    if (this.componentMap[componentId]) {
      this.graphData$.next(this.componentMap[componentId].graph);
    } else if (Object.values(this.componentMap).length === 1) {
      this.graphData$.next(Object.values(this.componentMap)[0].graph);
    } else {
      this.graphData$.next(this.appGraph);
    }
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

  private generateAppGraph(componentMap: ComponentMap): Graph {
    const nodes = [];
    const links = [];

    for (const [path, component] of Object.entries(componentMap)) {
      nodes.push({
        id: path,
        label: path
          .split('/')
          .pop()
          .split('.')[0]
      });

      if (component.extends) {
        component.extends = this.getCompleteFilePath(component.extends);
      }

      component.dependencies = new Set<string>(
        [...component.dependencies].map(this.getCompleteFilePath.bind(this))
      );

      component.dependencies.forEach(dependency => {
        if (!dependency.startsWith('/')) {
          return;
        }
        pushUniqueLink(
          {
            source: path,
            target: dependency
          },
          links
        );
      });

      if (component.extends) {
        if (!nodes.find(node => node.id === component.extends)) {
          console.log('Found a wrong super class path: ', component.extends);
        } else {
          pushUniqueLink(
            {
              source: component.extends,
              target: path
            },
            links
          );
        }
      }
    }

    return { nodes, links };
  }

  private resetData(): void {
    this.componentFiles = [];
    this.componentMap = {};
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

  private getCompleteFilePath(importPath: string) {
    const file = this.componentFiles.find(componentFile =>
      componentFile.path.startsWith(importPath)
    );

    return file ? file.path : importPath;
  }

  private findReport(nodeId: string, componentId: string) {
    if (!this.report) {
      return;
    }

    if (componentId) {
      const moduleReport = this.report.modules.find(
        module => module.srcPath === componentId
      );

      if (!moduleReport.classes[0]) {
        return moduleReport;
      }

      const report = moduleReport.classes[0].methods.find(
        method => method.name === nodeId
      );

      return report || moduleReport;
    } else {
      return this.report.modules.find(module => module.srcPath === nodeId);
    }
  }
}
