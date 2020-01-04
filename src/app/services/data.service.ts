import { Injectable } from '@angular/core';
import * as Babel from '@babel/types';
import { BehaviorSubject } from 'rxjs';
import { Graph, Node, NodeSelection } from '../interfaces';
import { FileWithPath } from '../helper/getFilesAsync';
import { excludedFolders, supportedExtensions } from '../constants/files';
import { JSONToSet, SetToJSON } from '../helper/SetToJson';
import escomplexProject from 'typhonjs-escomplex-project';
import { parse } from '../helper/parser';
import { pushUniqueLink, pushUniqueNode, traverse } from '../helper/traverser';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  ast: Babel.File;
  files: FileWithPath[] = [];
  componentMap: {
    [componentName: string]: {
      graph?: Graph;
      imports?: { name: string; source: string }[];
      extends?: string;
      dependencies?: Set<string>;
    };
  } = {};
  asts: {
    ast: Babel.File;
    srcPath: string;
  }[] = [];
  appGraph: Graph = {
    nodes: [],
    links: []
  };
  componentFiles: FileWithPath[];
  report;

  graphData$ = new BehaviorSubject<Graph>(undefined);
  selectedNode$ = new BehaviorSubject<NodeSelection>(undefined);

  constructor() {}

  saveToLocalStorage() {
    if (this.graphData$.value) {
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
    }
  }

  async setFiles(files: FileWithPath[]) {
    this.resetData();

    console.log('loaded files count:', files.length);

    this.componentFiles = this.getComponentFiles(files);
    console.log('component files:', this.componentFiles);

    for (const [index, file] of this.componentFiles.entries()) {
      await this.setFile(file);
      console.log(`Analyzing [${index + 1}/${this.componentFiles.length}]...`);
    }

    console.log('ComponentMap:', this.componentMap);
    console.log('ASTs:', this.asts);

    this.report = escomplexProject.analyze(this.asts);
    console.log('Report:', this.report);

    for (const [path, value] of Object.entries(this.componentMap)) {
      value.dependencies.forEach(dependency => {
        if (!dependency.startsWith('/')) {
          return;
        }
        pushUniqueLink(
          {
            source: path,
            target: dependency
          },
          this.appGraph.links
        );
      });

      if (value.extends) {
        if (!this.appGraph.nodes.find(node => node.id === value.extends)) {
          console.log('Found a wrong super class path: ', value.extends);
        } else {
          pushUniqueLink(
            {
              source: value.extends,
              target: path
            },
            this.appGraph.links
          );
        }
      }
    }

    this.graphData$.next(this.appGraph);
  }

  private resetData() {
    this.componentFiles = [];
    this.componentMap = {};
    this.asts = [];
    this.appGraph = {
      nodes: [],
      links: []
    };
  }

  private getComponentFiles(files: FileWithPath[]) {
    return files.filter(file => {
      if (excludedFolders.some(folder => file.path.includes(folder))) {
        return;
      }

      const fileParts = file.path.split('.');
      return (
        fileParts.length >= 2 &&
        fileParts[fileParts.length - 2] !== 'test' &&
        supportedExtensions.includes(fileParts[fileParts.length - 1])
      );
    });
  }

  async setFile(file: FileWithPath) {
    // @ts-ignore
    const code = await file.file.text();

    const ast = parse(code, file.path);
    this.asts.push({ ast, srcPath: file.path });

    this.componentMap[file.path] = {
      imports: [],
      graph: {
        nodes: [],
        links: []
      },
      dependencies: new Set<string>()
    };

    this.componentMap[file.path] = traverse(ast, file.path);

    pushUniqueNode(
      {
        id: file.path,
        label: file.path
          .split('/')
          .pop()
          .split('.')[0]
      },
      this.appGraph.nodes
    );

    for (const component of Object.values(this.componentMap)) {
      if (component.extends) {
        component.extends = this.getCompleteFilePath(component.extends);
      }
      if (component.dependencies) {
        component.dependencies = new Set(
          [...component.dependencies].map(this.getCompleteFilePath.bind(this))
        );
      }
    }
  }

  getCompleteFilePath(absoluteImportPath: string) {
    const file = this.componentFiles.find(componentFile =>
      componentFile.path.startsWith(absoluteImportPath)
    );

    return file ? file.path : absoluteImportPath;
  }

  setComponent(componentId: string) {
    if (componentId && this.componentMap[componentId]) {
      this.graphData$.next(this.componentMap[componentId].graph);
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

  private findReport(nodeId: string, componentId: string) {
    if (componentId) {
      const moduleReport = this.report.modules.find(
        module => module.srcPath === componentId
      );
      const report = moduleReport.classes[0].methods.find(
        method => method.name === nodeId
      );

      return report || moduleReport;
    } else {
      return this.report.modules.find(module => module.srcPath === nodeId);
    }
  }
}
