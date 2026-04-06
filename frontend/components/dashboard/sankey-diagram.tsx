"use client"

import { useEffect, useState, memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api, type SankeyData, type LossHotspot } from "@/lib/api"
import SankeyChart, { SankeyChartData } from "@/components/charts/SankeyChart"

export const SankeyDiagram = memo(function SankeyDiagram() {
  const [sankey, setSankey] = useState<SankeyData | null>(null)
  const [hotspots, setHotspots] = useState<LossHotspot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.getSankey(1), api.getSummary(1)])
      .then(([sankeyData, summary]) => {
        setSankey(sankeyData)
        setHotspots(summary.yield_analytics.loss_hotspots.slice(0, 3))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const chartData: SankeyChartData = sankey
    ? { nodes: sankey.nodes.map(n => ({ id: n.name, ...n })), links: sankey.links }
    : { nodes: [], links: [] }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-card-foreground">Material Lifecycle Flow</CardTitle>
            <p className="text-sm text-muted-foreground">Live material flow from source to finished product</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Flow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive" />
              <span className="text-sm text-muted-foreground">Loss</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          {loading ? (
            <div className="flex h-[300px] w-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : chartData.nodes.length > 0 ? (
            <div className="pt-2 w-full h-[320px]">
              <SankeyChart data={chartData} viewW={860} viewH={320} />
            </div>
          ) : (
            <div className="flex h-[300px] w-full items-center justify-center text-muted-foreground">
              No flow data available
            </div>
          )}
        </div>

        {/* Loss hotspot stats */}
        {!loading && (
          <div className="mt-4 grid grid-cols-4 gap-4 rounded-lg bg-muted/50 p-4">
            {hotspots.map((h) => (
              <div key={h.label} className="text-center">
                <p className="text-xs text-muted-foreground truncate">{h.label}</p>
                <p className="text-lg font-semibold text-card-foreground">{h.total_loss_qty.toLocaleString()} KG</p>
                <p className={`text-xs ${h.yield_percent < 85 ? "text-destructive" : "text-primary"}`}>
                  {(100 - h.yield_percent).toFixed(1)}% loss
                </p>
              </div>
            ))}
            {hotspots.length === 0 && (
              <div className="col-span-4 text-center text-sm text-muted-foreground">No loss data</div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
