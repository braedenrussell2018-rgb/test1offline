import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import { getAccounts, getBudgetForecasts, generateAIForecast, type Account, type BudgetForecast } from "@/lib/accounting-storage";
import { getItems, getInvoices, type Item, type Invoice } from "@/lib/supabase-storage";
import { getExpenses, type Expense, getCategoryLabel } from "@/lib/expense-storage";
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";

export const FinancialReports = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM-01"));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [forecasts, setForecasts] = useState<BudgetForecast[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingForecast, setGeneratingForecast] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsData, forecastsData, itemsData, invoicesData, expensesData] = await Promise.all([
        getAccounts(),
        getBudgetForecasts(selectedMonth),
        getItems(),
        getInvoices(),
        getExpenses(),
      ]);

      setAccounts(accountsData);
      setForecasts(forecastsData);
      setItems(itemsData);
      setInvoices(invoicesData);
      setExpenses(expensesData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load financial data");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateForecast = async () => {
    try {
      setGeneratingForecast(true);
      const newForecasts = await generateAIForecast(selectedMonth);
      setForecasts(newForecasts);
      toast.success("AI forecast generated successfully!");
    } catch (error) {
      console.error("Error generating forecast:", error);
      toast.error("Failed to generate forecast");
    } finally {
      setGeneratingForecast(false);
    }
  };

  // Filter data by selected month
  const startDate = startOfMonth(new Date(selectedMonth));
  const endDate = endOfMonth(new Date(selectedMonth));

  const isInSelectedMonth = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    try {
      const date = parseISO(dateStr);
      return isWithinInterval(date, { start: startDate, end: endDate });
    } catch {
      return false;
    }
  };

  // Calculate inventory value (available items only)
  const availableItems = items.filter(item => item.status === 'available');
  const inventoryValue = availableItems.reduce((sum, item) => sum + (item.cost || 0), 0);

  // Calculate sales revenue from invoices in selected month
  const monthlyInvoices = invoices.filter(inv => isInSelectedMonth(inv.createdAt));
  const salesRevenue = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const shippingRevenue = monthlyInvoices.reduce((sum, inv) => sum + (inv.shipping || 0), 0);
  const totalRevenue = salesRevenue;

  // Calculate COGS from sold items in the month
  const soldItemsThisMonth = items.filter(item => item.status === 'sold' && isInSelectedMonth(item.dateSold));
  const cogs = soldItemsThisMonth.reduce((sum, item) => sum + (item.cost || 0), 0);

  // Calculate operating expenses from expense tracker
  const monthlyExpenses = expenses.filter(exp => isInSelectedMonth(exp.expenseDate));
  const totalExpenses = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Group expenses by category
  const expensesByCategory = monthlyExpenses.reduce((acc, exp) => {
    const category = exp.category;
    acc[category] = (acc[category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  // Net income calculation
  const grossProfit = totalRevenue - cogs;
  const netIncome = grossProfit - totalExpenses;

  // Calculate accounts receivable (unpaid invoices)
  const accountsReceivable = invoices
    .filter(inv => !inv.paid)
    .reduce((sum, inv) => sum + inv.total, 0);

  const getAccountsByType = (type: string) => accounts.filter(a => a.account_type === type);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Financial Reports</CardTitle>
            <CardDescription>Comprehensive financial statements and forecasting</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date();
                  date.setMonth(date.getMonth() - i);
                  const value = format(date, "yyyy-MM-01");
                  return (
                    <SelectItem key={value} value={value}>
                      {format(date, "MMMM yyyy")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="balance-sheet">
            <AccordionTrigger>Balance Sheet</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="font-bold">
                      <TableCell colSpan={2}>ASSETS</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Inventory</TableCell>
                      <TableCell className="text-right">${inventoryValue.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Accounts Receivable</TableCell>
                      <TableCell className="text-right">${accountsReceivable.toFixed(2)}</TableCell>
                    </TableRow>
                    {getAccountsByType('asset').map(account => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-6">{account.account_name}</TableCell>
                        <TableCell className="text-right">$0.00</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right">${(inventoryValue + accountsReceivable).toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell colSpan={2}>LIABILITIES</TableCell>
                    </TableRow>
                    {getAccountsByType('liability').map(account => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-6">{account.account_name}</TableCell>
                        <TableCell className="text-right">$0.00</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right">$0.00</TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell colSpan={2}>EQUITY</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-6">Retained Earnings</TableCell>
                      <TableCell className="text-right">${(inventoryValue + accountsReceivable).toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="font-semibold">
                      <TableCell>Total Equity</TableCell>
                      <TableCell className="text-right">${(inventoryValue + accountsReceivable).toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right">${(inventoryValue + accountsReceivable).toFixed(2)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="income-statement">
            <AccordionTrigger>Income Statement</AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="font-bold">
                    <TableCell colSpan={2}>REVENUE</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Sales Revenue</TableCell>
                    <TableCell className="text-right">${(salesRevenue - shippingRevenue).toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Shipping Revenue</TableCell>
                    <TableCell className="text-right">${shippingRevenue.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell>Total Revenue</TableCell>
                    <TableCell className="text-right">${totalRevenue.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell colSpan={2}>COST OF GOODS SOLD</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-6">Cost of Goods Sold</TableCell>
                    <TableCell className="text-right">${cogs.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold">
                    <TableCell>Gross Profit</TableCell>
                    <TableCell className="text-right">${grossProfit.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell colSpan={2}>OPERATING EXPENSES</TableCell>
                  </TableRow>
                  {Object.entries(expensesByCategory).map(([category, amount]) => (
                    <TableRow key={category}>
                      <TableCell className="pl-6">{getCategoryLabel(category)}</TableCell>
                      <TableCell className="text-right">${amount.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {Object.keys(expensesByCategory).length === 0 && (
                    <TableRow>
                      <TableCell className="pl-6 text-muted-foreground">No expenses recorded</TableCell>
                      <TableCell className="text-right">$0.00</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="font-semibold">
                    <TableCell>Total Operating Expenses</TableCell>
                    <TableCell className="text-right">${totalExpenses.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className={`font-bold border-t-2 ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <TableCell>Net Income</TableCell>
                    <TableCell className="text-right">${netIncome.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="chart-of-accounts">
            <AccordionTrigger>Chart of Accounts</AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* System-generated accounts from actual data */}
                  <TableRow>
                    <TableCell>1000</TableCell>
                    <TableCell>Inventory</TableCell>
                    <TableCell className="capitalize">asset</TableCell>
                    <TableCell>Value of inventory items</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>1100</TableCell>
                    <TableCell>Accounts Receivable</TableCell>
                    <TableCell className="capitalize">asset</TableCell>
                    <TableCell>Unpaid invoices</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>4000</TableCell>
                    <TableCell>Sales Revenue</TableCell>
                    <TableCell className="capitalize">revenue</TableCell>
                    <TableCell>Revenue from invoice sales</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>4100</TableCell>
                    <TableCell>Shipping Revenue</TableCell>
                    <TableCell className="capitalize">revenue</TableCell>
                    <TableCell>Revenue from shipping charges</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>5000</TableCell>
                    <TableCell>Cost of Goods Sold</TableCell>
                    <TableCell className="capitalize">expense</TableCell>
                    <TableCell>Cost of sold inventory items</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>6000</TableCell>
                    <TableCell>Operating Expenses</TableCell>
                    <TableCell className="capitalize">expense</TableCell>
                    <TableCell>Expenses from expense tracker</TableCell>
                  </TableRow>
                  {accounts.map(account => (
                    <TableRow key={account.id}>
                      <TableCell>{account.account_number}</TableCell>
                      <TableCell>{account.account_name}</TableCell>
                      <TableCell className="capitalize">{account.account_type}</TableCell>
                      <TableCell>{account.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="budget-forecast">
            <AccordionTrigger>Budget Forecast & Comparison</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    AI-powered budget forecasting for {format(new Date(selectedMonth), "MMMM yyyy")}
                  </p>
                  <Button onClick={handleGenerateForecast} disabled={generatingForecast}>
                    {generatingForecast ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Generate AI Forecast
                      </>
                    )}
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Forecasted</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-right">Variance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecasts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No forecast data. Click "Generate AI Forecast" to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      forecasts.map(forecast => {
                        const account = accounts.find(a => a.id === forecast.account_id);
                        const variance = forecast.actual_amount - forecast.forecasted_amount;
                        const variancePercent = forecast.forecasted_amount !== 0
                          ? (variance / forecast.forecasted_amount) * 100
                          : 0;
                        
                        return (
                          <TableRow key={forecast.id}>
                            <TableCell>{account?.account_name}</TableCell>
                            <TableCell className="text-right">${forecast.forecasted_amount.toFixed(2)}</TableCell>
                            <TableCell className="text-right">${forecast.actual_amount.toFixed(2)}</TableCell>
                            <TableCell className={`text-right ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${Math.abs(variance).toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right ${variancePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {variancePercent.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};
