import { Component, OnDestroy, OnInit } from '@angular/core';
import * as d3 from 'd3';
import data from '../../constants/data';
import { Link, Node } from '../../interfaces';
import { DataService } from '../../services/data.service';

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
  dragging = false;

  constructor(public dataService: DataService) {}

  ngOnInit() {
    this.dataService.graphData$.subscribe(graph => {
      if (graph) {
        this.linkData = graph.links;
        this.nodeData = graph.nodes;
      }

      this.restartGraph();
    });

    // @ts-ignore
    window.restartGraph = this.restartGraph.bind(this);
  }

  private startGraph(force?: number) {
    this.svgZoomGroup = this.createSVG();
    this.simulation = this.createSimulation(force);
    this.links = this.createLinks();
    this.nodes = this.createNodes();
  }

  private stopGraph() {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    d3.select('#d3-root')
      .selectAll('*')
      .remove();
  }

  private restartGraph(force?: number) {
    this.stopGraph();
    this.startGraph(force);
  }

  private createSVG() {
    const svg = d3
      .select('#d3-root')
      .append('svg')
      .attr('style', 'width: 100%; height: 100%; user-select: none;')
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

  private createSimulation(force?: number) {
    const chargeForce =
      force !== undefined
        ? force
        : Math.min(-4000 + this.nodeData.length * 200, -100);
    console.log('Charge force:', chargeForce);

    const simulation = d3
      .forceSimulation(this.nodeData)
      .force(
        'link',
        d3.forceLink(this.linkData).id((d: any) => d.id)
      )
      .force('charge', d3.forceManyBody().strength(chargeForce))
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
      .attr('style', 'cursor: pointer; outline: none;')
      .call(this.drag(this.simulation))
      .on('click', event => {
        if (d3.event.ctrlKey) {
          this.nodeData = this.nodeData.filter(node => node.id !== event.id);
          this.linkData = this.linkData.filter(
            // @ts-ignore
            link => link.source.id !== event.id && link.target.id !== event.id
          );
          this.restartGraph();
        } else if (window.location.search.indexOf('fade=1') >= 0) {
          _fade(event, 0.1);
        }
      });

    if (window.location.search.indexOf('fade=1') >= 0) {
      nodes.on('blur', fade(1));
      nodes
        .on('mouseover.fade', d => {
          if (d3.event.ctrlKey) {
            _fade(d, 0.1);
          }
        })
        .on('mouseout.fade', d => {
          if (d3.event.ctrlKey) {
            _fade(d, 1);
          }
        });
    }

    nodes
      .append('circle')
      .attr('r', 8)
      .attr('fill', d => this.scale(d.group ? d.group.toString() : '1'));

    if (window.location.search.indexOf('text=1') >= 0) {
      nodes
        .append('text')
        .text(d => d.id)
        .style('font-size', '12px')
        .attr('x', 9)
        .attr('y', 4);
    }

    const linkedByIndex = {};
    this.linkData.forEach(d => {
      // @ts-ignore
      linkedByIndex[`${d.source.index},${d.target.index}`] = 1;
    });

    function isConnected(a, b) {
      return (
        linkedByIndex[`${a.index},${b.index}`] ||
        linkedByIndex[`${b.index},${a.index}`] ||
        a.index === b.index
      );
    }

    const links = this.links;
    const self = this;

    function fade(opacity: number) {
      return d => {
        _fade(d, opacity);
      };
    }

    function _fade(d: Node, opacity: number) {
      if (self.dragging) {
        return;
      }

      nodes
        .transition()
        .style('opacity', o =>
          opacity === 1 || isConnected(d, o) ? 1 : opacity
        );

      links
        .transition()
        .attr('opacity', o =>
          opacity === 1 || o.source === d || o.target === d ? 1 : opacity
        );
    }

    return nodes;
  }

  private drag(simulation: d3.Simulation<any, any>): any {
    const self = this;

    function dragged(d) {
      if (!self.dragging) {
        console.log('dragged');
        simulation.alphaTarget(0.3).restart();
        self.dragging = true;
      }

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
      self.dragging = false;
    }

    return d3
      .drag()
      .on('drag', dragged)
      .on('end', dragEnded);
  }

  ngOnDestroy() {
    this.stopGraph();
  }
}
