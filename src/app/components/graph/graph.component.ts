import { Component, OnDestroy, OnInit } from '@angular/core';
import * as d3 from 'd3';
import data from '../../data';
import { Link, Node } from '../../interfaces';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements OnInit, OnDestroy {
  linkData: Link[] = data.links;
  nodeData: Node[] = data.nodes;

  width = window.innerWidth;
  height = window.innerHeight - 64;

  svg: d3.Selection<SVGSVGElement, any, any, any>;
  simulation: d3.Simulation<any, any>;
  links: d3.Selection<any, any, any, any>;
  nodes: d3.Selection<any, any, any, any>;

  scale = d3.scaleOrdinal(d3.schemeCategory10);

  ngOnInit() {
    this.svg = this.createSVG();
    this.simulation = this.createSimulation();
    this.links = this.createLinks();
    this.nodes = this.createNodes();
  }

  private createSVG() {
    return d3
      .select('#d3-root')
      .append('svg')
      .attr('style', 'width: 100%; height: 100%; display: block');
  }

  private createSimulation() {
    const simulation = d3
      .forceSimulation(this.nodeData)
      .force(
        'link',
        d3.forceLink(this.linkData).id((d: any) => d.id)
      )
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2));

    simulation.on('tick', () => {
      this.links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      this.nodes.attr('cx', d => d.x).attr('cy', d => d.y);
    });

    return simulation;
  }

  private createLinks() {
    return this.svg
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(this.linkData)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value));
  }

  private createNodes() {
    const node = this.svg
      .append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(this.nodeData)
      .join('circle')
      .attr('r', 8)
      .attr('fill', d => {
        return this.scale(d.group.toString());
      })
      .call(this.drag(this.simulation));

    node.append('title').text(d => d.id);

    return node;
  }

  private drag(simulation: d3.Simulation<any, any>): any {
    function dragStarted(d) {
      if (!d3.event.active) {
        simulation.alphaTarget(0.3).restart();
      }
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }

    function dragEnded(d) {
      if (!d3.event.active) {
        simulation.alphaTarget(0);
      }
      d.fx = null;
      d.fy = null;
    }

    return d3
      .drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded);
  }

  ngOnDestroy() {
    this.simulation.stop();
  }
}
