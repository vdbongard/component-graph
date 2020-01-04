import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import * as d3 from 'd3';
import { RefLink, Node, Settings, NodeSelection } from '../../interfaces';
import { DataService } from '../../services/data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { d3adaptor, Layout, Link as ColaLink, Node as ColaNode } from 'webcola';
import { ID3StyleLayoutAdaptor } from 'webcola/dist/src/d3adaptor';
import data from '../../constants/data';
import { generateLinkReferences } from '../../helper/generateLinkReferences';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements OnInit, OnDestroy {
  nodeData: Node[] = data.nodes;
  linkData: RefLink[] = generateLinkReferences(data.links, data.nodes);

  @ViewChild('d3Root', { static: false }) d3Root: ElementRef;

  svg: d3.Selection<SVGElement, any, any, any>;
  svgZoomGroup: d3.Selection<SVGGElement, any, any, any>;
  simulation: d3.Simulation<any, any> | (Layout & ID3StyleLayoutAdaptor);
  links: d3.Selection<any, any, any, any>;
  nodes: d3.Selection<any, any, any, any>;
  zoom: d3.ZoomBehavior<any, any>;

  scale = d3.scaleOrdinal(d3.schemeCategory10);
  dragging = false;
  firstSimulation = true;
  selectedNode: NodeSelection;
  id: string;
  progress: number;
  queryParamWasUpload = false;
  queryParamIsInitial = true;

  private graphDataSub: Subscription;
  private settingsSub: Subscription;
  private queryParamsSub: Subscription;
  private selectedNodeSub: Subscription;
  private progressSub: Subscription;

  // Settings
  settings: Settings;
  fadeOpacity = 0.1;
  zoomTransition = '0.1s ease-out';
  selectedCircleStrokeWidth = 2;
  selectedCircleFillBrightness = 0.8;
  linkColor = '#999';
  linkOpacity = 0.6;
  linkStrokeWidth = 0.8;
  maxLinkStrokeWidth = 1.6;
  dragAlphaTarget = 0.3; // how much the dragged node influences other nodes

  normalTextSize: number;
  maxTextSize: number;
  circleRadius: number;
  circleFillBrightness: number;
  circleStrokeWidth: number;
  minChargeForce: number;
  linkDistance: number;

  constructor(
    public dataService: DataService,
    public settingsService: SettingsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private ref: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.settingsSub = this.settingsService.settings$.subscribe(settings => {
      const firstLoad = !this.settings;
      this.settings = { ...this.settings, ...settings };

      // layout settings
      if ('textCenter' in settings) {
        if (settings.textCenter) {
          this.normalTextSize = 14;
          this.maxTextSize = 20;
          this.circleRadius = 24;
          this.circleFillBrightness = 0.8;
          this.circleStrokeWidth = 1;
          this.minChargeForce = -200;
          this.linkDistance = 100;
        } else {
          this.normalTextSize = 12;
          this.maxTextSize = 18;
          this.circleRadius = 8;
          this.circleFillBrightness = 0;
          this.circleStrokeWidth = 0;
          this.minChargeForce = -100;
          this.linkDistance = 30;
        }
      }

      if (firstLoad) {
        this.initGraph();
      } else {
        if (Object.keys(settings).length === 1 && 'fullScreen' in settings) {
          this.ref.detectChanges();
          this.zoomToFit();
          return;
        }
        setTimeout(this.restartGraph.bind(this), 0);
      }
    });

    // @ts-ignore
    window.restartGraph = this.restartGraph.bind(this);
    // @ts-ignore
    window.zoomFit = this.zoomToFit.bind(this);

    window.onbeforeunload = () => this.dataService.saveToLocalStorage();

    this.queryParamsSub = this.activatedRoute.queryParams.subscribe(
      queryParams => {
        if (queryParams.upload) {
          this.router.navigate([], {
            relativeTo: this.activatedRoute
          });
          this.queryParamWasUpload = true;
          this.queryParamIsInitial = false;
          return;
        }
        // skip graph update, wait for uploaded files being analyzed
        if (this.queryParamWasUpload) {
          this.queryParamWasUpload = false;
          return;
        }
        if (this.queryParamIsInitial) {
          this.queryParamIsInitial = false;
          this.dataService.restoreFromLocalStorage();
        }

        this.id = queryParams.id;
        this.dataService.setComponentGraph(queryParams.id);
      }
    );

    this.selectedNodeSub = this.dataService.selectedNode$.subscribe(node => {
      if (!node) {
        return;
      }
      if (node.report.aggregate) {
        node.report.aggregate.halstead.operands.identifiers = ['...'];
        node.report.aggregate.halstead.operators.identifiers = ['...'];
      }
      this.selectedNode = node;
      this.updateGraph();
    });

    this.progressSub = this.dataService.progress$.subscribe(
      progress => (this.progress = progress)
    );
  }

  private initGraph() {
    this.graphDataSub = this.dataService.graphData$.subscribe(graph => {
      if (graph) {
        console.log('Graph:', graph);

        this.nodeData = JSON.parse(JSON.stringify(graph.nodes));
        // clone data to prevent simulation changes from getting saved to localStorage
        this.linkData = generateLinkReferences(
          JSON.parse(JSON.stringify(graph.links)),
          this.nodeData
        );

        setTimeout(this.restartGraph.bind(this), 0);
      }
    });
  }

  private startGraph(force?: number) {
    this.firstSimulation = true;
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
    this.links = null;
    this.nodes = null;
    this.svgZoomGroup = null;
    d3.select('#d3-root')
      .selectAll('*')
      .remove();
  }

  private restartGraph(force?: number) {
    this.stopGraph();
    this.startGraph(force);
  }

  private updateGraph() {
    this.svgZoomGroup
      .selectAll('.node circle')
      .attr('stroke-width', (d: Node) => {
        return d.id === this.selectedNode.id
          ? this.selectedCircleStrokeWidth
          : this.circleStrokeWidth;
      })
      .attr('fill', (d: Node) => {
        const brightness =
          d.id === this.selectedNode.id
            ? this.selectedCircleFillBrightness
            : this.circleFillBrightness;

        return this.calculateBrightenedColor(d, brightness);
      });
  }

  private calculateBrightenedColor(d: Node, brightness: number) {
    const color = d3.hsl(this.scale(d.group ? d.group.toString() : '1'));
    color.l += (1 - color.l) * brightness;
    return color.toString();
  }

  generateNodeSizes(nodes: Node[]) {
    return nodes.map(node => {
      node.width = this.circleRadius * 2;
      node.height = this.circleRadius * 2;
      return node;
    });
  }

  private createSVG() {
    this.zoom = d3.zoom().on('zoom', () => {
      this.svgZoomGroup.attr('transform', d3.event.transform);
      if (this.normalTextSize * d3.event.transform.k > this.maxTextSize) {
        this.nodes
          .select('text')
          .style('font-size', `${this.maxTextSize / d3.event.transform.k}px`);
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
    });

    this.svg = d3
      .select('#d3-root')
      .append('svg')
      .attr(
        'style',
        'width: 100%; height: 100%; user-select: none; display: block;'
      )
      .on('wheel', () => {
        this.svgZoomGroup.style(
          'transition',
          `transform ${this.zoomTransition}`
        );
      })
      .on('mousedown', () => {
        this.svgZoomGroup.style('transition', null);
      })
      .call(this.zoom);

    this.svg
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

    return this.svg.append('g');
  }

  private createSimulation(force?: number) {
    let simulation;

    if (this.settings.colaLayout) {
      this.nodeData = this.generateNodeSizes(this.nodeData);
      simulation = d3adaptor(d3)
        .size([
          this.d3Root.nativeElement.clientWidth,
          this.d3Root.nativeElement.clientHeight
        ])
        .nodes(this.nodeData)
        .links(this.linkData as ColaLink<ColaNode>[])
        .avoidOverlaps(true)
        .flowLayout('y', 100)
        .symmetricDiffLinkLengths(40, 0.7)
        .start(10, 20, 20);
    } else {
      const chargeForce =
        force !== undefined
          ? force
          : Math.min(-4000 + this.nodeData.length * 200, this.minChargeForce);
      console.log('Charge force:', chargeForce);

      simulation = d3
        .forceSimulation(this.nodeData)
        .force(
          'link',
          d3
            .forceLink(this.linkData)
            // .id((d: any) => d.id)
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
    }

    simulation
      .on('tick', () => {
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
      })
      .on('end', () => {
        if (this.firstSimulation && !this.settings.colaLayout) {
          this.firstSimulation = false;
          this.zoomToFit();
        }
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
      .on('click', d => {
        if (d3.event.shiftKey && d.id.startsWith('/')) {
          this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams: { id: d.id },
            queryParamsHandling: 'merge'
          });
        } else if (d3.event.ctrlKey) {
          this.removeNode(d);
          this.restartGraph();
        } else {
          this.dataService.selectNode(d, this.id);
        }
      });

    if (this.settings.colaLayout) {
      nodes.call((this.simulation as Layout & ID3StyleLayoutAdaptor).drag);
    } else {
      nodes.call(this.drag(this.simulation as d3.Simulation<any, any>));
    }

    if (this.settings.fade) {
      nodes
        .on('click.fade', d => {
          fade(d, this.fadeOpacity);
        })
        .on('blur', d => fade(d, 1))
        .on('mouseover.fade', d => {
          if (d3.event.ctrlKey) {
            fade(d, this.fadeOpacity);
          }
        })
        .on('mouseout.fade', d => {
          if (d3.event.ctrlKey) {
            fade(d, 1);
          }
        });
    }

    nodes
      .append('circle')
      .attr('r', this.circleRadius)
      .attr('fill', d =>
        this.calculateBrightenedColor(d, this.circleFillBrightness)
      )
      .attr('stroke', d => this.scale(d.group ? d.group.toString() : '1'))
      .attr('stroke-width', this.circleStrokeWidth);

    if (this.settings.text) {
      nodes
        .append('text')
        .text(d => d.label || d.id)
        .style('font-size', `${this.normalTextSize}px`)
        .style('dominant-baseline', 'central')
        .style('transition', `font-size ${this.zoomTransition}`)
        .attr('x', this.circleRadius * 1.1);

      if (this.settings.textCenter) {
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

    function fade(d: Node, opacity: number) {
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

  private removeNode(d: Node) {
    this.nodeData = this.nodeData.filter(node => node.id !== d.id);
    this.linkData = this.linkData.filter(
      // @ts-ignore
      link => link.source.id !== d.id && link.target.id !== d.id
    );
  }

  zoomToFit(paddingPercent = 0.95) {
    const bounds = this.svgZoomGroup.node().getBBox();
    const parent = this.svgZoomGroup.node().parentElement;
    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;

    // nothing to fit
    if (width === 0 || height === 0) {
      return;
    }

    const scale =
      paddingPercent / Math.max(width / fullWidth, height / fullHeight);
    const translate = [
      fullWidth / 2 - scale * midX,
      fullHeight / 2 - scale * midY
    ];

    this.svg
      .transition()
      .call(
        this.zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
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
    this.settingsSub.unsubscribe();
    this.queryParamsSub.unsubscribe();
    this.selectedNodeSub.unsubscribe();
    this.progressSub.unsubscribe();
    if (this.graphDataSub) {
      this.graphDataSub.unsubscribe();
    }
  }
}
