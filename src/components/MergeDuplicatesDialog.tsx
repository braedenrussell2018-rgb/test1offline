import { useState, useMemo } from "react";
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
import { toast } from "sonner";
import { Person, inventoryStorage } from "@/lib/inventory-storage";
import { Users, Merge, Mail, Phone } from "lucide-react";

interface MergeDuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  persons: Person[];
  onMerged: () => void;
}

interface DuplicateGroup {
  key: string;
  contacts: Person[];
  reason: string;
}

function normalizeString(str?: string): string {
  return (str || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function findDuplicates(persons: Person[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // Find by similar name
  persons.forEach((person, index) => {
    if (processed.has(person.id)) return;

    const normalizedName = normalizeString(person.name);
    const similar = persons.filter((p, i) => {
      if (i === index || processed.has(p.id)) return false;
      const otherName = normalizeString(p.name);
      // Check for exact match or partial match
      return (
        normalizedName === otherName ||
        normalizedName.includes(otherName) ||
        otherName.includes(normalizedName) ||
        levenshteinDistance(normalizedName, otherName) <= 2
      );
    });

    if (similar.length > 0) {
      const allInGroup = [person, ...similar];
      allInGroup.forEach((p) => processed.add(p.id));
      groups.push({
        key: `name-${person.id}`,
        contacts: allInGroup,
        reason: "Similar names",
      });
    }
  });

  // Find by same email
  const emailMap = new Map<string, Person[]>();
  persons.forEach((person) => {
    if (person.email && !processed.has(person.id)) {
      const email = normalizeString(person.email);
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(person);
    }
  });

  emailMap.forEach((contacts, email) => {
    if (contacts.length > 1) {
      contacts.forEach((p) => processed.add(p.id));
      groups.push({
        key: `email-${email}`,
        contacts,
        reason: "Same email",
      });
    }
  });

  // Find by same phone
  const phoneMap = new Map<string, Person[]>();
  persons.forEach((person) => {
    if (person.phone && !processed.has(person.id)) {
      const phone = person.phone.replace(/\D/g, "");
      if (phone.length >= 7) {
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone)!.push(person);
      }
    }
  });

  phoneMap.forEach((contacts, phone) => {
    if (contacts.length > 1) {
      contacts.forEach((p) => processed.add(p.id));
      groups.push({
        key: `phone-${phone}`,
        contacts,
        reason: "Same phone",
      });
    }
  });

  return groups;
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

export function MergeDuplicatesDialog({
  open,
  onOpenChange,
  persons,
  onMerged,
}: MergeDuplicatesDialogProps) {
  const [selectedGroups, setSelectedGroups] = useState<Map<string, string[]>>(
    new Map()
  );
  const [isMerging, setIsMerging] = useState(false);

  const duplicateGroups = useMemo(() => findDuplicates(persons), [persons]);

  const toggleContactSelection = (groupKey: string, contactId: string) => {
    setSelectedGroups((prev) => {
      const newMap = new Map(prev);
      const groupSelection = newMap.get(groupKey) || [];

      if (groupSelection.includes(contactId)) {
        newMap.set(
          groupKey,
          groupSelection.filter((id) => id !== contactId)
        );
      } else {
        newMap.set(groupKey, [...groupSelection, contactId]);
      }

      return newMap;
    });
  };

  const handleMerge = async (group: DuplicateGroup) => {
    const selectedIds = selectedGroups.get(group.key) || [];
    if (selectedIds.length < 2) {
      toast.error("Select at least 2 contacts to merge");
      return;
    }

    setIsMerging(true);
    try {
      // The first selected contact will be the primary (kept)
      const primaryId = selectedIds[0];
      const primaryContact = group.contacts.find((c) => c.id === primaryId)!;
      const otherIds = selectedIds.slice(1);

      // Merge data from other contacts into primary
      const mergedContact = { ...primaryContact };
      otherIds.forEach((id) => {
        const contact = group.contacts.find((c) => c.id === id)!;
        if (!mergedContact.email && contact.email) mergedContact.email = contact.email;
        if (!mergedContact.phone && contact.phone) mergedContact.phone = contact.phone;
        if (!mergedContact.address && contact.address) mergedContact.address = contact.address;
        if (!mergedContact.jobTitle && contact.jobTitle) mergedContact.jobTitle = contact.jobTitle;
        // Merge notes
        mergedContact.notes = [...(mergedContact.notes || []), ...(contact.notes || [])];
      });

      // Update primary contact
      await inventoryStorage.updatePerson(mergedContact);

      // Delete other contacts
      for (const id of otherIds) {
        await inventoryStorage.deletePerson(id);
      }

      toast.success(`Merged ${selectedIds.length} contacts`);
      setSelectedGroups((prev) => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Find & Merge Duplicates
          </DialogTitle>
          <DialogDescription>
            Review potential duplicate contacts and merge them
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {duplicateGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No potential duplicates found
            </div>
          ) : (
            <div className="space-y-6">
              {duplicateGroups.map((group) => (
                <div key={group.key} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <Badge variant="secondary">{group.reason}</Badge>
                    <Button
                      size="sm"
                      onClick={() => handleMerge(group)}
                      disabled={
                        isMerging ||
                        (selectedGroups.get(group.key)?.length || 0) < 2
                      }
                    >
                      <Merge className="h-4 w-4 mr-1" />
                      Merge Selected
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {group.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={
                            selectedGroups.get(group.key)?.includes(contact.id) ||
                            false
                          }
                          onCheckedChange={() =>
                            toggleContactSelection(group.key, contact.id)
                          }
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

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
