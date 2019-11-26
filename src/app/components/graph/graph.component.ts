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

  svgZoomGroup: d3.Selection<SVGGElement, any, any, any>;
  simulation: d3.Simulation<any, any>;
  links: d3.Selection<any, any, any, any>;
  nodes: d3.Selection<any, any, any, any>;

  scale = d3.scaleOrdinal(d3.schemeCategory10);

  ngOnInit() {
    this.svgZoomGroup = this.createSVG();
    this.simulation = this.createSimulation();
    this.links = this.createLinks();
    this.nodes = this.createNodes();
  }

  private createSVG() {
    const svg = d3
      .select('#d3-root')
      .append('svg')
      .attr('style', 'width: 100%; height: 100%; display: block')
      .on('wheel', () => {
        svg.style('transition', 'transform 0.1s ease-out');
      })
      .on('mousedown', () => {
        svg.style('transition', null);
      })
      .call(
        d3.zoom().on('zoom', () => {
          svg.attr('transform', d3.event.transform);
        })
      )
      .append('g');

    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 21)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#999')
      .style('stroke', 'none');

    return svg;
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

      this.nodes.attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    return simulation;
  }

  private createLinks() {
    return this.svgZoomGroup
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(this.linkData)
      .join('line')
      .attr('stroke-width', 0.8)
      .attr('marker-end', 'url(#arrowhead)');
  }

  private createNodes() {
    const nodes = this.svgZoomGroup
      .append('g')
      .selectAll('.node')
      .data(this.nodeData)
      .join('g')
      .attr('class', 'node')
      .attr('style', 'cursor: pointer')
      .call(this.drag(this.simulation));

    nodes
      .append('circle')
      .attr('r', 8)
      .attr('fill', d => this.scale(d.group.toString()));

    if (window.location.search.indexOf('text=true') >= 0) {
      nodes
        .append('text')
        .text(d => d.id)
        .style('font-size', '12px')
        .attr('x', 9)
        .attr('y', 4);
    }

    return nodes;
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
      // stick node at the position if the shift key is pressed
      if (!d3.event.sourceEvent.shiftKey) {
        d.fx = null;
        d.fy = null;
      }
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
