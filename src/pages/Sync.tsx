import { useState, useEffect } from "react";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { useCRDTSync } from "@/hooks/useCRDTSync";
import { getNotificationStatus, getStorageEstimate, requestPersistentStorage } from "@/lib/push-notifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Smartphone, 
  RefreshCw, 
  Wifi, 
  WifiOff,
  Check, 
  X, 
  AlertTriangle,
  ArrowLeftRight,
  Loader2,
  Edit2,
  Download,
  Clock,
  CloudOff,
  Trash2,
  ShieldAlert,
  Bell,
  BellOff,
  Users,
  Link,
  Copy,
  HardDrive,
  Zap,
  Share2,
  Monitor,
  Share,
  Plus
} from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Sync() {
  // Legacy sync hook (for backward compatibility)
  const legacySync = useDeviceSync();
  
  // New CRDT sync hook
  const crdtSync = useCRDTSync({
    autoSync: true,
    syncIntervalMs: 30000,
    deviceName: legacySync.deviceName,
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(legacySync.deviceName);
  const [joinRoomKey, setJoinRoomKey] = useState("");
  const [storageInfo, setStorageInfo] = useState<{ quota?: number; usage?: number; percentUsed?: number }>({});
  const [isPersistent, setIsPersistent] = useState(false);
  const [syncMode, setSyncMode] = useState<"crdt" | "legacy" | "install">("crdt");

  // Install PWA state
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Load storage info on mount
  useEffect(() => {
    getStorageEstimate().then(setStorageInfo);
    navigator.storage?.persisted?.().then(setIsPersistent);
  }, []);

  // Install PWA detection
  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleSaveName = () => {
    if (tempName.trim()) {
      legacySync.updateDeviceName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const formatLastSync = (date: Date | string | null) => {
    if (!date) return "Never";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const copyRoomKey = () => {
    navigator.clipboard.writeText(crdtSync.roomKey);
    toast.success("Room key copied to clipboard");
  };

  const handleJoinRoom = async () => {
    if (!joinRoomKey.trim()) {
      toast.error("Please enter a room key");
      return;
    }
    await crdtSync.connectToRoom(joinRoomKey.trim());
    setJoinRoomKey("");
  };

  const handleRequestPersistence = async () => {
    const granted = await requestPersistentStorage();
    setIsPersistent(granted);
    if (granted) {
      toast.success("Persistent storage granted");
    } else {
      toast.error("Persistent storage denied");
    }
  };

  const notificationStatus = getNotificationStatus();

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <div className="space-y-6">
        {/* Connection Status */}
        <Card className={crdtSync.isOnline ? "border-green-500/50" : "border-destructive/50"}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {crdtSync.isOnline ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="font-medium text-green-600">Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive">Offline</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {crdtSync.peerCount > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    <Users className="h-3 w-3 mr-1" />
                    {crdtSync.peerCount} peer{crdtSync.peerCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {legacySync.pendingChanges > 0 && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    {legacySync.pendingChanges} pending
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Mode Tabs */}
        <Tabs value={syncMode} onValueChange={(v) => setSyncMode(v as "crdt" | "legacy" | "install")}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="crdt" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              P2P Sync
            </TabsTrigger>
            <TabsTrigger value="legacy" className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4" />
              Server Sync
            </TabsTrigger>
            <TabsTrigger value="install" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Install
            </TabsTrigger>
          </TabsList>

          {/* CRDT P2P Sync Tab */}
          <TabsContent value="crdt" className="space-y-6 mt-6">
            {/* CRDT Room Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5" />
                  Sync Room
                </CardTitle>
                <CardDescription>
                  Connect devices using the same room key for automatic sync
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Your Room Key</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={crdtSync.roomKey} 
                      readOnly 
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={copyRoomKey}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this key with other devices to sync automatically
                  </p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Join Another Room</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={joinRoomKey}
                      onChange={(e) => setJoinRoomKey(e.target.value)}
                      placeholder="Paste room key here..."
                      className="font-mono text-xs"
                    />
                    <Button onClick={handleJoinRoom} disabled={!joinRoomKey.trim()}>
                      Join
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Connected Peers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Connected Peers ({crdtSync.peerCount})
                </CardTitle>
                <CardDescription>
                  Devices syncing with you in real-time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {crdtSync.peers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Share2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No peers connected</p>
                    <p className="text-sm mt-1">Share your room key with other devices</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {crdtSync.peers.map((peer) => (
                      <div 
                        key={peer.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5 text-primary" />
                          <span>{peer.name || `Peer ${peer.id}`}</span>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Syncing
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Manual Sync Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Manual Sync
                </CardTitle>
                <CardDescription>
                  Sync data with the server manually
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Last synced</span>
                  <span>{formatLastSync(crdtSync.lastSyncTime)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline"
                    onClick={crdtSync.refreshFromServer}
                    disabled={crdtSync.isSyncing || !crdtSync.isOnline}
                  >
                    {crdtSync.isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Pull from Server
                  </Button>
                  <Button 
                    onClick={crdtSync.syncToServer}
                    disabled={crdtSync.isSyncing || !crdtSync.isOnline}
                  >
                    {crdtSync.isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="h-4 w-4 mr-2" />
                    )}
                    Push to Server
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Legacy Server Sync Tab */}
          <TabsContent value="legacy" className="space-y-6 mt-6">
            {/* This Device */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  This Device
                </CardTitle>
                <CardDescription>
                  Your device identity for network sync
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {isEditingName ? (
                    <>
                      <Input
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="flex-1"
                        placeholder="Device name"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                        autoFocus
                      />
                      <Button size="sm" onClick={handleSaveName}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setTempName(legacySync.deviceName);
                        setIsEditingName(false);
                      }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-lg">{legacySync.deviceName}</span>
                      <Button size="sm" variant="ghost" onClick={() => {
                        setTempName(legacySync.deviceName);
                        setIsEditingName(true);
                      }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  ID: {legacySync.deviceId.slice(0, 20)}...
                </p>
              </CardContent>
            </Card>

            {/* Nearby Devices */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wifi className="h-5 w-5" />
                      Nearby Devices
                    </CardTitle>
                    <CardDescription>
                      Devices on the same network
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={legacySync.discoverDevices}
                    disabled={legacySync.isDiscovering || !legacySync.online}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${legacySync.isDiscovering ? "animate-spin" : ""}`} />
                    Scan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!legacySync.online ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>You're offline</p>
                  </div>
                ) : legacySync.nearbyDevices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wifi className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No devices found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {legacySync.nearbyDevices.map((device) => (
                      <div 
                        key={device.deviceId}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5 text-primary" />
                          <span>{device.deviceName}</span>
                        </div>
                        <Badge variant="secondary">Online</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legacy Sync Action */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5" />
                  Sync Data
                </CardTitle>
                <CardDescription>
                  Share your data with connected devices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => legacySync.syncData()}
                  disabled={legacySync.isSyncing || !legacySync.online}
                >
                  {legacySync.isSyncing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : !legacySync.online ? (
                    <>
                      <CloudOff className="h-5 w-5 mr-2" />
                      Offline
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="h-5 w-5 mr-2" />
                      Start Sync
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Install App Tab */}
          <TabsContent value="install" className="space-y-6 mt-6">
            {isInstalled ? (
              <Card>
                <CardHeader className="text-center">
                  <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <CardTitle>App Installed!</CardTitle>
                  <CardDescription>
                    Serial Stock Suite is now installed on your device. You can access it from your home screen.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <>
                {/* Features */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Why Install?</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <Smartphone className="w-4 h-4 text-primary" />
                      </div>
                      <span>Works offline - access your data anytime</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <Monitor className="w-4 h-4 text-primary" />
                      </div>
                      <span>Full screen experience - no browser chrome</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                        <Download className="w-4 h-4 text-primary" />
                      </div>
                      <span>Quick access from your home screen</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Install Instructions */}
                {isIOS ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Install on iPhone/iPad</CardTitle>
                      <CardDescription>Follow these steps to install</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                          1
                        </div>
                        <div>
                          <p className="font-medium">Tap the Share button</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            Look for <Share className="w-4 h-4" /> at the bottom of Safari
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                          2
                        </div>
                        <div>
                          <p className="font-medium">Scroll and tap "Add to Home Screen"</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            Look for <Plus className="w-4 h-4" /> Add to Home Screen
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                          3
                        </div>
                        <div>
                          <p className="font-medium">Tap "Add" to confirm</p>
                          <p className="text-sm text-muted-foreground">
                            The app will appear on your home screen
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : deferredPrompt ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Ready to Install</CardTitle>
                      <CardDescription>Click the button below to install the app</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleInstall} className="w-full" size="lg">
                        <Download className="w-4 h-4 mr-2" />
                        Install App
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Install from Browser Menu</CardTitle>
                      <CardDescription>Use your browser's install option</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Look for "Install app" or "Add to Home Screen" in your browser's menu (usually the three dots ⋮ in the top right).
                      </p>
                      <p className="text-sm text-muted-foreground">
                        If you don't see the option, try refreshing the page or visiting in Chrome.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Notifications & Storage Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {crdtSync.notificationsEnabled ? (
                  <Bell className="h-5 w-5 text-primary" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label>Push Notifications</Label>
                  <p className="text-xs text-muted-foreground">
                    Get notified about sync events
                  </p>
                </div>
              </div>
              <Switch 
                checked={crdtSync.notificationsEnabled}
                onCheckedChange={() => crdtSync.enableNotifications()}
                disabled={notificationStatus.permission === "denied"}
              />
            </div>

            {notificationStatus.permission === "denied" && (
              <p className="text-xs text-destructive">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            )}

            <Separator />

            {/* Persistent Storage */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>Persistent Storage</Label>
                  <p className="text-xs text-muted-foreground">
                    Prevent browser from clearing offline data
                  </p>
                </div>
              </div>
              {isPersistent ? (
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Check className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Button variant="outline" size="sm" onClick={handleRequestPersistence}>
                  Enable
                </Button>
              )}
            </div>

            <Separator />

            {/* Storage Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage Used</span>
                <span>{formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}</span>
              </div>
              {storageInfo.percentUsed !== undefined && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(storageInfo.percentUsed, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Offline Cache */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Offline Data
            </CardTitle>
            <CardDescription>
              Cache data for offline use
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Last cached: {formatLastSync(legacySync.lastSync)}</span>
              </div>
            </div>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={legacySync.cacheDataForOffline}
              disabled={legacySync.isCaching || !legacySync.online}
            >
              {legacySync.isCaching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Caching...
                </>
              ) : !legacySync.online ? (
                <>
                  <CloudOff className="h-4 w-4 mr-2" />
                  Offline - Cannot Cache
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Data for Offline
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Duplicates Review (Legacy) */}
        {legacySync.duplicates.length > 0 && (
          <Card className="border-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Duplicates Found ({legacySync.duplicates.length})
              </CardTitle>
              <CardDescription>
                Review potential duplicates before syncing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {legacySync.duplicates.map((dup, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge>{dup.type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Match on: {dup.field}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-2 bg-muted rounded">
                          <p className="font-medium mb-1">Incoming</p>
                          <p>{String(dup.incoming.name || dup.incoming.part_number || "Unknown")}</p>
                          {dup.incoming.email && <p className="text-muted-foreground">{String(dup.incoming.email)}</p>}
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <p className="font-medium mb-1">Existing</p>
                          <p>{String(dup.existing.name || dup.existing.part_number || "Unknown")}</p>
                          {dup.existing.email && <p className="text-muted-foreground">{String(dup.existing.email)}</p>}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => legacySync.resolveDuplicate(index, "keep_existing")}
                        >
                          Keep Existing
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => legacySync.resolveDuplicate(index, "keep_incoming")}
                        >
                          Keep Incoming
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => legacySync.resolveDuplicate(index, "keep_both")}
                        >
                          Keep Both
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              <Button 
                className="w-full" 
                onClick={legacySync.confirmSync}
                disabled={legacySync.duplicates.length > 0 || legacySync.isSyncing}
              >
                {legacySync.duplicates.length > 0 
                  ? `Resolve ${legacySync.duplicates.length} duplicate(s) to continue`
                  : "Confirm Sync"
                }
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Deleted by Others Review (Legacy) */}
        {legacySync.deletedByOthers.length > 0 && (
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                Items Deleted by Others ({legacySync.deletedByOthers.length})
              </CardTitle>
              <CardDescription>
                These items were deleted by another user
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] pr-4">
                <div className="space-y-2">
                  {legacySync.deletedByOthers.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <Trash2 className="h-4 w-4 text-red-500" />
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {item.type}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  variant="destructive"
                  onClick={() => legacySync.confirmDeletions(legacySync.deletedByOthers)}
                  disabled={legacySync.isSyncing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Copies
                </Button>
                <Button 
                  className="flex-1" 
                  variant="outline"
                  onClick={legacySync.dismissDeletions}
                  disabled={legacySync.isSyncing}
                >
                  Keep My Copies
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
