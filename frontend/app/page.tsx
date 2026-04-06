"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { ArrowRight, Recycle, Shield, BarChart3, Zap, Globe2, Leaf } from "lucide-react"
import Link from "next/link"

const GlobeDemo = dynamic(() => import("@/components/globe-demo"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-16 w-16 animate-pulse rounded-full border-2 border-primary/50" />
    </div>
  ),
})

const stats = [
  { value: "98%", label: "Traceability Rate" },
  { value: "2.5M", label: "KG Recycled" },
  { value: "150+", label: "Active Corridors" },
  { value: "24/7", label: "Real-time Monitoring" },
]

const features = [
  {
    icon: Recycle,
    title: "Complete Material Traceability",
    description: "Track every kilogram from source to destination with blockchain-verified transparency.",
  },
  {
    icon: Shield,
    title: "AI-Powered Verification",
    description: "Real-time anomaly detection and automated compliance monitoring across your supply chain.",
  },
  {
    icon: BarChart3,
    title: "Sustainability Analytics",
    description: "Comprehensive ESG reporting with carbon offset calculations and impact metrics.",
  },
  {
    icon: Zap,
    title: "Instant Insights",
    description: "Natural language queries through IntelliAgent for immediate operational intelligence.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Recycle className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">RecycleIT</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Features</a>
            <a href="#stats" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Impact</a>
            <a href="#contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Contact</a>
          </div>
          <Link href="/dashboard">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Launch Platform
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen overflow-hidden pt-16 bg-[#F9FAFB]">
        {/* Background effects */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-[#E5E7EB]" />
        
        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col lg:flex-row">
          {/* Left Content */}
          <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:py-0">
            <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-black bg-black px-4 py-1.5 shadow-[4px_4px_0_0_#FFD600]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FFD600] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FFD600]" />
              </span>
              <span className="text-sm font-bold text-white uppercase tracking-wider">Where Recycling Meets Intelligence.</span>
            </div>
            
            <h1 className="mb-2 text-5xl font-black tracking-tight text-black sm:text-6xl lg:text-7xl uppercase">
              <span className="text-balance">Turn your material waste</span>
            </h1>
            <h1 className="mb-8 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl uppercase" style={{ color: "#FFD600", WebkitTextStroke: "2px black" }}>
              into revenue
            </h1>
            
            <p className="mb-10 max-w-xl text-lg font-medium leading-relaxed text-[#4B5563]">
              RecycleIT delivers end-to-end traceability for circular supply chains. 
              Track, verify, and optimize every material flow with AI-powered precision.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/dashboard">
                <Button size="lg" className="h-12 gap-2 border-2 border-black bg-[#FFD600] px-8 text-base font-black uppercase tracking-wider text-black hover:bg-black hover:text-white shadow-[4px_4px_0_0_#000] hover:shadow-none translate-x-[-4px] translate-y-[-4px] hover:translate-x-0 hover:translate-y-0 transition-all rounded-none">
                  Enter Management Vault
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" className="h-12 gap-2 border-2 border-black bg-white px-8 text-base font-black uppercase tracking-wider text-black hover:bg-[#F3F4F6] shadow-[4px_4px_0_0_#000] hover:shadow-none translate-x-[-4px] translate-y-[-4px] hover:translate-x-0 hover:translate-y-0 transition-all rounded-none">
                <Globe2 className="h-4 w-4" />
                Watch Demo
              </Button>
            </div>
          </div>

          {/* Right - Globe (Disabled for Dev to save RAM) */}
          <div className="relative flex flex-1 items-center justify-center p-6 lg:p-0">
            <GlobeDemo />
            {/* <div className="h-[400px] w-[400px] rounded-full border-4 border-dashed border-primary/20 flex items-center justify-center text-muted-foreground">
              Globe Disabled (Memory Saver)
            </div> */}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="border-y border-border bg-card/50">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center justify-center px-6 py-10">
              <p className="text-3xl font-bold text-foreground sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 max-w-2xl">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Enterprise-grade circular economy infrastructure
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need to transform your sustainability operations into a competitive advantage.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/50 hover:bg-card/80"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-card/50 py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Ready to transform your supply chain?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join leading enterprises using RecycleIT to achieve their circular economy goals.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/dashboard">
              <Button size="lg" className="h-12 gap-2 bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Recycle className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">RecycleIT</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Where Recycling Meets Intelligence.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
