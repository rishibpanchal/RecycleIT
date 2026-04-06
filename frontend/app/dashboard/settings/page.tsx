"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User, Bell, Shield, Database, Webhook, Key, Save, RefreshCw } from "lucide-react"

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    anomalies: true,
    reports: false,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and platform preferences</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Settings */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Settings */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Profile Settings</CardTitle>
              </div>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" defaultValue="John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" defaultValue="Doe" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" defaultValue="john.doe@recycleit.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select defaultValue="admin">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-chart-2" />
                <CardTitle className="text-foreground">Notifications</CardTitle>
              </div>
              <CardDescription>Configure how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Browser push notifications</p>
                </div>
                <Switch
                  checked={notifications.push}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Anomaly Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified about process anomalies</p>
                </div>
                <Switch
                  checked={notifications.anomalies}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, anomalies: checked })}
                />
              </div>
              <Separator className="bg-border" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">Receive weekly summary reports</p>
                </div>
                <Switch
                  checked={notifications.reports}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, reports: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-chart-4" />
                <CardTitle className="text-foreground">Security</CardTitle>
              </div>
              <CardDescription>Manage your security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input id="currentPassword" type="password" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-4">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Button variant="outline" size="sm">
                  Enable
                </Button>
              </div>
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Save className="h-4 w-4" />
                Update Password
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          {/* API Keys */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-chart-3" />
                <CardTitle className="text-foreground">API Keys</CardTitle>
              </div>
              <CardDescription>Manage integration access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Production Key</p>
                    <p className="font-mono text-xs text-muted-foreground">im_prod_****...8f2a</p>
                  </div>
                  <Badge className="bg-primary/20 text-primary">Active</Badge>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Development Key</p>
                    <p className="font-mono text-xs text-muted-foreground">im_dev_****...3e1b</p>
                  </div>
                  <Badge className="bg-chart-4/20 text-chart-4">Test</Badge>
                </div>
              </div>
              <Button variant="outline" className="w-full gap-2">
                <RefreshCw className="h-4 w-4" />
                Generate New Key
              </Button>
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-primary" />
                <CardTitle className="text-foreground">Integrations</CardTitle>
              </div>
              <CardDescription>Connected services</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "ERP System", status: "Connected", active: true },
                { name: "Logistics API", status: "Connected", active: true },
                { name: "Reporting Suite", status: "Pending", active: false },
                { name: "IoT Sensors", status: "Connected", active: true },
              ].map((integration) => (
                <div
                  key={integration.name}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <span className="text-sm font-medium text-foreground">{integration.name}</span>
                  <Badge
                    className={
                      integration.active
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {integration.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Data Management */}
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-chart-2" />
                <CardTitle className="text-foreground">Data Management</CardTitle>
              </div>
              <CardDescription>Export and backup options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2">
                Export All Data (CSV)
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2">
                Download Backup
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-destructive hover:text-destructive">
                Clear Cache
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
