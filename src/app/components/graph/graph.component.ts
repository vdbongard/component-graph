import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import * as d3 from 'd3';
import data from '../../constants/data';
import { Link, Node } from '../../interfaces';
import { DataService } from '../../services/data.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements OnInit, OnDestroy {
  linkData: Link[] = data.links;
  nodeData: Node[] = data.nodes;

  @ViewChild('d3Root') d3Root: ElementRef;

  svgZoomGroup: d3.Selection<SVGGElement, any, any, any>;
  simulation: d3.Simulation<any, any>;
  links: d3.Selection<any, any, any, any>;
  nodes: d3.Selection<any, any, any, any>;

  scale = d3.scaleOrdinal(d3.schemeCategory10);
  dragging = false;

  // Settings
  normalTextSize = 12;
  maxTextSize = 18;
  fadeOpacity = 0.1;
  zoomTransition = '0.1s ease-out';
  linkColor = '#999';
  linkOpacity = 0.6;
  linkStrokeWidth = 0.8;
  maxLinkStrokeWidth = 1.6;
  circleRadius = 8;
  circleFillBrightness = 0;
  circleStrokeWidth = 0;
  dragAlphaTarget = 0.3; // how much the dragged node influences other nodes
  minChargeForce = -100;
  linkDistance = 30;
  textCenter = false;
  fullScreen = window.location.search.indexOf('fullScreen=0') === -1;

  constructor(
    public dataService: DataService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    if (window.location.search.indexOf('textCenter=1') >= 0) {
      this.normalTextSize = 14;
      this.maxTextSize = 20;
      this.circleRadius = 24;
      this.circleFillBrightness = 0.8;
      this.circleStrokeWidth = 1;
      this.minChargeForce = -600;
      this.linkDistance = 100;
      this.textCenter = true;
    }

    this.dataService.graphData$.subscribe(graph => {
      if (graph) {
        // clone data to prevent simulation changes from getting saved to localStorage
        this.linkData = JSON.parse(JSON.stringify(graph.links));
        this.nodeData = JSON.parse(JSON.stringify(graph.nodes));
      }

      setTimeout(this.restartGraph.bind(this), 0);
    });

    // @ts-ignore
    window.restartGraph = this.restartGraph.bind(this);

    this.dataService.restoreFromLocalStorage();
    window.onbeforeunload = () => this.dataService.saveToLocalStorage();

    this.activatedRoute.queryParams.subscribe(queryParams => {
      this.dataService.setComponent(queryParams.id);
    });
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
      .attr(
        'style',
        'width: 100%; height: 100%; user-select: none; display: block;'
      )
      .on('wheel', () => {
        svg.style('transition', `transform ${this.zoomTransition}`);
      })
      .on('mousedown', () => {
        svg.style('transition', null);
      })
      .call(
        d3.zoom().on('zoom', () => {
          svg.attr('transform', d3.event.transform);
          if (this.normalTextSize * d3.event.transform.k > this.maxTextSize) {
            this.nodes
              .select('text')
              .style(
                'font-size',
                `${this.maxTextSize / d3.event.transform.k}px`
              );
          }
          if (
            this.linkStrokeWidth * d3.event.transform.k >
            this.maxLinkStrokeWidth
          ) {
            this.links.style(
              'stroke-width',
              this.maxLinkStrokeWidth / d3.event.transform.k
            );
          }
        })
      )
      .append('g');

    svg
      .append('defs')
      .append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 9)
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
        : Math.min(-4000 + this.nodeData.length * 200, this.minChargeForce);
    console.log('Charge force:', chargeForce);

    const simulation = d3
      .forceSimulation(this.nodeData)
      .force(
        'link',
        d3
          .forceLink(this.linkData)
          .id((d: any) => d.id)
          .distance(this.linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeForce))
      .force(
        'center',
        d3.forceCenter(
          this.d3Root.nativeElement.clientWidth / 2,
          this.d3Root.nativeElement.clientHeight / 2
        )
      )
      .force('collide', d3.forceCollide().radius(this.circleRadius * 1.2));

    simulation.on('tick', () => {
      this.links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => {
          const diffX = d.target.x - d.source.x;
          const diffY = d.target.y - d.source.y;
          const distance = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));
          return (
            d.source.x +
            (diffX / distance) *
              (distance - this.circleRadius - this.circleStrokeWidth / 2)
          );
        })
        .attr('y2', d => {
          const diffX = d.target.x - d.source.x;
          const diffY = d.target.y - d.source.y;
          const distance = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));
          return (
            d.source.y +
            (diffY / distance) *
              (distance - this.circleRadius - this.circleStrokeWidth / 2)
          );
        });

      this.nodes.attr('transform', d => `translate(${d.x}, ${d.y})`);
    });

    return simulation;
  }

  private createLinks() {
    return this.svgZoomGroup
      .append('g')
      .attr('stroke', this.linkColor)
      .attr('stroke-opacity', this.linkOpacity)
      .style('opacity', 1)
      .selectAll('line')
      .data(this.linkData)
      .join('line')
      .style('transition', `stroke-width ${this.zoomTransition}`)
      .attr('stroke-width', this.linkStrokeWidth)
      .attr('marker-end', 'url(#arrowhead)');
  }

  private createNodes() {
    const nodes = this.svgZoomGroup
      .append('g')
      .selectAll('.node')
      .data(this.nodeData)
      .join('g')
      .attr('class', 'node')
      .attr('style', 'cursor: pointer; outline: none; opacity: 1;')
      .call(this.drag(this.simulation))
      .on('click', event => {
        if (d3.event.ctrlKey) {
          this.nodeData = this.nodeData.filter(node => node.id !== event.id);
          this.linkData = this.linkData.filter(
            // @ts-ignore
            link => link.source.id !== event.id && link.target.id !== event.id
          );
          this.restartGraph();
        }
      });

    if (window.location.search.indexOf('fade=1') >= 0) {
      nodes
        .on('click.fade', d => {
          if (d.id.startsWith('/')) {
            this.router.navigate([], {
              relativeTo: this.activatedRoute,
              queryParams: { id: d.id },
              queryParamsHandling: 'merge'
            });
          } else {
            fade(this.fadeOpacity).call(this, d);
          }
        })
        .on('blur', fade(1))
        .on('mouseover.fade', d => {
          if (d3.event.ctrlKey) {
            _fade(d, this.fadeOpacity);
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
      .attr('r', this.circleRadius)
      .attr('fill', d => {
        const color = d3.hsl(this.scale(d.group ? d.group.toString() : '1'));
        color.l += (1 - color.l) * this.circleFillBrightness;
        return color.toString();
      })
      .attr('stroke', d => this.scale(d.group ? d.group.toString() : '1'))
      .attr('stroke-width', this.circleStrokeWidth);

    if (window.location.search.indexOf('text=1') >= 0) {
      nodes
        .append('text')
        .text(d => d.label || d.id)
        .style('font-size', `${this.normalTextSize}px`)
        .style('dominant-baseline', 'central')
        .style('transition', `font-size ${this.zoomTransition}`)
        .attr('x', this.circleRadius * 1.1);

      if (this.textCenter) {
        nodes
          .select('text')
          .style('text-anchor', 'middle')
          .attr('x', null);
      }
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
        simulation.alphaTarget(self.dragAlphaTarget).restart();
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
