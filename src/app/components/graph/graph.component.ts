import { Component, OnDestroy, OnInit } from '@angular/core';
import * as d3 from 'd3';
import data from '../../data';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements OnInit, OnDestroy {
  svg;
  links = data.links;
  nodes: any = data.nodes;
  width = window.innerWidth;
  height = window.innerHeight - 64;
  simulation;
  scale = d3.scaleOrdinal(d3.schemeCategory10);

  constructor() {}

  ngOnInit() {
    this.svg = d3
      .select('#d3-root')
      .append('svg')
      .attr('style', 'width: 100%; height: 100%; display: block');

    this.simulation = d3
      .forceSimulation(this.nodes)
      .force(
        'link',
        d3.forceLink(this.links).id((d: any) => d.id)
      )
      .force('charge', d3.forceManyBody().strength(-100))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2));

    const link = this.svg
      .append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(this.links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value));

    const node = this.svg
      .append('g')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .selectAll('circle')
      .data(this.nodes)
      .join('circle')
      .attr('r', 8)
      .attr('fill', d => {
        return this.scale(d.group);
      })
      .call(this.drag(this.simulation));

    node.append('title').text(d => d.id);

    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('cx', d => d.x).attr('cy', d => d.y);
    });
  }

  ngOnDestroy() {
    this.simulation.stop();
  }

  drag(simulation) {
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
}
