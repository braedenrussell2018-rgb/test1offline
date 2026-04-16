import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { MapPin, Building2, User, X, Loader2, AlertCircle, Hexagon, RefreshCw, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Company, Person } from "@/lib/inventory-storage";
import { PersonDetailDialog } from "@/components/PersonDetailDialog";
import { CompanyDetailDialog } from "@/components/CompanyDetailDialog";
import { useContactsMap, getHexColor } from "@/hooks/useContactsMap";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function MapViewContent() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mapCompanies = (data: any[]) => data.map((c: any) => ({
    id: c.id, name: c.name, address: c.address || "", notes: c.notes || [],
    createdAt: c.created_at || new Date().toISOString(),
  }));
  const mapPersons = (data: any[]) => data.map((p: any) => ({
    id: p.id, name: p.name, email: p.email || "", phone: p.phone || "",
    address: p.address || "", companyId: p.company_id || "", branchId: p.branch_id || "",
    jobTitle: p.job_title || "", notes: p.notes || [], excavatorLines: p.excavator_lines || [],
    createdAt: p.created_at || new Date().toISOString(), updatedAt: p.updated_at,
  }));

  useEffect(() => {
    const load = async () => {
      const [{ data: companiesData }, { data: personsData }] = await Promise.all([
        supabase.from("companies").select("*"),
        supabase.from("people").select("*").is("deleted_at", null),
      ]);
      setCompanies(mapCompanies(companiesData || []));
      setPersons(mapPersons(personsData || []));
      setDataLoaded(true);
    };
    load();
  }, []);

  const {
    locations, selectedLocation, setSelectedLocation,
    selectedH3Cell, setSelectedH3Cell, selectedData,
    failedLocations, showFailedDialog, setShowFailedDialog,
    isLoading, isLoadingMinimized, setIsLoadingMinimized,
    geocodeProgress, geocodeStatus,
    showH3Overlay, setShowH3Overlay,
    h3Resolution, setH3Resolution,
    totalAddresses, maxCellCount,
    mapContainer, startGeocoding, getCompanyName, invalidateSize,
  } = useContactsMap({ companies, persons, active: dataLoaded });

  const onRefresh = useCallback(async () => {
    const [{ data: companiesData }, { data: personsData }] = await Promise.all([
      supabase.from("companies").select("*"),
      supabase.from("people").select("*").is("deleted_at", null),
    ]);
    setCompanies(mapCompanies(companiesData || []));
    setPersons(mapPersons(personsData || []));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => { setIsFullscreen(!!document.fullscreenElement); invalidateSize(); };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [invalidateSize]);

  return (
    <div className="flex flex-col h-screen">
      <div className="border-b bg-card px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/crm")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to CRM</Button>
          <h1 className="font-semibold flex items-center gap-2"><MapPin className="h-5 w-5" /> Contacts & Companies Map</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={startGeocoding} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {failedLocations.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setShowFailedDialog(true)}>
              <AlertCircle className="h-4 w-4 mr-1" /> Failed ({failedLocations.length})
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Switch id="h3-toggle-page" checked={showH3Overlay} onCheckedChange={setShowH3Overlay} />
            <Label htmlFor="h3-toggle-page" className="flex items-center gap-1 text-sm cursor-pointer"><Hexagon className="h-4 w-4" /> H3 Heatmap</Label>
          </div>
          {showH3Overlay && (
            <select value={h3Resolution} onChange={(e) => setH3Resolution(Number(e.target.value))} className="text-sm border rounded px-2 py-1 bg-background">
              <option value={5}>Large Cells</option>
              <option value={6}>Medium-Large</option>
              <option value={7}>Medium</option>
              <option value={8}>Medium-Small</option>
              <option value={9}>Small Cells</option>
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <div ref={mapContainer} className="absolute inset-0" />
          {isLoading && !isLoadingMinimized && (
            <div className={`absolute inset-0 flex items-center justify-center ${locations.length > 0 ? 'bg-background/80' : 'bg-muted'}`}>
              <div className="flex flex-col items-center gap-4 max-w-md px-8 bg-card p-6 rounded-lg shadow-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground text-center">{geocodeStatus}</p>
                <Progress value={geocodeProgress} className="w-full" />
                {locations.length > 0 ? (
                  <button onClick={() => setIsLoadingMinimized(true)} className="text-xs text-primary hover:underline text-center cursor-pointer">
                    {locations.length} locations shown. Click to view map while processing...
                  </button>
                ) : <p className="text-xs text-muted-foreground text-center">First load may take a while. Addresses are cached for 24 hours.</p>}
              </div>
            </div>
          )}
          {isLoading && isLoadingMinimized && (
            <div className="absolute bottom-4 right-4 z-[5000] bg-card border rounded-lg shadow-lg p-3 w-64 animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs font-medium">Processing...</span>
                <button onClick={() => setIsLoadingMinimized(false)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Expand</button>
              </div>
              <Progress value={geocodeProgress} className="h-1.5 w-full" />
              <p className="text-[10px] text-muted-foreground mt-1 truncate">{geocodeStatus}</p>
            </div>
          )}
          {!isLoading && locations.length === 0 && dataLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="flex flex-col items-center gap-2 text-center px-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No valid addresses found to display on the map</p>
                <p className="text-xs text-muted-foreground">{geocodeStatus}</p>
              </div>
            </div>
          )}
        </div>

        {selectedData && (
          <div className="w-80 border-l bg-card flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm truncate flex-1">
                {selectedH3Cell ? `Region (${selectedH3Cell.count} contacts)` : selectedLocation?.address}
              </h3>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedLocation(null); setSelectedH3Cell(null); }}><X className="h-4 w-4" /></Button>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {selectedData.companies.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Building2 className="h-3 w-3" /> Companies ({selectedData.companies.length})</h4>
                    <div className="space-y-2">
                      {selectedData.companies.map(company => (
                        <CompanyDetailDialog key={company.id} company={company} persons={persons.filter(p => p.companyId === company.id)} onPersonClick={() => {}} onUpdate={onRefresh}>
                          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{company.name}</p>
                                  <p className="text-xs text-muted-foreground">{persons.filter(p => p.companyId === company.id).length} contacts</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </CompanyDetailDialog>
                      ))}
                    </div>
                  </div>
                )}
                {selectedData.persons.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><User className="h-3 w-3" /> Contacts ({selectedData.persons.length})</h4>
                    <div className="space-y-2">
                      {selectedData.persons.map(person => (
                        <PersonDetailDialog key={person.id} person={person} companyName={getCompanyName(person.companyId)} onUpdate={onRefresh}>
                          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium text-sm truncate">{person.name}</p>
                                  {person.companyId && <Badge variant="secondary" className="text-xs truncate max-w-full">{getCompanyName(person.companyId)}</Badge>}
                                  {person.jobTitle && <p className="text-xs text-muted-foreground truncate">{person.jobTitle}</p>}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </PersonDetailDialog>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t text-xs text-muted-foreground flex justify-between items-center shrink-0">
        <span>Showing {locations.length} location{locations.length !== 1 ? "s" : ""} • Click a marker or hexagon to see details</span>
        {showH3Overlay && locations.length > 0 && (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded" style={{ background: getHexColor(1, maxCellCount) }} /> Low
            <span className="w-3 h-3 rounded" style={{ background: getHexColor(maxCellCount, maxCellCount) }} /> High density
          </span>
        )}
      </div>

      <Dialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-destructive" /> Failed Addresses</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2">
            <p className="text-sm text-muted-foreground mb-4">The following addresses could not be located.</p>
            <div className="space-y-4">
              {failedLocations.map((fail, i) => (
                <Card key={i} className="bg-muted/50">
                  <CardContent className="p-3">
                    <p className="font-medium text-sm text-destructive mb-1">{fail.address}</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {fail.companies.map(c => (
                        <CompanyDetailDialog key={c.id} company={c} persons={persons.filter(p => p.companyId === c.id)} onPersonClick={() => {}} onUpdate={onRefresh}>
                          <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors p-1 rounded hover:bg-background/50">
                            <Building2 className="h-3 w-3" /><span className="underline decoration-dotted">{c.name}</span>
                          </div>
                        </CompanyDetailDialog>
                      ))}
                      {fail.persons.map(p => (
                        <PersonDetailDialog key={p.id} person={p} companyName={getCompanyName(p.companyId)} onUpdate={onRefresh}>
                          <div className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors p-1 rounded hover:bg-background/50">
                            <User className="h-3 w-3" /><span className="underline decoration-dotted">{p.name}</span>
                          </div>
                        </PersonDetailDialog>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MapView() {
  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <MapViewContent />
      </ErrorBoundary>
    </ProtectedRoute>
  );
}
