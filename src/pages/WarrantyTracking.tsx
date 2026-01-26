import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { inventoryStorage, InventoryItem } from "@/lib/inventory-storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, ShieldCheck, ShieldAlert, RefreshCw, Package, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { toast } from "sonner";

interface SpiffWarranty {
  id: string;
  spiff_sale_id: string;
  serial_number: string;
  sale_description: string;
  salesman_id: string;
  warranty_start_date: string;
  warranty_months: number;
  warranty_end_date: string;
  created_at: string;
}

const WarrantyCountdown = ({ expiryDate }: { expiryDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const difference = expiryDate.getTime() - now.getTime();

            if (difference <= 0) {
                setTimeLeft("Expired");
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);

            if (days > 0) {
                setTimeLeft(`${days}d ${hours}h left`);
            } else {
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                setTimeLeft(`${hours}h ${minutes}m left`);
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 60000);

        return () => clearInterval(timer);
    }, [expiryDate]);

    const isExpired = timeLeft === "Expired";
    const isExpiringSoon = timeLeft.includes("d") && parseInt(timeLeft) < 30;

    return (
        <div className={`flex items-center gap-2 font-medium ${isExpired ? 'text-destructive' : isExpiringSoon ? 'text-orange-500' : 'text-green-600'}`}>
            {isExpired ? <ShieldAlert className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {timeLeft}
        </div>
    );
};

