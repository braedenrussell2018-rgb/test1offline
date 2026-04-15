import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Video, Calendar, Link as LinkIcon, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface CreateMeetingDropdownProps {
  onMeetingCreated: (meetingId: string, title: string) => void;
}

export function CreateMeetingDropdown({ onMeetingCreated }: CreateMeetingDropdownProps) {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }
    if (!user?.id) return;

    setCreating(true);
    try {
      const insertData: any = {
        title: title.trim(),
        meeting_type: "local_company",
        created_by: user.id,
        status: scheduledAt ? "scheduled" : "waiting",
      };
      if (scheduledAt) insertData.scheduled_at = new Date(scheduledAt).toISOString();

      const { data, error } = await (supabase as any)
        .from("video_meetings")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      if (scheduledAt) {
        setLastCreatedCode(data.meeting_code);
        toast.success("Meeting scheduled!");
      } else {
        toast.success("Meeting created!");
        setDialogOpen(false);
        onMeetingCreated(data.id, data.title);
      }
      setTitle("");
      setScheduledAt("");
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error("Failed to create meeting");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      toast.error("Please enter a meeting code");
      return;
    }
    const { data, error } = await (supabase as any)
      .from("video_meetings")
      .select("id, title, status")
      .eq("meeting_code", joinCode.trim().toUpperCase())
      .maybeSingle();

    if (error || !data) {
      toast.error("Meeting not found");
      return;
    }
    if (data.status === "ended") {
      toast.error("This meeting has ended");
      return;
    }
    setJoinDialogOpen(false);
    setJoinCode("");
    onMeetingCreated(data.id, data.title);
  };

  const handleCopyLink = () => {
    if (lastCreatedCode) {
      navigator.clipboard.writeText(`${window.location.origin}/meeting/${lastCreatedCode}`);
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Meeting
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { setLastCreatedCode(null); setDialogOpen(true); }} className="gap-2">
            <Video className="h-4 w-4" />
            Start Meeting Now
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setScheduledAt(""); setLastCreatedCode(null); setDialogOpen(true); }} className="gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Meeting
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setJoinDialogOpen(true)} className="gap-2">
            <LinkIcon className="h-4 w-4" />
            Join by Code
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create / Schedule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setLastCreatedCode(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              {scheduledAt ? "Schedule Meeting" : "Create Video Meeting"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="meeting-title">Meeting Title</Label>
              <Input
                id="meeting-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekly Team Standup"
                onKeyDown={(e) => e.key === "Enter" && !lastCreatedCode && handleCreate()}
              />
            </div>
            <div>
              <Label htmlFor="meeting-schedule">Schedule For (optional)</Label>
              <Input
                id="meeting-schedule"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            {lastCreatedCode && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">Meeting Code:</span>
                <code className="font-mono text-sm tracking-wider">{lastCreatedCode}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={handleCopyLink}>
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {lastCreatedCode ? "Done" : "Cancel"}
            </Button>
            {!lastCreatedCode && (
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating..." : scheduledAt ? "Schedule" : "Start Meeting"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join by Code Dialog */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Join Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="join-code">Meeting Code</Label>
              <Input
                id="join-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                className="font-mono tracking-wider text-center text-lg"
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleJoinByCode}>Join</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
