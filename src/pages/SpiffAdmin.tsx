import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Award, Trophy, DollarSign, Star, Plus, Gift, Users, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Prize {
  id: string;
  name: string;
  description: string | null;
  credits_required: number;
  is_active: boolean;
}

interface SpiffRecord {
  id: string;
  salesman_id: string;
  sale_description: string;
  sale_amount: number;
  credits_earned: number;
  prize_redeemed: string | null;
  redeemed_at: string | null;
  created_at: string;
}

interface SalesmanStats {
  salesman_id: string;
  salesman_name: string;
  total_sales: number;
  total_credits: number;
  available_credits: number;
  prizes_redeemed: number;
}

export default function SpiffAdmin() {
  const { toast } = useToast();
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [spiffRecords, setSpiffRecords] = useState<SpiffRecord[]>([]);
  const [salesmanStats, setSalesmanStats] = useState<SalesmanStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Prize form state
  const [prizeDialogOpen, setPrizeDialogOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [prizeName, setPrizeName] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [prizeCredits, setPrizeCredits] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPrizes(), fetchSpiffRecords()]);
    setLoading(false);
  };

  const fetchPrizes = async () => {
    const { data, error } = await supabase
      .from("spiff_prizes")
      .select("*")
      .order("credits_required", { ascending: true });

    if (error) {
      console.error("Error fetching prizes:", error);
    } else {
      setPrizes(data || []);
    }
  };

  const fetchSpiffRecords = async () => {
    const { data, error } = await supabase
      .from("spiff_program")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching spiff records:", error);
      return;
    }

    setSpiffRecords(data || []);

    // Calculate salesmen stats
    const statsMap = new Map<string, SalesmanStats>();
    
    for (const record of data || []) {
      const existing = statsMap.get(record.salesman_id);
      if (existing) {
        existing.total_sales += Number(record.sale_amount);
        existing.total_credits += record.credits_earned;
        if (!record.prize_redeemed) {
          existing.available_credits += record.credits_earned;
        } else {
          existing.prizes_redeemed += 1;
        }
      } else {
        statsMap.set(record.salesman_id, {
          salesman_id: record.salesman_id,
          salesman_name: record.salesman_id.slice(0, 8), // Will try to get real name
          total_sales: Number(record.sale_amount),
          total_credits: record.credits_earned,
          available_credits: record.prize_redeemed ? 0 : record.credits_earned,
          prizes_redeemed: record.prize_redeemed ? 1 : 0,
        });
      }
    }

    // Try to get salesman names from profiles
    const salesmanIds = Array.from(statsMap.keys());
    if (salesmanIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", salesmanIds);

      if (profiles) {
        for (const profile of profiles) {
          const stats = statsMap.get(profile.user_id);
          if (stats) {
            stats.salesman_name = profile.full_name;
          }
        }
      }
    }

    setSalesmanStats(Array.from(statsMap.values()).sort((a, b) => b.total_sales - a.total_sales));
  };

  const openPrizeDialog = (prize?: Prize) => {
    if (prize) {
      setEditingPrize(prize);
      setPrizeName(prize.name);
      setPrizeDescription(prize.description || "");
      setPrizeCredits(prize.credits_required.toString());
    } else {
      setEditingPrize(null);
      setPrizeName("");
      setPrizeDescription("");
      setPrizeCredits("");
    }
    setPrizeDialogOpen(true);
  };

  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const prizeData = {
      name: prizeName,
      description: prizeDescription || null,
      credits_required: parseInt(prizeCredits),
    };

    if (editingPrize) {
      const { error } = await supabase
        .from("spiff_prizes")
        .update(prizeData)
        .eq("id", editingPrize.id);

      if (error) {
        toast({ title: "Error", description: "Failed to update prize", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Prize updated successfully" });
        setPrizeDialogOpen(false);
        fetchPrizes();
      }
    } else {
      const { error } = await supabase
        .from("spiff_prizes")
        .insert(prizeData);

      if (error) {
        toast({ title: "Error", description: "Failed to create prize", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Prize created successfully" });
        setPrizeDialogOpen(false);
        fetchPrizes();
      }
    }
  };

  const handleTogglePrizeActive = async (prize: Prize) => {
    const { error } = await supabase
      .from("spiff_prizes")
      .update({ is_active: !prize.is_active })
      .eq("id", prize.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update prize", variant: "destructive" });
    } else {
      fetchPrizes();
    }
  };

  const handleDeletePrize = async (prize: Prize) => {
    if (!confirm(`Are you sure you want to delete "${prize.name}"?`)) return;

    const { error } = await supabase
      .from("spiff_prizes")
      .delete()
      .eq("id", prize.id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete prize", variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Prize deleted" });
      fetchPrizes();
    }
  };

  // Calculate totals
  const totalSales = salesmanStats.reduce((sum, s) => sum + s.total_sales, 0);
  const totalCreditsEarned = salesmanStats.reduce((sum, s) => sum + s.total_credits, 0);
  const totalPrizesRedeemed = salesmanStats.reduce((sum, s) => sum + s.prizes_redeemed, 0);

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
            Spiff Program Admin
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage prizes and view salesmen performance
          </p>
        </div>
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
            <p className="text-xs text-muted-foreground">All salesmen combined</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits Earned</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCreditsEarned}</div>
            <p className="text-xs text-muted-foreground">Across all salesmen</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Salesmen</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{salesmanStats.length}</div>
            <p className="text-xs text-muted-foreground">With recorded sales</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prizes Redeemed</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPrizesRedeemed}</div>
            <p className="text-xs text-muted-foreground">Total redemptions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="salesmen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="salesmen" className="gap-2">
            <Users className="h-4 w-4" />
            Salesmen Performance
          </TabsTrigger>
          <TabsTrigger value="prizes" className="gap-2">
            <Gift className="h-4 w-4" />
            Manage Prizes
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Award className="h-4 w-4" />
            All Sales
          </TabsTrigger>
        </TabsList>

        {/* Salesmen Performance Tab */}
        <TabsContent value="salesmen">
          <Card>
            <CardHeader>
              <CardTitle>Salesmen Leaderboard</CardTitle>
              <CardDescription>View performance metrics for all salesmen</CardDescription>
            </CardHeader>
            <CardContent>
              {salesmanStats.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No salesmen data yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Salesman</TableHead>
                      <TableHead className="text-right">Total Sales</TableHead>
                      <TableHead className="text-right">Credits Earned</TableHead>
                      <TableHead className="text-right">Available Credits</TableHead>
                      <TableHead className="text-right">Prizes Redeemed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesmanStats.map((stats, index) => (
                      <TableRow key={stats.salesman_id}>
                        <TableCell>
                          {index === 0 && <Trophy className="h-5 w-5 text-yellow-500 inline" />}
                          {index === 1 && <Trophy className="h-5 w-5 text-gray-400 inline" />}
                          {index === 2 && <Trophy className="h-5 w-5 text-amber-600 inline" />}
                          {index > 2 && <span className="text-muted-foreground">#{index + 1}</span>}
                        </TableCell>
                        <TableCell className="font-medium">{stats.salesman_name}</TableCell>
                        <TableCell className="text-right">${stats.total_sales.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{stats.total_credits}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{stats.available_credits}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{stats.prizes_redeemed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prizes Management Tab */}
        <TabsContent value="prizes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Prize Management</CardTitle>
                  <CardDescription>Add, edit, or remove prizes from the program</CardDescription>
                </div>
                <Dialog open={prizeDialogOpen} onOpenChange={setPrizeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openPrizeDialog()} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Prize
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-background">
                    <DialogHeader>
                      <DialogTitle>{editingPrize ? "Edit Prize" : "Add New Prize"}</DialogTitle>
                      <DialogDescription>
                        {editingPrize ? "Update the prize details" : "Create a new prize for salesmen to redeem"}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSavePrize} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="prize-name">Prize Name</Label>
                        <Input
                          id="prize-name"
                          placeholder="e.g., $50 Gift Card"
                          value={prizeName}
                          onChange={(e) => setPrizeName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prize-description">Description (optional)</Label>
                        <Input
                          id="prize-description"
                          placeholder="e.g., Amazon, Visa, or Target gift card"
                          value={prizeDescription}
                          onChange={(e) => setPrizeDescription(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="prize-credits">Credits Required</Label>
                        <Input
                          id="prize-credits"
                          type="number"
                          min="1"
                          placeholder="e.g., 10"
                          value={prizeCredits}
                          onChange={(e) => setPrizeCredits(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full">
                        {editingPrize ? "Update Prize" : "Create Prize"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {prizes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No prizes created yet.</p>
                  <p className="text-sm">Click "Add Prize" to create your first prize!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prize Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Credits Required</TableHead>
                      <TableHead className="text-center">Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prizes.map((prize) => (
                      <TableRow key={prize.id}>
                        <TableCell className="font-medium">{prize.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {prize.description || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{prize.credits_required}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={prize.is_active}
                            onCheckedChange={() => handleTogglePrizeActive(prize)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPrizeDialog(prize)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePrize(prize)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Sales History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>All Sales History</CardTitle>
              <CardDescription>Complete history of all sales across all salesmen</CardDescription>
            </CardHeader>
            <CardContent>
              {spiffRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sales recorded yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Salesman</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spiffRecords.map((record) => {
                      const salesman = salesmanStats.find(s => s.salesman_id === record.salesman_id);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(new Date(record.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {salesman?.salesman_name || record.salesman_id.slice(0, 8)}
                          </TableCell>
                          <TableCell>{record.sale_description}</TableCell>
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
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
