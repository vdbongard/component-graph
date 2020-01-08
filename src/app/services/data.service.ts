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

  saveToLocalStorage() {
    if (this.report) {
      console.log('Saving to local storage...');
      window.localStorage.setItem('graph', JSON.stringify(this.appGraph));
      window.localStorage.setItem(
        'components',
        JSON.stringify(this.fileMap, SetToJSON)
      );
      window.localStorage.setItem('report', JSON.stringify(this.report));
    }
  }

  restoreFromLocalStorage() {
    console.log('Restoring from local storage...');

    if (window.localStorage.getItem('graph')) {
      this.appGraph = JSON.parse(window.localStorage.getItem('graph'));

      this.fileMap =
        JSON.parse(window.localStorage.getItem('components'), JSONToSet) || {};
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

  async setFiles(files: FileWithPath[]) {
    console.log('Loaded files count:', files.length);
    this.resetData();
    this.componentFiles = files.filter(this.isComponentFile);
    console.log('Component files:', this.componentFiles);
    const asts: AstWithPath[] = [];

    for (const [index, file] of this.componentFiles.entries()) {
      const { ast, components, code } = await this.setFile(file);
      asts.push({ ast, srcPath: file.path });
      this.fileMap[file.path] = { components, code };
      this.progress$.next(((index + 1) / this.componentFiles.length) * 100);
    }

    console.log('FileMap:', this.fileMap);
    this.report = escomplexProject.analyze(asts);
    console.log('Report:', this.report);
    this.appGraph = this.generateAppGraph(this.fileMap);
    this.progress$.next(undefined);
    this.setComponentGraph();
  }

  async setFile(file: FileWithPath) {
    const code = await file.file.text();
    const ast = parse(code, file.path);
    const components = traverse(ast, file.path);
    return { ast, components, code };
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
            component.extends.source
          );
        }

        component.dependencies = new Set<Import>(
          [...component.dependencies].map(dependency => {
            dependency.source = this.getCompleteFilePath(dependency.source);
            return dependency;
          })
        );

        component.dependencies.forEach(dependency => {
          if (!dependency.source.startsWith('/')) {
            return;
          }
          pushUniqueLink(
            {
              source: `${fileName}#${componentName}`,
              target: `${dependency.source}#${dependency.name}`
            },
            links
          );
        });

        if (component.extends) {
          if (
            !nodes.find(
              node =>
                node.id ===
                `${component.extends.source}#${component.extends.name}`
            )
          ) {
            console.warn(
              'Found a wrong super class path: ',
              `${component.extends.source}#${component.extends.name}`
            );
          } else {
            pushUniqueLink(
              {
                source: `${component.extends.source}#${component.extends.name}`,
                target: `${fileName}#${componentName}`
              },
              links
            );
          }
        }
      }
    }

    return { nodes, links };
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

  private getCompleteFilePath(importPath: string) {
    const file = this.componentFiles.find(componentFile =>
      componentFile.path.startsWith(importPath)
    );

    return file ? file.path : importPath;
  }

  private hasSingleComponent() {
    return (
      Object.keys(this.fileMap).length === 1 &&
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
}
