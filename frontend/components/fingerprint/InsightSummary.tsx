"use client"

import { Lightbulb, AlertTriangle, TrendingDown, Star, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface InsightSummaryProps {
  insights: string[]
  loading?: boolean
}

function classifyInsight(text: string): { icon: React.ReactNode; accent: string } {
  const lower = text.toLowerCase()
  if (lower.includes("high") && lower.includes("loss") || lower.includes("low efficien")) {
    return {
      icon: <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />,
      accent: "border-red-500/10 bg-red-50/30",
    }
  }
  if (lower.includes("vendor") && lower.includes("below")) {
    return {
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />,
      accent: "border-amber-500/10 bg-amber-50/30",
    }
  }
  if (lower.includes("vendor") && lower.includes("above") || lower.includes("high efficien")) {
    return {
      icon: <Star className="h-4 w-4 text-[#FFD600] flex-shrink-0 mt-0.5" />,
      accent: "border-[#FFD600]/20 bg-[#FFD600]/5",
    }
  }
  if (lower.includes("lifecycle") || lower.includes("time") || lower.includes("slowest")) {
    return {
      icon: <Clock className="h-4 w-4 text-black flex-shrink-0 mt-0.5" />,
      accent: "border-gray-200 bg-gray-50/80",
    }
  }
  return {
    icon: <Lightbulb className="h-4 w-4 text-black flex-shrink-0 mt-0.5" />,
    accent: "border-gray-200 bg-gray-50/50",
  }
}

function SkeletonInsight() {
  return (
    <div className="flex gap-3 rounded-xl border border-border p-3 animate-pulse">
      <div className="h-4 w-4 rounded-full bg-muted flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    </div>
  )
}

export function InsightSummary({ insights, loading = false }: InsightSummaryProps) {
  return (
    <Card className="border-border bg-card shadow-md">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground uppercase font-black tracking-tight">
          <Lightbulb className="h-4 w-4 text-primary" />
          AI Insight Summary
        </CardTitle>
        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
          Pattern detection from fingerprint clustering
        </p>
      </CardHeader>

      <CardContent className="pb-3 pt-0">
        {loading ? (
          <div className="space-y-1.5">
            {[...Array(4)].map((_, i) => <SkeletonInsight key={i} />)}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-border text-[10px] text-muted-foreground">
            No insights available
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
            {insights.map((insight, i) => {
              const { icon, accent } = classifyInsight(insight)
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition-all hover:shadow-sm ${accent}`}
                >
                  {icon}
                  <p className="text-[11px] leading-relaxed font-medium text-foreground">{insight}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Footer badge */}
        {!loading && insights.length > 0 && (
          <p className="mt-3 text-center text-[10px] text-muted-foreground">
            {insights.length} insight{insights.length !== 1 ? "s" : ""} generated from{" "}
            <span className="font-semibold text-primary">K-Means clustering</span> &{" "}
            <span className="font-semibold text-primary">feature analysis</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
