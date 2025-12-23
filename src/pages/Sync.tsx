import { useState } from "react";
import { useDeviceSync } from "@/hooks/useDeviceSync";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  ShieldAlert
} from "lucide-react";

export default function Sync() {
  const {
    deviceId,
    deviceName,
    updateDeviceName,
    nearbyDevices,
    isDiscovering,
    isSyncing,
    isCaching,
    duplicates,
    deletedByOthers,
    discoverDevices,
    syncData,
    resolveDuplicate,
    confirmSync,
    confirmDeletions,
    dismissDeletions,
    online,
    lastSync,
    pendingChanges,
    cacheDataForOffline,
  } = useDeviceSync();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);

  const handleSaveName = () => {
    if (tempName.trim()) {
      updateDeviceName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const formatLastSync = (dateString: string | null) => {
    if (!dateString) return "Never";
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <div className="space-y-6">
        {/* Connection Status */}
        <Card className={online ? "border-green-500/50" : "border-destructive/50"}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {online ? (
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
              {pendingChanges > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  {pendingChanges} pending change{pendingChanges > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* This Device */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              This Device
            </CardTitle>
            <CardDescription>
              Your device identity for local network sync
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
                    setTempName(deviceName);
                    setIsEditingName(false);
                  }}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="font-medium text-lg">{deviceName}</span>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setTempName(deviceName);
                    setIsEditingName(true);
                  }}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              ID: {deviceId.slice(0, 20)}...
            </p>
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
                <span>Last cached: {formatLastSync(lastSync)}</span>
              </div>
            </div>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={cacheDataForOffline}
              disabled={isCaching || !online}
            >
              {isCaching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Caching...
                </>
              ) : !online ? (
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
                onClick={discoverDevices}
                disabled={isDiscovering || !online}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isDiscovering ? "animate-spin" : ""}`} />
                Scan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!online ? (
              <div className="text-center py-8 text-muted-foreground">
                <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>You're offline</p>
                <p className="text-sm mt-1">Connect to a network to discover devices</p>
              </div>
            ) : nearbyDevices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wifi className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No devices found on this network</p>
                <p className="text-sm mt-1">Make sure other devices have the app open</p>
              </div>
            ) : (
              <div className="space-y-2">
                {nearbyDevices.map((device) => (
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

        {/* Sync Action */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              Sync Data
            </CardTitle>
            <CardDescription>
              Share your data with all devices on this network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => syncData()}
              disabled={isSyncing || !online}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : !online ? (
                <>
                  <CloudOff className="h-5 w-5 mr-2" />
                  Offline - Cannot Sync
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

        {/* Duplicates Review */}
        {duplicates.length > 0 && (
          <Card className="border-amber-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Duplicates Found ({duplicates.length})
              </CardTitle>
              <CardDescription>
                Review potential duplicates before syncing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {duplicates.map((dup, index) => (
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
                          <p>{dup.incoming.name || dup.incoming.part_number || "Unknown"}</p>
                          {dup.incoming.email && <p className="text-muted-foreground">{dup.incoming.email}</p>}
                        </div>
                        <div className="p-2 bg-muted rounded">
                          <p className="font-medium mb-1">Existing</p>
                          <p>{dup.existing.name || dup.existing.part_number || "Unknown"}</p>
                          {dup.existing.email && <p className="text-muted-foreground">{dup.existing.email}</p>}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => resolveDuplicate(index, "keep_existing")}
                        >
                          Keep Existing
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => resolveDuplicate(index, "keep_incoming")}
                        >
                          Keep Incoming
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => resolveDuplicate(index, "keep_both")}
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
                onClick={confirmSync}
                disabled={duplicates.length > 0 || isSyncing}
              >
                {duplicates.length > 0 
                  ? `Resolve ${duplicates.length} duplicate(s) to continue`
                  : "Confirm Sync"
                }
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Deleted by Others Review */}
        {deletedByOthers.length > 0 && (
          <Card className="border-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                Items Deleted by Others ({deletedByOthers.length})
              </CardTitle>
              <CardDescription>
                These items were deleted by another user. Choose what to do with your local copies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[250px] pr-4">
                <div className="space-y-2">
                  {deletedByOthers.map((item, index) => (
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
                  onClick={() => confirmDeletions(deletedByOthers)}
                  disabled={isSyncing}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Copies Too
                </Button>
                <Button 
                  className="flex-1" 
                  variant="outline"
                  onClick={dismissDeletions}
                  disabled={isSyncing}
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
