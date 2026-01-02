import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Award, Trophy, DollarSign, Star, Plus, Gift, Eye } from "lucide-react";
import { format } from "date-fns";

interface SpiffRecord {
  id: string;
  salesman_id: string;
  salesman_name?: string;
  sale_description: string;
  serial_number: string | null;
  sale_amount: number;
  credits_earned: number;
  prize_redeemed: string | null;
  redeemed_at: string | null;
  created_at: string;
}

interface Prize {
  id: string;
  name: string;
  description: string | null;
  credits_required: number;
}

export default function SpiffProgram() {
  const { user } = useAuth();
  const { isOwner, isSalesman } = useUserRole();
  const { toast } = useToast();
  const [spiffRecords, setSpiffRecords] = useState<SpiffRecord[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  
  // Form state for adding sales
  const [saleDescription, setSaleDescription] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [saleAmount, setSaleAmount] = useState("");

  const totalCredits = spiffRecords.reduce((sum, record) => sum + record.credits_earned, 0);
  const redeemedCredits = spiffRecords
    .filter(r => r.prize_redeemed)
    .reduce((sum, record) => sum + record.credits_earned, 0);
  const availableCredits = totalCredits - redeemedCredits;
  const totalSales = spiffRecords.reduce((sum, record) => sum + Number(record.sale_amount), 0);

  useEffect(() => {
    fetchSpiffRecords();
    fetchPrizes();
  }, [user]);

  const fetchSpiffRecords = async () => {
    if (!user) return;
    
    // Owners see all records, salesmen see only their own
    let query = supabase.from("spiff_program").select("*");
    
    if (isSalesman()) {
      query = query.eq("salesman_id", user.id);
    }
    
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching spiff records:", error);
      setSpiffRecords([]);
    } else {
      // For owners, fetch salesman names
      if (isOwner() && data && data.length > 0) {
        const uniqueSalesmanIds = [...new Set(data.map(r => r.salesman_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", uniqueSalesmanIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        const recordsWithNames = data.map(record => ({
          ...record,
          salesman_name: profileMap.get(record.salesman_id) || "Unknown"
        }));
        setSpiffRecords(recordsWithNames);
      } else {
        setSpiffRecords(data || []);
      }
    }
    setLoading(false);
  };

  const fetchPrizes = async () => {
    const { data, error } = await supabase
      .from("spiff_prizes")
      .select("*")
      .eq("is_active", true)
      .order("credits_required", { ascending: true });

    if (error) {
      console.error("Error fetching prizes:", error);
    } else {
      setPrizes(data || []);
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !saleDescription || !serialNumber || !saleAmount) return;

    const amount = parseFloat(saleAmount);
    // Calculate credits: 1 credit per $100 in sales
    const creditsEarned = Math.floor(amount / 100);

    const { error } = await supabase
      .from("spiff_program")
      .insert({
        salesman_id: user.id,
        sale_description: saleDescription,
        serial_number: serialNumber.trim(),
        sale_amount: amount,
        credits_earned: creditsEarned,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add sale record",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success!",
        description: `Sale recorded! You earned ${creditsEarned} credits.`,
      });
      setSaleDescription("");
      setSerialNumber("");
      setSaleAmount("");
      setAddDialogOpen(false);
      fetchSpiffRecords();
    }
  };

  const handleRedeemPrize = async (prize: Prize) => {
    if (availableCredits < prize.credits_required) {
      toast({
        title: "Not enough credits",
        description: `You need ${prize.credits_required - availableCredits} more credits to redeem this prize.`,
        variant: "destructive",
      });
      return;
    }

    // Find the oldest unredeemed records to mark as redeemed
    const unredeemedRecords = spiffRecords.filter(r => !r.prize_redeemed);
    let creditsToMark = prize.credits_required;
    
    for (const record of unredeemedRecords) {
      if (creditsToMark <= 0) break;
      
      const { error } = await supabase
        .from("spiff_program")
        .update({
          prize_redeemed: prize.name,
          redeemed_at: new Date().toISOString(),
        })
        .eq("id", record.id);

      if (error) {
        console.error("Error redeeming:", error);
      }
      
      creditsToMark -= record.credits_earned;
    }

    toast({
      title: "Prize Redeemed! 🎉",
      description: `You've successfully redeemed: ${prize.name}`,
    });
    setRedeemDialogOpen(false);
    fetchSpiffRecords();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 pt-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Spiff Program
            {isOwner() && (
              <Badge variant="outline" className="ml-2 gap-1">
                <Eye className="h-3 w-3" />
                Owner View
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isOwner() 
              ? "View all salesmen's sales and credits" 
              : "Track your sales and earn credits for prizes!"}
          </p>
        </div>
        {/* Only salesmen can add sales */}
        {isSalesman() && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Sale
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Record a Sale</DialogTitle>
                <DialogDescription>
                  Add your sale details to earn credits. You earn 1 credit for every $100 in sales.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddSale} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sale-description">Sale Description</Label>
                  <Input
                    id="sale-description"
                    placeholder="e.g., Excavator parts for ABC Company"
                    value={saleDescription}
                    onChange={(e) => setSaleDescription(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial-number">Attachment Serial Number</Label>
                  <Input
                    id="serial-number"
                    placeholder="e.g., SN-12345-ABC"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sale-amount">Sale Amount ($)</Label>
                  <Input
                    id="sale-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={saleAmount}
                    onChange={(e) => setSaleAmount(e.target.value)}
                    required
                  />
                  {saleAmount && (
                    <p className="text-sm text-muted-foreground">
                      You'll earn <span className="font-semibold text-primary">{Math.floor(parseFloat(saleAmount) / 100)}</span> credits
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Record Sale
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Lifetime sales</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCredits}</div>
            <p className="text-xs text-muted-foreground">Credits earned</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Credits</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{availableCredits}</div>
            <p className="text-xs text-muted-foreground">Ready to redeem</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prizes Redeemed</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {spiffRecords.filter(r => r.prize_redeemed).length}
            </div>
            <p className="text-xs text-muted-foreground">Total redemptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Prizes Section - only for salesmen */}
      {isSalesman() && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Available Prizes
                </CardTitle>
                <CardDescription>Redeem your credits for awesome prizes</CardDescription>
              </div>
              <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Gift className="h-4 w-4" />
                    Redeem Prize
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-background max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Redeem a Prize</DialogTitle>
                    <DialogDescription>
                      You have <span className="font-bold text-primary">{availableCredits}</span> credits available
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    {prizes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No prizes available at the moment. Check back later!
                      </p>
                    ) : (
                      prizes.map((prize) => (
                        <div
                          key={prize.id}
                          className={`flex items-center justify-between p-4 border rounded-lg ${
                            availableCredits >= prize.credits_required
                              ? "border-primary bg-primary/5"
                              : "opacity-50"
                          }`}
                        >
                          <div>
                            <h4 className="font-semibold">{prize.name}</h4>
                            {prize.description && (
                              <p className="text-sm text-muted-foreground">{prize.description}</p>
                            )}
                            <Badge variant="secondary" className="mt-2">
                              {prize.credits_required} credits
                            </Badge>
                          </div>
                          <Button
                            onClick={() => handleRedeemPrize(prize)}
                            disabled={availableCredits < prize.credits_required}
                          >
                            Redeem
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {prizes.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No prizes configured yet. Ask your manager to add prizes to the program.
              </p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {prizes.map((prize) => (
                  <div
                    key={prize.id}
                    className="flex items-center gap-2 px-4 py-2 border rounded-full"
                  >
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{prize.name}</span>
                    <Badge variant="secondary">{prize.credits_required} credits</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales History */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
          <CardDescription>
            {isOwner() ? "All salesmen's recorded sales" : "Your recorded sales and earned credits"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {spiffRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No sales recorded yet.</p>
              {isSalesman() && <p className="text-sm">Click "Add Sale" to record your first sale!</p>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {isOwner() && <TableHead>Salesman</TableHead>}
                  <TableHead>Description</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spiffRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.created_at), "MMM d, yyyy")}
                    </TableCell>
                    {isOwner() && <TableCell>{record.salesman_name || "Unknown"}</TableCell>}
                    <TableCell>{record.sale_description}</TableCell>
                    <TableCell className="font-mono text-sm">{record.serial_number || "-"}</TableCell>
                    <TableCell className="text-right">
                      ${Number(record.sale_amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      +{record.credits_earned}
                    </TableCell>
                    <TableCell>
                      {record.prize_redeemed ? (
                        <Badge variant="secondary" className="gap-1">
                          <Gift className="h-3 w-3" />
                          {record.prize_redeemed}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600">
                          Available
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
