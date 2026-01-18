import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Person, Company, inventoryStorage } from "@/lib/inventory-storage";
import { Users, Merge, Mail, Phone, Building2, MapPin, Loader2 } from "lucide-react";

interface MergeDuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

interface DuplicateGroup<T> {
  key: string;
  items: T[];
  reason: string;
}

function normalizeString(str?: string): string {
  return (str || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

function countMatchingFields(person1: Person, person2: Person): { count: number; reasons: string[] } {
  const reasons: string[] = [];
  
  // Check name match
  const name1 = normalizeString(person1.name);
  const name2 = normalizeString(person2.name);
  if (name1 && name2 && (
    name1 === name2 ||
    name1.includes(name2) ||
    name2.includes(name1) ||
    levenshteinDistance(name1, name2) <= 2
  )) {
    reasons.push("name");
  }
  
  // Check email match
  const email1 = normalizeString(person1.email);
  const email2 = normalizeString(person2.email);
  if (email1 && email2 && email1 === email2) {
    reasons.push("email");
  }
  
  // Check phone match
  const phone1 = (person1.phone || "").replace(/\D/g, "");
  const phone2 = (person2.phone || "").replace(/\D/g, "");
  if (phone1.length >= 7 && phone2.length >= 7 && phone1 === phone2) {
    reasons.push("phone");
  }
  
  return { count: reasons.length, reasons };
}

function findPersonDuplicates(persons: Person[]): DuplicateGroup<Person>[] {
  const groups: DuplicateGroup<Person>[] = [];
  const processed = new Set<string>();

  // Find contacts with 2+ matching fields
  persons.forEach((person, index) => {
    if (processed.has(person.id)) return;

    const matches = persons.filter((p, i) => {
      if (i === index || processed.has(p.id)) return false;
      const { count } = countMatchingFields(person, p);
      return count >= 2; // Require at least 2 matching fields
    });

    if (matches.length > 0) {
      const allInGroup = [person, ...matches];
      
      // Determine the reason string based on what fields match
      const sampleMatch = countMatchingFields(person, matches[0]);
      const reasonText = sampleMatch.reasons.length === 3 
        ? "Same name, email & phone" 
        : `Same ${sampleMatch.reasons.join(" & ")}`;
      
      allInGroup.forEach((p) => processed.add(p.id));
      groups.push({
        key: `multi-${person.id}`,
        items: allInGroup,
        reason: reasonText,
      });
    }
  });

  return groups;
}

function findCompanyDuplicates(companies: Company[]): DuplicateGroup<Company>[] {
  const groups: DuplicateGroup<Company>[] = [];
  const processed = new Set<string>();

  companies.forEach((company, index) => {
    if (processed.has(company.id)) return;

    const normalizedName = normalizeString(company.name);
    const similar = companies.filter((c, i) => {
      if (i === index || processed.has(c.id)) return false;
      const otherName = normalizeString(c.name);
      return (
        normalizedName === otherName ||
        normalizedName.includes(otherName) ||
        otherName.includes(normalizedName) ||
        levenshteinDistance(normalizedName, otherName) <= 2
      );
    });

    if (similar.length > 0) {
      const allInGroup = [company, ...similar];
      allInGroup.forEach((c) => processed.add(c.id));
      groups.push({
        key: `company-${company.id}`,
        items: allInGroup,
        reason: "Similar names",
      });
    }
  });

  return groups;
}

export function MergeDuplicatesDialog({
  open,
  onOpenChange,
  onMerged,
}: MergeDuplicatesDialogProps) {
  const [selectedPersonGroups, setSelectedPersonGroups] = useState<Map<string, string[]>>(new Map());
  const [selectedCompanyGroups, setSelectedCompanyGroups] = useState<Map<string, string[]>>(new Map());
  const [isMerging, setIsMerging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [persons, setPersons] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Fetch fresh data when dialog opens
  useEffect(() => {
    if (open) {
      setIsLoading(true);
      Promise.all([
        inventoryStorage.getPersons(),
        inventoryStorage.getCompanies(),
      ])
        .then(([personsData, companiesData]) => {
          setPersons(personsData);
          setCompanies(companiesData);
        })
        .catch((error) => {
          console.error("Error loading data:", error);
          toast.error("Failed to load data");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open]);

  const personDuplicates = useMemo(() => findPersonDuplicates(persons), [persons]);
  const companyDuplicates = useMemo(() => findCompanyDuplicates(companies), [companies]);

  const togglePersonSelection = (groupKey: string, personId: string) => {
    setSelectedPersonGroups((prev) => {
      const newMap = new Map(prev);
      const groupSelection = newMap.get(groupKey) || [];
      if (groupSelection.includes(personId)) {
        newMap.set(groupKey, groupSelection.filter((id) => id !== personId));
      } else {
        newMap.set(groupKey, [...groupSelection, personId]);
      }
      return newMap;
    });
  };

  const toggleCompanySelection = (groupKey: string, companyId: string) => {
    setSelectedCompanyGroups((prev) => {
      const newMap = new Map(prev);
      const groupSelection = newMap.get(groupKey) || [];
      if (groupSelection.includes(companyId)) {
        newMap.set(groupKey, groupSelection.filter((id) => id !== companyId));
      } else {
        newMap.set(groupKey, [...groupSelection, companyId]);
      }
      return newMap;
    });
  };

  const handleMergePersons = async (group: DuplicateGroup<Person>) => {
    let selectedIds = selectedPersonGroups.get(group.key) || [];
    
    // If exactly 2 items in group, merge both regardless of selection
    if (group.items.length === 2) {
      selectedIds = group.items.map(item => item.id);
    }
    
    if (selectedIds.length < 2) {
      toast.error("Select at least 2 contacts to merge");
      return;
    }

    setIsMerging(true);
    try {
      const primaryId = selectedIds[0];
      const primaryContact = group.items.find((c) => c.id === primaryId)!;
      const otherIds = selectedIds.slice(1);

      const mergedContact = { ...primaryContact };
      otherIds.forEach((id) => {
        const contact = group.items.find((c) => c.id === id)!;
        if (!mergedContact.email && contact.email) mergedContact.email = contact.email;
        if (!mergedContact.phone && contact.phone) mergedContact.phone = contact.phone;
        if (!mergedContact.address && contact.address) mergedContact.address = contact.address;
        if (!mergedContact.jobTitle && contact.jobTitle) mergedContact.jobTitle = contact.jobTitle;
        mergedContact.notes = [...(mergedContact.notes || []), ...(contact.notes || [])];
      });

      await inventoryStorage.updatePerson(mergedContact);

      for (const id of otherIds) {
        await inventoryStorage.deletePerson(id);
      }

      toast.success(`Merged ${selectedIds.length} contacts`);
      setSelectedPersonGroups((prev) => {
        const newMap = new Map(prev);
        newMap.delete(group.key);
        return newMap;
      });
      onMerged();
    } catch (error) {
      console.error("Error merging contacts:", error);
      toast.error("Failed to merge contacts");
    } finally {
      setIsMerging(false);
    }
  };

  const handleMergeCompanies = async (group: DuplicateGroup<Company>) => {
    let selectedIds = selectedCompanyGroups.get(group.key) || [];
    
    // If exactly 2 items in group, merge both regardless of selection
    if (group.items.length === 2) {
      selectedIds = group.items.map(item => item.id);
    }
    
    if (selectedIds.length < 2) {
      toast.error("Select at least 2 companies to merge");
      return;
    }

    setIsMerging(true);
    try {
      const primaryId = selectedIds[0];
      const primaryCompany = group.items.find((c) => c.id === primaryId)!;
      const otherIds = selectedIds.slice(1);

      const mergedCompany = { ...primaryCompany };
      otherIds.forEach((id) => {
        const company = group.items.find((c) => c.id === id)!;
        if (!mergedCompany.address && company.address) mergedCompany.address = company.address;
        mergedCompany.notes = [...(mergedCompany.notes || []), ...(company.notes || [])];
      });

      await inventoryStorage.updateCompany(mergedCompany);

      for (const id of otherIds) {
        await inventoryStorage.deleteCompany(id);
      }

      toast.success(`Merged ${selectedIds.length} companies`);
      setSelectedCompanyGroups((prev) => {
        const newMap = new Map(prev);
        newMap.delete(group.key);
        return newMap;
      });
      onMerged();
    } catch (error) {
      console.error("Error merging companies:", error);
      toast.error("Failed to merge companies");
    } finally {
      setIsMerging(false);
    }
  };

  // Helper to check if merge button should be enabled
  const canMergePersonGroup = (group: DuplicateGroup<Person>) => {
    // Always allow merge if exactly 2 items, or if 2+ are selected
    if (group.items.length === 2) return true;
    const selected = selectedPersonGroups.get(group.key)?.length || 0;
    return selected >= 2;
  };

  const canMergeCompanyGroup = (group: DuplicateGroup<Company>) => {
    // Always allow merge if exactly 2 items, or if 2+ are selected
    if (group.items.length === 2) return true;
    const selected = selectedCompanyGroups.get(group.key)?.length || 0;
    return selected >= 2;
  };

  // Auto merge all contact duplicates
  const handleAutoMergeAllContacts = async () => {
    if (personDuplicates.length === 0) return;
    
    setIsMerging(true);
    let mergedCount = 0;
    
    try {
      for (const group of personDuplicates) {
        const selectedIds = group.items.map(item => item.id);
        const primaryId = selectedIds[0];
        const primaryContact = group.items.find((c) => c.id === primaryId)!;
        const otherIds = selectedIds.slice(1);

        const mergedContact = { ...primaryContact };
        otherIds.forEach((id) => {
          const contact = group.items.find((c) => c.id === id)!;
          if (!mergedContact.email && contact.email) mergedContact.email = contact.email;
          if (!mergedContact.phone && contact.phone) mergedContact.phone = contact.phone;
          if (!mergedContact.address && contact.address) mergedContact.address = contact.address;
          if (!mergedContact.jobTitle && contact.jobTitle) mergedContact.jobTitle = contact.jobTitle;
          mergedContact.notes = [...(mergedContact.notes || []), ...(contact.notes || [])];
        });

        await inventoryStorage.updatePerson(mergedContact);

        for (const id of otherIds) {
          await inventoryStorage.deletePerson(id);
        }
        
        mergedCount++;
      }

      toast.success(`Auto-merged ${mergedCount} duplicate groups`);
      setSelectedPersonGroups(new Map());
      onMerged();
    } catch (error) {
      console.error("Error auto-merging contacts:", error);
      toast.error("Failed to auto-merge contacts");
    } finally {
      setIsMerging(false);
    }
  };

  // Auto merge all company duplicates
  const handleAutoMergeAllCompanies = async () => {
    if (companyDuplicates.length === 0) return;
    
    setIsMerging(true);
    let mergedCount = 0;
    
    try {
      for (const group of companyDuplicates) {
        const selectedIds = group.items.map(item => item.id);
        const primaryId = selectedIds[0];
        const primaryCompany = group.items.find((c) => c.id === primaryId)!;
        const otherIds = selectedIds.slice(1);

        const mergedCompany = { ...primaryCompany };
        otherIds.forEach((id) => {
          const company = group.items.find((c) => c.id === id)!;
          if (!mergedCompany.address && company.address) mergedCompany.address = company.address;
          mergedCompany.notes = [...(mergedCompany.notes || []), ...(company.notes || [])];
        });

        await inventoryStorage.updateCompany(mergedCompany);

        for (const id of otherIds) {
          await inventoryStorage.deleteCompany(id);
        }
        
        mergedCount++;
      }

      toast.success(`Auto-merged ${mergedCount} duplicate groups`);
      setSelectedCompanyGroups(new Map());
      onMerged();
    } catch (error) {
      console.error("Error auto-merging companies:", error);
      toast.error("Failed to auto-merge companies");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Find & Merge Duplicates
          </DialogTitle>
          <DialogDescription>
            Contacts with 2+ matching fields (name, email, phone) are flagged as duplicates
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
        <Tabs defaultValue="contacts" className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts ({personDuplicates.length})
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Companies ({companyDuplicates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="flex-1 min-h-0 mt-4">
            {personDuplicates.length > 0 && (
              <div className="flex justify-end mb-4">
                <Button
                  onClick={handleAutoMergeAllContacts}
                  disabled={isMerging}
                  variant="default"
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Auto Merge All ({personDuplicates.length} groups)
                </Button>
              </div>
            )}
            <ScrollArea className="h-[55vh] pr-4">
              {personDuplicates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No duplicate contacts found (requires 2+ matching fields)
                </div>
              ) : (
                <div className="space-y-6">
                  {personDuplicates.map((group) => (
                    <div key={group.key} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <Badge variant="secondary">{group.reason}</Badge>
                        <Button
                          size="sm"
                          onClick={() => handleMergePersons(group)}
                          disabled={isMerging || !canMergePersonGroup(group)}
                        >
                          <Merge className="h-4 w-4 mr-1" />
                          {group.items.length === 2 ? "Merge Both" : "Merge Selected"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedPersonGroups.get(group.key)?.includes(contact.id) || false}
                              onCheckedChange={() => togglePersonSelection(group.key, contact.id)}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{contact.name}</div>
                              <div className="text-sm text-muted-foreground flex gap-4">
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {contact.email}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        First selected contact will be kept; others will be merged into it
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="companies" className="flex-1 min-h-0 mt-4">
            {companyDuplicates.length > 0 && (
              <div className="flex justify-end mb-4">
                <Button
                  onClick={handleAutoMergeAllCompanies}
                  disabled={isMerging}
                  variant="default"
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Auto Merge All ({companyDuplicates.length} groups)
                </Button>
              </div>
            )}
            <ScrollArea className="h-[55vh] pr-4">
              {companyDuplicates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No duplicate companies found
                </div>
              ) : (
                <div className="space-y-6">
                  {companyDuplicates.map((group) => (
                    <div key={group.key} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <Badge variant="secondary">{group.reason}</Badge>
                        <Button
                          size="sm"
                          onClick={() => handleMergeCompanies(group)}
                          disabled={isMerging || !canMergeCompanyGroup(group)}
                        >
                          <Merge className="h-4 w-4 mr-1" />
                          {group.items.length === 2 ? "Merge Both" : "Merge Selected"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((company) => (
                          <div
                            key={company.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedCompanyGroups.get(group.key)?.includes(company.id) || false}
                              onCheckedChange={() => toggleCompanySelection(group.key, company.id)}
                            />
                            <div className="flex-1">
                              <div className="font-medium flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {company.name}
                              </div>
                              {company.address && (
                                <div className="text-sm text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {company.address}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        First selected company will be kept; others will be merged into it
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        )}

        <div className="flex justify-end flex-shrink-0 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
