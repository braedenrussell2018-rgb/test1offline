import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Award, Trophy, DollarSign, Star, Plus, Gift, Users, Pencil, Trash2, Clock, CheckCircle, XCircle, AlertCircle, Check, X } from "lucide-react";
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
  serial_number: string | null;
  sale_amount: number;
  credits_earned: number;
  prize_redeemed: string | null;
  redeemed_at: string | null;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'adjusted';
  approved_by: string | null;
  approved_at: string | null;
  adjusted_amount: number | null;
  adjusted_credits: number | null;
  admin_notes: string | null;
}

interface SalesmanStats {
  salesman_id: string;
  salesman_name: string;
  total_sales: number;
  total_credits: number;
  available_credits: number;
  prizes_redeemed: number;
  pending_sales: number;
}

export default function SpiffAdmin() {
  const { user } = useAuth();
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

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SpiffRecord | null>(null);
  const [adjustedAmount, setAdjustedAmount] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  // Profile cache for salesman names
  const [profileCache, setProfileCache] = useState<Map<string, string>>(new Map());

  const pendingRecords = spiffRecords.filter(r => r.status === 'pending');

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

    setSpiffRecords((data || []) as SpiffRecord[]);

    // Calculate salesmen stats (only approved/adjusted records count)
    const statsMap = new Map<string, SalesmanStats>();
    
    for (const record of (data || []) as SpiffRecord[]) {
      const existing = statsMap.get(record.salesman_id);
      const isApproved = record.status === 'approved' || record.status === 'adjusted';
      const amount = record.adjusted_amount ?? Number(record.sale_amount);
      const credits = record.adjusted_credits ?? record.credits_earned;
      
      if (existing) {
        if (isApproved) {
          existing.total_sales += amount;
          existing.total_credits += credits;
          if (!record.prize_redeemed) {
            existing.available_credits += credits;
          } else {
            existing.prizes_redeemed += 1;
          }
        }
        if (record.status === 'pending') {
          existing.pending_sales += 1;
        }
      } else {
        statsMap.set(record.salesman_id, {
          salesman_id: record.salesman_id,
          salesman_name: record.salesman_id.slice(0, 8),
          total_sales: isApproved ? amount : 0,
          total_credits: isApproved ? credits : 0,
          available_credits: isApproved && !record.prize_redeemed ? credits : 0,
          prizes_redeemed: isApproved && record.prize_redeemed ? 1 : 0,
          pending_sales: record.status === 'pending' ? 1 : 0,
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

      const newCache = new Map(profileCache);
      if (profiles) {
        for (const profile of profiles) {
          const stats = statsMap.get(profile.user_id);
          if (stats) {
            stats.salesman_name = profile.full_name;
          }
          newCache.set(profile.user_id, profile.full_name);
        }
      }
      setProfileCache(newCache);
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

  const openApprovalDialog = (record: SpiffRecord) => {
    setSelectedRecord(record);
    setAdjustedAmount(record.sale_amount.toString());
    setAdminNotes("");
    setApprovalDialogOpen(true);
  };

  const handleApprove = async (adjust: boolean = false) => {
    if (!selectedRecord || !user) return;

    const amount = parseFloat(adjustedAmount);
    const isAdjusted = adjust && amount !== Number(selectedRecord.sale_amount);
    const newCredits = Math.floor(amount / 100);

    const updateData: Record<string, unknown> = {
      status: isAdjusted ? 'adjusted' : 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      admin_notes: adminNotes || null,
    };

    if (isAdjusted) {
      updateData.adjusted_amount = amount;
      updateData.adjusted_credits = newCredits;
    }

    const { error: updateError } = await supabase
      .from("spiff_program")
      .update(updateData)
      .eq("id", selectedRecord.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to approve sale", variant: "destructive" });
      return;
    }

    // Create warranty record
    const warrantyEndDate = new Date();
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 12);

    const { error: warrantyError } = await supabase
      .from("spiff_warranties")
      .insert({
        spiff_sale_id: selectedRecord.id,
        serial_number: selectedRecord.serial_number || '',
        sale_description: selectedRecord.sale_description,
        salesman_id: selectedRecord.salesman_id,
        warranty_start_date: new Date().toISOString(),
        warranty_months: 12,
        warranty_end_date: warrantyEndDate.toISOString(),
      });

    if (warrantyError) {
      console.error("Error creating warranty:", warrantyError);
      // Don't fail the whole operation if warranty creation fails
    }

    toast({ 
      title: "Sale Approved!", 
      description: isAdjusted 
        ? `Sale adjusted to $${amount.toLocaleString()} (${newCredits} credits) and 12-month warranty started.`
        : `Sale approved with ${selectedRecord.credits_earned} credits and 12-month warranty started.`
    });
    setApprovalDialogOpen(false);
    fetchSpiffRecords();
  };

  const handleReject = async () => {
    if (!selectedRecord || !user) return;

    const { error } = await supabase
      .from("spiff_program")
      .update({
        status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        admin_notes: adminNotes || null,
      })
      .eq("id", selectedRecord.id);

    if (error) {
      toast({ title: "Error", description: "Failed to reject sale", variant: "destructive" });
    } else {
      toast({ title: "Sale Rejected", description: "The sale has been rejected." });
      setApprovalDialogOpen(false);
      fetchSpiffRecords();
    }
  };

  const handleQuickApprove = async (record: SpiffRecord) => {
    if (!user) return;

    const { error: updateError } = await supabase
      .from("spiff_program")
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    if (updateError) {
      toast({ title: "Error", description: "Failed to approve sale", variant: "destructive" });
      return;
    }

    // Create warranty record
    const warrantyEndDate = new Date();
    warrantyEndDate.setMonth(warrantyEndDate.getMonth() + 12);

    await supabase
      .from("spiff_warranties")
      .insert({
        spiff_sale_id: record.id,
        serial_number: record.serial_number || '',
        sale_description: record.sale_description,
        salesman_id: record.salesman_id,
        warranty_start_date: new Date().toISOString(),
        warranty_months: 12,
        warranty_end_date: warrantyEndDate.toISOString(),
      });

    toast({ title: "Approved!", description: `Sale approved with ${record.credits_earned} credits. 12-month warranty started.` });
    fetchSpiffRecords();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300 bg-yellow-50">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
            <CheckCircle className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'adjusted':
        return (
          <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 bg-blue-50">
            <AlertCircle className="h-3 w-3" />
            Adjusted
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="gap-1 text-red-600 border-red-300 bg-red-50">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Calculate totals (only approved/adjusted)
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
            Manage prizes, approve sales, and view salesmen performance
          </p>
        </div>
      </div>

      {/* Pending Notice */}
      {pendingRecords.length > 0 && (
        <Card className="mb-6 border-yellow-300 bg-yellow-50/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">
                    {pendingRecords.length} sale{pendingRecords.length > 1 ? 's' : ''} awaiting approval
                  </p>
                  <p className="text-sm text-yellow-700">
                    Review and approve or adjust sales before credits are applied.
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="border-yellow-300 text-yellow-800 hover:bg-yellow-100"
                onClick={() => {
                  const tabsList = document.querySelector('[role="tablist"]');
                  const pendingTab = tabsList?.querySelector('[value="pending"]') as HTMLButtonElement;
                  pendingTab?.click();
                }}
              >
                Review Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All salesmen combined</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Earned</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCreditsEarned}</div>
            <p className="text-xs text-muted-foreground">Across all salesmen</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingRecords.length}</div>
            <p className="text-xs text-muted-foreground">Sales to review</p>
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

      <Tabs defaultValue={pendingRecords.length > 0 ? "pending" : "salesmen"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending Approval
            {pendingRecords.length > 0 && (
              <Badge variant="destructive" className="ml-1">{pendingRecords.length}</Badge>
            )}
          </TabsTrigger>
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

        {/* Pending Approval Tab */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Sales Pending Approval</CardTitle>
              <CardDescription>Review and approve or adjust submitted sales before credits are applied</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p>No sales pending approval!</p>
                  <p className="text-sm">All submitted sales have been reviewed.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Salesman</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRecords.map((record) => {
                      const salesmanName = profileCache.get(record.salesman_id) || record.salesman_id.slice(0, 8);
                      return (
                        <TableRow key={record.id}>
                          <TableCell>
                            {format(new Date(record.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">{salesmanName}</TableCell>
                          <TableCell>{record.sale_description}</TableCell>
                          <TableCell className="font-mono text-sm">{record.serial_number || "-"}</TableCell>
                          <TableCell className="text-right">
                            ${Number(record.sale_amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            +{record.credits_earned}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => handleQuickApprove(record)}
                              >
                                <Check className="h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openApprovalDialog(record)}
                              >
                                <Pencil className="h-4 w-4" />
                                Adjust
                              </Button>
                            </div>
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

        {/* Salesmen Performance Tab */}
        <TabsContent value="salesmen">
          <Card>
            <CardHeader>
              <CardTitle>Salesmen Leaderboard</CardTitle>
              <CardDescription>View performance metrics for all salesmen (approved sales only)</CardDescription>
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
                      <TableHead className="text-right">Approved Sales</TableHead>
                      <TableHead className="text-right">Credits Earned</TableHead>
                      <TableHead className="text-right">Available Credits</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Prizes</TableHead>
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
                        <TableCell className="text-right">
                          {stats.pending_sales > 0 ? (
                            <Badge variant="outline" className="text-yellow-600">{stats.pending_sales}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
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
                      <TableHead>Serial Number</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spiffRecords.map((record) => {
                      const salesmanName = profileCache.get(record.salesman_id) || record.salesman_id.slice(0, 8);
                      const displayAmount = record.adjusted_amount ?? Number(record.sale_amount);
                      const displayCredits = record.adjusted_credits ?? record.credits_earned;
                      
                      return (
                        <TableRow key={record.id} className={record.status === 'rejected' ? 'opacity-50' : ''}>
                          <TableCell>
                            {format(new Date(record.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="font-medium">{salesmanName}</TableCell>
                          <TableCell>
                            <div>
                              {record.sale_description}
                              {record.admin_notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Note: {record.admin_notes}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{record.serial_number || "-"}</TableCell>
                          <TableCell className="text-right">
                            ${displayAmount.toLocaleString()}
                            {record.status === 'adjusted' && record.adjusted_amount !== null && (
                              <p className="text-xs text-muted-foreground line-through">
                                ${Number(record.sale_amount).toLocaleString()}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {record.status === 'rejected' ? (
                              <span className="text-destructive">0</span>
                            ) : (
                              <>
                                +{displayCredits}
                                {record.status === 'adjusted' && record.adjusted_credits !== null && record.adjusted_credits !== record.credits_earned && (
                                  <p className="text-xs text-muted-foreground line-through">
                                    +{record.credits_earned}
                                  </p>
                                )}
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.prize_redeemed ? (
                              <Badge variant="secondary" className="gap-1">
                                <Gift className="h-3 w-3" />
                                {record.prize_redeemed}
                              </Badge>
                            ) : (
                              getStatusBadge(record.status)
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

      {/* Approval/Adjust Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Review Sale</DialogTitle>
            <DialogDescription>
              Approve, adjust, or reject this sale submission.
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><strong>Salesman:</strong> {profileCache.get(selectedRecord.salesman_id) || selectedRecord.salesman_id.slice(0, 8)}</p>
                <p><strong>Description:</strong> {selectedRecord.sale_description}</p>
                <p><strong>Serial Number:</strong> {selectedRecord.serial_number || "N/A"}</p>
                <p><strong>Original Amount:</strong> ${Number(selectedRecord.sale_amount).toLocaleString()}</p>
                <p><strong>Original Credits:</strong> {selectedRecord.credits_earned}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjusted-amount">Sale Amount ($)</Label>
                <Input
                  id="adjusted-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={adjustedAmount}
                  onChange={(e) => setAdjustedAmount(e.target.value)}
                />
                {adjustedAmount && (
                  <p className="text-sm text-muted-foreground">
                    Credits: <span className="font-semibold">{Math.floor(parseFloat(adjustedAmount) / 100)}</span>
                    {parseFloat(adjustedAmount) !== Number(selectedRecord.sale_amount) && (
                      <span className="text-blue-600 ml-2">(adjusted from {selectedRecord.credits_earned})</span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-notes">Notes (optional)</Label>
                <Textarea
                  id="admin-notes"
                  placeholder="Add a note explaining any adjustments or rejections..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
            <Button
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleApprove(true)}
              className="gap-1"
            >
              <Check className="h-4 w-4" />
              {parseFloat(adjustedAmount) !== Number(selectedRecord?.sale_amount) ? "Approve with Adjustments" : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
