import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, Loader2, Building2, Users, Mail, Phone, MapPin, Briefcase, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, Company } from "@/lib/inventory-storage";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportContactsDialogProps {
  onContactsImported: () => void;
}

interface ParsedContact {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  companyName?: string;
  jobTitle?: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicate: boolean;
  isNewCompany: boolean;
}

export const ImportContactsDialog = ({ onContactsImported }: ImportContactsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [existingCompanies, setExistingCompanies] = useState<Company[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewTab, setPreviewTab] = useState("all");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParsedContact>>({});
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = [
      {
        Name: "John Doe",
        Email: "john.doe@example.com",
        Phone: "555-123-4567",
        Address: "123 Main St, City, State 12345",
        Company: "Acme Corporation",
        JobTitle: "Sales Manager",
      },
      {
        Name: "Jane Smith",
        Email: "jane.smith@example.com",
        Phone: "555-987-6543",
        Address: "456 Oak Ave, Town, State 67890",
        Company: "Tech Solutions Inc",
        JobTitle: "Project Lead",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    XLSX.writeFile(wb, "contacts_template.xlsx");

    toast({
      title: "Template Downloaded",
      description: "Use this template to prepare your contact data",
    });
  };

  // Helper to separate first and last name from a full name
  const parseFullName = (fullName: string): string => {
    if (!fullName) return "";
    
    // Already has proper spacing, return as-is
    const trimmed = fullName.trim();
    
    // If no spaces, try to separate camelCase or PascalCase (e.g., "JohnDoe" -> "John Doe")
    if (!trimmed.includes(" ")) {
      // Check for camelCase pattern
      const camelCaseSplit = trimmed.replace(/([a-z])([A-Z])/g, "$1 $2");
      if (camelCaseSplit !== trimmed) {
        return camelCaseSplit;
      }
    }
    
    return trimmed;
  };

  const validateContact = async (
    item: Record<string, unknown>,
    existingPersons: { name: string; email?: string }[],
    companies: Company[]
  ): Promise<ParsedContact> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Support multiple name column formats including Pipedrive-style "Person - Name"
    const rawName = String(
      item["Person - Name"] || 
      item.Name || 
      item.name || 
      item["Full Name"] || 
      item["First Name"] || 
      ""
    ).trim();
    
    const lastName = String(item["Last Name"] || item.lastName || "").trim();
    const fullName = lastName ? `${parseFullName(rawName)} ${lastName}` : parseFullName(rawName);
    
    // Support multiple email column formats (work, home, other)
    const email = String(
      item["Person - Email - Work"] ||
      item["Person - Email - Home"] ||
      item["Person - Email - Other"] ||
      item.Email || 
      item.email || 
      item["Email Address"] || 
      ""
    ).trim() || undefined;
    
    // Support multiple phone column formats (work, home, mobile, other) - take first non-empty
    const phoneRaw = String(
      item["Person - Phone - Work"] ||
      item["Person - Phone - Mobile"] ||
      item["Person - Phone - Home"] ||
      item["Person - Phone - Other"] ||
      item.Phone || 
      item.phone || 
      item["Phone Number"] || 
      item.PhoneNumber || 
      ""
    ).trim();
    // Handle comma-separated phone numbers (take first one)
    const phone = phoneRaw.split(",")[0].trim() || undefined;
    
    // Support state/address column
    const address = String(
      item["Person - State"] ||
      item.Address || 
      item.address || 
      ""
    ).trim() || undefined;
    
    // Support organization/company columns
    const companyName = String(
      item["Organization - Name"] ||
      item["Person - Organization"] ||
      item.Company || 
      item.company || 
      item["Company Name"] || 
      item.CompanyName || 
      ""
    ).trim() || undefined;
    
    const jobTitle = String(
      item.JobTitle || 
      item.jobTitle || 
      item["Job Title"] || 
      item.Title || 
      item.title || 
      ""
    ).trim() || undefined;

    let isDuplicate = false;
    let isNewCompany = false;

    // Required field validation
    if (!fullName) {
      errors.push("Missing name (required)");
    }

    // Check for duplicate by name or email
    if (fullName && existingPersons.some(p => p.name.toLowerCase() === fullName.toLowerCase())) {
      errors.push("Duplicate: Contact with this name already exists");
      isDuplicate = true;
    }
    if (email && existingPersons.some(p => p.email?.toLowerCase() === email.toLowerCase())) {
      errors.push("Duplicate: Contact with this email already exists");
      isDuplicate = true;
    }

    // Basic email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Invalid email format");
    }

    // Check for missing optional fields (warnings)
    if (!email) warnings.push("No email");
    if (!phone) warnings.push("No phone");
    if (!address) warnings.push("No address");
    if (!companyName) warnings.push("No company");
    if (!jobTitle) warnings.push("No job title");

    // Check if company exists
    if (companyName) {
      const existingCompany = companies.find(
        c => c.name.toLowerCase() === companyName.toLowerCase()
      );
      if (!existingCompany) {
        isNewCompany = true;
      }
    }

    return {
      name: fullName,
      email,
      phone,
      address,
      companyName,
      jobTitle,
      valid: errors.length === 0,
      errors,
      warnings,
      isDuplicate,
      isNewCompany,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast({
          title: "Error",
          description: "The Excel file is empty",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Get existing data for validation
      const [existingPersons, companies] = await Promise.all([
        inventoryStorage.getPersons(),
        inventoryStorage.getCompanies()
      ]);
      
      setExistingCompanies(companies);
      const existingForCheck = existingPersons.map(p => ({ name: p.name, email: p.email }));

      const validated = await Promise.all(
        jsonData.map((item) => validateContact(item, existingForCheck, companies))
      );
      setParsedContacts(validated);
      setPreviewTab("all");

      const validCount = validated.filter(item => item.valid).length;
      const invalidCount = validated.length - validCount;

      toast({
        title: "File Loaded",
        description: `${validated.length} contacts found. Review the preview below.`,
      });
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({
        title: "Error",
        description: "Failed to parse Excel file. Please check the format.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  const handleImport = async () => {
    const validContacts = parsedContacts.filter(contact => contact.valid);
    
    if (validContacts.length === 0) {
      toast({
        title: "Error",
        description: "No valid contacts to import",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      let companies = [...existingCompanies];
      const createdCompanies = new Map<string, string>();
      let newCompaniesCount = 0;
      
      for (const contact of validContacts) {
        let companyId: string | undefined;
        
        if (contact.companyName) {
          const companyNameLower = contact.companyName.toLowerCase();
          
          if (createdCompanies.has(companyNameLower)) {
            companyId = createdCompanies.get(companyNameLower);
          } else {
            const matchingCompany = companies.find(
              c => c.name.toLowerCase() === companyNameLower
            );
            
            if (matchingCompany) {
              companyId = matchingCompany.id;
            } else {
              const newCompany = await inventoryStorage.addCompany(contact.companyName);
              companyId = newCompany.id;
              createdCompanies.set(companyNameLower, companyId);
              companies = [...companies, newCompany];
              newCompaniesCount++;
            }
          }
        }

        await inventoryStorage.addPerson({
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          address: contact.address,
          companyId,
          jobTitle: contact.jobTitle,
          notes: [],
          excavatorLines: [],
        });
      }

      const companiesMessage = newCompaniesCount > 0 
        ? ` and created ${newCompaniesCount} new ${newCompaniesCount === 1 ? 'company' : 'companies'}`
        : '';
      
      toast({
        title: "Success",
        description: `Imported ${validContacts.length} contacts${companiesMessage}`,
      });

      setParsedContacts([]);
      setOpen(false);
      onContactsImported();
    } catch (error) {
      console.error("Error importing contacts:", error);
      toast({
        title: "Error",
        description: "Failed to import some contacts",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Compute statistics
  const stats = useMemo(() => {
    const valid = parsedContacts.filter(c => c.valid);
    const invalid = parsedContacts.filter(c => !c.valid);
    const duplicates = parsedContacts.filter(c => c.isDuplicate);
    const missingInfo = parsedContacts.filter(c => c.valid && c.warnings.length > 0);
    const newCompanies = [...new Set(
      parsedContacts
        .filter(c => c.isNewCompany && c.companyName)
        .map(c => c.companyName!.toLowerCase())
    )];
    
    return {
      total: parsedContacts.length,
      valid: valid.length,
      invalid: invalid.length,
      duplicates: duplicates.length,
      missingInfo: missingInfo.length,
      newCompanies,
    };
  }, [parsedContacts]);

  // Filter contacts based on tab
  const filteredContacts = useMemo(() => {
    switch (previewTab) {
      case "valid":
        return parsedContacts.filter(c => c.valid);
      case "errors":
        return parsedContacts.filter(c => !c.valid);
      case "duplicates":
        return parsedContacts.filter(c => c.isDuplicate);
      case "missing":
        return parsedContacts.filter(c => c.valid && c.warnings.length > 0);
      case "new-companies":
        return parsedContacts.filter(c => c.isNewCompany);
      default:
        return parsedContacts;
    }
  }, [parsedContacts, previewTab]);

  // Find the original index in parsedContacts for a filtered contact
  const getOriginalIndex = (contact: ParsedContact): number => {
    return parsedContacts.findIndex(c => c === contact);
  };

  // Open edit dialog for a contact
  const handleEditContact = (contact: ParsedContact, originalIndex: number) => {
    setEditingIndex(originalIndex);
    setEditForm({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      address: contact.address || "",
      companyName: contact.companyName || "",
      jobTitle: contact.jobTitle || "",
    });
  };

  // Save edited contact and revalidate
  const handleSaveEdit = async () => {
    if (editingIndex === null) return;
    
    const existingPersons = await inventoryStorage.getPersons();
    const existingForCheck = existingPersons.map(p => ({ name: p.name, email: p.email }));
    
    // Revalidate with new data
    const updatedContact = await revalidateContact(
      {
        name: editForm.name || "",
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address,
        companyName: editForm.companyName,
        jobTitle: editForm.jobTitle,
      },
      existingForCheck,
      existingCompanies
    );
    
    const newContacts = [...parsedContacts];
    newContacts[editingIndex] = updatedContact;
    setParsedContacts(newContacts);
    setEditingIndex(null);
    setEditForm({});
    
    toast({
      title: "Contact Updated",
      description: updatedContact.valid ? "Contact is now valid" : "Contact still has errors",
    });
  };

  // Revalidate a contact after editing
  const revalidateContact = async (
    data: { name: string; email?: string; phone?: string; address?: string; companyName?: string; jobTitle?: string },
    existingPersons: { name: string; email?: string }[],
    companies: Company[]
  ): Promise<ParsedContact> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const name = data.name.trim();
    const email = data.email?.trim() || undefined;
    const phone = data.phone?.trim() || undefined;
    const address = data.address?.trim() || undefined;
    const companyName = data.companyName?.trim() || undefined;
    const jobTitle = data.jobTitle?.trim() || undefined;

    let isDuplicate = false;
    let isNewCompany = false;

    if (!name) {
      errors.push("Missing name (required)");
    }

    if (name && existingPersons.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      errors.push("Duplicate: Contact with this name already exists");
      isDuplicate = true;
    }
    if (email && existingPersons.some(p => p.email?.toLowerCase() === email.toLowerCase())) {
      errors.push("Duplicate: Contact with this email already exists");
      isDuplicate = true;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Invalid email format");
    }

    if (!email) warnings.push("No email");
    if (!phone) warnings.push("No phone");
    if (!address) warnings.push("No address");
    if (!companyName) warnings.push("No company");
    if (!jobTitle) warnings.push("No job title");

    if (companyName) {
      const existingCompany = companies.find(
        c => c.name.toLowerCase() === companyName.toLowerCase()
      );
      if (!existingCompany) {
        isNewCompany = true;
      }
    }

    return {
      name,
      email,
      phone,
      address,
      companyName,
      jobTitle,
      valid: errors.length === 0,
      errors,
      warnings,
      isDuplicate,
      isNewCompany,
    };
  };

  const renderContactCard = (contact: ParsedContact, filteredIndex: number) => {
    const originalIndex = getOriginalIndex(contact);
    
    return (
      <div
        key={filteredIndex}
        onClick={() => handleEditContact(contact, originalIndex)}
        className={`p-3 border rounded-lg cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
          !contact.valid 
            ? 'bg-destructive/5 border-destructive/20' 
            : contact.warnings.length > 0
              ? 'bg-warning/5 border-warning/20'
              : 'bg-success/5 border-success/20'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-medium">{contact.name || "(missing name)"}</span>
              {contact.valid ? (
                <Badge variant="default" className="bg-success text-success-foreground">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Valid
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Invalid
                </Badge>
              )}
              {contact.isDuplicate && (
                <Badge variant="outline" className="border-destructive text-destructive">
                  <Users className="h-3 w-3 mr-1" />
                  Duplicate
                </Badge>
              )}
              {contact.isNewCompany && contact.companyName && (
                <Badge variant="outline" className="border-primary text-primary">
                  <Building2 className="h-3 w-3 mr-1" />
                  New Company
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
              <div className={`flex items-center gap-1 ${contact.email ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                <Mail className="h-3 w-3" />
                {contact.email || "No email"}
              </div>
              <div className={`flex items-center gap-1 ${contact.phone ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                <Phone className="h-3 w-3" />
                {contact.phone || "No phone"}
              </div>
              <div className={`flex items-center gap-1 ${contact.companyName ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                <Building2 className="h-3 w-3" />
                {contact.companyName || "No company"}
              </div>
              <div className={`flex items-center gap-1 ${contact.jobTitle ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                <Briefcase className="h-3 w-3" />
                {contact.jobTitle || "No job title"}
              </div>
              {contact.address && (
                <div className="flex items-center gap-1 text-foreground sm:col-span-2">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{contact.address}</span>
                </div>
              )}
            </div>
            
            {contact.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {contact.errors.map((error, errorIndex) => (
                  <p key={errorIndex} className="text-xs text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3 flex-shrink-0" />
                    {error}
                  </p>
                ))}
              </div>
            )}
          </div>
          <Pencil className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setParsedContacts([]);
        setPreviewTab("all");
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import Contacts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {parsedContacts.length === 0 ? (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Upload Excel with columns: <strong>Name</strong> (required) + Email, Phone, Address, Company, JobTitle (optional)
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadTemplate}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
                
                <Label htmlFor="contacts-file-upload" className="flex-1">
                  <div className="flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground">
                    <Upload className="mr-2 h-4 w-4" />
                    {isProcessing ? "Processing..." : "Choose Excel File"}
                  </div>
                  <input
                    id="contacts-file-upload"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                    className="sr-only"
                  />
                </Label>
              </div>
            </>
          ) : (
            <>
              {/* Clickable Summary Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  onClick={() => setPreviewTab("all")}
                  className={`p-3 rounded-lg text-center transition-all ${
                    previewTab === "all" 
                      ? "bg-muted ring-2 ring-primary" 
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </button>
                <button
                  onClick={() => setPreviewTab("valid")}
                  className={`p-3 rounded-lg text-center transition-all ${
                    previewTab === "valid" 
                      ? "bg-success/20 ring-2 ring-success" 
                      : "bg-success/10 hover:bg-success/20"
                  }`}
                >
                  <div className="text-2xl font-bold text-success">{stats.valid}</div>
                  <div className="text-xs text-muted-foreground">Valid</div>
                </button>
                <button
                  onClick={() => setPreviewTab("errors")}
                  className={`p-3 rounded-lg text-center transition-all ${
                    previewTab === "errors" 
                      ? "bg-destructive/20 ring-2 ring-destructive" 
                      : "bg-destructive/10 hover:bg-destructive/20"
                  }`}
                >
                  <div className="text-2xl font-bold text-destructive">{stats.invalid}</div>
                  <div className="text-xs text-muted-foreground">Errors</div>
                </button>
                <button
                  onClick={() => setPreviewTab("duplicates")}
                  className={`p-3 rounded-lg text-center transition-all ${
                    previewTab === "duplicates" 
                      ? "bg-warning/20 ring-2 ring-warning" 
                      : "bg-warning/10 hover:bg-warning/20"
                  }`}
                >
                  <div className="text-2xl font-bold text-warning">{stats.duplicates}</div>
                  <div className="text-xs text-muted-foreground">Duplicates</div>
                </button>
                <button
                  onClick={() => setPreviewTab("new-companies")}
                  className={`p-3 rounded-lg text-center transition-all ${
                    previewTab === "new-companies" 
                      ? "bg-primary/20 ring-2 ring-primary" 
                      : "bg-primary/10 hover:bg-primary/20"
                  }`}
                >
                  <div className="text-2xl font-bold text-primary">{stats.newCompanies.length}</div>
                  <div className="text-xs text-muted-foreground">New Companies</div>
                </button>
              </div>

              {/* New Companies Preview */}
              {stats.newCompanies.length > 0 && previewTab === "new-companies" && (
                <Alert>
                  <Building2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{stats.newCompanies.length} new {stats.newCompanies.length === 1 ? 'company' : 'companies'}</strong> will be created: {stats.newCompanies.join(", ")}
                  </AlertDescription>
                </Alert>
              )}

              {/* Contact List */}
              <div className="flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="h-[350px] border rounded-lg">
                  <div className="p-4 space-y-2 pb-8">
                    {filteredContacts.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No contacts in this category
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">
                          Click on any contact to edit
                        </p>
                        {filteredContacts.map((contact, index) => renderContactCard(contact, index))}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setParsedContacts([])}
                >
                  Upload Different File
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setOpen(false);
                      setParsedContacts([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={stats.valid === 0 || isImporting}
                  >
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {stats.valid} {stats.valid === 1 ? 'Contact' : 'Contacts'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      {/* Edit Contact Dialog */}
      <Dialog open={editingIndex !== null} onOpenChange={(isOpen) => {
        if (!isOpen) {
          setEditingIndex(null);
          setEditForm({});
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email || ""}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editForm.phone || ""}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                value={editForm.companyName || ""}
                onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-job-title">Job Title</Label>
              <Input
                id="edit-job-title"
                value={editForm.jobTitle || ""}
                onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                placeholder="Job title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editForm.address || ""}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Address"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => {
              setEditingIndex(null);
              setEditForm({});
            }}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
