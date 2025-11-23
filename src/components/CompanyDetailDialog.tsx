import { useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Building2, User, Mail, Phone, Briefcase } from "lucide-react";
import { Company, Person } from "@/lib/inventory-storage";

interface CompanyDetailDialogProps {
  company: Company;
  persons: Person[];
  onPersonClick: (person: Person) => void;
  children: React.ReactNode;
}

export const CompanyDetailDialog = ({ company, persons, onPersonClick, children }: CompanyDetailDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Building2 className="h-6 w-6" />
            {company.name}
          </DialogTitle>
          <DialogDescription>
            Company details and contacts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Company Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(company.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Contacts</span>
                  <span>{persons.length}</span>
                </div>
              </div>
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
                            {person.firstName} {person.lastName}
                          </h4>
                          {person.jobTitle && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Briefcase className="h-3 w-3" />
                              <span>{person.jobTitle}</span>
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
