import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Award, Trophy, DollarSign, Star, Plus, Gift, Clock, CheckCircle, XCircle, AlertCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDebouncedSearch } from "@/hooks/useDebounce";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/inventory/PaginationControls";
import { EmptyState } from "@/components/EmptyState";

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
  adjusted_amount: number | null;
  adjusted_credits: number | null;
  admin_notes: string | null;
  approved_at: string | null;
}

interface Prize {
  id: string;
  name: string;
  description: string | null;
  credits_required: number;
}

function SpiffSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4 pt-20">
      <div className="flex items-center justify-between mb-8">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
      </div>
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
      </div>
      <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
    </div>
  );
}

function SpiffProgramContent() {
  const { user } = useAuth();
  const { hasInternalAccess } = useUserRole();
  const { toast } = useToast();
  const [spiffRecords, setSpiffRecords] = useState<SpiffRecord[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [saleDescription, setSaleDescription] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const { searchQuery, debouncedQuery, setSearchQuery } = useDebouncedSearch("", 300);

  const approvedRecords = spiffRecords.filter(r => r.status === 'approved' || r.status === 'adjusted');
  const totalCredits = approvedRecords.reduce((sum, record) => sum + (record.adjusted_credits ?? record.credits_earned), 0);
  const redeemedCredits = approvedRecords.filter(r => r.prize_redeemed).reduce((sum, record) => sum + (record.adjusted_credits ?? record.credits_earned), 0);
  const availableCredits = totalCredits - redeemedCredits;
  const totalSales = approvedRecords.reduce((sum, record) => sum + (record.adjusted_amount ?? Number(record.sale_amount)), 0);
  const pendingRecords = spiffRecords.filter(r => r.status === 'pending');

  // Filter and paginate
  const q = debouncedQuery.toLowerCase();
  const filteredRecords = q ? spiffRecords.filter(r =>
    r.sale_description.toLowerCase().includes(q) ||
    r.serial_number?.toLowerCase().includes(q) ||
    r.status.includes(q)
  ) : spiffRecords;
  const pagination = usePagination(filteredRecords, { initialPageSize: 25 });

  useEffect(() => {
    fetchSpiffRecords();
    fetchPrizes();
  }, [user]);

  const fetchSpiffRecords = async () => {
    if (!user) return;
    let query = supabase.from("spiff_program").select("*").order("created_at", { ascending: false });
    if (!hasInternalAccess()) query = query.eq("salesman_id", user.id);
    const { data, error } = await query;
    if (error) { console.error("Error fetching spiff records:", error); setSpiffRecords([]); }
    else setSpiffRecords((data || []) as SpiffRecord[]);
    setLoading(false);
  };

  const fetchPrizes = async () => {
    const { data, error } = await supabase.from("spiff_prizes").select("*").eq("is_active", true).order("credits_required", { ascending: true });
    if (error) console.error("Error fetching prizes:", error);
    else setPrizes(data || []);
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !saleDescription || !serialNumber || !saleAmount) return;
    const amount = parseFloat(saleAmount);
    const creditsEarned = Math.floor(amount / 100);
    const { error } = await supabase.from("spiff_program").insert({
      salesman_id: user.id, sale_description: saleDescription, serial_number: serialNumber.trim(),
      sale_amount: amount, credits_earned: creditsEarned, status: 'pending',
    });
    if (error) {
      toast({ title: "Error", description: "Failed to submit sale for approval", variant: "destructive" });
    } else {
      toast({ title: "Sale Submitted!", description: `Your sale has been submitted for approval. You'll earn ${creditsEarned} credits once approved.` });
      setSaleDescription(""); setSerialNumber(""); setSaleAmount(""); setAddDialogOpen(false); fetchSpiffRecords();
    }
  };

  const handleRedeemPrize = async (prize: Prize) => {
    if (availableCredits < prize.credits_required) {
      toast({ title: "Not enough credits", description: `You need ${prize.credits_required - availableCredits} more credits.`, variant: "destructive" });
      return;
    }
    const unredeemedRecords = approvedRecords.filter(r => !r.prize_redeemed);
    let creditsToMark = prize.credits_required;
    for (const record of unredeemedRecords) {
      if (creditsToMark <= 0) break;
      await supabase.from("spiff_program").update({ prize_redeemed: prize.name, redeemed_at: new Date().toISOString() }).eq("id", record.id);
      creditsToMark -= (record.adjusted_credits ?? record.credits_earned);
    }
    toast({ title: "Prize Redeemed! 🎉", description: `You've successfully redeemed: ${prize.name}` });
    setRedeemDialogOpen(false); fetchSpiffRecords();
  };

  const getStatusBadge = (record: SpiffRecord) => {
    switch (record.status) {
      case 'pending': return <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-300 bg-yellow-50"><Clock className="h-3 w-3" />Pending Review</Badge>;
      case 'approved': return <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case 'adjusted': return <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 bg-blue-50"><AlertCircle className="h-3 w-3" />Adjusted</Badge>;
      case 'rejected': return <Badge variant="outline" className="gap-1 text-red-600 border-red-300 bg-red-50"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) return <SpiffSkeleton />;

  return (
    <div className="container mx-auto py-8 px-4 pt-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Trophy className="h-8 w-8 text-yellow-500" />Spiff Program</h1>
          <p className="text-muted-foreground mt-1">Track your sales and earn credits for prizes!</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" />Record Sale</Button></DialogTrigger>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle>Record a Sale</DialogTitle>
              <DialogDescription>Submit your sale for approval. You earn 1 credit for every $100 in sales once approved. A 12-month warranty will also start for the serial number.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddSale} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sale-description">Sale Description</Label>
                <Input id="sale-description" placeholder="e.g., Excavator parts for ABC Company" value={saleDescription} onChange={(e) => setSaleDescription(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serial-number">Attachment Serial Number</Label>
                <Input id="serial-number" placeholder="e.g., SN-12345-ABC" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} required />
                <p className="text-xs text-muted-foreground">This will start a 12-month warranty once approved</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-amount">Sale Amount ($)</Label>
                <Input id="sale-amount" type="number" step="0.01" min="0" placeholder="0.00" value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} required />
                {saleAmount && <p className="text-sm text-muted-foreground">You'll earn <span className="font-semibold text-primary">{Math.floor(parseFloat(saleAmount) / 100)}</span> credits once approved</p>}
              </div>
              <Button type="submit" className="w-full">Submit Sale for Approval</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {pendingRecords.length > 0 && (
        <Card className="mb-6 border-yellow-300 bg-yellow-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">{pendingRecords.length} sale{pendingRecords.length > 1 ? 's' : ''} pending approval</p>
                <p className="text-sm text-yellow-700">Credits will be added once your sales are reviewed and approved.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Approved Sales</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">${totalSales.toLocaleString()}</div><p className="text-xs text-muted-foreground">Approved lifetime sales</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Credits</CardTitle><Star className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCredits}</div><p className="text-xs text-muted-foreground">Credits from approved sales</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Available Credits</CardTitle><Award className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{availableCredits}</div><p className="text-xs text-muted-foreground">Ready to redeem</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Prizes Redeemed</CardTitle><Gift className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{approvedRecords.filter(r => r.prize_redeemed).length}</div><p className="text-xs text-muted-foreground">Total redemptions</p></CardContent>
        </Card>
      </div>

      {/* Prizes */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" />Available Prizes</CardTitle>
              <CardDescription>Redeem your credits for awesome prizes</CardDescription>
            </div>
            <Dialog open={redeemDialogOpen} onOpenChange={setRedeemDialogOpen}>
              <DialogTrigger asChild><Button variant="outline" className="gap-2"><Gift className="h-4 w-4" />Redeem Prize</Button></DialogTrigger>
              <DialogContent className="bg-background max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Redeem a Prize</DialogTitle>
                  <DialogDescription>You have <span className="font-bold text-primary">{availableCredits}</span> credits available</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {prizes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No prizes available at the moment.</p>
                  ) : prizes.map((prize) => (
                    <div key={prize.id} className={`flex items-center justify-between p-4 border rounded-lg ${availableCredits >= prize.credits_required ? "border-primary bg-primary/5" : "opacity-50"}`}>
                      <div>
                        <h4 className="font-semibold">{prize.name}</h4>
                        {prize.description && <p className="text-sm text-muted-foreground">{prize.description}</p>}
                        <Badge variant="secondary" className="mt-2">{prize.credits_required} credits</Badge>
                      </div>
                      <Button onClick={() => handleRedeemPrize(prize)} disabled={availableCredits < prize.credits_required}>Redeem</Button>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {prizes.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No prizes configured yet.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {prizes.map((prize) => (
                <div key={prize.id} className="flex items-center gap-2 px-4 py-2 border rounded-full">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">{prize.name}</span>
                  <Badge variant="secondary">{prize.credits_required} credits</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sales History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Sales History</CardTitle>
              <CardDescription>Your recorded sales and earned credits</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search sales..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pagination.paginatedData.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title={debouncedQuery ? "No sales match your search" : "No sales recorded yet"}
              description={debouncedQuery ? "Try a different search term" : "Click 'Record Sale' to submit your first sale!"}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.paginatedData.map((record) => {
                    const displayAmount = record.adjusted_amount ?? Number(record.sale_amount);
                    const displayCredits = record.adjusted_credits ?? record.credits_earned;
                    const isAdjusted = record.status === 'adjusted';
                    return (
                      <TableRow key={record.id} className={record.status === 'rejected' ? 'opacity-50' : ''}>
                        <TableCell>{format(new Date(record.created_at), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <div>
                            {record.sale_description}
                            {record.admin_notes && <p className="text-xs text-muted-foreground mt-1">Note: {record.admin_notes}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{record.serial_number || "-"}</TableCell>
                        <TableCell className="text-right">
                          <div>
                            ${displayAmount.toLocaleString()}
                            {isAdjusted && record.adjusted_amount !== null && <p className="text-xs text-muted-foreground line-through">${Number(record.sale_amount).toLocaleString()}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <div>
                            {record.status === 'pending' ? <span className="text-muted-foreground">+{record.credits_earned} (pending)</span>
                              : record.status === 'rejected' ? <span className="text-destructive">0</span>
                              : <>+{displayCredits}{isAdjusted && record.adjusted_credits !== null && record.adjusted_credits !== record.credits_earned && <p className="text-xs text-muted-foreground line-through">+{record.credits_earned}</p>}</>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.prize_redeemed ? <Badge variant="secondary" className="gap-1"><Gift className="h-3 w-3" />{record.prize_redeemed}</Badge> : getStatusBadge(record)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pagination.totalPages > 1 && (
                <PaginationControls
                  currentPage={pagination.currentPage} totalPages={pagination.totalPages}
                  pageSize={pagination.pageSize} totalItems={pagination.totalItems}
                  startIndex={pagination.startIndex} endIndex={pagination.endIndex}
                  hasNextPage={pagination.hasNextPage} hasPreviousPage={pagination.hasPreviousPage}
                  pageSizeOptions={pagination.pageSizeOptions}
                  onPageChange={pagination.goToPage} onNextPage={pagination.nextPage}
                  onPreviousPage={pagination.previousPage} onPageSizeChange={pagination.setPageSize}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SpiffProgram() {
  return (
    <ErrorBoundary>
      <SpiffProgramContent />
    </ErrorBoundary>
  );
}
