import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, FileText, StickyNote, Mail, Phone, MapPin, Briefcase, User } from "lucide-react";
import { AddCompanyDialog } from "@/components/AddCompanyDialog";
import { AddPersonDialog } from "@/components/AddPersonDialog";
import { CompanyDetailDialog } from "@/components/CompanyDetailDialog";
import { PersonDetailDialog } from "@/components/PersonDetailDialog";
import { inventoryStorage, Company, Person } from "@/lib/inventory-storage";

const CRM = () => {
  const [activeTab, setActiveTab] = useState("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  useEffect(() => {
    setCompanies(inventoryStorage.getCompanies());
    setPersons(inventoryStorage.getPersons());
  }, [refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || "Unknown Company";
  };

  const handlePersonClick = (person: Person) => {
    setSelectedPerson(person);
  };

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
          <Card 
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => setActiveTab("companies")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies.length}</div>
              <p className="text-xs text-muted-foreground">Active clients</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => setActiveTab("contacts")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{persons.length}</div>
              <p className="text-xs text-muted-foreground">People in system</p>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent/5 transition-colors"
            onClick={() => setActiveTab("quotes")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Quotes</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Pending quotes</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-12">
          <AddCompanyDialog onCompanyAdded={handleRefresh} />
          <AddPersonDialog onPersonAdded={handleRefresh} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="companies" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Companies</CardTitle>
                <CardDescription>Manage your clients and organizations</CardDescription>
              </CardHeader>
              <CardContent>
                {companies.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No companies yet. Add your first company to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {companies.map((company) => {
                      const companyPersons = persons.filter(p => p.companyId === company.id);
                      return (
                        <CompanyDetailDialog
                          key={company.id}
                          company={company}
                          persons={companyPersons}
                          onPersonClick={handlePersonClick}
                        >
                          <div className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/10 transition-colors cursor-pointer">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold text-lg">{company.name}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {companyPersons.length} {companyPersons.length === 1 ? 'contact' : 'contacts'}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Added {new Date(company.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </CompanyDetailDialog>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Contacts</CardTitle>
                <CardDescription>View and manage your contacts</CardDescription>
              </CardHeader>
              <CardContent>
                {persons.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No contacts yet. Add your first person to get started.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {persons.map((person) => (
                      <PersonDetailDialog
                        key={person.id}
                        person={person}
                        companyName={getCompanyName(person.companyId)}
                        onUpdate={handleRefresh}
                      >
                        <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors cursor-pointer">
                          <div className="flex gap-4">
                            {person.businessCardPhoto && (
                              <div className="flex-shrink-0">
                                <img
                                  src={person.businessCardPhoto}
                                  alt="Business card"
                                  className="w-32 h-20 object-cover rounded border"
                                />
                              </div>
                            )}
                            <div className="flex-1 space-y-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-lg">
                                    {person.firstName} {person.lastName}
                                  </h3>
                                  <Badge variant="secondary">
                                    {getCompanyName(person.companyId)}
                                  </Badge>
                                </div>
                                {person.jobTitle && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Briefcase className="h-3 w-3" />
                                    <span>{person.jobTitle}</span>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-1">
                                {person.email && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    <a href={`mailto:${person.email}`} className="text-primary hover:underline">
                                      {person.email}
                                    </a>
                                  </div>
                                )}
                                {person.phone && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    <a href={`tel:${person.phone}`} className="text-primary hover:underline">
                                      {person.phone}
                                    </a>
                                  </div>
                                )}
                                {person.address && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span>{person.address}</span>
                                  </div>
                                )}
                              </div>
                              {person.notes.length > 0 && (
                                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                                  <StickyNote className="h-3 w-3 inline mr-1" />
                                  {person.notes.length} {person.notes.length === 1 ? 'note' : 'notes'}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </PersonDetailDialog>
                    ))}
                  </div>
                )}
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
