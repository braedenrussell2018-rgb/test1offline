import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Upload, X, Plus, Scan } from "lucide-react";
import { inventoryStorage, Note, Branch } from "@/lib/inventory-storage";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AddPersonDialogProps {
  onPersonAdded: () => void;
}

export function AddPersonDialog({ onPersonAdded }: AddPersonDialogProps) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessCardPhoto, setBusinessCardPhoto] = useState<string>("");
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showNewBranchForm, setShowNewBranchForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  
  // Excavator lines state
  const [excavatorLines, setExcavatorLines] = useState<string[]>([]);
  const [excavatorInput, setExcavatorInput] = useState("");
  const [allExcavatorLines, setAllExcavatorLines] = useState<string[]>([]);
  const [showExcavatorDropdown, setShowExcavatorDropdown] = useState(false);
  const excavatorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inventoryStorage.getCompanies().then(setCompanies);
    inventoryStorage.getUniqueExcavatorLines().then(setAllExcavatorLines);
  }, []);

  // Load branches when company changes
  useEffect(() => {
    if (companyId) {
      inventoryStorage.getBranchesByCompany(companyId).then(setBranches);
      setBranchId(""); // Reset branch when company changes
      setShowNewBranchForm(false);
      setNewBranchName("");
    } else {
      setBranches([]);
      setBranchId("");
      setShowNewBranchForm(false);
      setNewBranchName("");
    }
  }, [companyId]);

  const handleCreateNewBranch = async () => {
    if (!newBranchName.trim() || !companyId) {
      toast({
        title: "Error",
        description: "Branch name is required",
        variant: "destructive",
      });
      return;
    }

    const newBranch = await inventoryStorage.addBranch({
      companyId,
      name: newBranchName.trim(),
    });

    setBranchId(newBranch.id);
    setNewBranchName("");
    setShowNewBranchForm(false);
    setBranches([...branches, newBranch]);
    
    toast({
      title: "Success",
      description: "Branch created successfully",
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBusinessCardPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setBusinessCardPhoto("");
  };

  const handleScanBusinessCard = async () => {
    if (!businessCardPhoto) {
      toast({
        title: "Error",
        description: "Please upload a business card photo first",
        variant: "destructive",
      });
      return;
    }

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-business-card', {
        body: { imageData: businessCardPhoto }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const { contactInfo } = data;
      
      // Auto-fill the form fields
      if (contactInfo.name) {
        const nameParts = contactInfo.name.trim().split(/\s+/);
        if (nameParts.length > 0) {
          setFirstName(nameParts[0]);
          if (nameParts.length > 1) {
            setLastName(nameParts.slice(1).join(' '));
          }
        }
      }
      
        if (contactInfo.company) {
        // Try to find existing company
        const companiesData = await inventoryStorage.getCompanies();
        const existingCompany = companiesData.find(
          c => c.name.toLowerCase() === contactInfo.company.toLowerCase()
        );
        
        if (existingCompany) {
          setCompanyId(existingCompany.id);
        } else {
          // Set up new company creation
          setNewCompanyName(contactInfo.company);
          setShowNewCompanyForm(true);
        }
      }
      
      if (contactInfo.jobTitle) setJobTitle(contactInfo.jobTitle);
      if (contactInfo.email) setEmail(contactInfo.email);
      if (contactInfo.phone) setPhone(contactInfo.phone);
      if (contactInfo.address) setAddress(contactInfo.address);

      toast({
        title: "Success",
        description: "Business card scanned successfully!",
      });
    } catch (error) {
      console.error('Error scanning business card:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to scan business card",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleCreateNewCompany = async () => {
    if (!newCompanyName.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    const newCompany = await inventoryStorage.addCompany(newCompanyName);

    setCompanyId(newCompany.id);
    setNewCompanyName("");
    setShowNewCompanyForm(false);
    setCompanies([...companies, newCompany]);
    
    toast({
      title: "Success",
      description: "Company created successfully",
    });
  };

  // Excavator line handlers
  const handleAddExcavatorLine = (line: string) => {
    const trimmedLine = line.trim().toLowerCase();
    if (trimmedLine && !excavatorLines.includes(trimmedLine)) {
      setExcavatorLines([...excavatorLines, trimmedLine]);
      // Add to allExcavatorLines if it's new
      if (!allExcavatorLines.includes(trimmedLine)) {
        setAllExcavatorLines([...allExcavatorLines, trimmedLine].sort());
      }
    }
    setExcavatorInput("");
    setShowExcavatorDropdown(false);
  };

  const handleRemoveExcavatorLine = (line: string) => {
    setExcavatorLines(excavatorLines.filter(l => l !== line));
  };

  const handleExcavatorInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (excavatorInput.trim()) {
        handleAddExcavatorLine(excavatorInput);
      }
    }
  };

  const filteredExcavatorLines = allExcavatorLines.filter(
    line => line.toLowerCase().includes(excavatorInput.toLowerCase()) && !excavatorLines.includes(line)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    if (!companyId && !showNewCompanyForm) {
      toast({
        title: "Error",
        description: "Please select a company or create a new one",
        variant: "destructive",
      });
      return;
    }

    inventoryStorage.addPerson({
      companyId,
      branchId: branchId || undefined,
      name: `${firstName.trim()} ${lastName.trim()}`,
      jobTitle: jobTitle || undefined,
      address: address || undefined,
      email: email || undefined,
      phone: phone || undefined,
      notes: notes ? [{ id: crypto.randomUUID(), text: notes, timestamp: new Date().toISOString() }] : [],
      excavatorLines: excavatorLines,
    });
    
    toast({
      title: "Success",
      description: "Contact added successfully",
    });
    
    // Reset form
    setFirstName("");
    setLastName("");
    setCompanyId("");
    setBranchId("");
    setJobTitle("");
    setAddress("");
    setNotes("");
    setEmail("");
    setPhone("");
    setBusinessCardPhoto("");
    setShowNewCompanyForm(false);
    setNewCompanyName("");
    setShowNewBranchForm(false);
    setNewBranchName("");
    setExcavatorLines([]);
    setExcavatorInput("");
    setOpen(false);
    onPersonAdded();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <UserPlus className="mr-2 h-5 w-5" />
          Add Person
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Person</DialogTitle>
            <DialogDescription>
              Add a new contact to your CRM
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="company">Company *</Label>
              {!showNewCompanyForm ? (
                <div className="flex gap-2">
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowNewCompanyForm(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="New company name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleCreateNewCompany}
                  >
                    Create
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowNewCompanyForm(false);
                      setNewCompanyName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Branch selector - only show if company is selected */}
            {companyId && (
              <div className="grid gap-2">
                <Label htmlFor="branch">Branch</Label>
                {!showNewBranchForm ? (
                  <div className="flex gap-2">
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a branch (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNewBranchForm(true)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="New branch name"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="default"
                      onClick={handleCreateNewBranch}
                    >
                      Create
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowNewBranchForm(false);
                        setNewBranchName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="jobTitle">Job Title</Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Sales Manager"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, City, State 12345"
                rows={2}
              />
            </div>

            {/* Excavator Line Field */}
            <div className="grid gap-2">
              <Label htmlFor="excavatorLine">Excavator Line</Label>
              <div className="relative">
                <div className="flex flex-wrap gap-2 p-2 border rounded-md bg-background min-h-[42px]">
                  {excavatorLines.map((line) => (
                    <Badge 
                      key={line} 
                      variant="secondary" 
                      className="flex items-center gap-1"
                    >
                      {line}
                      <X 
                        className="h-3 w-3 cursor-pointer hover:text-destructive" 
                        onClick={() => handleRemoveExcavatorLine(line)}
                      />
                    </Badge>
                  ))}
                  <Input
                    ref={excavatorInputRef}
                    id="excavatorLine"
                    value={excavatorInput}
                    onChange={(e) => {
                      setExcavatorInput(e.target.value);
                      setShowExcavatorDropdown(true);
                    }}
                    onFocus={() => setShowExcavatorDropdown(true)}
                    onBlur={() => {
                      // Delay hiding to allow click on dropdown items
                      setTimeout(() => setShowExcavatorDropdown(false), 200);
                    }}
                    onKeyDown={handleExcavatorInputKeyDown}
                    placeholder={excavatorLines.length === 0 ? "Type and press Enter..." : "Add more..."}
                    className="border-0 shadow-none focus-visible:ring-0 flex-1 min-w-[120px] p-0 h-auto"
                  />
                </div>
                
                {/* Dropdown for suggestions */}
                {showExcavatorDropdown && (excavatorInput || filteredExcavatorLines.length > 0) && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[150px] overflow-y-auto">
                    {filteredExcavatorLines.map((line) => (
                      <div
                        key={line}
                        className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddExcavatorLine(line);
                        }}
                      >
                        {line}
                      </div>
                    ))}
                    {excavatorInput.trim() && !allExcavatorLines.includes(excavatorInput.trim().toLowerCase()) && (
                      <div
                        className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddExcavatorLine(excavatorInput);
                        }}
                      >
                        Add "{excavatorInput.trim()}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Type a word and press Enter to add. Used for filtering contacts.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this contact..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="businessCard">Business Card Photo</Label>
              {businessCardPhoto ? (
                <div className="space-y-2">
                  <div className="relative">
                    <img
                      src={businessCardPhoto}
                      alt="Business card"
                      className="w-full h-48 object-contain border rounded-md bg-muted"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={handleRemovePhoto}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full"
                    onClick={handleScanBusinessCard}
                    disabled={isScanning}
                  >
                    <Scan className="mr-2 h-4 w-4" />
                    {isScanning ? "Scanning..." : "Scan Business Card with AI"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="businessCard"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload business card photo
                      </p>
                    </div>
                    <input
                      id="businessCard"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Add Person</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}