function WarrantyTrackingContent() {
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [spiffWarranties, setSpiffWarranties] = useState<SpiffWarranty[]>([]);
    const [salesmanNames, setSalesmanNames] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState(true);

    const loadItems = async () => {
        setLoading(true);
        try {
            // Load inventory warranties
            const allItems = await inventoryStorage.getItems();
            const warrantyItems = allItems.filter(item => {
                const warrantyVal = item.warranty ? parseInt(item.warranty.replace(/[^0-9]/g, "")) : 0;
                return item.status === 'sold' && item.soldDate && warrantyVal > 0;
            });
            setInventoryItems(warrantyItems);

            // Load spiff warranties
            const { data: spiffData, error: spiffError } = await supabase
                .from("spiff_warranties")
                .select("*")
                .order("warranty_end_date", { ascending: true });

            if (spiffError) {
                console.error("Error loading spiff warranties:", spiffError);
            } else {
                setSpiffWarranties(spiffData || []);

                // Fetch salesman names
                const salesmanIds = [...new Set((spiffData || []).map(w => w.salesman_id))];
                if (salesmanIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from("profiles")
                        .select("user_id, full_name")
                        .in("user_id", salesmanIds);

                    const nameMap = new Map<string, string>();
                    if (profiles) {
                        profiles.forEach(p => nameMap.set(p.user_id, p.full_name));
                    }
                    setSalesmanNames(nameMap);
                }
            }
        } catch (error) {
            console.error("Error loading warranty items:", error);
            toast.error("Failed to load warranty data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, []);

    const calculateExpiry = (soldDate: string, warranty: string) => {
        const date = new Date(soldDate);
        const months = parseInt(warranty.replace(/[^0-9]/g, ""));
        date.setMonth(date.getMonth() + months);
        return date;
    };

    const activeInventoryWarranties = inventoryItems.filter(item => {
        const expiryDate = calculateExpiry(item.soldDate!, item.warranty!);
        return expiryDate >= new Date();
    });

    const expiredInventoryWarranties = inventoryItems.filter(item => {
        const expiryDate = calculateExpiry(item.soldDate!, item.warranty!);
        return expiryDate < new Date();
    });

    const activeSpiffWarranties = spiffWarranties.filter(w => new Date(w.warranty_end_date) >= new Date());
    const expiredSpiffWarranties = spiffWarranties.filter(w => new Date(w.warranty_end_date) < new Date());

    const totalActive = activeInventoryWarranties.length + activeSpiffWarranties.length;
    const totalExpired = expiredInventoryWarranties.length + expiredSpiffWarranties.length;

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b bg-card">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Warranty Tracking</h1>
                            <p className="text-muted-foreground mt-1">Monitor active warranties for sold items and spiff program sales</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadItems}
                            disabled={loading}
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Active Warranties</CardTitle>
                            <ShieldCheck className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{totalActive}</div>
                            <p className="text-xs text-muted-foreground">Currently under warranty</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Expired Warranties</CardTitle>
                            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalExpired}</div>
                            <p className="text-xs text-muted-foreground">Warranty period ended</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Spiff Program Sales</CardTitle>
                            <Trophy className="h-4 w-4 text-yellow-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{spiffWarranties.length}</div>
                            <p className="text-xs text-muted-foreground">12-month warranties from sales</p>
                        </CardContent>
                    </Card>
                </div>

                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : totalActive === 0 && totalExpired === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center p-12">
                            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium">No items currently under warranty</p>
                            <p className="text-muted-foreground text-center max-w-sm">
                                When an item with a warranty is sold or a spiff sale is approved, it will appear here to track its remaining coverage.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <Tabs defaultValue="spiff" className="space-y-4">
                        <TabsList>
                            <TabsTrigger value="spiff" className="gap-2">
                                <Trophy className="h-4 w-4" />
                                Spiff Sales
                                {activeSpiffWarranties.length > 0 && (
                                    <Badge variant="secondary" className="ml-1">{activeSpiffWarranties.length}</Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="inventory" className="gap-2">
                                <Package className="h-4 w-4" />
                                Inventory Items
                                {activeInventoryWarranties.length > 0 && (
                                    <Badge variant="secondary" className="ml-1">{activeInventoryWarranties.length}</Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="expired" className="gap-2">
                                <ShieldAlert className="h-4 w-4" />
                                Expired
                                {totalExpired > 0 && (
                                    <Badge variant="outline" className="ml-1">{totalExpired}</Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* Spiff Program Warranties */}
                        <TabsContent value="spiff">
                            {activeSpiffWarranties.length === 0 ? (
                                <Card>
                                    <CardContent className="flex flex-col items-center justify-center p-12">
                                        <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                                        <p className="text-lg font-medium">No active spiff warranties</p>
                                        <p className="text-muted-foreground text-center max-w-sm">
                                            When a spiff sale is approved, a 12-month warranty will start and appear here.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {activeSpiffWarranties.map((warranty) => {
                                        const expiryDate = new Date(warranty.warranty_end_date);
                                        const startDate = new Date(warranty.warranty_start_date);

                                        return (
                                            <Card key={warranty.id} className="hover:shadow-md transition-shadow">
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-lg flex items-center gap-2">
                                                                <Trophy className="h-4 w-4 text-yellow-500" />
                                                                {warranty.serial_number || 'No Serial'}
                                                            </CardTitle>
                                                            <p className="text-sm text-muted-foreground">
                                                                {salesmanNames.get(warranty.salesman_id) || 'Unknown Salesman'}
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline" className="text-green-600 border-green-300">
                                                            Active
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <p className="text-sm line-clamp-2 min-h-[2.5rem]">{warranty.sale_description}</p>

                                                    <div className="space-y-2 pt-2 border-t">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Started:</span>
                                                            <span>{startDate.toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Warranty:</span>
                                                            <span>{warranty.warranty_months} months</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Expires:</span>
                                                            <span>{expiryDate.toLocaleDateString()}</span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-2">
                                                        <WarrantyCountdown expiryDate={expiryDate} />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        {/* Inventory Item Warranties */}
                        <TabsContent value="inventory">
                            {activeInventoryWarranties.length === 0 ? (
                                <Card>
                                    <CardContent className="flex flex-col items-center justify-center p-12">
                                        <Package className="h-12 w-12 text-muted-foreground mb-4" />
                                        <p className="text-lg font-medium">No active inventory warranties</p>
                                        <p className="text-muted-foreground text-center max-w-sm">
                                            When an inventory item with a warranty is sold, it will appear here.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {activeInventoryWarranties.map((item) => {
                                        const expiryDate = calculateExpiry(item.soldDate!, item.warranty!);

                                        return (
                                            <Card key={item.id} className="hover:shadow-md transition-shadow">
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-lg">{item.partNumber}</CardTitle>
                                                            <p className="text-sm text-muted-foreground">SN: {item.serialNumber || 'N/A'}</p>
                                                        </div>
                                                        <Badge variant="outline" className="text-green-600 border-green-300">
                                                            Active
                                                        </Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <p className="text-sm line-clamp-2 min-h-[2.5rem]">{item.description}</p>

                                                    <div className="space-y-2 pt-2 border-t">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Sold On:</span>
                                                            <span>{new Date(item.soldDate!).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Warranty:</span>
                                                            <span>{item.warranty}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Expires:</span>
                                                            <span>{expiryDate.toLocaleDateString()}</span>
                                                        </div>
                                                    </div>

                                                    <div className="pt-2">
                                                        <WarrantyCountdown expiryDate={expiryDate} />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        {/* Expired Warranties */}
                        <TabsContent value="expired">
                            {totalExpired === 0 ? (
                                <Card>
                                    <CardContent className="flex flex-col items-center justify-center p-12">
                                        <ShieldCheck className="h-12 w-12 text-green-500 mb-4" />
                                        <p className="text-lg font-medium">No expired warranties</p>
                                        <p className="text-muted-foreground text-center max-w-sm">
                                            All warranties are still active.
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {/* Expired Spiff Warranties */}
                                    {expiredSpiffWarranties.map((warranty) => {
                                        const expiryDate = new Date(warranty.warranty_end_date);

                                        return (
                                            <Card key={warranty.id} className="opacity-75">
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-lg flex items-center gap-2">
                                                                <Trophy className="h-4 w-4 text-yellow-500" />
                                                                {warranty.serial_number || 'No Serial'}
                                                            </CardTitle>
                                                            <p className="text-sm text-muted-foreground">
                                                                {salesmanNames.get(warranty.salesman_id) || 'Unknown'}
                                                            </p>
                                                        </div>
                                                        <Badge variant="destructive">Expired</Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <p className="text-sm line-clamp-2 min-h-[2.5rem]">{warranty.sale_description}</p>
                                                    <div className="space-y-2 pt-2 border-t">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Expired:</span>
                                                            <span>{expiryDate.toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2">
                                                        <WarrantyCountdown expiryDate={expiryDate} />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}

                                    {/* Expired Inventory Warranties */}
                                    {expiredInventoryWarranties.map((item) => {
                                        const expiryDate = calculateExpiry(item.soldDate!, item.warranty!);

                                        return (
                                            <Card key={item.id} className="opacity-75">
                                                <CardHeader className="pb-2">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <CardTitle className="text-lg">{item.partNumber}</CardTitle>
                                                            <p className="text-sm text-muted-foreground">SN: {item.serialNumber || 'N/A'}</p>
                                                        </div>
                                                        <Badge variant="destructive">Expired</Badge>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <p className="text-sm line-clamp-2 min-h-[2.5rem]">{item.description}</p>
                                                    <div className="space-y-2 pt-2 border-t">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Expired:</span>
                                                            <span>{expiryDate.toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="pt-2">
                                                        <WarrantyCountdown expiryDate={expiryDate} />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    );
}

export default function WarrantyTracking() {
    return (
        <ProtectedRoute>
            <ErrorBoundary>
                <WarrantyTrackingContent />
            </ErrorBoundary>
        </ProtectedRoute>
    );
}
