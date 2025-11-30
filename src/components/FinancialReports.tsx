import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import { getAccounts, getAccountTransactions, getBudgetForecasts, generateAIForecast, type Account, type AccountTransaction, type BudgetForecast } from "@/lib/accounting-storage";
import { format, startOfMonth, endOfMonth } from "date-fns";

export const FinancialReports = () => {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM-01"));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [forecasts, setForecasts] = useState<BudgetForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingForecast, setGeneratingForecast] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      const startDate = format(startOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(selectedMonth)), "yyyy-MM-dd");

      const [accountsData, transactionsData, forecastsData] = await Promise.all([
        getAccounts(),
        getAccountTransactions(startDate, endDate),
        getBudgetForecasts(selectedMonth),
      ]);

      setAccounts(accountsData);
      setTransactions(transactionsData);
      setForecasts(forecastsData);
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

  const getAccountBalance = (accountType: string): number => {
    return accounts
      .filter(a => a.account_type === accountType)
      .reduce((sum, account) => {
        const accountTransactions = transactions.filter(t => t.account_id === account.id);
        return sum + accountTransactions.reduce((s, t) => s + Number(t.amount), 0);
      }, 0);
  };

  const assets = getAccountBalance('asset');
  const liabilities = getAccountBalance('liability');
  const equity = getAccountBalance('equity');
  const revenue = getAccountBalance('revenue');
  const expenses = getAccountBalance('expense');
  const netIncome = revenue - expenses;

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
                    {getAccountsByType('asset').map(account => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-6">{account.account_name}</TableCell>
                        <TableCell className="text-right">
                          ${transactions.filter(t => t.account_id === account.id)
                            .reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total Assets</TableCell>
                      <TableCell className="text-right">${assets.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell colSpan={2}>LIABILITIES</TableCell>
                    </TableRow>
                    {getAccountsByType('liability').map(account => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-6">{account.account_name}</TableCell>
                        <TableCell className="text-right">
                          ${transactions.filter(t => t.account_id === account.id)
                            .reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right">${liabilities.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold">
                      <TableCell colSpan={2}>EQUITY</TableCell>
                    </TableRow>
                    {getAccountsByType('equity').map(account => (
                      <TableRow key={account.id}>
                        <TableCell className="pl-6">{account.account_name}</TableCell>
                        <TableCell className="text-right">
                          ${transactions.filter(t => t.account_id === account.id)
                            .reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold">
                      <TableCell>Total Equity</TableCell>
                      <TableCell className="text-right">${equity.toFixed(2)}</TableCell>
                    </TableRow>
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Liabilities & Equity</TableCell>
                      <TableCell className="text-right">${(liabilities + equity).toFixed(2)}</TableCell>
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
                  {getAccountsByType('revenue').map(account => (
                    <TableRow key={account.id}>
                      <TableCell className="pl-6">{account.account_name}</TableCell>
                      <TableCell className="text-right">
                        ${transactions.filter(t => t.account_id === account.id)
                          .reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total Revenue</TableCell>
                    <TableCell className="text-right">${revenue.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell colSpan={2}>EXPENSES</TableCell>
                  </TableRow>
                  {getAccountsByType('expense').map(account => (
                    <TableRow key={account.id}>
                      <TableCell className="pl-6">{account.account_name}</TableCell>
                      <TableCell className="text-right">
                        ${transactions.filter(t => t.account_id === account.id)
                          .reduce((s, t) => s + Number(t.amount), 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold">
                    <TableCell>Total Expenses</TableCell>
                    <TableCell className="text-right">${expenses.toFixed(2)}</TableCell>
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
