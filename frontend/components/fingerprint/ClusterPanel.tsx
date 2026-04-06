"use client"

import { useEffect, useRef, useCallback } from "react"
import * as d3 from "d3"
import { BarChart3, Users, TrendingDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { type ClustersResponse, type FingerprintEntry } from "@/lib/api"
import { CLUSTER_CONFIG } from "@/hooks/useFingerprint"

interface ClusterPanelProps {
  clusters: ClustersResponse | null
  fingerprints: FingerprintEntry[]
  selectedBatch: string | null
}

function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const ref = useRef<SVGSVGElement>(null)

  const draw = useCallback(() => {
    const el = ref.current
    if (!el || data.length === 0) return
    const w = el.clientWidth || 200
    const h = 60
    const margin = { top: 4, right: 4, bottom: 20, left: 4 }

    d3.select(el).selectAll("*").remove()
    const svg = d3.select(el).attr("viewBox", `0 0 ${w} ${h}`)

    const x = d3.scaleBand()
      .domain(data.map((d) => d.label))
      .range([margin.left, w - margin.right])
      .padding(0.35)

    const maxVal = Math.max(...data.map((d) => d.value)) || 1
    const y = d3.scaleLinear()
      .domain([0, maxVal])
      .range([h - margin.bottom, margin.top])

    // Bars
    svg.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", (d) => x(d.label)!)
      .attr("y", (d) => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", (d) => (h - margin.bottom) - y(d.value))
      .attr("rx", 4)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.85)

    // Value labels
    svg.selectAll("text.val")
      .data(data)
      .join("text")
      .attr("class", "val")
      .attr("x", (d) => x(d.label)! + x.bandwidth() / 2)
      .attr("y", (d) => y(d.value) - 3)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("font-size", "9px")
      .style("font-weight", "600")
      .text((d) => d.value)

    // X labels
    svg.selectAll("text.lbl")
      .data(data)
      .join("text")
      .attr("class", "lbl")
      .attr("x", (d) => x(d.label)! + x.bandwidth() / 2)
      .attr("y", h - 4)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .style("font-size", "8px")
      .attr("class", "fill-muted-foreground")
      .text((d) => d.label.slice(0, 3).toUpperCase())
  }, [data])

  useEffect(() => {
    draw()
    const ro = new ResizeObserver(draw)
    if (ref.current) ro.observe(ref.current.parentElement!)
    return () => ro.disconnect()
  }, [draw])

  return <svg ref={ref} className="w-full" style={{ height: 60 }} />
}

export function ClusterPanel({ clusters, fingerprints, selectedBatch }: ClusterPanelProps) {
  const clusterMap = Object.fromEntries(fingerprints.map((f) => [f.batch_id, f.cluster]))
  const currentCluster = selectedBatch ? clusterMap[selectedBatch] : null

  const clusterKeys: Array<"high_efficiency" | "medium_efficiency" | "low_efficiency"> =
    ["high_efficiency", "medium_efficiency", "low_efficiency"]

  const chartData = clusterKeys.map((k) => ({
    label: CLUSTER_CONFIG[k].label,
    value: clusters?.clusters[k]?.length ?? 0,
    color: CLUSTER_CONFIG[k].color,
  }))

  const totalBatches = chartData.reduce((s, d) => s + d.value, 0) || 1

  return (
    <Card className="border-border bg-card shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <BarChart3 className="h-4 w-4 text-primary" />
          Cluster Distribution
        </CardTitle>
        <p className="text-xs text-muted-foreground">K-Means clustering by material fingerprint efficiency</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bar chart */}
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <MiniBarChart data={chartData} />
        </div>

        {/* Cluster tiles */}
        <div className="space-y-2">
          {clusterKeys.map((key) => {
            const cfg = CLUSTER_CONFIG[key]
            const count = clusters?.clusters[key]?.length ?? 0
            const pct = ((count / totalBatches) * 100).toFixed(0)
            const isCurrent = currentCluster === key

            return (
              <div
                key={key}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  isCurrent
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-muted/20"
                }`}
              >
                <div
                  className="h-8 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: cfg.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                    {isCurrent && (
                      <Badge className="bg-primary/10 text-primary border-0 text-[10px] px-1.5 py-0">Current</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: cfg.color }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-foreground">{count}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Users className="h-2.5 w-2.5" /> batches
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
