import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Receipt, Plus, User } from "lucide-react";
import { getExpenses, getCategoryLabel, type Expense } from "@/lib/expense-storage";
import { AddExpenseDialog } from "@/components/AddExpenseDialog";
import { ExpenseDetailDialog } from "@/components/ExpenseDetailDialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

const Expenses = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [employeeExpanded, setEmployeeExpanded] = useState<Record<string, boolean>>({});

  const loadExpenses = async () => {
    const data = await getExpenses();
    setExpenses(data);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  // Filter expenses based on search query
  const filteredExpenses = expenses.filter(expense => {
    const query = searchQuery.toLowerCase();
    return (
      expense.employeeName.toLowerCase().includes(query) ||
      expense.category.toLowerCase().includes(query) ||
      expense.description?.toLowerCase().includes(query) ||
      expense.amount.toString().includes(query)
    );
  });

  // Group expenses by employee
  const expensesByEmployee = filteredExpenses.reduce((acc, expense) => {
    const employee = expense.employeeName;
    if (!acc[employee]) {
      acc[employee] = [];
    }
    acc[employee].push(expense);
    return acc;
  }, {} as Record<string, Expense[]>);

  const employeeStats = Object.entries(expensesByEmployee).map(([name, expenses]) => ({
    name,
    expenses,
    totalAmount: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    count: expenses.length
  })).sort((a, b) => b.totalAmount - a.totalAmount);

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setDetailDialogOpen(true);
  };

  const handleExpenseUpdated = () => {
    loadExpenses();
    setDetailDialogOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Expense Tracker</h1>
              <p className="text-muted-foreground mt-1">Track and manage all expenses</p>
            </div>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">${totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">{filteredExpenses.length} expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Employees</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(expensesByEmployee).length}</div>
              <p className="text-xs text-muted-foreground">with expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg per Expense</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${filteredExpenses.length > 0 ? (totalExpenses / filteredExpenses.length).toFixed(2) : '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">average amount</p>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses by employee, category, description, or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Expenses by Employee */}
        <div className="space-y-4">
          {employeeStats.map(({ name, expenses, totalAmount, count }) => (
            <Card key={name}>
              <Collapsible 
                open={employeeExpanded[name]} 
                onOpenChange={(open) => setEmployeeExpanded({ ...employeeExpanded, [name]: open })}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {employeeExpanded[name] ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        <User className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-lg">{name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{count} expenses</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-orange-600">${totalAmount.toFixed(2)}</div>
                        <Badge variant="secondary">{count} total</Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {expenses
                        .sort((a, b) => new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime())
                        .map((expense) => (
                          <div
                            key={expense.id}
                            className="flex items-center justify-between p-4 border rounded-lg bg-background/50 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleExpenseClick(expense)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {new Date(expense.expenseDate).toLocaleDateString()}
                                </span>
                              </div>
                              {expense.description && (
                                <p className="text-sm text-muted-foreground">{expense.description}</p>
                              )}
                              {expense.creditCardLast4 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Card ending in {expense.creditCardLast4}
                                </p>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-lg font-semibold text-orange-600">
                                ${expense.amount.toFixed(2)}
                              </div>
                              {expense.receiptUrl && (
                                <Badge variant="secondary" className="text-xs">Has Receipt</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}

          {employeeStats.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No expenses found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <AddExpenseDialog 
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onExpenseAdded={loadExpenses}
      />

      {selectedExpense && (
        <ExpenseDetailDialog
          expense={selectedExpense}
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          onExpenseUpdated={handleExpenseUpdated}
          onExpenseDeleted={loadExpenses}
        />
      )}
    </div>
  );
};

export default Expenses;
