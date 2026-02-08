import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Video,
  Clock,
  MapPin,
  Users,
  Trash2,
  Edit,
  Check,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfWeek, startOfMonth, endOfMonth, addDays, addMonths, subMonths, isSameDay, isSameMonth, addWeeks, subWeeks, parseISO, getDay } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  event_type: string;
  location: string | null;
  is_video_meeting: boolean;
  video_meeting_id: string | null;
  created_by: string;
  created_at: string;
}

interface Invitee {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  profile?: { full_name: string };
}

interface EmployeeProfile {
  user_id: string;
  full_name: string;
}

type CalendarView = "day" | "week" | "month";

interface WeeklyCalendarProps {
  onCreateVideoMeeting?: (meetingId: string, title: string) => void;
}

export function WeeklyCalendar({ onCreateVideoMeeting }: WeeklyCalendarProps) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterUserId, setFilterUserId] = useState<string>("all");

  // Event dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    event_type: "meeting",
    location: "",
    is_video_meeting: false,
  });
  const [selectedInvitees, setSelectedInvitees] = useState<string[]>([]);

  // Event detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Compute the date range for data fetching based on view
  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      return { start: currentDate, end: addDays(currentDate, 1) };
    } else if (viewMode === "week") {
      return { start: currentWeekStart, end: addDays(currentWeekStart, 7) };
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      // Include surrounding days for the grid
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = addDays(startOfWeek(addDays(monthEnd, 7), { weekStartsOn: 1 }), 0);
      return { start: gridStart, end: gridEnd };
    }
  }, [viewMode, currentDate, currentWeekStart]);

  const monthDays = useMemo(() => {
    if (viewMode !== "month") return [];
    const monthStart = startOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = gridStart;
    // Always show 6 weeks (42 days) for consistent grid
    for (let i = 0; i < 42; i++) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [viewMode, currentDate]);

  useEffect(() => {
    loadEvents();
    loadEmployees();
  }, [dateRange]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("calendar_events")
        .select("*")
        .gte("start_time", dateRange.start.toISOString())
        .lt("start_time", dateRange.end.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;
      setEvents(data || []);

      // Load invitees for these events
      if (data && data.length > 0) {
        const eventIds = data.map((e: CalendarEvent) => e.id);
        const { data: invData } = await (supabase as any)
          .from("calendar_event_invitees")
          .select("*")
          .in("event_id", eventIds);
        setInvitees(invData || []);
      } else {
        setInvitees([]);
      }
    } catch (error) {
      console.error("Error loading calendar events:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    // Filter to internal roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["owner", "employee", "developer"]);

    const internalUserIds = new Set(roles?.map((r) => r.user_id) || []);
    setEmployees(
      (data || []).filter((p) => internalUserIds.has(p.user_id))
    );
  };

  const getEmployeeName = (userId: string) => {
    return employees.find((e) => e.user_id === userId)?.full_name || "Unknown";
  };

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => isSameDay(parseISO(event.start_time), day));
  };

  const filteredEventsForDay = (day: Date) => {
    const dayEvents = getEventsForDay(day);
    if (filterUserId === "all") return dayEvents;
    return dayEvents.filter((e) => {
      if (e.created_by === filterUserId) return true;
      return invitees.some(
        (inv) => inv.event_id === e.id && inv.user_id === filterUserId
      );
    });
  };

  const openCreateDialog = (day: Date) => {
    setSelectedDay(day);
    setEditingEvent(null);
    const dateStr = format(day, "yyyy-MM-dd");
    setForm({
      title: "",
      description: "",
      start_time: `${dateStr}T09:00`,
      end_time: `${dateStr}T10:00`,
      event_type: "meeting",
      location: "",
      is_video_meeting: false,
    });
    setSelectedInvitees([]);
    setDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || "",
      start_time: event.start_time.slice(0, 16),
      end_time: event.end_time.slice(0, 16),
      event_type: event.event_type,
      location: event.location || "",
      is_video_meeting: event.is_video_meeting,
    });
    const eventInvitees = invitees
      .filter((inv) => inv.event_id === event.id)
      .map((inv) => inv.user_id);
    setSelectedInvitees(eventInvitees);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.start_time || !form.end_time) {
      toast.error("Please fill in title, start and end time");
      return;
    }

    try {
      let videoMeetingId: string | null = null;

      // Create video meeting if requested
      if (form.is_video_meeting && !editingEvent?.is_video_meeting) {
        const { data: vmData, error: vmError } = await (supabase as any)
          .from("video_meetings")
          .insert({
            title: form.title,
            meeting_type: "local_company",
            created_by: user!.id,
            status: "waiting",
          })
          .select()
          .single();

        if (vmError) throw vmError;
        videoMeetingId = vmData.id;
      }

      const eventData = {
        title: form.title,
        description: form.description || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        event_type: form.event_type,
        location: form.location || null,
        is_video_meeting: form.is_video_meeting,
        ...(videoMeetingId ? { video_meeting_id: videoMeetingId } : {}),
      };

      let eventId: string;

      if (editingEvent) {
        const { error } = await (supabase as any)
          .from("calendar_events")
          .update(eventData)
          .eq("id", editingEvent.id);
        if (error) throw error;
        eventId = editingEvent.id;

        // Remove old invitees and re-add
        await (supabase as any)
          .from("calendar_event_invitees")
          .delete()
          .eq("event_id", eventId);
      } else {
        const { data, error } = await (supabase as any)
          .from("calendar_events")
          .insert({ ...eventData, created_by: user!.id })
          .select()
          .single();
        if (error) throw error;
        eventId = data.id;
      }

      // Add invitees
      if (selectedInvitees.length > 0) {
        const inviteeRows = selectedInvitees.map((uid) => ({
          event_id: eventId,
          user_id: uid,
          status: "pending",
        }));
        await (supabase as any)
          .from("calendar_event_invitees")
          .insert(inviteeRows);
      }

      toast.success(editingEvent ? "Event updated" : "Event created");
      setDialogOpen(false);
      loadEvents();

      // If video meeting was created, optionally launch it
      if (videoMeetingId && onCreateVideoMeeting) {
        onCreateVideoMeeting(videoMeetingId, form.title);
      }
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("Failed to save event");
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      const { error } = await (supabase as any)
        .from("calendar_events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
      toast.success("Event deleted");
      setDetailOpen(false);
      loadEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    }
  };

  const handleRespondInvite = async (eventId: string, status: "accepted" | "declined") => {
    try {
      const { error } = await (supabase as any)
        .from("calendar_event_invitees")
        .update({ status, responded_at: new Date().toISOString() })
        .eq("event_id", eventId)
        .eq("user_id", user!.id);
      if (error) throw error;
      toast.success(`Invitation ${status}`);
      loadEvents();
    } catch (error) {
      console.error("Error responding to invite:", error);
      toast.error("Failed to respond");
    }
  };

  const toggleInvitee = (userId: string) => {
    setSelectedInvitees((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.is_video_meeting) return "bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300";
    switch (event.event_type) {
      case "task": return "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300";
      case "reminder": return "bg-yellow-500/20 border-yellow-500/50 text-yellow-700 dark:text-yellow-300";
      case "out_of_office": return "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300";
      default: return "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-300";
    }
  };

  const getPendingInvites = () => {
    return invitees.filter(
      (inv) => inv.user_id === user?.id && inv.status === "pending"
    );
  };

  const pendingInvites = getPendingInvites();

  const navigatePrev = () => {
    if (viewMode === "day") setCurrentDate((d) => addDays(d, -1));
    else if (viewMode === "week") setCurrentWeekStart((w) => subWeeks(w, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const navigateNext = () => {
    if (viewMode === "day") setCurrentDate((d) => addDays(d, 1));
    else if (viewMode === "week") setCurrentWeekStart((w) => addWeeks(w, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const navigateToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setCurrentWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  return (
    <div className="space-y-4">
      {/* Pending invitations banner */}
      {pendingInvites.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Pending Invitations ({pendingInvites.length})
            </h3>
            <div className="space-y-2">
              {pendingInvites.map((inv) => {
                const event = events.find((e) => e.id === inv.event_id);
                if (!event) return null;
                return (
                  <div key={inv.id} className="flex items-center justify-between p-2 border rounded-lg">
                    <div>
                      <span className="font-medium text-sm">{event.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {format(parseISO(event.start_time), "MMM d, h:mm a")} — by {getEmployeeName(event.created_by)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => handleRespondInvite(event.id, "accepted")}>
                        <Check className="h-3 w-3" /> Accept
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => handleRespondInvite(event.id, "declined")}>
                        <X className="h-3 w-3" /> Decline
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {viewMode === "day" ? "Daily" : viewMode === "week" ? "Weekly" : "Monthly"} Schedule
              </CardTitle>
              <CardDescription>
                {viewMode === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
                {viewMode === "week" && `${format(currentWeekStart, "MMMM d")} — ${format(addDays(currentWeekStart, 6), "MMMM d, yyyy")}`}
                {viewMode === "month" && format(currentDate, "MMMM yyyy")}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => { if (v) setViewMode(v as CalendarView); }}>
                <ToggleGroupItem value="day" size="sm">Day</ToggleGroupItem>
                <ToggleGroupItem value="week" size="sm">Week</ToggleGroupItem>
                <ToggleGroupItem value="month" size="sm">Month</ToggleGroupItem>
              </ToggleGroup>
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name} {emp.user_id === user?.id ? "(You)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" onClick={navigatePrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={navigateToday}>
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={navigateNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* DAY VIEW */}
          {viewMode === "day" && (
            <div className="space-y-2">
              <div className={`text-center text-sm font-medium p-2 rounded-lg ${isSameDay(currentDate, new Date()) ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                {format(currentDate, "EEEE, MMMM d")}
              </div>
              <div className="min-h-[400px] border rounded-lg p-3 space-y-2">
                {filteredEventsForDay(currentDate).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No events scheduled</p>
                )}
                {filteredEventsForDay(currentDate).map((event) => {
                  const eventInvitees = invitees.filter((inv) => inv.event_id === event.id);
                  return (
                    <div
                      key={event.id}
                      className={`p-3 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${getEventColor(event)}`}
                      onClick={() => { setDetailEvent(event); setDetailOpen(true); }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{event.title}</div>
                        <div className="flex items-center gap-2">
                          {event.is_video_meeting && <Video className="h-4 w-4" />}
                          {eventInvitees.length > 0 && <span className="flex items-center gap-1 text-xs"><Users className="h-3 w-3" />{eventInvitees.length}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs mt-1 opacity-75">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(event.start_time), "h:mm a")} — {format(parseISO(event.end_time), "h:mm a")}
                      </div>
                      {event.location && <div className="flex items-center gap-1 text-xs mt-1 opacity-75"><MapPin className="h-3 w-3" />{event.location}</div>}
                    </div>
                  );
                })}
                <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => openCreateDialog(currentDate)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Event
                </Button>
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === "week" && (
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`text-center text-xs font-medium p-2 rounded-t-lg ${isSameDay(day, new Date()) ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                >
                  <div>{format(day, "EEE")}</div>
                  <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>{format(day, "d")}</div>
                </div>
              ))}
              {weekDays.map((day) => {
                const dayEvents = filteredEventsForDay(day);
                return (
                  <div
                    key={`col-${day.toISOString()}`}
                    className={`min-h-[200px] border rounded-b-lg p-1 ${isSameDay(day, new Date()) ? "border-primary/30 bg-primary/5" : "border-border"}`}
                  >
                    <div className="space-y-1">
                      {dayEvents.map((event) => {
                        const eventInvitees = invitees.filter((inv) => inv.event_id === event.id);
                        const myInvite = eventInvitees.find((inv) => inv.user_id === user?.id);
                        return (
                          <div
                            key={event.id}
                            className={`p-1.5 rounded border text-xs cursor-pointer hover:opacity-80 transition-opacity ${getEventColor(event)}`}
                            onClick={() => { setDetailEvent(event); setDetailOpen(true); }}
                          >
                            <div className="font-medium truncate">{event.title}</div>
                            <div className="flex items-center gap-1 opacity-75">
                              <Clock className="h-2.5 w-2.5" />
                              {format(parseISO(event.start_time), "h:mm a")}
                            </div>
                            {event.is_video_meeting && <Video className="h-2.5 w-2.5 mt-0.5" />}
                            {eventInvitees.length > 0 && (
                              <div className="flex items-center gap-0.5 mt-0.5 opacity-75">
                                <Users className="h-2.5 w-2.5" /><span>{eventInvitees.length}</span>
                              </div>
                            )}
                            {myInvite && (
                              <Badge variant={myInvite.status === "accepted" ? "default" : myInvite.status === "declined" ? "destructive" : "secondary"} className="text-[9px] px-1 py-0 mt-0.5">
                                {myInvite.status}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full h-6 mt-1 text-xs opacity-0 hover:opacity-100 transition-opacity" onClick={() => openCreateDialog(day)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* MONTH VIEW */}
          {viewMode === "month" && (
            <div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground p-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day) => {
                  const dayEvents = filteredEventsForDay(day);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[80px] border rounded p-1 cursor-pointer hover:bg-accent/30 transition-colors ${
                        isSameDay(day, new Date()) ? "border-primary/50 bg-primary/5" : "border-border"
                      } ${!isCurrentMonth ? "opacity-40" : ""}`}
                      onClick={() => {
                        if (dayEvents.length > 0) {
                          setCurrentDate(day);
                          setViewMode("day");
                        } else {
                          openCreateDialog(day);
                        }
                      }}
                    >
                      <div className={`text-xs font-medium mb-0.5 ${isSameDay(day, new Date()) ? "text-primary" : ""}`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className={`text-[10px] px-1 py-0.5 rounded truncate ${getEventColor(event)}`}
                            onClick={(e) => { e.stopPropagation(); setDetailEvent(event); setDetailOpen(true); }}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-4 pr-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Event title..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start *</Label>
                  <Input
                    type="datetime-local"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End *</Label>
                  <Input
                    type="datetime-local"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="video_meeting">Video Meeting</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="reminder">Reminder</SelectItem>
                      <SelectItem value="out_of_office">Out of Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Room / Link..."
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="video-meeting"
                  checked={form.is_video_meeting || form.event_type === "video_meeting"}
                  onCheckedChange={(checked) =>
                    setForm({
                      ...form,
                      is_video_meeting: !!checked,
                      event_type: checked ? "video_meeting" : form.event_type === "video_meeting" ? "meeting" : form.event_type,
                    })
                  }
                />
                <Label htmlFor="video-meeting" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Create video meeting room
                </Label>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Event details..."
                  rows={3}
                />
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4" />
                  Invite Employees
                </Label>
                <div className="border rounded-lg p-2 space-y-1 max-h-[150px] overflow-y-auto">
                  {employees
                    .filter((emp) => emp.user_id !== user?.id)
                    .map((emp) => (
                      <div
                        key={emp.user_id}
                        className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent/50 cursor-pointer"
                        onClick={() => toggleInvitee(emp.user_id)}
                      >
                        <Checkbox checked={selectedInvitees.includes(emp.user_id)} />
                        <span className="text-sm">{emp.full_name}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingEvent ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailEvent?.is_video_meeting && <Video className="h-5 w-5 text-blue-500" />}
              {detailEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {detailEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(parseISO(detailEvent.start_time), "MMM d, h:mm a")} — {format(parseISO(detailEvent.end_time), "h:mm a")}
                </span>
                {detailEvent.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {detailEvent.location}
                  </span>
                )}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Organizer: </span>
                <span className="font-medium">{getEmployeeName(detailEvent.created_by)}</span>
              </div>
              <Badge variant="outline">{detailEvent.event_type}</Badge>
              {detailEvent.description && (
                <p className="text-sm">{detailEvent.description}</p>
              )}
              {/* Invitees */}
              {(() => {
                const eventInvs = invitees.filter((inv) => inv.event_id === detailEvent.id);
                if (eventInvs.length === 0) return null;
                return (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <Users className="h-4 w-4" /> Invitees
                    </h4>
                    <div className="space-y-1">
                      {eventInvs.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between text-sm p-1.5 border rounded">
                          <span>{getEmployeeName(inv.user_id)}</span>
                          <Badge
                            variant={inv.status === "accepted" ? "default" : inv.status === "declined" ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {inv.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {detailEvent.is_video_meeting && detailEvent.video_meeting_id && onCreateVideoMeeting && (
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      onCreateVideoMeeting(detailEvent.video_meeting_id!, detailEvent.title);
                      setDetailOpen(false);
                    }}
                  >
                    <Video className="h-4 w-4" /> Join Meeting
                  </Button>
                )}
                {detailEvent.created_by === user?.id && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setDetailOpen(false);
                        openEditDialog(detailEvent);
                      }}
                    >
                      <Edit className="h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-2"
                      onClick={() => handleDelete(detailEvent.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </>
                )}
                {/* Accept/decline if invited */}
                {(() => {
                  const myInv = invitees.find(
                    (inv) => inv.event_id === detailEvent.id && inv.user_id === user?.id
                  );
                  if (!myInv || myInv.status !== "pending") return null;
                  return (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleRespondInvite(detailEvent.id, "accepted")}>
                        <Check className="h-3 w-3" /> Accept
                      </Button>
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => handleRespondInvite(detailEvent.id, "declined")}>
                        <X className="h-3 w-3" /> Decline
                      </Button>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
