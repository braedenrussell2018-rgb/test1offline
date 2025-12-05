import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, User, Mail, Phone, Briefcase, MapPin, Edit, X, Check, Plus, GitBranch, Trash2 } from "lucide-react";
import { Company, Person, Branch, inventoryStorage } from "@/lib/inventory-storage";

interface CompanyDetailDialogProps {
  company: Company;
  persons: Person[];
  onPersonClick: (person: Person) => void;
  onUpdate: () => void;
  children: React.ReactNode;
}

export const CompanyDetailDialog = ({ company, persons, onPersonClick, onUpdate, children }: CompanyDetailDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCompany, setEditedCompany] = useState<Company>(company);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isAddingBranch, setIsAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchAddress, setNewBranchAddress] = useState("");

  useEffect(() => {
    if (open) {
      inventoryStorage.getBranchesByCompany(company.id).then(setBranches);
    }
  }, [open, company.id]);

  const handleSaveEdit = () => {
    inventoryStorage.updateCompany(editedCompany);
    setIsEditing(false);
    onUpdate();
  };

  const handleCancelEdit = () => {
    setEditedCompany(company);
    setIsEditing(false);
  };

  const handleAddBranch = async () => {
    if (!newBranchName.trim()) return;
    
    const newBranch = await inventoryStorage.addBranch({
      companyId: company.id,
      name: newBranchName.trim(),
      address: newBranchAddress.trim() || undefined,
    });
    
    setBranches([...branches, newBranch]);
    setNewBranchName("");
    setNewBranchAddress("");
    setIsAddingBranch(false);
    onUpdate();
  };

  const handleDeleteBranch = async (branchId: string) => {
    await inventoryStorage.deleteBranch(branchId);
    setBranches(branches.filter(b => b.id !== branchId));
    onUpdate();
  };

  const getBranchName = (branchId?: string) => {
    if (!branchId) return null;
    return branches.find(b => b.id === branchId)?.name;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="flex items-center gap-2 text-2xl">
                <Building2 className="h-6 w-6" />
                {company.name}
              </DialogTitle>
            </div>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            )}
          </div>
          <DialogDescription>
            Company details and contacts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Company Info */}
          <Card>
            <CardContent className="pt-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-company-name">Company Name</Label>
                    <Input
                      id="edit-company-name"
                      value={editedCompany.name}
                      onChange={(e) => setEditedCompany({ ...editedCompany, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-company-address">Address</Label>
                    <Textarea
                      id="edit-company-address"
                      value={editedCompany.address || ""}
                      onChange={(e) => setEditedCompany({ ...editedCompany, address: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {company.address && (
                    <div className="flex items-start gap-2 text-sm mb-3 pb-3 border-b">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>{company.address}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Created</span>
                    <span>{new Date(company.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Contacts</span>
                    <span>{persons.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Branches</span>
                    <span>{branches.length}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Branches Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GitBranch className="h-5 w-5" />
                Branches
              </CardTitle>
              {!isAddingBranch && (
                <Button variant="outline" size="sm" onClick={() => setIsAddingBranch(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Branch
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {isAddingBranch && (
                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                  <div className="space-y-2">
                    <Label htmlFor="new-branch-name">Branch Name *</Label>
                    <Input
                      id="new-branch-name"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="e.g., Downtown Office"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-branch-address">Address</Label>
                    <Textarea
                      id="new-branch-address"
                      value={newBranchAddress}
                      onChange={(e) => setNewBranchAddress(e.target.value)}
                      placeholder="Branch address"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsAddingBranch(false);
                        setNewBranchName("");
                        setNewBranchAddress("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleAddBranch} disabled={!newBranchName.trim()}>
                      Add Branch
                    </Button>
                  </div>
                </div>
              )}
              
              {branches.length === 0 && !isAddingBranch ? (
                <p className="text-center text-muted-foreground py-4">
                  No branches yet. Add your first branch above.
                </p>
              ) : (
                <div className="space-y-2">
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{branch.name}</p>
                        {branch.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {branch.address}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {persons.filter(p => p.branchId === branch.id).length} contacts
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteBranch(branch.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Persons List */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <User className="h-5 w-5" />
              Contacts
            </h3>
            {persons.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 border rounded-lg">
                No contacts in this company yet.
              </p>
            ) : (
              <div className="space-y-3">
                {persons.map((person) => (
                  <Card 
                    key={person.id} 
                    className="cursor-pointer hover:bg-accent/10 transition-colors"
                    onClick={() => {
                      setOpen(false);
                      onPersonClick(person);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">
                            {person.name}
                          </h4>
                          {person.jobTitle && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Briefcase className="h-3 w-3" />
                              <span>{person.jobTitle}</span>
                            </div>
                          )}
                          {getBranchName(person.branchId) && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <GitBranch className="h-3 w-3" />
                              <span>{getBranchName(person.branchId)}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-3 mt-2">
                            {person.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-muted-foreground" />
                                <span>{person.email}</span>
                              </div>
                            )}
                            {person.phone && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span>{person.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {person.notes.length} {person.notes.length === 1 ? 'note' : 'notes'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};