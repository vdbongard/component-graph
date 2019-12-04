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
