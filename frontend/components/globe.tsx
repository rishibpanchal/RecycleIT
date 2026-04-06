"use client"

import { useEffect, useRef, useCallback } from "react"

interface Arc {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  color: string
}

interface GlobeProps {
  arcs?: Arc[]
  className?: string
}

export function Globe({ arcs = [], className }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const animationRef = useRef<number>(0)

  // Convert lat/lng to 3D coordinates
  const latLngToXY = useCallback((lat: number, lng: number, radius: number, centerX: number, centerY: number, rotationAngle: number) => {
    const latRad = (lat * Math.PI) / 180
    const lngRad = ((lng + rotationAngle) * Math.PI) / 180

    const x = radius * Math.cos(latRad) * Math.sin(lngRad)
    const y = -radius * Math.sin(latRad)
    const z = radius * Math.cos(latRad) * Math.cos(lngRad)

    // Simple perspective projection
    const scale = 1 + z / (radius * 4)
    return {
      x: centerX + x * scale,
      y: centerY + y * scale,
      z,
      visible: z > -radius * 0.3
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const radius = Math.min(rect.width, rect.height) * 0.38

    const draw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height)

      // Draw globe background with gradient
      const gradient = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        0,
        centerX,
        centerY,
        radius
      )
      gradient.addColorStop(0, "#FFFFFF")
      gradient.addColorStop(0.5, "#F9FAFB")
      gradient.addColorStop(1, "#F3F4F6")

      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()

      // Draw globe border
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw latitude lines
      ctx.strokeStyle = "rgba(16, 185, 129, 0.15)"
      ctx.lineWidth = 1
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = (lat * Math.PI) / 180
        const y = centerY - radius * Math.sin(latRad)
        const xRadius = radius * Math.cos(latRad)

        ctx.beginPath()
        ctx.ellipse(centerX, y, xRadius, xRadius * 0.2, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Draw longitude lines
      const currentRotation = rotationRef.current
      for (let lng = 0; lng < 180; lng += 30) {
        ctx.beginPath()
        for (let lat = -90; lat <= 90; lat += 5) {
          const point = latLngToXY(lat, lng, radius, centerX, centerY, currentRotation)
          if (lat === -90) {
            ctx.moveTo(point.x, point.y)
          } else {
            ctx.lineTo(point.x, point.y)
          }
        }
        ctx.strokeStyle = "rgba(16, 185, 129, 0.15)"
        ctx.stroke()
      }

      // Draw arcs (recycling corridors)
      arcs.forEach((arc) => {
        const start = latLngToXY(arc.startLat, arc.startLng, radius, centerX, centerY, currentRotation)
        const end = latLngToXY(arc.endLat, arc.endLng, radius, centerX, centerY, currentRotation)

        if (start.visible && end.visible) {
          // Draw glowing arc
          ctx.beginPath()
          ctx.moveTo(start.x, start.y)

          // Calculate control point for curved arc
          const midX = (start.x + end.x) / 2
          const midY = (start.y + end.y) / 2
          const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
          const controlY = midY - distance * 0.4

          ctx.quadraticCurveTo(midX, controlY, end.x, end.y)

          // Glow effect
          ctx.shadowColor = arc.color
          ctx.shadowBlur = 15
          ctx.strokeStyle = arc.color
          ctx.lineWidth = 3
          ctx.stroke()
          ctx.shadowBlur = 0

          // Draw start point
          ctx.beginPath()
          ctx.arc(start.x, start.y, 6, 0, Math.PI * 2)
          ctx.fillStyle = arc.color
          ctx.shadowColor = arc.color
          ctx.shadowBlur = 10
          ctx.fill()
          ctx.shadowBlur = 0

          // Draw end point
          ctx.beginPath()
          ctx.arc(end.x, end.y, 6, 0, Math.PI * 2)
          ctx.fillStyle = arc.color
          ctx.shadowColor = arc.color
          ctx.shadowBlur = 10
          ctx.fill()
          ctx.shadowBlur = 0

          // Animated pulse on arc
          const pulsePos = ((Date.now() % 2000) / 2000)
          const pulseX = start.x + (midX - start.x) * pulsePos * 2
          const pulseY = start.y + (controlY - start.y) * pulsePos * 2 + (pulsePos > 0.5 ? (end.y - controlY) * (pulsePos - 0.5) * 2 : 0)
          
          if (pulsePos <= 0.5) {
            ctx.beginPath()
            ctx.arc(pulseX, pulseY, 4, 0, Math.PI * 2)
            ctx.fillStyle = "#ffffff"
            ctx.shadowColor = arc.color
            ctx.shadowBlur = 15
            ctx.fill()
            ctx.shadowBlur = 0
          }
        }

        // Draw points even if arc is partially visible
        if (start.visible) {
          ctx.beginPath()
          ctx.arc(start.x, start.y, 5, 0, Math.PI * 2)
          ctx.fillStyle = arc.color
          ctx.fill()
        }
        if (end.visible) {
          ctx.beginPath()
          ctx.arc(end.x, end.y, 5, 0, Math.PI * 2)
          ctx.fillStyle = arc.color
          ctx.fill()
        }
      })

      // Draw subtle glow around globe
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(16, 185, 129, 0.2)"
      ctx.lineWidth = 10
      ctx.stroke()
    }

    const animate = () => {
      rotationRef.current = (rotationRef.current + 0.15) % 360
      draw()
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [arcs, latLngToXY])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  )
}
