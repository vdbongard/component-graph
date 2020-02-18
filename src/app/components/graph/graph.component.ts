import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSelectChange, MatSnackBar } from '@angular/material';
import { ActivatedRoute, Router } from '@angular/router';
import * as d3 from 'd3';
import { Subscription } from 'rxjs';
import { d3adaptor, Layout, Link as ColaLink, Node as ColaNode } from 'webcola';
import { ID3StyleLayoutAdaptor } from 'webcola/dist/src/d3adaptor';
import { colorScheme } from '../../constants/colors';
import { qualityMetrics, sizeConstant, warningThreshold } from '../../constants/quality-metrics';
import { getCookie, setCookie } from '../../helper/cookie';
import { generateLinkReferences } from '../../helper/generateLinkReferences';
import { nestedStringAccess } from '../../helper/nestedStringAccess';
import { Node, NodeIcon, NodeSelection, RefLink, Settings } from '../../interfaces';
import { DataService } from '../../services/data.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.component.html',
  styleUrls: ['./graph.component.scss']
})
export class GraphComponent implements OnInit, OnDestroy {
  @Input() set selectedNodes(value: NodeSelection[]) {
    this.selectedNodesInternal = value;
    this.updateGraph();
  }
  get selectedNodes(): NodeSelection[] {
    return this.selectedNodesInternal;
  }

  private selectedNodesInternal: NodeSelection[];

  @ViewChild('d3Root') d3Root: ElementRef;

  nodeData: Node[];
  linkData: RefLink[];

  svg: d3.Selection<any, any, any, any>;
  svgZoomGroup: d3.Selection<any, any, any, any>;
  simulation: d3.Simulation<any, any> | (Layout & ID3StyleLayoutAdaptor);
  links: d3.Selection<any, any, any, any>;
  nodes: d3.Selection<any, any, any, any>;
  zoom: d3.ZoomBehavior<any, any>;

  dragging = false;
  firstSimulation = true;
  id: string;
  isFaded: boolean;
  isWheelZooming = false;
  queryParamWasUpload = false;
  queryParamIsInitial = true;
  zoomLevel: number;
  qualityMetricsEntries = Object.entries(qualityMetrics);

  private graphDataSub: Subscription;
  private settingsSub: Subscription;
  private queryParamsSub: Subscription;
  private selectedNodesSub: Subscription;
  private progressSub: Subscription;

  // Settings
  settings: Settings;
  fadeOpacity = 0.1;
  zoomTransition = '0.1s ease-out';
  selectedCircleStrokeWidth = 2;
  selectedCircleFillBrightness = 0.5;
  linkColor = '#999';
  linkOpacity = 0.6;
  linkStrokeWidth = 0.8;
  maxLinkStrokeWidth = 1.6;
  dragAlphaTarget = 0.3; // how much the dragged node influences other nodes
  previewCircleRadius = 3;
  normalTextSize = 14;
  maxTextSize = 20;
  circleRadius = 24;
  circleFillBrightness = 0.75;
  circleStrokeWidth = 1;
  minChargeForce = -200;
  linkDistance = 100;
  sizeMetric = 'sloc.physical';

