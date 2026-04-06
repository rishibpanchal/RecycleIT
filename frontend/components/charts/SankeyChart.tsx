"use client";

import React, {
  useRef, useEffect, useState, useCallback, useId,
} from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";

// ─── COLOR SYSTEM ─────────────────────────────────────────────────────────────
const PHASE_COLOR_MAP: Record<string, string> = {
  collection:    "#6366F1",
  sorting:       "#22D3EE",
  processing:    "#F59E0B",
  recycling:     "#10B981",
  dispatch:      "#8B5CF6",
  INTAKE:        "#10B981",
  "PRE-PROCESS": "#34D399",
  LOGISTICS:     "#60A5FA",
  PROCESSING:    "#818CF8",
  QUALITY:       "#F59E0B",
  MANUFACTURING: "#A78BFA",
  LOSS:          "#EF4444",
  UNKNOWN:       "#94A3B8",
};
const LOSS_COLOR     = "#EF4444";
const FALLBACK_SCALE = d3.scaleOrdinal(d3.schemeTableau10);

function nodeColor(id: string, phase?: string): string {
  if (phase && PHASE_COLOR_MAP[phase]) return PHASE_COLOR_MAP[phase];
  return PHASE_COLOR_MAP[id?.toLowerCase()] ?? FALLBACK_SCALE(id ?? "?");
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface DataNode  { id: string; name?: string; phase?: string; }
export interface DataLink  { source: string; target: string; value: number; phase?: string; }
export interface SankeyChartData { nodes: DataNode[]; links: DataLink[]; }

interface SankeyChartProps {
  data: SankeyChartData;
  viewW?: number;
  viewH?: number;
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
function buildLayout(nodes: DataNode[], links: DataLink[], w: number, h: number) {
  return sankey<DataNode, DataLink>()
    .nodeId((d: any) => d.id)
    .nodeWidth(22)
    .nodePadding(36)
    .nodeAlign(sankeyLeft)
    .extent([[24, 24], [w - 24, h - 24]])({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });
}

// ─── PARTICLE STATE ───────────────────────────────────────────────────────────
interface Particle {
  pathEl: SVGPathElement;
  totalLen: number;
  offset: number;    // 0..1 position along path
  speed: number;     // fraction of path per frame
  color: string;
  el: SVGCircleElement;
}

// ─── POPUP DATA ───────────────────────────────────────────────────────────────
type HoverData =
  | { type: "link"; source: string; target: string; srcColor: string; tgtColor: string; }
  | { type: "node"; id: string; phase?: string; color: string; };

// ─── PREMIUM POPUP CARD ───────────────────────────────────────────────────────
const PopupCard: React.FC<{
  data: HoverData | null;
  x: number;
  y: number;
  containerRect: DOMRect | null;
}> = ({ data: hoverItem, x, y, containerRect }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hoverItem) {
      setData(null);
      return;
    }
    let isCancelled = false;
    setLoading(true);

    import("@/lib/api").then(({ api }) => {
      if (hoverItem.type === "link") {
        api.getSankeyHover({ type: "link", source: hoverItem.source, target: hoverItem.target })
          .then((res) => {
            if (!isCancelled) {
              setData({ ...hoverItem, ...res });
              setLoading(false);
            }
          })
          .catch(() => {
            if (!isCancelled) setLoading(false);
          });
      } else {
        api.getSankeyHover({ type: "node", node_id: hoverItem.id })
          .then((res) => {
            if (!isCancelled) {
              setData({ ...hoverItem, ...res });
              setLoading(false);
            }
          })
          .catch(() => {
            if (!isCancelled) setLoading(false);
          });
      }
    });

    return () => { isCancelled = true; };
  }, [hoverItem]);

  if (!hoverItem || !containerRect) return null;

  // Keep popup inside viewport
  const POPUP_W = 268;
  const POPUP_H = 200;
  let left = x - containerRect.left + 16;
  let top  = y - containerRect.top  + 16;
  if (left + POPUP_W > containerRect.width)  left = x - containerRect.left - POPUP_W - 16;
  if (top  + POPUP_H > containerRect.height) top  = y - containerRect.top  - POPUP_H - 16;

  return (
    <div
      className="pointer-events-none absolute z-50 animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top, width: POPUP_W }}
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_8px_32px_rgba(0,0,0,0.12)] min-h-[120px] relative">
        {loading && !data && (
           <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
           </div>
        )}
        
        {!loading && data && data.type === "link" ? (
          <>
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{
                background: `#F9FAFB`,
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: data.srcColor, border: '1px solid currentColor' }}
              />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#111827] capitalize">
                {data.source.replace(/_/g, " ")}
              </span>
              <svg className="h-3 w-3 text-[#9CA3AF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ background: data.tgtColor, border: '1px solid currentColor' }}
              />
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#111827] capitalize">
                {data.target.replace(/_/g, " ")}
              </span>
            </div>

            {/* metrics grid */}
            <div className="grid grid-cols-2 gap-px bg-gray-100 text-xs">
              <MetricCell label="Flow Volume" value={`${data.value.toLocaleString()} KG`} />
              <MetricCell
                label="Change"
                value={
                  data.pct === null ? "—" :
                  data.pct >= 0     ? `+${data.pct.toFixed(1)}%` :
                                      `${data.pct.toFixed(1)}%`
                }
                accent={data.pct === null ? undefined : data.pct < 0 ? "#EF4444" : "#10B981"}
              />
              <MetricCell label="Stage" value={`${data.source.replace(/_/g, " ")} → ${data.target.replace(/_/g, " ")}`} />
              <MetricCell
                label="Efficiency"
                value={data.isLossy ? "⚠ Below 95 %" : "✓ Optimal"}
                accent={data.isLossy ? "#EF4444" : "#10B981"}
              />
            </div>

            {/* insight row */}
            {data.isLossy && (
              <div className="flex items-start gap-2 bg-red-50 border-t border-red-100 px-4 py-2.5 text-[11px] text-red-600">
                <svg className="mt-0.5 h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Significant material loss detected. Review sorting parameters.
              </div>
            )}
          </>
        ) : !loading && data && data.type === "node" ? (
          <>
            {/* NODE popup header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: `#F9FAFB`,
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ background: data.color, boxShadow: `0 0 8px ${data.color}88` }}
              />
              <div>
                <div className="text-[12px] font-bold capitalize text-gray-800">
                  {data.id.replace(/_/g, " ")}
                </div>
                {data.phase && (
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider">{data.phase}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px bg-gray-100 text-xs">
              <MetricCell label="Inbound"  value={data.inFlow  > 0 ? `${data.inFlow.toLocaleString()} KG`  : "—"} />
              <MetricCell label="Outbound" value={data.outFlow > 0 ? `${data.outFlow.toLocaleString()} KG` : "—"} />
              <MetricCell
                label="Material Loss"
                value={
                  data.inFlow > 0 && data.outFlow < data.inFlow
                    ? `${(data.inFlow - data.outFlow).toLocaleString()} KG (${(((data.inFlow - data.outFlow) / data.inFlow) * 100).toFixed(1)}%)`
                    : "None"
                }
                accent={data.inFlow > 0 && data.outFlow < data.inFlow ? "#EF4444" : "#10B981"}
              />
              <MetricCell label="Batches" value={`${data.batchCount}`} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const MetricCell: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="bg-white px-4 py-2.5">
    <div className="text-[9px] uppercase tracking-widest text-gray-400 mb-1">{label}</div>
    <div className="text-[12px] font-semibold" style={{ color: accent ?? "#111827" }}>{value}</div>
  </div>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export const SankeyChart: React.FC<SankeyChartProps> = ({
  data,
  viewW = 900,
  viewH = 380,
}) => {
  const uid          = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef       = useRef<SVGSVGElement | null>(null);
  const particleRef  = useRef<SVGGElement | null>(null);     // separate particle layer
  const rafRef       = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const activeRef    = useRef<boolean>(false);               // particle loop active?

  const [dims, setDims] = useState({ w: viewW, h: viewH });
  const [popup, setPopup] = useState<{
    data: HoverData | null; x: number; y: number;
  }>({ data: null, x: 0, y: 0 });
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width < 1) return;
      const h = Math.max(viewH, Math.round(width * (viewH / viewW)));
      setDims({ w: viewW, h });
      setContainerRect(containerRef.current!.getBoundingClientRect());
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [viewW, viewH]);

  // ── PARTICLE ANIMATION LOOP ────────────────────────────────────────────────
  const stopParticles = useCallback(() => {
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    particlesRef.current.forEach(p => p.el.remove());
    particlesRef.current = [];
  }, []);

  const startParticles = useCallback((
    linkPaths: SVGPathElement[],
    linkData: any[],
  ) => {
    stopParticles();
    if (!particleRef.current) return;

    const layer = d3.select(particleRef.current);
    const particles: Particle[] = [];

    linkPaths.forEach((pathEl, i) => {
      const d       = linkData[i];
      const totalLen = pathEl.getTotalLength();
      const color    = d._srcColor as string;

      // Scale particle count: 2..8 based on value
      const maxV = Math.max(...linkData.map((l: any) => l.value));
      const count = Math.round(2 + (d.value / maxV) * 6);
      const speed = 0.0012 + (d.value / maxV) * 0.0018; // fraction/frame

      for (let k = 0; k < count; k++) {
        const el = layer.append("circle")
          .attr("r", 3.5)
          .attr("fill", color)
          .attr("opacity", 0)
          .attr("filter", `url(#${uid}-particle-glow)`)
          .style("pointer-events", "none")   // ← stops particles stealing mouse events
          .node()!;

        particles.push({
          pathEl,
          totalLen,
          offset: k / count, // evenly stagger offsets
          speed,
          color,
          el,
        });
      }
    });

    particlesRef.current = particles;
    activeRef.current = true;

    const tick = () => {
      if (!activeRef.current) return;
      particles.forEach(p => {
        p.offset = (p.offset + p.speed) % 1;
        const pt = p.pathEl.getPointAtLength(p.offset * p.totalLen);
        // fade in first 10%, fade out last 10%
        const opacity = p.offset < 0.1
          ? p.offset / 0.1
          : p.offset > 0.9
            ? (1 - p.offset) / 0.1
            : 1;
        d3.select(p.el)
          .attr("cx", pt.x)
          .attr("cy", pt.y)
          .attr("opacity", opacity * 0.85);
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [stopParticles, uid]);

  // ── D3 RENDER ──────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    if (!svgRef.current || data.nodes.length === 0 || data.links.length === 0) return;

    stopParticles();

    const { w, h } = dims;
    const validLinks = data.links.filter(l => l.value > 0);
    const graph      = buildLayout(data.nodes, validLinks, w, h);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${w} ${h}`);

    // ── DEFS ──────────────────────────────────────────────────────────────────
    const defs = svg.append("defs");

    // Node shadow
    const shadowF = defs.append("filter").attr("id", `${uid}-shadow`)
      .attr("x", "-30%").attr("y", "-30%").attr("width", "160%").attr("height", "160%");
    shadowF.append("feDropShadow")
      .attr("dx", 0).attr("dy", 4).attr("stdDeviation", 5)
      .attr("flood-color", "rgba(0,0,0,0.3)");

    // Link glow (hover)
    const glowF = defs.append("filter").attr("id", `${uid}-link-glow`)
      .attr("x", "-20%").attr("y", "-50%").attr("width", "140%").attr("height", "200%");
    glowF.append("feGaussianBlur").attr("stdDeviation", 5).attr("result", "blur");
    const fm = glowF.append("feMerge");
    fm.append("feMergeNode").attr("in", "blur");
    fm.append("feMergeNode").attr("in", "SourceGraphic");

    // Particle glow
    const pgf = defs.append("filter").attr("id", `${uid}-particle-glow`)
      .attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%");
    pgf.append("feGaussianBlur").attr("stdDeviation", 3).attr("result", "blur");
    const pfm = pgf.append("feMerge");
    pfm.append("feMergeNode").attr("in", "blur");
    pfm.append("feMergeNode").attr("in", "SourceGraphic");

    // Per-link gradients
    graph.links.forEach((link: any, i: number) => {
      const srcColor = nodeColor(link.source.id, link.source.phase);
      const tgtColor = nodeColor(link.target.id, link.target.phase);

      const inFlow  = d3.sum(link.source.targetLinks as any[], (l: any) => l.value);
      const outFlow = d3.sum(link.source.sourceLinks as any[], (l: any) => l.value);
      const isLossy = inFlow > 0 && outFlow < inFlow * 0.95;

      const gid = `${uid}-lg-${i}`;
      const g   = defs.append("linearGradient").attr("id", gid)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", link.source.x1).attr("x2", link.target.x0);
      g.append("stop").attr("offset", "0%").attr("stop-color", srcColor);
      g.append("stop").attr("offset", "100%").attr("stop-color", isLossy ? LOSS_COLOR : tgtColor);

      link._gradId   = gid;
      link._isLossy  = isLossy;
      link._srcColor = srcColor;
      link._tgtColor = tgtColor;
      link._pct      = inFlow > 0 ? ((outFlow - inFlow) / inFlow) * 100 : null;
    });

    const root = svg.append("g");

    // ── LINKS ─────────────────────────────────────────────────────────────────
    const linkPath = sankeyLinkHorizontal();
    const linksG = root.append("g").attr("fill", "none");

    const linkSel = linksG
      .selectAll<SVGPathElement, any>("path.link-visual")
      .data(graph.links)
      .join("path")
        .attr("class", "link-visual")
        .attr("d", linkPath)
        .attr("stroke-width", (d: any) => Math.max(3, d.width))
        .attr("stroke-opacity", 0.35)
        .attr("stroke", (d: any) => `url(#${d._gradId})`)
        .style("pointer-events", "none"); // visual only — hit area handles events

    // Wide invisible hit-area paths for easier hovering (20px min)
    const hitSel = linksG
      .selectAll<SVGPathElement, any>("path.link-hit")
      .data(graph.links)
      .join("path")
        .attr("class", "link-hit")
        .attr("d", linkPath)
        .attr("stroke-width", (d: any) => Math.max(20, d.width + 14))
        .attr("stroke", "transparent")
        .attr("fill", "none")
        .style("cursor", "pointer");

    // Draw-on animation on the visual paths
    linkSel
      .attr("stroke-dasharray", function (this: SVGPathElement) {
        const l = this.getTotalLength(); return `${l} ${l}`;
      })
      .attr("stroke-dashoffset", function (this: SVGPathElement) {
        return this.getTotalLength();
      })
      .transition().duration(1400).ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    // ── PARTICLE LAYER (appended after links, before nodes) ───────────────────
    const pLayer = root.append("g");
    particleRef.current = pLayer.node();

    // ── LINK EVENTS (attached to wide hit area, not visual path) ─────────────
    hitSel
      .on("mouseover", function (event: MouseEvent, d: any) {
        linkSel
          .attr("stroke-opacity", 0.08)
          .attr("filter", null);
        d3.select<SVGPathElement, any>(this)
          .attr("stroke-opacity", 0.9)
          .attr("filter", `url(#${uid}-link-glow)`);

        // start particles on ALL link paths but highlight the hovered one
        const pathNodes = linkSel.nodes() as SVGPathElement[];
        startParticles(pathNodes, graph.links as any[]);

        setContainerRect(containerRef.current?.getBoundingClientRect() ?? null);
        setPopup({
          x: event.clientX,
          y: event.clientY,
          data: {
            type: "link",
            source:  d.source.id,
            target:  d.target.id,
            srcColor: d._srcColor,
            tgtColor: d._tgtColor,
          },
        });
      })
      .on("mousemove", (event: MouseEvent) =>
        setPopup(p => ({ ...p, x: event.clientX, y: event.clientY }))
      )
      .on("mouseout", function () {
        stopParticles();
        linkSel.attr("stroke-opacity", 0.35).attr("filter", null);
        setPopup(p => ({ ...p, data: null }));
      });

    // Keep hit layer truly on top (pointer-events wise) by re-raising
    hitSel.raise();

    // ── NODES ─────────────────────────────────────────────────────────────────
    const nodeGroup = root.append("g")
      .selectAll<SVGGElement, any>("g")
      .data(graph.nodes)
      .join("g");

    const nodeRects = nodeGroup.append("rect")
      .attr("x",      (d: any) => d.x0)
      .attr("y",      (d: any) => d.y0)
      .attr("width",  (d: any) => d.x1 - d.x0)
      .attr("height", (d: any) => Math.max(2, d.y1 - d.y0))
      .attr("rx", 6).attr("ry", 6)
      .attr("fill", (d: any) => nodeColor(d.id, d.phase))
      .attr("opacity", 0.93)
      .style("filter", `url(#${uid}-shadow)`)
      .style("cursor", "pointer");

    // Labels
    nodeGroup.append("text")
      .attr("x",          (d: any) => d.x0 < w / 2 ? d.x1 + 10 : d.x0 - 10)
      .attr("y",          (d: any) => (d.y0 + d.y1) / 2)
      .attr("dy",         "0.35em")
      .attr("text-anchor",(d: any) => d.x0 < w / 2 ? "start" : "end")
      .attr("fill",       "currentColor")
      .attr("font-size",  12)
      .attr("font-weight",600)
      .attr("font-family","Inter, system-ui, sans-serif")
      .style("pointer-events", "none")
      .text((d: any) => {
        const t = (d.id ?? "").replace(/_/g, " ");
        return t.length > 20 ? t.slice(0, 19) + "…" : t;
      });

    nodeGroup.append("text")
      .attr("x",          (d: any) => d.x0 < w / 2 ? d.x1 + 10 : d.x0 - 10)
      .attr("y",          (d: any) => (d.y0 + d.y1) / 2 + 15)
      .attr("dy",         "0.35em")
      .attr("text-anchor",(d: any) => d.x0 < w / 2 ? "start" : "end")
      .attr("fill",       "currentColor")
      .attr("opacity",    0.4)
      .attr("font-size",  10)
      .attr("font-family","Inter, system-ui, sans-serif")
      .style("pointer-events", "none")
      .text((d: any) => `${Math.round(d.value).toLocaleString()} KG`);

    // ── NODE EVENTS ───────────────────────────────────────────────────────────
    nodeRects
      .on("mouseover", function (event: MouseEvent, d: any) {
        nodeRects.attr("opacity", 0.15);
        d3.select<SVGRectElement, any>(this).attr("opacity", 1);
        linkSel.attr("stroke-opacity", (l: any) =>
          l.source.id === d.id || l.target.id === d.id ? 0.85 : 0.04
        );

        // animate particles only on connected links (use visual path nodes)
        const connPaths: SVGPathElement[] = [];
        const connData:  any[]            = [];
        linkSel.each(function (l: any) {
          if (l.source.id === d.id || l.target.id === d.id) {
            connPaths.push(this as SVGPathElement);
            connData.push(l);
          }
        });
        startParticles(connPaths, connData);

        const inFlow  = d3.sum(d.targetLinks as any[], (l: any) => l.value);
        const outFlow = d3.sum(d.sourceLinks as any[], (l: any) => l.value);
        const batches = ((d.targetLinks as any[]).length + (d.sourceLinks as any[]).length);

        setContainerRect(containerRef.current?.getBoundingClientRect() ?? null);
        setPopup({
          x: event.clientX,
          y: event.clientY,
          data: {
            type: "node",
            id:    d.id,
            phase: d.phase,
            color: nodeColor(d.id, d.phase),
          },
        });
      })
      .on("mousemove", (event: MouseEvent) =>
        setPopup(p => ({ ...p, x: event.clientX, y: event.clientY }))
      )
      .on("mouseout", () => {
        stopParticles();
        nodeRects.attr("opacity", 0.93);
        linkSel.attr("stroke-opacity", 0.35).attr("filter", null);
        setPopup(p => ({ ...p, data: null }));
      });

  }, [data, dims, startParticles, stopParticles, uid]);

  useEffect(() => { render(); }, [render]);

  // cleanup on unmount
  useEffect(() => () => { stopParticles(); }, [stopParticles]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[300px]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        className="w-full h-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      />
      <PopupCard data={popup.data} x={popup.x} y={popup.y} containerRect={containerRect} />
    </div>
  );
};

export default SankeyChart;
