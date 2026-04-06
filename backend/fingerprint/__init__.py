"""
fingerprint/
============
Material Fingerprint module for the Recycling Traceability System.

Exposes:
  - preprocessor      : GroupBy + sort lifecycle events
  - feature_engineering: Compute stage/overall features per batch
  - fingerprint_builder: Build + normalize fixed-length fingerprint vectors
  - similarity        : Cosine similarity search
  - clustering        : K-Means clustering + labeling
  - insight_generator : Human-readable insights from clusters
"""
