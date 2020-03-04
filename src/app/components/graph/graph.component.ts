import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatSelectChange, MatSnackBar } from '@angular/material';
import { ActivatedRoute, Router } from '@angular/router';
import * as d3 from 'd3';
import { jLouvain } from 'jlouvain';
import { Subscription } from 'rxjs';
import { d3adaptor, IConstraint, Layout, Link as ColaLink, Node as ColaNode } from 'webcola';
import { ID3StyleLayoutAdaptor } from 'webcola/dist/src/d3adaptor';
import { graphSettings } from '../../constants/graph-settings';
import { qualityMetrics, sizeConstant, warningThreshold } from '../../constants/quality-metrics';
import { deprecatedMethods, reactMethods } from '../../constants/special-methods';
import { registerCookie } from '../../helper/cookie';
import { debounce } from '../../helper/debounce';
import { generateLinkReferences } from '../../helper/generateLinkReferences';
import { isColliding } from '../../helper/isColliding';
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
  isComponentView;
  isFaded: boolean;
  isWheelZooming = false;
  queryParamWasUpload = false;
  queryParamIsInitial = true;
  zoomLevel: number;
  qualityMetricsEntries = Object.entries(qualityMetrics);
  sizeMetric = graphSettings.defaultSizeMetric;
  settings: Settings;
  lastZoomValue;
  scale = d3.scaleOrdinal(d3.schemeCategory10);
  showCluster = false;

  private graphDataSub: Subscription;
  private settingsSub: Subscription;
  private queryParamsSub: Subscription;
  private selectedNodesSub: Subscription;
  private progressSub: Subscription;

  debouncedHideOverlappingLabels = debounce(this.hideOverlappingLabels.bind(this), 250);

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
        this.isComponentView = false;
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
      this.isComponentView = !!this.id || this.dataService.hasSingleComponent();
      this.dataService.setComponentGraph(queryParams.id);

      if (this.id) {
        if (qualityMetrics[this.sizeMetric].componentOnly) {
          this.sizeMetric = 'sloc.physical';
        }
        setTimeout(() => {
          this.dataService.selectFile(this.id.split('#')[0]);
        }, 0);
      }

      this.qualityMetricsEntries = Object.entries(qualityMetrics).filter(
        entry => (this.id && !entry[1].componentOnly) || !this.id
      );
    });
  }

  private initGraph() {
    this.graphDataSub = this.dataService.graphData$.subscribe(graph => {
      if (graph) {
        console.log('Graph:', graph);

        this.isComponentView = !!this.id || this.dataService.hasSingleComponent();

        if (graph.nodes.length > 30 && this.settings.colaLayout) {
          registerCookie('toastDisableFlowLayout', () => {
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
        ? graphSettings.selectedCircleStrokeWidth
        : graphSettings.circleStrokeWidth;
    });

    this.svgZoomGroup
      .selectAll('.node circle.circle-node')
      .attr('class', (d: Node) => {
        let className = `circle-node ${d.type}`;
        const selected = this.selectedNodes && this.selectedNodes.find(node => node.id === d.id);
        if (selected) {
          className += ' selected';
        }
        if (d.special) {
          className += ' special';
        }
        return className;
      })
      .style('fill', (d: Node) =>
        d.community && this.showCluster && this.isComponentView
          ? this.calculateBrightenedColor(d, 0.8)
          : null
      );

    this.svgZoomGroup
      .selectAll('.node circle.inner-circle, .node circle.circle-overlay')
      .style('stroke', (d: Node) =>
        d.community && this.showCluster && this.isComponentView
          ? this.calculateBrightenedColor(d, 0.2)
          : null
      );
  }

  generateNodeSizes(nodes: Node[]) {
    const isComponentView = this.id || this.dataService.hasSingleComponent();

    return nodes.map(node => {
      if (!this.settings.nodeSizesBasedOnMetrics) {
        node.width = node.height = graphSettings.circleRadius * 2;
        return node;
      }

      const report = node.report?.aggregate || node.report;

      if (!report) {
        console.error('Report not found:', node.id, this.id);
        return;
      }

      node.icons = this.getNodeIcons(node, report);

      // component node size based on remaining lines of code
      // after subtracting all function lines of code in component view
      if (isComponentView && node.type === 'component') {
        const allLines = report.sloc.physical;
        let functionLines = 0;
        nodes.forEach(functionNode => {
          if (functionNode.type !== 'innerFunction') {
            return;
          }
          functionLines += functionNode.report.sloc.physical;
        });

        let remainingComponentLines = allLines - functionLines;
        if (remainingComponentLines < 0) {
          remainingComponentLines = allLines;
        }
        const componentLineThreshold = qualityMetrics['sloc.physical'].thresholds.component;
        const componentMetricSizeFactor = sizeConstant / componentLineThreshold;
        node.width = node.height = Math.sqrt(
          (componentMetricSizeFactor * remainingComponentLines) / Math.PI
        );

        return node;
      }

      const metricValue = nestedStringAccess(report, this.sizeMetric);

      const threshold =
        qualityMetrics[this.sizeMetric].thresholds[`${node.type}.${node.label || node.id}`] !==
        undefined
          ? qualityMetrics[this.sizeMetric].thresholds[`${node.type}.${node.label || node.id}`]
          : qualityMetrics[this.sizeMetric].thresholds[node.type];
      const metricSizeFactor = sizeConstant / threshold;

      node.warn = node.error = false;
      if (metricValue >= threshold * warningThreshold && metricValue < threshold) {
        node.warn = true;
      } else if (metricValue >= threshold) {
        node.error = true;
      }

      // circle area relative to metric (not circle radius)
      node.width = node.height = Math.sqrt((metricSizeFactor * metricValue) / Math.PI);

      if (!isComponentView) {
        node.width += this.getCirclePreviewWidth();
        node.height += this.getCirclePreviewWidth();
      }

      return node;
    });
  }

  private calculateBrightenedColor(d: Node, brightness: number) {
    const color = d3.hsl(this.scale(d.community.toString()));
    color.l += (1 - color.l) * brightness;
    return color.toString();
  }

  generateCommunities(nodes: Node[]) {
    const jLouvainNodeData = this.nodeData
      .map(node => {
        if (node.type === 'component' || node.special) {
          return;
        }
        if (node.id === 'constructor') {
          return '_constructor';
        }
        return node.id;
      })
      .filter(n => n);
    const jLouvainLinkData = this.linkData.map(link => {
      const source =
        (link.source as Node).id === 'constructor' ? '_constructor' : (link.source as Node).id;
      const target =
        (link.target as Node).id === 'constructor' ? '_constructor' : (link.target as Node).id;
      return { source, target };
    });
    const community = jLouvain()
      .nodes(jLouvainNodeData)
      .edges(jLouvainLinkData);
    const communities = community();
    console.log('Communities:', communities);

    return nodes.map(node => {
      node.community = communities[node.id === 'constructor' ? '_constructor' : node.id];
      return node;
    });
  }

  // TODO move this to the data service
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

    if (hasError || hasWarning) {
      const icon: Partial<NodeIcon> = {
        icon: 'warning',
        description:
          node.type === 'component'
            ? 'This component should be split into smaller components'
            : 'This function should be split into smaller functions'
      };

      if (hasError) {
        icon.class = 'error';
      } else if (hasWarning) {
        icon.class = 'warn';
      }

      icons.push(icon as NodeIcon);
    }

    if (report.sloc.logical === 0) {
      // empty function
      icons.push({
        icon: 'delete',
        class: 'warn',
        description: 'Empty functions should be removed'
      });
    } else if (
      node.type === 'innerFunction' &&
      node.kind === 'ClassComponent' &&
      !node.isUsingThis
    ) {
      // no this reference -> helper function
      icons.push({
        icon: 'content_cut',
        class: 'warn',
        description:
          'This function has no this reference and should be extracted into a helper function.'
      });
    }

    if (node.returnsJSX && node.id !== 'render') {
      // function besides the render function that returns JSX -> extract component
      icons.push({
        icon: 'content_cut',
        class: 'warn',
        description:
          'Functions returning JSX should be components (except for the render function in class components)'
      });
    }

    if (node.extends) {
      icons.push({
        icon: 'device_hub',
        class: 'warn',
        description: `Component composition is recommended over inheritance.
          (see <a href="https://reactjs.org/docs/composition-vs-inheritance.html" target="_blank">
          https://reactjs.org/docs/composition-vs-inheritance.html</a>)`
      });
    }

    if (this.isComponentView && deprecatedMethods.includes(node.id)) {
      icons.push({
        icon: 'report',
        class: 'warn',
        description: `Deprecated React lifecycle method
          (see <a href="https://reactjs.org/docs/react-component.html#legacy-lifecycle-methods" target="_blank">
          https://reactjs.org/docs/react-component.html#legacy-lifecycle-methods</a>)`
      });
    }

    return icons;
  }

  private createSVG() {
    this.zoom = d3.zoom().on('zoom', () => {
      this.zoomLevel = Math.round(d3.event.transform.k * 100);

      this.svgZoomGroup.attr('transform', d3.event.transform);
      if (graphSettings.normalTextSize * d3.event.transform.k > graphSettings.maxTextSize) {
        this.nodes
          .select('text.node-label')
          .style('font-size', `${graphSettings.maxTextSize / d3.event.transform.k}px`);
      }
      if (graphSettings.linkStrokeWidth * d3.event.transform.k > graphSettings.maxLinkStrokeWidth) {
        this.links.style('stroke-width', graphSettings.maxLinkStrokeWidth / d3.event.transform.k);
      }

      if (d3.event.transform.k !== this.lastZoomValue) {
        this.lastZoomValue = d3.event.transform.k;
        if (this.settings.hideOverlappingLabels) {
          this.debouncedHideOverlappingLabels();
        }
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
      .style('stroke-width', Math.max(graphSettings.circleStrokeWidth * 2, 1))
      .style('opacity', 0.6);

    return this.svg.select('#zoomGroup');
  }

  private addTransition() {
    if (!this.isWheelZooming) {
      this.isWheelZooming = true;
      this.svgZoomGroup.style('transition', `transform ${graphSettings.zoomTransition}`);
      this.svgZoomGroup
        .selectAll('.node text.node-label')
        .style('transition', `font-size ${graphSettings.zoomTransition}`);
    }
  }

  private removeTransition() {
    if (this.isWheelZooming) {
      this.isWheelZooming = false;
      this.svgZoomGroup.style('transition', null);
      this.svgZoomGroup.selectAll('.node text.node-label').style('transition', null);
    }
  }

  generateReactConstraints(nodes: Node[], gap: number): IConstraint[] {
    const constraints: any[] = [];
    const nodeIndexes = [];

    reactMethods.forEach(methodName => {
      const nodeIndex = nodes.findIndex(node => node.id === methodName);
      if (nodeIndex >= 0) {
        nodeIndexes.push(nodeIndex);
      }
    });

    if (!nodeIndexes) {
      return [];
    }

    nodeIndexes.forEach((nodeIndex, listIndex) => {
      const nextNodeIndex = nodeIndexes[listIndex + 1];

      if (!nextNodeIndex) {
        return;
      }

      constraints.push({
        axis: 'x',
        left: nodeIndex,
        right: nextNodeIndex,
        gap
      });
    });

    return constraints;
  }

  private createSimulation(force?: number) {
    let simulation;

    this.nodeData = this.generateNodeSizes(this.nodeData);
    this.nodeData = this.generateCommunities(this.nodeData);

    if (this.settings.colaLayout) {
      const constraints = this.isComponentView
        ? this.generateReactConstraints(this.nodeData, graphSettings.nodeGap)
        : [];

      simulation = d3adaptor(d3)
        .size([this.d3Root.nativeElement.clientWidth, this.d3Root.nativeElement.clientHeight])
        .nodes(this.nodeData)
        .links(this.linkData as ColaLink<ColaNode>[])
        .constraints(constraints)
        .avoidOverlaps(true)
        .flowLayout('y', graphSettings.nodeGap)
        .symmetricDiffLinkLengths(40, 0.7)
        .start(40, 20, 20);
    } else {
      const chargeForce =
        force !== undefined
          ? force
          : Math.min(-4000 + this.nodeData.length * 200, graphSettings.minChargeForce);
      console.log('Charge force:', chargeForce);

      simulation = d3
        .forceSimulation(this.nodeData)
        .force(
          'link',
          d3
            .forceLink(this.linkData)
            // .id((d: any) => d.id)
            .distance(graphSettings.linkDistance)
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
              this.getMainCircleRadiusWithoutStrokeWidth(d.target) +
              graphSettings.circleStrokeWidth / 2;
            const actualDistance = distance - targetRadius;
            return d.source.x + (diffX / distance) * actualDistance;
          })
          .attr('y2', d => {
            const diffX = d.target.x - d.source.x;
            const diffY = d.target.y - d.source.y;
            const distance = Math.sqrt(Math.pow(diffX, 2) + Math.pow(diffY, 2));
            const targetRadius =
              this.getMainCircleRadiusWithoutStrokeWidth(d.target) +
              graphSettings.circleStrokeWidth / 2;
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
        if (this.settings.hideOverlappingLabels) {
          this.debouncedHideOverlappingLabels();
        }
      });

    return simulation;
  }

  private createLinks() {
    return this.svgZoomGroup
      .append('g')
      .attr('stroke', graphSettings.linkColor)
      .attr('stroke-opacity', graphSettings.linkOpacity)
      .style('opacity', 1)
      .selectAll('line')
      .data(this.linkData)
      .join('line')
      .style('transition', `stroke-width ${graphSettings.zoomTransition}`)
      .attr('stroke-width', graphSettings.linkStrokeWidth)
      .attr('stroke-dasharray', d => (d.inherits ? '4 2' : null))
      .attr('marker-end', 'url(#arrowhead)');
  }

  private createNodes() {
    const nodeGroup = this.createNodeGroup();

    this.createMainCircle(nodeGroup);
    this.createPreviewCircles(nodeGroup);
    this.createThreeDots(nodeGroup);
    this.createLabels(nodeGroup);
    this.createFading(nodeGroup);

    return nodeGroup;
  }

  private createNodeGroup() {
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
    return nodes;
  }

  private createFading(nodes) {
    if (this.settings.fade) {
      nodes
        .on('click.fade', d => {
          fade(d, graphSettings.fadeOpacity);
          this.isFaded = true;
        })
        .on('blur', d => {
          if (this.isFaded) {
            fade(d, 1);
          }
        })
        .on('mouseover.fade', d => {
          if (d3.event.ctrlKey) {
            fade(d, graphSettings.fadeOpacity);
            this.isFaded = true;
          }
        })
        .on('mouseout.fade', d => {
          if (d3.event.ctrlKey && this.isFaded) {
            fade(d, 1);
          }
        });

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
          .style('opacity', o => (opacity === 1 || isConnected(d, o) ? 1 : opacity));

        links
          .transition()
          .attr('opacity', o => (opacity === 1 || o.source === d || o.target === d ? 1 : opacity));
      }
    }
  }

  private createPreviewCircles(nodes) {
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
      .on('click', d => {
        this.dataService.selectNode(d, d.componentId);
      })
      .attr('r', graphSettings.previewCircleRadius)
      .attr('class', (d: Node) => {
        let className = `function ${d.type}`;
        if (d.returnsJSX) {
          className += ' jsx';
        }
        if (d.special) {
          className += ' special';
        }
        return className;
      })
      .attr('stroke-width', graphSettings.circleStrokeWidth)
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
        const circleIndexValue = this.getCircleIndexValue(i + 2, r);
        // hide if bigger than one full circle
        return circleIndexValue > Math.PI * 2 ? 'none' : null;
      })
      .append('title')
      .text(d => d.id);
  }

  private createMainCircle(nodes) {
    // main circle
    nodes
      .append('circle')
      .attr('class', 'circle-node')
      .attr('r', d => this.getMainCircleRadiusWithoutStrokeWidth(d));

    // overlay circle
    nodes
      .append('circle')
      .attr('class', 'circle-overlay')
      .on('click', this.onNodeClick.bind(this))
      .attr('fill', d =>
        d.type === 'component' && d.kind === 'ClassComponent'
          ? 'url(#diagonalHatch)'
          : 'transparent'
      )
      .attr('r', d => this.getMainCircleRadiusWithoutStrokeWidth(d))
      .attr('class', d => {
        let className = `circle-overlay ${d.type}`;
        if (d.special) {
          className += ' special';
        }
        if (this.settings.currentSizeMetricErrorHighlighting) {
          if (d.warn) {
            className += ' warn';
          } else if (d.error) {
            className += ' error';
          }
        }
        return className;
      });

    // inner circle stroke (for functions returning jsx)
    nodes
      .filter(d => d.returnsJSX)
      .append('circle')
      .attr('fill', 'none')
      .attr('r', d => this.getMainCircleRadiusWithoutStrokeWidth(d) - 3)
      .attr('class', d => {
        let className = `inner-circle ${d.type}`;
        if (d.special) {
          className += ' special';
        }
        if (this.settings.currentSizeMetricErrorHighlighting) {
          if (d.warn) {
            className += ' warn';
          } else if (d.error) {
            className += ' error';
          }
        }
        return className;
      })
      .attr('stroke-width', graphSettings.circleStrokeWidth);
  }

  private createLabels(nodes) {
    if (!this.settings.text) {
      return;
    }

    const textNodes = nodes
      .append('text')
      .attr('class', 'node-label')
      .style('font-size', `${graphSettings.normalTextSize}px`)
      .style('dominant-baseline', 'central')
      .style('text-anchor', 'middle');

    textNodes
      .append('tspan')
      .attr('class', 'label-text')
      .on('click', this.onNodeClick.bind(this))
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

  private hideOverlappingLabels() {
    const textNodes = this.nodes.select('tspan.label-text');

    textNodes.each(function(d, i) {
      const selectedLabel = d3.select(this).style('display', 'initial');

      // @ts-ignore
      d3.select(selectedLabel.node().parentElement.parentElement)
        .select('title')
        .remove();
      // @ts-ignore
      const thisBBox = this.getBoundingClientRect();

      textNodes
        .filter((k, j) => j < i)
        .each(function() {
          // @ts-ignore
          // noinspection JSPotentiallyInvalidUsageOfThis
          const underBBox = this.getBoundingClientRect();

          if (isColliding(thisBBox, underBBox)) {
            const innerSelectedLabel = d3.select(this).style('display', 'none');
            // @ts-ignore
            d3.select(innerSelectedLabel.node().parentElement.parentElement)
              .append('title')
              // @ts-ignore
              .text(this.childNodes[0].textContent);
          }
        });
    });
  }

  private createThreeDots(nodes) {
    nodes
      .append('g')
      .selectAll('text')
      .data(d => {
        let index;
        return d.functions
          ? d.functions
              .filter((f, i) => {
                const dWithWidth = f;
                dWithWidth.width = d.width;
                dWithWidth.componentId = d.id;
                const r = this.getOuterCircleRadius(dWithWidth);
                const circleIndexValue = this.getCircleIndexValue(i + 1, r);
                const circleNextIndexValue = this.getCircleIndexValue(i + 2, r);
                const condition =
                  circleIndexValue <= Math.PI * 2 && circleNextIndexValue > Math.PI * 2;
                if (condition) {
                  index = i;
                }
                return condition;
              })
              .map(f => {
                f.width = d.width;
                f.componentId = d.id;
                f.index = index;
                return f;
              })
          : [];
      })
      .join('text')
      .text('...')
      .attr('x', d => {
        const r = this.getOuterCircleRadius(d);
        return r * Math.cos(this.getCircleIndexValue(d.index, r) - Math.PI * 0.5);
      })
      .attr('y', d => {
        const r = this.getOuterCircleRadius(d);
        return r * Math.sin(this.getCircleIndexValue(d.index, r) - Math.PI * 0.5);
      })
      .attr('opacity', 0.5)
      .attr('class', (d: Node) => {
        return `function dots ${d.type}`;
      });
  }

  onNodeClick(d) {
    if (d3.event.ctrlKey) {
      this.removeNode(d);
      this.restartGraph();
      return;
    }
    if (d.functions?.length > 0) {
      registerCookie('toastDoubleClickComponent', () => {
        this.snackBar.open(
          'Tip: You can double click a component that has inner functions!',
          null,
          {
            duration: 8000
          }
        );
      });
    }
    this.dataService.selectNode(d, this.id);
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
        simulation.alphaTarget(graphSettings.dragAlphaTarget).restart();
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
    return (i / r) * (graphSettings.previewCircleRadius + graphSettings.circleStrokeWidth / 2) * 2;
  }

  private getCirclePreviewWidth() {
    return (graphSettings.previewCircleRadius + graphSettings.circleStrokeWidth / 2) * 4;
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
      graphSettings.circleStrokeWidth / 2 +
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
