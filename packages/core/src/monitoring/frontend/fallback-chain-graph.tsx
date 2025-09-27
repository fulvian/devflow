import * as d3 from 'd3';
import { AgentStatus, AgentNode, Link, PerformanceMetrics } from './types';

interface FallbackChainGraphConfig {
  container: string;
  width?: number;
  height?: number;
  onNodeSelect?: (node: AgentNode) => void;
}

export class FallbackChainGraph {
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private g: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private simulation: d3.Simulation<AgentNode, Link>;
  private linkGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private nodeGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>;
  private config: FallbackChainGraphConfig;
  private nodes: AgentNode[] = [];
  private links: Link[] = [];
  private width: number;
  private height: number;

  constructor(config: FallbackChainGraphConfig) {
    this.config = config;
    this.width = config.width || 800;
    this.height = config.height || 600;

    // Create SVG container
    this.svg = d3.select(config.container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .classed('fallback-chain-graph', true);

    // Create main group for zoom/pan
    this.g = this.svg.append('g');

    // Create groups for links and nodes
    this.linkGroup = this.g.append('g').attr('class', 'links');
    this.nodeGroup = this.g.append('g').attr('class', 'nodes');

    // Create tooltip
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'fallback-graph-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('pointer-events', 'none')
      .style('font-size', '12px');

    // Initialize simulation
    this.simulation = d3.forceSimulation<AgentNode>()
      .force('link', d3.forceLink<AgentNode, Link>().id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(this.width / 2, this.height / 2))
      .force('collision', d3.forceCollide().radius(60));

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(zoom);

    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  public updateData(nodes: AgentNode[], links: Link[]): void {
    this.nodes = nodes;
    this.links = links;
    this.render();
  }

  public updateNodeStatus(nodeId: string, status: AgentStatus): void {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = status;
      this.updateNodeStyles();
    }
  }

  public updatePerformanceMetrics(nodeId: string, metrics: PerformanceMetrics): void {
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      node.metrics = metrics;
      this.updateNodeStyles();
    }
  }

  private render(): void {
    // Update links
    const linkSelection = this.linkGroup
      .selectAll<SVGLineElement, Link>('line')
      .data(this.links, d => `${d.source}-${d.target}`);

    linkSelection.exit().remove();

    const linkEnter = linkSelection.enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 2);

    const linkMerge = linkEnter.merge(linkSelection as any);

    // Update nodes
    const nodeSelection = this.nodeGroup
      .selectAll<SVGCircleElement, AgentNode>('g.node')
      .data(this.nodes, d => d.id);

    nodeSelection.exit().remove();

    const nodeEnter = nodeSelection.enter()
      .append('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', this.dragStarted.bind(this))
        .on('drag', this.dragged.bind(this))
        .on('end', this.dragEnded.bind(this))
      );

    nodeEnter.append('circle')
      .attr('r', 30)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    nodeEnter.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#fff');

    const nodeMerge = nodeEnter.merge(nodeSelection as any);

    // Update text content
    nodeMerge.select('text')
      .text(d => d.type.substring(0, 3));

    // Add event listeners
    nodeMerge
      .on('click', (event, d) => {
        if (this.config.onNodeSelect) {
          this.config.onNodeSelect(d);
        }
      })
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip());

    // Update simulation
    this.simulation.nodes(this.nodes);
    (this.simulation.force('link') as d3.ForceLink<AgentNode, Link>).links(this.links);

    this.simulation.on('tick', () => {
      linkMerge
        .attr('x1', d => (d.source as AgentNode).x!)
        .attr('y1', d => (d.source as AgentNode).y!)
        .attr('x2', d => (d.target as AgentNode).x!)
        .attr('y2', d => (d.target as AgentNode).y!);

      nodeMerge
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    this.updateNodeStyles();
    this.simulation.alpha(1).restart();
  }

  private updateNodeStyles(): void {
    this.nodeGroup.selectAll<SVGCircleElement, AgentNode>('g.node circle')
      .attr('fill', d => {
        switch (d.status) {
          case 'active': return '#4CAF50';
          case 'standby': return '#FFC107';
          case 'error': return '#F44336';
          case 'offline': return '#9E9E9E';
          default: return '#2196F3';
        }
      })
      .attr('stroke', d => d.status === 'error' ? '#F44336' : '#fff')
      .attr('stroke-width', d => d.status === 'error' ? 3 : 2);
  }

  private showTooltip(event: MouseEvent, node: AgentNode): void {
    const content = `
      <div><strong>${node.name}</strong></div>
      <div>Type: ${node.type}</div>
      <div>Status: ${node.status}</div>
      ${node.metrics ? `
        <div>Response Time: ${node.metrics.responseTime}ms</div>
        <div>Success Rate: ${node.metrics.successRate}%</div>
        <div>Throughput: ${node.metrics.throughput} req/s</div>
      ` : ''}
    `;

    this.tooltip
      .html(content)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`)
      .transition()
      .duration(200)
      .style('opacity', 0.9);
  }

  private hideTooltip(): void {
    this.tooltip
      .transition()
      .duration(200)
      .style('opacity', 0);
  }

  private dragStarted(event: d3.D3DragEvent<SVGGElement, AgentNode, unknown>): void {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  private dragged(event: d3.D3DragEvent<SVGGElement, AgentNode, unknown>): void {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  private dragEnded(event: d3.D3DragEvent<SVGGElement, AgentNode, unknown>): void {
    if (!event.active) this.simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }

  private handleResize(): void {
    // Responsive behavior can be implemented here
    // For now, we rely on SVG viewBox for responsiveness
  }

  public destroy(): void {
    this.simulation.stop();
    this.svg.remove();
    this.tooltip.remove();
    window.removeEventListener('resize', this.handleResize);
  }
}