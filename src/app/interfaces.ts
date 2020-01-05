import { SimulationNodeDatum } from 'd3-force';
import { File as BabelFile } from '@babel/types';

export interface RefLink extends SimulationNodeDatum {
  source: number | Node;
  target: number | Node;
  value?: number;
  id?: string;
}

export interface Node extends SimulationNodeDatum {
  id: string;
  label?: string;
  group?: number;
  width?: number;
  height?: number;
}

export interface Link {
  source: string;
  target: string;
  value?: number;
  id?: string;
}

export interface Graph {
  nodes: Node[];
  links: Link[];
}

export interface Entry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  filesystem: any;
  createWriter: () => any;
  file: (cb: (file: File) => void) => void;
  createReader: () => any;
  getFile: () => any;
  getDirectory: () => any;
  removeRecursively: () => any;
}

export interface Settings {
  textCenter?: boolean;
  text?: boolean;
  fade?: boolean;
  fullScreen?: boolean;
  colaLayout?: boolean;
}

export interface NodeSelection {
  id: string;
  label?: string;
  report: any;
}

export interface ComponentMap {
  [componentName: string]: {
    graph?: Graph;
    extends?: string;
    dependencies?: Set<string>;
  };
}

export interface AstWithPath {
  ast: BabelFile;
  srcPath: string;
}
