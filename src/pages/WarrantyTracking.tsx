import { useState, useEffect } from "react";
import { inventoryStorage, InventoryItem } from "@/lib/inventory-storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { toast } from "sonner";

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
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadItems = async () => {
        setLoading(true);
        try {
            const allItems = await inventoryStorage.getItems();

            const warrantyItems = allItems.filter(item => {
                const warrantyVal = item.warranty ? parseInt(item.warranty.replace(/[^0-9]/g, "")) : 0;
                return item.status === 'sold' && item.soldDate && warrantyVal > 0;
            });
            setItems(warrantyItems);
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

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b bg-card">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Warranty Tracking</h1>
                            <p className="text-muted-foreground mt-1">Monitor active warranties for sold items</p>
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
                {loading ? (
                    <div className="flex justify-center p-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : items.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center p-12">
                            <ShieldCheck className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-lg font-medium">No items currently under warranty</p>
                            <p className="text-muted-foreground text-center max-w-sm">
                                When an item with a warranty is sold, it will appear here to track its remaining coverage.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => {
                            const expiryDate = calculateExpiry(item.soldDate!, item.warranty!);
                            const isExpired = expiryDate < new Date();

                            return (
                                <Card key={item.id} className={isExpired ? "opacity-75" : "hover:shadow-md transition-shadow"}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle className="text-lg">{item.partNumber}</CardTitle>
                                                <p className="text-sm text-muted-foreground">SN: {item.serialNumber || 'N/A'}</p>
                                            </div>
                                            <Badge variant={isExpired ? "destructive" : "outline"}>
                                                {isExpired ? "Expired" : "Active"}
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
                                                <span className="text-muted-foreground">Warranty Length:</span>
                                                <span>{item.warranty}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-muted-foreground">Expires On:</span>
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
