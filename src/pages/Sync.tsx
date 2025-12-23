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
  Check, 
  X, 
  AlertTriangle,
  ArrowLeftRight,
  Loader2,
  Edit2
} from "lucide-react";

export default function Sync() {
  const {
    deviceId,
    deviceName,
    updateDeviceName,
    nearbyDevices,
    isDiscovering,
    isSyncing,
    duplicates,
    discoverDevices,
    syncData,
    resolveDuplicate,
    confirmSync,
  } = useDeviceSync();

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(deviceName);

  const handleSaveName = () => {
    updateDeviceName(tempName);
    setIsEditingName(false);
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <div className="space-y-6">
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
                  />
                  <Button size="sm" onClick={handleSaveName}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="font-medium text-lg">{deviceName}</span>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditingName(true)}>
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
                disabled={isDiscovering}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isDiscovering ? "animate-spin" : ""}`} />
                Scan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {nearbyDevices.length === 0 ? (
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
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Syncing...
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
          <Card className="border-warning">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
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
      </div>
    </div>
  );
}
