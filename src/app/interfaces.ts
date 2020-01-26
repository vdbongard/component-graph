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
  code?: string;
}

export interface FileMap {
  [fileName: string]: {
    components?: ComponentMap;
    defaultExport?: string;
    code: string;
  };
}

export interface ComponentMap {
  [componentName: string]: {
    graph?: Graph;
    extends?: Import;
    dependencies?: Import[];
  };
}

export interface AstWithPath {
  ast: BabelFile;
  srcPath: string;
}

export interface Import {
  name: string;
  source: string;
}

export interface FileTree {
  name: string;
  id?: string;
  type: 'file' | 'folder';
  children?: FileTree[];
}

export interface FlatNode {
  expandable: boolean;
  name: string;
  level: number;
}
