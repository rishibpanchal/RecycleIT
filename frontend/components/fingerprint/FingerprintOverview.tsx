"use client"

import { Package, Clock, TrendingDown, Star, Layers, ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { type FingerprintEntry } from "@/lib/api"
import { FEATURE_LABELS, CLUSTER_CONFIG } from "@/hooks/useFingerprint"

interface FingerprintOverviewProps {
  fingerprint: FingerprintEntry
}

const ICONS = [TrendingDown, TrendingDown, Clock, Clock, Star, Layers]
const COLORS = [
  "text-red-600", "text-amber-500", "text-black",
  "text-gray-600", "text-[#FFD600]", "text-black",
]
const BG = [
  "bg-red-50", "bg-amber-50", "bg-gray-100",
  "bg-gray-50", "bg-[#FFD600]/20", "bg-gray-100",
]

function getHealthColor(idx: number, value: number): string {
  // Loss metrics (0,1) → lower is better; time (2,3) → neutral; vendor (4) → higher better; consistency (5) = 0 or 1
  if (idx === 4) return value > 0.6 ? "text-emerald-600" : value > 0.3 ? "text-amber-500" : "text-red-500"
  if (idx === 5) return value === 1 ? "text-emerald-600" : "text-red-500"
  if (idx <= 1) return value < 0.3 ? "text-emerald-600" : value < 0.6 ? "text-amber-500" : "text-red-500"
  return "text-blue-500"
}

export function FingerprintOverview({ fingerprint }: FingerprintOverviewProps) {
  const cfg = CLUSTER_CONFIG[fingerprint.cluster] ?? CLUSTER_CONFIG.unknown

  return (
    <Card className="border-border bg-card shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {fingerprint.batch_id}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">Material Fingerprint Overview</p>
          </div>
          <Badge className={`${cfg.bg} border-0 font-medium`}>
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FEATURE_LABELS.map((label, i) => {
            const val = fingerprint.fingerprint[i] ?? 0
            const Icon = ICONS[i]
            const hue = getHealthColor(i, val)

            return (
              <div
                key={label}
                className="group relative rounded-xl border border-border bg-muted/30 p-3 transition-all hover:border-primary/30 hover:bg-muted/60"
              >
                <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-lg ${BG[i]}`}>
                  <Icon className={`h-3.5 w-3.5 ${COLORS[i]}`} />
                </div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={`mt-0.5 text-lg font-bold ${hue}`}>
                  {i === 5
                    ? val === 1 ? "✓ Consistent" : "✗ Mixed"
                    : `${(val * 100).toFixed(1)}%`}
                </p>

                {/* Micro progress bar */}
                <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${val * 100}%`,
                      background: cfg.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