  constructor(
    public dataService: DataService,
    public settingsService: SettingsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    this.settingsSub = this.settingsService.settings$.subscribe(settings => {
      const firstLoad = !this.settings;
      this.settings = { ...this.settings, ...settings };

      if (firstLoad) {
        this.initGraph();
      } else {
        if (Object.keys(settings).length === 1 && 'fullScreen' in settings) {
          setTimeout(this.zoomToFit.bind(this), 0);
          return;
        }
        setTimeout(this.restartGraph.bind(this), 0);
      }
    });

    this.queryParamsSub = this.activatedRoute.queryParams.subscribe(queryParams => {
      if (queryParams.upload) {
        this.id = undefined;
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

      if (this.id) {
        setTimeout(() => {
          this.dataService.selectFile(this.id.split('#')[0]);
        }, 0);
      }
    });
  }

  private initGraph() {
    this.graphDataSub = this.dataService.graphData$.subscribe(graph => {
      if (graph) {
        console.log('Graph:', graph);

        if (
          graph.nodes.length > 30 &&
          this.settings.colaLayout &&
          !getCookie('toastDisableFlowLayout')
        ) {
          setCookie('toastDisableFlowLayout', 1, 365 * 10);
          this.snackBar
            .open('Tip: Try out disabling flow layout on large graphs', 'Change now', {
              duration: 8000
            })
            .onAction()
            .subscribe(() => {
              this.settingsService.setSettings({ colaLayout: false });
              this.snackBar
                .open('Changed graph layout', 'Undo', {
                  duration: 8000
                })
                .onAction()
                .subscribe(() => {
                  this.settingsService.setSettings({ colaLayout: true });
                });
            });
        }

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
    this.isFaded = false;
    this.svgZoomGroup = this.createSVG();
    this.simulation = this.createSimulation(force);
    this.links = this.createLinks();
    this.nodes = this.createNodes();
    this.updateGraph();
  }

  private stopGraph() {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    this.links = null;
    this.nodes = null;
    this.svgZoomGroup = null;
    d3.select('#d3-root svg #zoomGroup')
      .selectAll('*')
      .remove();
  }

  private restartGraph(force?: number) {
    this.stopGraph();
    this.startGraph(force);
  }

  private updateGraph() {
    if (!this.svgZoomGroup) {
      return;
    }

    this.svgZoomGroup.selectAll('.node circle.circle-overlay').attr('stroke-width', (d: Node) => {
      return this.selectedNodes && this.selectedNodes.find(node => node.id === d.id)
        ? this.selectedCircleStrokeWidth
        : this.circleStrokeWidth;
    });

    this.svgZoomGroup.selectAll('.node circle.circle-node').attr('fill', (d: Node) => {
      const brightness =
        this.selectedNodes && this.selectedNodes.find(node => node.id === d.id)
          ? this.selectedCircleFillBrightness
          : this.circleFillBrightness;

      return this.calculateBrightenedColor(d, brightness);
    });
  }

  private calculateBrightenedColor(d: Node, brightness: number) {
    const color = d3.hsl(colorScheme[d.group - 1]);
    color.l += (1 - color.l) * brightness;
    return color.toString();
  }

  generateNodeSizes(nodes: Node[]) {
    const isComponentView = this.id || this.dataService.hasSingleComponent();
    const nodeSizeMultiplier = isComponentView ? 3.5 : 2;

    return nodes.map(node => {
      if (!this.settings.nodeSizesBasedOnMetrics) {
        node.width = node.height = this.circleRadius * 2;
        return node;
      }

      const report = node.report?.aggregate || node.report;

      if (!report) {
        console.error('Report not found:', node.id, this.id);
        return;
      }

      node.icons = this.getNodeIcons(node, report);

      // fixed size for component node in component view
      if (isComponentView && node.group === 1) {
        node.width = node.height = this.circleRadius * 2;
        return node;
      }

      const metricValue = nestedStringAccess(report, this.sizeMetric);
      const metricSizeFactor = sizeConstant / qualityMetrics[this.sizeMetric].thresholds.component;

      // circle area relative to metric (not circle radius)
      node.width = node.height =
        nodeSizeMultiplier * Math.sqrt((metricSizeFactor * metricValue) / Math.PI);

      if (!isComponentView) {
        node.width += this.getCirclePreviewWidth();
        node.height += this.getCirclePreviewWidth();
      }

      return node;
    });
  }

  getNodeIcons(node, report): NodeIcon[] {
    const icons: NodeIcon[] = [];
    let hasWarning = false;
    let hasError = false;

    for (const id of Object.keys(qualityMetrics)) {
      const customThresholdName = node.type + '.' + (node.label || node.id);
      const threshold =
        qualityMetrics[id].thresholds[customThresholdName] !== undefined
          ? qualityMetrics[id].thresholds[customThresholdName]
          : qualityMetrics[id].thresholds[node.type];

      if (!threshold) {
        continue;
      }

      const value = nestedStringAccess(report, id);

      if (value >= threshold * warningThreshold && value < threshold) {
        hasWarning = true;
      } else if (value >= threshold) {
        hasError = true;
        break;
      }
    }

    if (hasError) {
      icons.push({
        icon: 'warning',
        class: 'error'
      });
    } else if (hasWarning) {
      icons.push({
        icon: 'warning',
        class: 'warn'
      });
    }

    if (report.sloc.logical === 0) {
      // empty function
      icons.push({
        icon: 'delete',
        class: 'warn'
      });
    } else if (
      node.kind === 'ClassComponent' &&
      node.type === 'innerFunction' &&
      !report.halstead.operators.identifiers.includes('this')
    ) {
      // no this reference -> helper function
      icons.push({
        icon: 'content_cut',
        class: 'warn'
      });
    }

    if (node.returnsJSX && node.id !== 'render') {
      console.log(node);
      // function besides the render function that returns JSX -> extract component
      icons.push({
        icon: 'content_cut',
        class: 'warn'
      });
    }

    return icons;
  }

  private createSVG() {
    this.zoom = d3.zoom().on('zoom', () => {
      this.zoomLevel = Math.round(d3.event.transform.k * 100);

      this.svgZoomGroup.attr('transform', d3.event.transform);
      if (this.normalTextSize * d3.event.transform.k > this.maxTextSize) {
        this.nodes
          .select('text.node-label')
          .style('font-size', `${this.maxTextSize / d3.event.transform.k}px`);
      }
      if (this.linkStrokeWidth * d3.event.transform.k > this.maxLinkStrokeWidth) {
        this.links.style('stroke-width', this.maxLinkStrokeWidth / d3.event.transform.k);
      }
    });

    this.svg = d3
      .select('#d3-root svg')
      .on('wheel', () => {
        this.addTransition();
      })
      .on('mousedown', () => {
        this.removeTransition();
      })
      .call(this.zoom)
      .on('dblclick.zoom', null);

    d3.select('#diagonalHatch line')
      .style('stroke', colorScheme[0])
      .style('stroke-width', Math.max(this.circleStrokeWidth * 2, 1))
      .style('opacity', 0.6);

    return this.svg.select('#zoomGroup');
  }

  private addTransition() {
    if (!this.isWheelZooming) {
      this.isWheelZooming = true;
      this.svgZoomGroup.style('transition', `transform ${this.zoomTransition}`);
      this.svgZoomGroup
        .selectAll('.node text.node-label')
        .style('transition', `font-size ${this.zoomTransition}`);
    }
  }

  private removeTransition() {
    if (this.isWheelZooming) {
      this.isWheelZooming = false;
      this.svgZoomGroup.style('transition', null);
      this.svgZoomGroup.selectAll('.node text.node-label').style('transition', null);
    }
  }

  private createSimulation(force?: number) {
    let simulation;

    this.nodeData = this.generateNodeSizes(this.nodeData);

    if (this.settings.colaLayout) {
      simulation = d3adaptor(d3)
        .size([this.d3Root.nativeElement.clientWidth, this.d3Root.nativeElement.clientHeight])
        .nodes(this.nodeData)
        .links(this.linkData as ColaLink<ColaNode>[])
        .avoidOverlaps(true)
        .flowLayout('y', 100)
        .symmetricDiffLinkLengths(40, 0.7)
        .start(40, 20, 20);
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
        .force(
          'collide',
          d3.forceCollide().radius((d: Node) => (d.width / 2) * 1.2)
        );
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
            const targetRadius =
              this.getMainCircleRadiusWithoutStrokeWidth(d.target) + this.circleStrokeWidth / 2;
            const actualDistance = distance - targetRadius;
            return d.source.x + (diffX / distance) * actualDistance;
          })
          .attr('y2', d => {
            const diffX = d.target.x - d.source.x;
            const diffY = d.target.y - d.source.y;
            const distance = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));
            const targetRadius =
              this.getMainCircleRadiusWithoutStrokeWidth(d.target) + this.circleStrokeWidth / 2;
            const actualDistance = distance - targetRadius;
            return d.source.y + (diffY / distance) * actualDistance;
          });

        this.nodes.attr('transform', d => `translate(${d.x}, ${d.y})`);
      })
      .on('end', () => {
        if (this.firstSimulation && this.simulation === simulation) {
          this.firstSimulation = false;
          if (this.settings.autoZoom) {
            this.zoomToFit();
          }
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
      .attr('stroke-dasharray', d => (d.inherits ? '4 2' : null))
      .attr('marker-end', 'url(#arrowhead)');
  }

  private createNodes() {
    const onNodeClick = d => {
      if (d3.event.ctrlKey) {
        this.removeNode(d);
        this.restartGraph();
        return;
      }
      this.dataService.selectNode(d, this.id);
    };

    const nodes = this.svgZoomGroup
      .append('g')
      .selectAll('.node')
      .data(this.nodeData)
      .join('g')
      .attr('class', 'node')
      .attr('style', 'cursor: pointer; outline: none; opacity: 1;')
      .on('dblclick', d => {
        if (d.id.startsWith('/') && d.functions.length >= 1) {
          this.router.navigate([], {
            relativeTo: this.activatedRoute,
            queryParams: { id: d.id },
            queryParamsHandling: 'merge'
          });
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
          this.isFaded = true;
        })
        .on('blur', d => {
          if (this.isFaded) {
            fade(d, 1);
          }
        })
        .on('mouseover.fade', d => {
          if (d3.event.ctrlKey) {
            fade(d, this.fadeOpacity);
            this.isFaded = true;
          }
        })
        .on('mouseout.fade', d => {
          if (d3.event.ctrlKey && this.isFaded) {
            fade(d, 1);
          }
        });
    }

    // main circle
    nodes
      .append('circle')
      .attr('class', 'circle-node')
      .attr('r', d => this.getMainCircleRadiusWithoutStrokeWidth(d));

    // overlay circle
    nodes
      .append('circle')
      .attr('class', 'circle-overlay')
      .on('click', onNodeClick)
      .attr('fill', d =>
        d.type === 'component' && d.kind === 'ClassComponent'
          ? 'url(#diagonalHatch)'
          : 'transparent'
      )
      .attr('r', d => this.getMainCircleRadiusWithoutStrokeWidth(d))
      .attr('stroke', d => colorScheme[d.group - 1]);

    // inner circle stroke (for functions returning jsx)
    nodes
      .filter(d => d.returnsJSX)
      .append('circle')
      .attr('fill', 'none')
      .attr('r', d => this.getMainCircleRadiusWithoutStrokeWidth(d) - 3)
      .attr('stroke', d => colorScheme[d.group - 1])
      .attr('stroke-width', this.circleStrokeWidth);

    // preview circles
    nodes
      .append('g')
      .selectAll('circle')
      .data(d => {
        return d.functions
          ? d.functions.map(f => {
              f.width = d.width;
              f.componentId = d.id;
              return f;
            })
          : [];
      })
      .join('circle')
      .attr('class', 'function')
      .on('click', d => {
        this.dataService.selectNode(d, d.componentId);
      })
      .attr('r', this.previewCircleRadius)
      .attr('fill', (d: Node) => {
        return d.returnsJSX
          ? this.calculateBrightenedColor(d, 0.15)
          : this.calculateBrightenedColor(d, 0.7);
      })
      .attr('stroke-width', this.circleStrokeWidth)
      .attr('stroke', d => colorScheme[d.group - 1])
      .attr('cx', (d, i) => {
        const r = this.getOuterCircleRadius(d);
        return r * Math.cos(this.getCircleIndexValue(i, r) - Math.PI * 0.5);
      })
      .attr('cy', (d, i) => {
        const r = this.getOuterCircleRadius(d);
        return r * Math.sin(this.getCircleIndexValue(i, r) - Math.PI * 0.5);
      })
      .attr('opacity', 0.5)
      .style('display', (d, i) => {
        const r = this.getOuterCircleRadius(d);
        const circleIndexValue = this.getCircleIndexValue(i + 1, r);
        // hide if bigger than one full circle
        return circleIndexValue > Math.PI * 2 ? 'none' : null;
      })
      .append('title')
      .text(d => d.id);

    if (this.settings.text) {
      const textNodes = nodes
        .append('text')
        .attr('class', 'node-label')
        .style('font-size', `${this.normalTextSize}px`)
        .style('dominant-baseline', 'central')
        .style('text-anchor', 'middle');

      textNodes
        .append('tspan')
        .on('click', onNodeClick)
        .text(d => d.label || d.id);

      // node warning and error icons
      textNodes
        .append('tspan')
        .attr('dy', '1.2em')
        .attr('x', '0')
        .selectAll('tspan.icon')
        .data(d => {
          return d.icons
            ? d.icons.map(i => {
                i.width = d.width;
                return i;
              })
            : [];
        })
        .join('tspan')
        .attr('class', d => 'icon ' + d.class)
        .text(d => d.icon);
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

      nodes.transition().style('opacity', o => (opacity === 1 || isConnected(d, o) ? 1 : opacity));

      links
        .transition()
        .attr('opacity', o => (opacity === 1 || o.source === d || o.target === d ? 1 : opacity));
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

  zoomToFit(paddingPercent = 0.95, forceScale?: number) {
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
      forceScale ||
      Math.min(
        paddingPercent / Math.max(width / fullWidth, height / fullHeight),
        3 // max auto zoom
      );
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

    this.removeTransition();

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

  routeBack() {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { id: null },
      queryParamsHandling: 'merge'
    });
  }

  private getCircleIndexValue(i: number, r: number) {
    return (i / r) * (this.previewCircleRadius + this.circleStrokeWidth / 2) * 2;
  }

  private getCirclePreviewWidth() {
    return (this.previewCircleRadius + this.circleStrokeWidth / 2) * 4;
  }

  private getMainCircleRadiusWithoutStrokeWidth(d: { width?: number }) {
    const isComponentView = this.id || this.dataService.hasSingleComponent();

    let circleWidth = d.width;

    if (!isComponentView) {
      circleWidth -= this.getCirclePreviewWidth();
    }

    return circleWidth / 2;
  }

  private getOuterCircleRadius(d: Node) {
    return (
      this.getMainCircleRadiusWithoutStrokeWidth(d) +
      this.circleStrokeWidth / 2 +
      this.getCirclePreviewWidth() / 4
    );
  }

  ngOnDestroy() {
    this.stopGraph();
    this.settingsSub.unsubscribe();
    this.queryParamsSub.unsubscribe();
    this.selectedNodesSub.unsubscribe();
    this.progressSub.unsubscribe();
    if (this.graphDataSub) {
      this.graphDataSub.unsubscribe();
    }
  }

  onMetricSelectionChange(event: MatSelectChange) {
    this.sizeMetric = event.value;
    this.restartGraph();
  }
}
