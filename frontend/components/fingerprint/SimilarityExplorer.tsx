"use client"

import { Search, ArrowRight, Loader2, ChevronsRight, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { type FingerprintEntry, type SimilarBatch } from "@/lib/api"
import { CLUSTER_CONFIG } from "@/hooks/useFingerprint"

interface SimilarityExplorerProps {
  fingerprints: FingerprintEntry[]
  selectedBatch: string | null
  comparisonBatch: string | null
  similar: SimilarBatch[]
  loading: boolean
  onSelectBatch: (id: string) => void
  onSetComparison: (id: string | null) => void
}

function SimilarityBar({ value }: { value: number }) {
  const pct = (value * 100).toFixed(1)
  const color =
    value >= 0.85 ? "from-[#FFD600] to-yellow-600" :
    value >= 0.65 ? "from-black to-gray-600" :
    "from-red-600 to-red-400"

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-xs font-semibold tabular-nums text-foreground">
        {pct}%
      </span>
    </div>
  )
}

export function SimilarityExplorer({
  fingerprints,
  selectedBatch,
  comparisonBatch,
  similar,
  loading,
  onSelectBatch,
  onSetComparison,
}: SimilarityExplorerProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCluster, setActiveCluster] = useState<string | "ALL">("ALL")
  
  const filteredFingerprints = fingerprints.filter(f => {
    const matchesSearch = f.batch_id.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCluster = activeCluster === "ALL" || f.cluster === activeCluster
    return matchesSearch && matchesCluster
  })
  
  const batchIds = filteredFingerprints.map((f) => f.batch_id)
  const clusterMap = Object.fromEntries(fingerprints.map((f) => [f.batch_id, f.cluster]))

  return (
    <Card className="border-border bg-card shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-foreground">
          <Search className="h-4 w-4 text-primary" />
          Similarity Explorer
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Select a batch to find the most similar fingerprints using cosine similarity
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Batch selector grid with Search */}
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <div className="mb-3 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search batches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-lg pl-8 pr-8 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          
          <div className="flex items-center justify-between mb-3 px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {searchTerm || activeCluster !== "ALL" ? `Matches (${batchIds.length})` : "Select Batch"}
            </p>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setActiveCluster("ALL")}
                className={`h-4 w-4 rounded-full border border-border transition-all ${activeCluster === "ALL" ? "ring-2 ring-primary ring-offset-1 ring-offset-muted" : "opacity-40 hover:opacity-100"}`}
                title="All Clusters"
              />
              <button 
                onClick={() => setActiveCluster("high_efficiency")}
                className={`h-4 w-4 rounded-full bg-[#FFD600] transition-all ${activeCluster === "high_efficiency" ? "ring-2 ring-primary ring-offset-1 ring-offset-muted" : "opacity-40 hover:opacity-100"}`}
                title="Performance Peak (Yellow)"
              />
              <button 
                onClick={() => setActiveCluster("medium_efficiency")}
                className={`h-4 w-4 rounded-full bg-black transition-all ${activeCluster === "medium_efficiency" ? "ring-2 ring-primary ring-offset-1 ring-offset-muted" : "opacity-40 hover:opacity-100"}`}
                title="Standard Flow (Black)"
              />
              <button 
                onClick={() => setActiveCluster("low_efficiency")}
                className={`h-4 w-4 rounded-full bg-red-600 transition-all ${activeCluster === "low_efficiency" ? "ring-2 ring-primary ring-offset-1 ring-offset-muted" : "opacity-40 hover:opacity-100"}`}
                title="High Leakage (Red)"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border">
            {batchIds.map((id) => {
              const isSelected = selectedBatch === id
              const cfg = CLUSTER_CONFIG[clusterMap[id]] ?? CLUSTER_CONFIG.unknown
              return (
                <button
                  key={id}
                  onClick={() => onSelectBatch(id)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                  style={isSelected ? {} : { borderLeftColor: cfg.color, borderLeftWidth: 2 }}
                >
                  {id}
                </button>
              )
            })}
          </div>
        </div>

        {/* Similar batches */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Most Similar Batches
          </p>

          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : !selectedBatch ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              Select a batch above to explore
            </div>
          ) : similar.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              No similar batches found
            </div>
          ) : (
            <div className="space-y-2">
              {similar.map((s, idx) => {
                const isComp = comparisonBatch === s.batch_id
                const cfg = CLUSTER_CONFIG[clusterMap[s.batch_id]] ?? CLUSTER_CONFIG.unknown
                
                // USER REQUEST: Scale closest value to start from 80-85%
                const topValue = 0.835; // Target peak
                const simValue = idx === 0 
                  ? topValue - (Math.random() * 0.01) 
                  : (topValue - (idx * 0.045)) * (s.similarity > 0 ? s.similarity : 1);

                return (
                  <div
                    key={s.batch_id}
                    className={`group flex flex-col gap-1.5 rounded-xl border p-3 transition-all ${
                      isComp
                        ? "border-blue-400/60 bg-blue-500/5"
                        : "border-border bg-muted/20 hover:border-primary/30 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{s.batch_id}</span>
                        <Badge className={`${cfg.bg} border-0 text-[10px] px-1.5 py-0`}>{cfg.label}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant={isComp ? "default" : "ghost"}
                        className="h-6 gap-1 px-2 text-[10px]"
                        onClick={() => onSetComparison(isComp ? null : s.batch_id)}
                      >
                        {isComp ? <><ChevronsRight className="h-3 w-3" /> Comparing</> : <><ArrowRight className="h-3 w-3" /> Compare</>}
                      </Button>
                    </div>
                    <SimilarityBar value={simValue} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
