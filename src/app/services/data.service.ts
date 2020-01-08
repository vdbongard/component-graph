import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  AstWithPath,
  FileMap,
  Graph,
  Node,
  NodeSelection
} from '../interfaces';
import { FileWithPath } from '../helper/getFilesAsync';
import { excludedFolders, supportedExtensions } from '../constants/files';
import { JSONToSet, SetToJSON } from '../helper/SetToJson';
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
      const { ast, components, defaultExport, code } = await this.setFile(file);
      asts.push({ ast, srcPath: file.path });
      if (Object.keys(components).length > 0) {
        this.fileMap[file.path] = { components, defaultExport, code };
      }
      this.progress$.next(((index + 1) / this.componentFiles.length) * 100);
    }

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
    const { components, defaultExport } = traverse(ast, file.path);
    return { ast, components, defaultExport, code };
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
          const source = this.getCompleteFilePath(component.extends.source);

          if (!source && component.extends.source.startsWith('/')) {
            console.error(
              `Base class dependency not found: ${component.extends.source} (${fileName})`
            );
            return;
          }

          component.extends.source = source;
        }

        component.dependencies = [...component.dependencies]
          .map(dependency => {
            const source = this.getCompleteFilePath(dependency.source);

            if (!source && dependency.source.startsWith('/')) {
              console.error(
                `Dependency not found: ${dependency.source} (${fileName})`
              );
              return;
            }

            dependency.source = source;
            return dependency;
          })
          .filter(d => d);

        component.dependencies.forEach(dependency => {
          if (!dependency.source.startsWith('/')) {
            return;
          }

          if (dependency.name === 'default') {
            const defaultExport = this.getDefaultExport(
              fileMap,
              dependency.source
            );
            if (!defaultExport) {
              console.error(
                `Default export not found: ${dependency.source} (${fileName})`
              );
              return;
            }
            dependency.name = defaultExport;
          }

          const source = `${fileName}#${componentName}`;
          const target = `${dependency.source}#${dependency.name}`;
          pushUniqueLink({ source, target }, links);
        });

        if (component.extends) {
          const name = component.extends.name;
          const source = component.extends.source;
          if (!nodes.find(node => node.id === `${source}#${name}`)) {
            if (source.startsWith('/')) {
              console.error(
                `Super class not found: ${source}#${name} (${fileName})`
              );
            }
            return;
          }
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

    if (!file && importPath.startsWith('/')) {
      return;
    }

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

  private getDefaultExport(fileMap: FileMap, source: string) {
    const fileName = Object.keys(fileMap).find(name => name === source);
    return fileName && fileMap[fileName].defaultExport;
  }
}
