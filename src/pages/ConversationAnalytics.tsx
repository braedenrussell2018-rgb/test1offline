import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { format, subDays, startOfDay, parseISO, endOfDay, isWithinInterval, differenceInDays, eachDayOfInterval } from "date-fns";
import { MessageSquare, Users, TrendingUp, Calendar as CalendarIcon, Loader2, Phone, Clock, Tag, X } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  contact_id: string | null;
  created_at: string;
  duration_seconds: number | null;
  key_points: string[] | null;
  summary: string | null;
}

interface Contact {
  id: string;
  name: string;
}

type PresetRange = "7d" | "30d" | "90d" | "custom";

export default function ConversationAnalytics() {
  const { user } = useAuth();
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [presetRange, setPresetRange] = useState<PresetRange>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [conversationsRes, contactsRes] = await Promise.all([
        supabase
          .from("ai_conversations")
          .select("id, contact_id, created_at, duration_seconds, key_points, summary")
          .order("created_at", { ascending: false }),
        supabase
          .from("people")
          .select("id, name"),
      ]);

      if (conversationsRes.data) {
        setAllConversations(conversationsRes.data.map(c => ({
          ...c,
          key_points: Array.isArray(c.key_points) ? c.key_points as string[] : [],
        })));
      }

      if (contactsRes.data) {
        setContacts(contactsRes.data);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle preset changes
  const handlePresetChange = (preset: PresetRange) => {
    setPresetRange(preset);
    if (preset !== "custom") {
      const days = preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
      setDateRange({
        from: subDays(new Date(), days),
        to: new Date(),
      });
    }
  };

  // Filter conversations by date range
  const conversations = useMemo(() => {
    if (!dateRange?.from) return allConversations;
    
    return allConversations.filter(conv => {
      const convDate = parseISO(conv.created_at);
      const start = startOfDay(dateRange.from!);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from!);
      return isWithinInterval(convDate, { start, end });
    });
  }, [allConversations, dateRange]);

  const getContactName = (contactId: string | null) => {
    if (!contactId) return "Unassigned";
    return contacts.find(c => c.id === contactId)?.name || "Unknown";
  };

  // Calls per day within date range
  const callsPerDay = useMemo(() => {
    if (!dateRange?.from) return [];
    
    const start = startOfDay(dateRange.from);
    const end = dateRange.to ? startOfDay(dateRange.to) : start;
    const days = eachDayOfInterval({ start, end });
    
    const dayData = days.map(date => ({
      date: format(date, "yyyy-MM-dd"),
      label: format(date, "MMM d"),
      count: 0,
    }));

    conversations.forEach(conv => {
      const convDate = format(parseISO(conv.created_at), "yyyy-MM-dd");
      const dayEntry = dayData.find(d => d.date === convDate);
      if (dayEntry) {
        dayEntry.count++;
      }
    });

    return dayData;
  }, [conversations, dateRange]);

  // Top contacts by conversation count
  const topContacts = useMemo(() => {
    const contactCounts: Record<string, number> = {};
    
    conversations.forEach(conv => {
      const key = conv.contact_id || "unassigned";
      contactCounts[key] = (contactCounts[key] || 0) + 1;
    });

    return Object.entries(contactCounts)
      .map(([contactId, count]) => ({
        contactId,
        name: contactId === "unassigned" ? "Unassigned" : getContactName(contactId),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [conversations, contacts]);

  // Extract key topics from all conversations
  const keyTopics = useMemo(() => {
    const topicCounts: Record<string, number> = {};
    
    conversations.forEach(conv => {
      if (conv.key_points) {
        conv.key_points.forEach(point => {
          // Extract keywords from key points (simple word extraction)
          const words = point.toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 4); // Only words longer than 4 chars
          
          words.forEach(word => {
            // Skip common words
            const skipWords = ['about', 'their', 'there', 'would', 'could', 'should', 'which', 'being', 'these', 'those', 'after', 'before', 'through', 'during', 'under', 'between', 'while', 'where', 'having'];
            if (!skipWords.includes(word)) {
              topicCounts[word] = (topicCounts[word] || 0) + 1;
            }
          });
        });
      }
    });

    return Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [conversations]);

  // Summary stats for filtered range
  const stats = useMemo(() => {
    const totalCalls = conversations.length;
    const totalDuration = conversations.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const uniqueContacts = new Set(conversations.filter(c => c.contact_id).map(c => c.contact_id)).size;
    const rangeLabel = dateRange?.from && dateRange?.to 
      ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
      : "Selected range";

    return { totalCalls, avgDuration, uniqueContacts, rangeLabel };
  }, [conversations, dateRange]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Conversation Analytics</h1>
              <p className="text-muted-foreground mt-1">Insights from your recorded conversations</p>
            </div>
            
            {/* Date Range Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={presetRange} onValueChange={(v) => handlePresetChange(v as PresetRange)}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                        </>
                      ) : (
                        format(dateRange.from, "MMM d, yyyy")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange(range);
                      if (range) setPresetRange("custom");
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCalls}</div>
              <p className="text-xs text-muted-foreground">{stats.rangeLabel}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
              <p className="text-xs text-muted-foreground">Per conversation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Contacts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueContacts}</div>
              <p className="text-xs text-muted-foreground">People contacted</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Calls Per Day Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Calls Per Day
              </CardTitle>
              <CardDescription>{stats.rangeLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              {conversations.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No conversation data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={callsPerDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="Calls"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Top Contacts Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Top Contacts
              </CardTitle>
              <CardDescription>Most conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {topContacts.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No conversation data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topContacts.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" name="Conversations" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Key Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Key Topics Discussed
            </CardTitle>
            <CardDescription>Common themes from conversation summaries</CardDescription>
          </CardHeader>
          <CardContent>
            {keyTopics.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No topics extracted yet. Record more conversations to see insights.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {keyTopics.map(({ topic, count }) => (
                  <Badge 
                    key={topic} 
                    variant="secondary"
                    className="text-sm py-1 px-3"
                  >
                    {topic}
                    <span className="ml-2 text-muted-foreground">({count})</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Conversations
            </CardTitle>
            <CardDescription>Latest recorded calls</CardDescription>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No conversations recorded yet
              </div>
            ) : (
              <div className="space-y-3">
                {conversations.slice(0, 10).map(conv => (
                  <div 
                    key={conv.id} 
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border rounded-lg bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{getContactName(conv.contact_id)}</div>
                      {conv.summary && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{conv.summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {conv.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(conv.duration_seconds)}
                        </span>
                      )}
                      <span>{format(parseISO(conv.created_at), "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
