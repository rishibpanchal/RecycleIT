"use client"

import { RefreshCw, Fingerprint, Loader2, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useFingerprint, getFingerprintByBatch } from "@/hooks/useFingerprint"
import { FingerprintOverview } from "@/components/fingerprint/FingerprintOverview"
import { FingerprintRadar } from "@/components/fingerprint/FingerprintRadar"
import { SimilarityExplorer } from "@/components/fingerprint/SimilarityExplorer"
import { InsightSummary } from "@/components/fingerprint/InsightSummary"
import { CLUSTER_CONFIG } from "@/hooks/useFingerprint"


export default function FingerprintPage() {
  const {
    data,
    clusters,
    similar,
    selectedBatch,
    comparisonBatch,
    loading,
    loadingSimilar,
    error,
    setSelectedBatch,
    setComparisonBatch,
    refresh,
  } = useFingerprint(20, 3)


  const fingerprints = data?.fingerprints ?? []
  const selected = getFingerprintByBatch(fingerprints, selectedBatch)
  const comparison = getFingerprintByBatch(fingerprints, comparisonBatch)

  const selectedCfg = selected ? CLUSTER_CONFIG[selected.cluster] ?? CLUSTER_CONFIG.unknown : null

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            <Fingerprint className="h-6 w-6 text-primary" />
            Fingerprint Intelligence
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Material batch fingerprinting, pattern discovery, and lifecycle analytics
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedCfg && selected && (
            <Badge className={`${selectedCfg.bg} border-0 gap-1.5 px-3 py-1.5 font-medium`}>
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse"
                style={{ background: selectedCfg.color }}
              />
              {selected.batch_id} · {selectedCfg.label}
            </Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5 h-9"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Error state ───────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-600">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold">Failed to load fingerprint data</p>
            <p className="text-xs opacity-75">{error} — Make sure the backend is running at localhost:8000</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-red-600 hover:bg-red-500/10"
            onClick={refresh}
          >
            Retry
          </Button>
        </div>
      )}

      {/* ── Loading skeleton ──────────────────────────────────────────── */}
      {loading && !error && (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Computing material fingerprints…</p>
          <p className="text-xs text-muted-foreground opacity-60">Generating synthetic lifecycle data</p>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────── */}
      {!loading && !error && data && selected && (
        <>
          {/* Desktop: 2-column layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            {/* LEFT — Visualization column */}
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Radar Chart */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-md h-full">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground leading-none">Fingerprint Radar</h2>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {comparison
                          ? `Comparing ${selected.batch_id} vs ${comparison.batch_id}`
                          : `Visualising ${selected.batch_id} across feature dimensions`}
                      </p>
                    </div>
                    {comparison && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => setComparisonBatch(null)}
                      >
                        Clear comparison
                      </Button>
                    )}
                  </div>
                  <div className="mx-auto max-w-[300px]">
                    <FingerprintRadar
                      fingerprint={selected.fingerprint}
                      comparison={comparison?.fingerprint ?? null}
                      primaryColor={selectedCfg?.color ?? "#10B981"}
                      compColor="#3B82F6"
                      label={selected.batch_id}
                      compLabel={comparison?.batch_id}
                    />
                  </div>
                </div>

                {/* Overview panel (Right of Radar) */}
                <FingerprintOverview fingerprint={selected} />
              </div>

              {/* Insights — moved to left column to fill space */}
              <InsightSummary insights={data.insights} loading={loading} />
            </div>

            {/* RIGHT — Controls column */}
            <div className="space-y-5">
              <SimilarityExplorer
                fingerprints={fingerprints}
                selectedBatch={selectedBatch}
                comparisonBatch={comparisonBatch}
                similar={similar?.similar_batches ?? []}
                loading={loadingSimilar}
                onSelectBatch={setSelectedBatch}
                onSetComparison={setComparisonBatch}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
