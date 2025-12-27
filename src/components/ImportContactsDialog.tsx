import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage } from "@/lib/inventory-storage";
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
}

export const ImportContactsDialog = ({ onContactsImported }: ImportContactsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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

  const validateContact = async (item: any, existingPersons: { name: string; email?: string }[]): Promise<ParsedContact> => {
    const errors: string[] = [];
    
    const name = String(item.Name || item.name || item["Full Name"] || item["First Name"] || "").trim();
    const lastName = String(item["Last Name"] || item.lastName || "").trim();
    const fullName = lastName ? `${name} ${lastName}` : name;
    
    const email = String(item.Email || item.email || item["Email Address"] || "").trim() || undefined;
    const phone = String(item.Phone || item.phone || item["Phone Number"] || item.PhoneNumber || "").trim() || undefined;
    const address = String(item.Address || item.address || "").trim() || undefined;
    const companyName = String(item.Company || item.company || item["Company Name"] || item.CompanyName || "").trim() || undefined;
    const jobTitle = String(item.JobTitle || item.jobTitle || item["Job Title"] || item.Title || item.title || "").trim() || undefined;

    if (!fullName) {
      errors.push("Missing name");
    }

    // Check for duplicate by name or email
    if (fullName && existingPersons.some(p => p.name.toLowerCase() === fullName.toLowerCase())) {
      errors.push("Contact with this name already exists");
    }
    if (email && existingPersons.some(p => p.email?.toLowerCase() === email.toLowerCase())) {
      errors.push("Contact with this email already exists");
    }

    // Basic email validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push("Invalid email format");
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

      // Get existing persons for duplicate checking
      const existingPersons = await inventoryStorage.getPersons();
      const existingForCheck = existingPersons.map(p => ({ name: p.name, email: p.email }));

      const validated = await Promise.all(jsonData.map((item) => validateContact(item, existingForCheck)));
      setParsedContacts(validated);

      const validCount = validated.filter(item => item.valid).length;
      const invalidCount = validated.length - validCount;

      if (invalidCount > 0) {
        toast({
          title: "Validation Complete",
          description: `${validCount} valid contacts, ${invalidCount} contacts with errors`,
          variant: "default",
        });
      } else {
        toast({
          title: "Validation Complete",
          description: `All ${validCount} contacts are valid and ready to import`,
        });
      }
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
      // Get existing companies
      let companies = await inventoryStorage.getCompanies();
      
      // Track new companies created during import
      const createdCompanies = new Map<string, string>(); // companyName -> companyId
      let newCompaniesCount = 0;
      
      for (const contact of validContacts) {
        let companyId: string | undefined;
        
        if (contact.companyName) {
          const companyNameLower = contact.companyName.toLowerCase();
          
          // Check if we already created this company in this import session
          if (createdCompanies.has(companyNameLower)) {
            companyId = createdCompanies.get(companyNameLower);
          } else {
            // Try to find existing company
            const matchingCompany = companies.find(
              c => c.name.toLowerCase() === companyNameLower
            );
            
            if (matchingCompany) {
              companyId = matchingCompany.id;
            } else {
              // Create new company
              const newCompany = await inventoryStorage.addCompany(contact.companyName);
              companyId = newCompany.id;
              createdCompanies.set(companyNameLower, companyId);
              companies = [...companies, newCompany]; // Add to local list
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

  const validCount = parsedContacts.filter(item => item.valid).length;
  const invalidCount = parsedContacts.length - validCount;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setParsedContacts([]);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Import Contacts
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
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

          {parsedContacts.length > 0 && (
            <>
              <div className="flex gap-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">
                    <strong>{validCount}</strong> Valid
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">
                    <strong>{invalidCount}</strong> Invalid
                  </span>
                </div>
              </div>

              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-4 space-y-2">
                  {parsedContacts.map((contact, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg ${
                        contact.valid ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{contact.name || "(missing)"}</span>
                            <Badge variant={contact.valid ? "default" : "destructive"}>
                              {contact.valid ? "Valid" : "Invalid"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {contact.email && <p>Email: {contact.email}</p>}
                            {contact.phone && <p>Phone: {contact.phone}</p>}
                            {contact.companyName && <p>Company: {contact.companyName}</p>}
                            {contact.jobTitle && <p>Job Title: {contact.jobTitle}</p>}
                          </div>
                          {contact.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {contact.errors.map((error, errorIndex) => (
                                <p key={errorIndex} className="text-xs text-destructive flex items-center gap-1">
                                  <XCircle className="h-3 w-3" />
                                  {error}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setParsedContacts([])}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0 || isImporting}
                >
                  {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {validCount} {validCount === 1 ? 'Contact' : 'Contacts'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
