import { File as BabelFile } from '@babel/types';
import { SimulationNodeDatum } from 'd3-force';
import { NodeKind, NodeType } from './types';

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
  width?: number;
  height?: number;
  lineStart?: number;
  lineEnd?: number;
  functions?: Node[];
  icons?: NodeIcon[];
  type?: NodeType;
  kind?: NodeKind;
  special?: boolean;
  returnsJSX?: boolean;
  isUsingThis?: boolean;
  componentId?: string;
  report?: any;
  extends?: boolean;
  warn?: boolean;
  error?: boolean;
  cluster?: number;
}

export interface NodeSelection {
  id: string;
  type: NodeType;
  label?: string;
  report: any;
  icons: NodeIcon[];
  code?: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface NodeIcon {
  icon: string; // Material icon name
  class: 'warn' | 'error';
  description: string;
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
  text?: boolean;
  fade?: boolean;
  highlightIndirectNodes?: boolean;
  fullScreen?: boolean;
  colaLayout?: boolean;
  nodeSizesBasedOnMetrics?: boolean;
  autoZoom?: boolean;
  currentSizeMetricErrorHighlighting?: boolean;
  hideOverlappingLabels?: boolean;
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
  kind?: NodeKind;
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

export interface QualityMetrics {
  [qualityMetric: string]: {
    name: string;
    description?: string;
    thresholds: {
      [thresholdType: string]: number; // e.g. 'component', 'innerFunction', 'innerFunction.render'
    };
    componentOnly?: boolean;
  };
}
