"use client"

import { useState, useEffect, useCallback } from "react"
import { api, type FingerprintComputeResponse, type SimilarBatchesResponse, type ClustersResponse, type FingerprintEntry } from "@/lib/api"

interface UseFingerprintState {
  data: FingerprintComputeResponse | null
  clusters: ClustersResponse | null
  similar: SimilarBatchesResponse | null
  selectedBatch: string | null
  comparisonBatch: string | null
  loading: boolean
  loadingSimilar: boolean
  error: string | null
  setSelectedBatch: (id: string) => void
  setComparisonBatch: (id: string | null) => void
  refresh: () => void
  fetchSimilar: (batchId: string) => void
}

export function useFingerprint(nBatches = 20, k = 3): UseFingerprintState {
  const [data, setData] = useState<FingerprintComputeResponse | null>(null)
  const [clusters, setClusters] = useState<ClustersResponse | null>(null)
  const [similar, setSimilar] = useState<SimilarBatchesResponse | null>(null)
  const [selectedBatch, setSelectedBatchState] = useState<string | null>(null)
  const [comparisonBatch, setComparisonBatch] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    
    api.fingerprintComputeReal(1, k)
      .then((d) => {
        setData(d)
        const firstId = d.fingerprints[0]?.batch_id ?? null
        setSelectedBatchState(firstId)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [k])

  useEffect(() => { refresh() }, [refresh])

  // Load clusters lazily (after data is ready)
  useEffect(() => {
    if (!data) return
    api.fingerprintClusters()
      .then(setClusters)
      .catch(() => null)
  }, [data])

  const fetchSimilar = useCallback((batchId: string) => {
    setLoadingSimilar(true)
    api.fingerprintSimilar(batchId, 5)
      .then(setSimilar)
      .catch(() => null)
      .finally(() => setLoadingSimilar(false))
  }, [])

  const setSelectedBatch = useCallback((id: string) => {
    setSelectedBatchState(id)
    setComparisonBatch(null)
    setSimilar(null)
    fetchSimilar(id)
  }, [fetchSimilar])

  return {
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
    fetchSimilar,
  }
}

export function getFingerprintByBatch(
  fingerprints: FingerprintEntry[],
  batchId: string | null
): FingerprintEntry | null {
  if (!batchId) return null
  return fingerprints.find((fp) => fp.batch_id === batchId) ?? null
}

export const FEATURE_LABELS = [
  "Total Loss",
  "Avg Stage Loss",
  "Total Time",
  "Avg Stage Time",
  "Vendor Score",
  "Consistency",
]

export const CLUSTER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  high_efficiency: { label: "Performance Peak", color: "#FFD600", bg: "bg-[#FFD600] text-black" },
  medium_efficiency: { label: "Standard Flow", color: "#000000", bg: "bg-black text-white" },
  low_efficiency: { label: "High Leakage", color: "#EF4444", bg: "bg-red-600 text-white" },
  unknown: { label: "Computing...", color: "#9CA3AF", bg: "bg-gray-100 text-gray-500" },
}
