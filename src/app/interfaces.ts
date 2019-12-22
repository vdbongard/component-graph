import { SimulationNodeDatum } from 'd3-force';

export interface Link extends SimulationNodeDatum {
  source: string;
  target: string;
  value?: number;
  id?: string;
}

export interface Node extends SimulationNodeDatum {
  id: string;
  group?: number;
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
