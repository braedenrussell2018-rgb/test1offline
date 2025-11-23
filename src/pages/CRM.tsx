import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, FileText, StickyNote, Plus } from "lucide-react";

const CRM = () => {
  const [activeTab, setActiveTab] = useState("companies");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">CRM</h1>
          <p className="text-muted-foreground mt-1">Track quotes, invoices, and notes for each company</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Active clients</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Pending quotes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Notes</CardTitle>
              <StickyNote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Across all companies</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Companies</CardTitle>
                <CardDescription>Manage your clients and contacts</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  No companies yet. Add your first company to get started.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Quotes</CardTitle>
                <CardDescription>Track quotes sent to companies</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  No quotes yet. Create your first quote.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoices by Company</CardTitle>
                <CardDescription>View invoices organized by company</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  No invoices yet. Invoices will appear here when created.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CRM;
