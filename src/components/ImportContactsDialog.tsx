import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Upload, Download, CheckCircle2, XCircle, AlertCircle, Loader2, Building2, Users, Mail, Phone, MapPin, Briefcase, Pencil, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { inventoryStorage, Company } from "@/lib/inventory-storage";
import { createTemplate, readExcelFile } from "@/lib/excel-utils";
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
  notes?: string;
  excavatorLines?: string[];
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
  const [isUpdating, setIsUpdating] = useState(false);
  const [previewTab, setPreviewTab] = useState("all");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParsedContact>>({});
  const [existingPersons, setExistingPersons] = useState<{ id: string; name: string; email?: string; jobTitle?: string }[]>([]);
  const { toast } = useToast();

  const downloadTemplate = async () => {
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

    await createTemplate(template, "Contacts", "contacts_template.xlsx");

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

  // Extract all emails from a row
  const extractEmails = (item: Record<string, unknown>): string[] => {
    const emails: string[] = [];
    
    // Check all possible email columns
    const emailColumns = [
      "Person - Email - Work",
      "Person - Email - Home", 
      "Person - Email - Other",
      "Email",
      "email",
      "Email Address"
    ];
    
    for (const col of emailColumns) {
      const val = item[col];
      if (val && typeof val === 'string') {
        const cleaned = val.trim();
        // Handle escaped @ symbols like "email\@domain.com"
        const unescaped = cleaned.replace(/\\@/g, '@');
        if (unescaped && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(unescaped)) {
          emails.push(unescaped);
        }
      }
    }
    
    return [...new Set(emails)]; // Remove duplicates
  };

  // Pre-process rows to expand multiple emails into separate contacts
  const preprocessRows = (rows: Record<string, unknown>[]): Record<string, unknown>[] => {
    const expandedRows: Record<string, unknown>[] = [];
    
    for (const row of rows) {
      const emails = extractEmails(row);
      
      if (emails.length <= 1) {
        // Single or no email - keep as is but clean up the email
        const cleanedRow = { ...row };
        if (emails.length === 1) {
          cleanedRow['_processedEmail'] = emails[0];
        }
        expandedRows.push(cleanedRow);
      } else {
        // Multiple emails - create a row for each email
        for (const email of emails) {
          expandedRows.push({
            ...row,
            '_processedEmail': email,
            '_isAdditionalEmail': email !== emails[0]
          });
        }
      }
    }
    
    return expandedRows;
  };

  const validateContact = async (
    item: Record<string, unknown>,
    existingPersons: { name: string; email?: string }[],
    companies: Company[],
    alreadyParsed: { name: string; email?: string }[] = []
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
    
    // Use preprocessed email if available, otherwise extract
    let email: string | undefined;
    if (item['_processedEmail']) {
      email = String(item['_processedEmail']).trim();
    } else {
      const emails = extractEmails(item);
      email = emails[0];
    }
    
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
    
    // Support state/address column - prefer full address
    const address = String(
      item["Person - Full/combined address of State"] ||
      item["Person - Full/combined address of Postal address"] ||
      item["Person - Postal address"] ||
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
    
    // Support multiple job title column formats - prioritize "Person - Job title" (column Z) over "Person - Job Title" (column X)
    const jobTitle = String(
      item["Person - Job title"] ||  // Column Z - primary job titles
      item["Person - Job Title"] ||  // Column X - secondary/contact type
      item["Person - Contact Type"] ||
      item.JobTitle || 
      item.jobTitle || 
      item["Job Title"] || 
      item.Title || 
      item.title || 
      ""
    ).trim() || undefined;

    // Parse notes from column L (Person - Notes)
    const notes = String(
      item["Person - Notes"] ||
      item.Notes ||
      item.notes ||
      ""
    ).trim() || undefined;

    // Parse excavator lines from column M (Person - Excavator line)
    const excavatorLinesRaw = String(
      item["Person - Excavator line"] ||
      item["Excavator Lines"] ||
      item.excavatorLines ||
      ""
    ).trim();
    const excavatorLines = excavatorLinesRaw 
      ? excavatorLinesRaw.split(",").map(s => s.trim()).filter(Boolean)
      : undefined;

    let isDuplicate = false;
    let isNewCompany = false;

    // Required field validation
    if (!fullName) {
      errors.push("Missing name (required)");
    }

    // Combine existing persons with already parsed contacts for duplicate checking
    const allExisting = [...existingPersons, ...alreadyParsed];

    // Check for duplicate by name or email (only if not an additional email for same person)
    const isAdditionalEmail = item['_isAdditionalEmail'] === true;
    
    if (!isAdditionalEmail) {
      if (fullName && existingPersons.some(p => p.name.toLowerCase() === fullName.toLowerCase())) {
        errors.push("Duplicate: Contact with this name already exists");
        isDuplicate = true;
      }
    }
    
    if (email && allExisting.some(p => p.email?.toLowerCase() === email?.toLowerCase())) {
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
      notes,
      excavatorLines,
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
      const rawData = await readExcelFile(file);

      if (rawData.length === 0) {
        toast({
          title: "Error",
          description: "The Excel file is empty",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Pre-process to expand multiple emails into separate rows
      const jsonData = preprocessRows(rawData);

      // Get existing data for validation
      const [existingPersonsData, companies] = await Promise.all([
        inventoryStorage.getPersons(),
        inventoryStorage.getCompanies()
      ]);
      
      setExistingCompanies(companies);
      setExistingPersons(existingPersonsData.map(p => ({ id: p.id, name: p.name, email: p.email, jobTitle: p.jobTitle })));
      const existingForCheck = existingPersonsData.map(p => ({ name: p.name, email: p.email }));

      // Validate sequentially to check for duplicates within the import batch
      const validated: ParsedContact[] = [];
      for (const item of jsonData) {
        const alreadyParsed = validated.map(c => ({ name: c.name, email: c.email }));
        const contact = await validateContact(item as Record<string, unknown>, existingForCheck, companies, alreadyParsed);
        validated.push(contact);
      }
      
      setParsedContacts(validated);
      setPreviewTab("all");

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

  const handleImport = async (): Promise<{ imported: ParsedContact[], failed: ParsedContact[] }> => {
    const validContacts = parsedContacts.filter(contact => contact.valid);
    
    if (validContacts.length === 0) {
      toast({
        title: "Error",
        description: "No valid contacts to import",
        variant: "destructive",
      });
      return { imported: [], failed: parsedContacts };
    }

    setIsImporting(true);
    
    const imported: ParsedContact[] = [];
    const failed: ParsedContact[] = [];

    try {
      let companies = [...existingCompanies];
      const createdCompanies = new Map<string, string>();
      let newCompaniesCount = 0;
      
      // Process contacts in batches of 10 to avoid overwhelming the database
      const batchSize = 10;
      
      for (let i = 0; i < validContacts.length; i += batchSize) {
        const batch = validContacts.slice(i, Math.min(i + batchSize, validContacts.length));
        
        for (const contact of batch) {
          try {
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
            
            imported.push(contact);
          } catch (contactError) {
            console.error(`Failed to import contact ${contact.name}:`, contactError);
            failed.push({
              ...contact,
              valid: false,
              errors: [...contact.errors, `Import failed: ${contactError instanceof Error ? contactError.message : 'Unknown error'}`]
            });
          }
        }
        
        // Small delay between batches to prevent overwhelming the API
        if (i + batchSize < validContacts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Add invalid contacts to failed list
      const invalidContacts = parsedContacts.filter(c => !c.valid);
      failed.push(...invalidContacts);

      const companiesMessage = newCompaniesCount > 0 
        ? ` and created ${newCompaniesCount} new ${newCompaniesCount === 1 ? 'company' : 'companies'}`
        : '';
      
      const failedMessage = failed.length > 0
        ? `. ${failed.length} contacts could not be imported.`
        : '';
      
      toast({
        title: imported.length > 0 ? "Import Complete" : "Import Failed",
        description: `Imported ${imported.length} contacts${companiesMessage}${failedMessage}`,
        variant: imported.length > 0 ? "default" : "destructive",
      });

      // If there were failures, show them instead of closing
      if (failed.length > 0) {
        setParsedContacts(failed);
        setPreviewTab("errors");
      } else {
        setParsedContacts([]);
        setOpen(false);
      }
      
      onContactsImported();
      return { imported, failed };
    } catch (error) {
      console.error("Error importing contacts:", error);
      toast({
        title: "Error",
        description: "Failed to import contacts. Please try again.",
        variant: "destructive",
      });
      return { imported, failed: [...failed, ...validContacts.filter(c => !imported.includes(c))] };
    } finally {
      setIsImporting(false);
    }
  };

  // Update existing contacts with job titles, notes, and excavator lines from the parsed data
  const handleUpdateExisting = async () => {
    // Get all duplicate contacts that have job title, notes, or excavator lines
    const duplicateContacts = parsedContacts.filter(c => 
      c.isDuplicate && (c.jobTitle || c.notes || (c.excavatorLines && c.excavatorLines.length > 0))
    );
    
    if (duplicateContacts.length === 0) {
      toast({
        title: "No Updates",
        description: "No duplicate contacts with data to update",
      });
      return;
    }

    setIsUpdating(true);
    let updatedCount = 0;
    let jobTitlesUpdated = 0;
    let notesAdded = 0;
    let excavatorLinesUpdated = 0;

    try {
      // Get fresh list of existing persons
      const allPersons = await inventoryStorage.getPersons();
      
      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < duplicateContacts.length; i += batchSize) {
        const batch = duplicateContacts.slice(i, Math.min(i + batchSize, duplicateContacts.length));
        
        for (const contact of batch) {
          // Find matching person by name or email
          const matchingPerson = allPersons.find(p => 
            p.name.toLowerCase() === contact.name.toLowerCase() ||
            (contact.email && p.email?.toLowerCase() === contact.email.toLowerCase())
          );
          
          if (matchingPerson) {
            let needsUpdate = false;
            const updates: Partial<typeof matchingPerson> = {};
            
            // Update job title if different and available
            if (contact.jobTitle && matchingPerson.jobTitle !== contact.jobTitle) {
              updates.jobTitle = contact.jobTitle;
              needsUpdate = true;
              jobTitlesUpdated++;
            }
            
            // Add notes if available (append to existing notes)
            if (contact.notes) {
              const existingNotes = matchingPerson.notes || [];
              // Check if this note already exists
              const noteExists = existingNotes.some(n => n.text === contact.notes);
              if (!noteExists) {
                updates.notes = [
                  ...existingNotes,
                  { id: crypto.randomUUID(), text: contact.notes, timestamp: new Date().toISOString() }
                ];
                needsUpdate = true;
                notesAdded++;
              }
            }
            
            // Update excavator lines if available
            if (contact.excavatorLines && contact.excavatorLines.length > 0) {
              const existingLines = matchingPerson.excavatorLines || [];
              const newLines = [...new Set([...existingLines, ...contact.excavatorLines])];
              if (newLines.length !== existingLines.length) {
                updates.excavatorLines = newLines;
                needsUpdate = true;
                excavatorLinesUpdated++;
              }
            }
            
            if (needsUpdate) {
              try {
                await inventoryStorage.updatePerson({
                  ...matchingPerson,
                  ...updates,
                });
                updatedCount++;
              } catch (err) {
                console.error(`Failed to update ${contact.name}:`, err);
              }
            }
          }
        }
        
        // Small delay between batches
        if (i + batchSize < duplicateContacts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const details = [];
      if (jobTitlesUpdated > 0) details.push(`${jobTitlesUpdated} job titles`);
      if (notesAdded > 0) details.push(`${notesAdded} notes`);
      if (excavatorLinesUpdated > 0) details.push(`${excavatorLinesUpdated} excavator lines`);

      toast({
        title: "Contacts Updated",
        description: `Updated ${updatedCount} contacts: ${details.join(', ') || 'no changes needed'}`,
      });

      // Refresh the data
      setParsedContacts([]);
      setOpen(false);
      onContactsImported();
    } catch (error) {
      console.error("Error updating contacts:", error);
      toast({
        title: "Error",
        description: "Failed to update contacts",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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
                <div className="flex gap-2 flex-wrap">
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
                  {stats.duplicates > 0 && (
                    <Button
                      variant="secondary"
                      onClick={handleUpdateExisting}
                      disabled={isUpdating || isImporting}
                    >
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Update {stats.duplicates} Existing
                    </Button>
                  )}
                  <Button
                    onClick={handleImport}
                    disabled={stats.valid === 0 || isImporting || isUpdating}
                  >
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {stats.valid} New
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
