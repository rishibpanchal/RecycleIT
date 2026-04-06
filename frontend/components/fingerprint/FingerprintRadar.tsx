"use client"

import { useEffect, useRef, useCallback } from "react"
import * as d3 from "d3"
import { FEATURE_LABELS } from "@/hooks/useFingerprint"

interface RadarChartProps {
  fingerprint: number[]         // primary batch (normalised 0-1)
  comparison?: number[] | null  // optional overlay
  primaryColor?: string
  compColor?: string
  label?: string
  compLabel?: string
}

const AXES = FEATURE_LABELS
const LEVELS = 5

export function FingerprintRadar({
  fingerprint,
  comparison = null,
  primaryColor = "#FFD600",
  compColor = "#000000",
  label = "Selected",
  compLabel = "Comparison",
}: RadarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const draw = useCallback(() => {
    const el = svgRef.current
    if (!el) return

    const full = el.clientWidth || 360
    const size = full
    const margin = 48
    const radius = (size / 2) - margin
    const cx = size / 2
    const cy = size / 2
    const n = AXES.length
    const angleStep = (2 * Math.PI) / n

    const angle = (i: number) => i * angleStep - Math.PI / 2
    const radialPoint = (r: number, i: number) => ({
      x: cx + r * Math.cos(angle(i)),
      y: cy + r * Math.sin(angle(i)),
    })

    const svg = d3.select(el)
    svg.selectAll("*").remove()
    svg.attr("viewBox", `0 0 ${size} ${size}`)

    const g = svg.append("g")

    // ── Background concentric rings ────────────────────────────────────
    for (let l = 1; l <= LEVELS; l++) {
      const r = (l / LEVELS) * radius
      const pts = d3.range(n).map((i) => radialPoint(r, i))
      g.append("polygon")
        .attr("points", pts.map((p) => `${p.x},${p.y}`).join(" "))
        .attr("fill", l % 2 === 0 ? "currentColor" : "none")
        .attr("class", "text-muted/30")
        .attr("stroke", "currentColor")
        .attr("stroke-width", 0.5)
        .attr("class", "stroke-border fill-transparent")
    }

    // ── Axis spokes ────────────────────────────────────────────────────
    d3.range(n).forEach((i) => {
      const outer = radialPoint(radius, i)
      g.append("line")
        .attr("x1", cx).attr("y1", cy)
        .attr("x2", outer.x).attr("y2", outer.y)
        .attr("stroke", "currentColor")
        .attr("class", "stroke-border")
        .attr("stroke-width", 0.8)
        .attr("stroke-dasharray", "3,2")

      // Axis label
      const labelPt = radialPoint(radius + 20, i)
      g.append("text")
        .attr("x", labelPt.x)
        .attr("y", labelPt.y)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", "currentColor")
        .attr("class", "fill-muted-foreground text-[10px]")
        .style("font-size", "10px")
        .text(AXES[i])
    })

    // ── Polygon builder ────────────────────────────────────────────────
    const makePolygon = (vec: number[], color: string, opacity: number) => {
      const pts = d3.range(n).map((i) => radialPoint(vec[i] * radius, i))
      const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ")

      g.append("polygon")
        .attr("points", polyline)
        .attr("fill", color)
        .attr("fill-opacity", opacity)
        .attr("stroke", color)
        .attr("stroke-width", 2)
        .attr("stroke-linejoin", "round")
        .style("transition", "all 0.4s ease")

      // Dots at each vertex
      pts.forEach((p, i) => {
        g.append("circle")
          .attr("cx", p.x).attr("cy", p.y)
          .attr("r", 3.5)
          .attr("fill", color)
          .append("title")
          .text(`${AXES[i]}: ${(vec[i] * 100).toFixed(1)}%`)
      })
    }

    if (comparison) makePolygon(comparison, compColor, 0.15)
    makePolygon(fingerprint, primaryColor, 0.25)
  }, [fingerprint, comparison, primaryColor, compColor])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (svgRef.current) ro.observe(svgRef.current.parentElement!)
    return () => ro.disconnect()
  }, [draw])

  return (
    <div className="relative w-full">
      <svg ref={svgRef} className="w-full aspect-square" />
      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: primaryColor }} />
          {label}
        </span>
        {comparison && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: compColor }} />
            {compLabel}
          </span>
        )}
      </div>
    </div>
  )
}
