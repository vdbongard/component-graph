import { File as BabelFile } from '@babel/types';
import { SimulationNodeDatum } from 'd3-force';

export interface RefLink extends SimulationNodeDatum {
  source: number | Node;
  target: number | Node;
  value?: number;
  id?: string;
  inherits?: boolean;
}

export interface Node extends SimulationNodeDatum {
  id: string;
  label?: string;
  group?: number;
  width?: number;
  height?: number;
  lineStart?: number;
  lineEnd?: number;
  functions?: Node[];
  icons?: NodeIcon[];
  type?: 'function' | 'class';
  returnsJSX?: boolean;
  componentId?: string;
}

export interface NodeIcon {
  icon: string;
  class: string;
  width?: number;
}

export interface Link {
  source: string;
  target: string;
  value?: number;
  id?: string;
  inherits?: boolean;
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
  nodeSizesBasedOnMetrics?: boolean;
}

export interface NodeSelection {
  id: string;
  type: 'component' | 'function';
  label?: string;
  report: any;
  code?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface FileMap {
  [fileName: string]: {
    components?: ComponentMap;
    defaultExport?: string;
    code: string;
  };
}

export interface ComponentMap {
  [componentName: string]: Component;
}

export interface Component {
  graph?: Graph;
  extends?: Import;
  dependencies?: Import[];
  lineStart?: number;
  lineEnd?: number;
  type?: 'function' | 'class';
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

export interface Selection {
  start: number;
  end: number;
}
