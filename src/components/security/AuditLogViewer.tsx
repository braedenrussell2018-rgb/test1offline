import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Search, Filter, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { logAuditEvent, AuditEvents } from "@/hooks/useAuditLog";

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  action_category: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  result: string;
  failure_reason: string | null;
  risk_level: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const RESULT_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  failure: "bg-red-100 text-red-800",
  blocked: "bg-red-100 text-red-800",
};

const CATEGORY_LABELS: Record<string, string> = {
  auth: "Authentication",
  data_access: "Data Access",
  data_modification: "Data Modification",
  admin: "Administration",
  export: "Data Export",
  security: "Security",
};

export function AuditLogViewer() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(500);

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data as AuditLog[]) || []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      searchTerm === "" ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === "all" || log.action_category === categoryFilter;
    const matchesRisk = riskFilter === "all" || log.risk_level === riskFilter;
    const matchesResult = resultFilter === "all" || log.result === resultFilter;

    return matchesSearch && matchesCategory && matchesRisk && matchesResult;
  });

  const exportToCSV = async () => {
    const headers = [
      "Timestamp",
      "Action",
      "Category",
      "Actor Email",
      "Actor Role",
      "Target Type",
      "Target Name",
      "Result",
      "Risk Level",
      "IP Address",
      "Failure Reason",
    ];

    const rows = filteredLogs.map((log) => [
      log.timestamp,
      log.action,
      log.action_category,
      log.actor_email || "",
      log.actor_role || "",
      log.target_type || "",
      log.target_name || "",
      log.result,
      log.risk_level || "",
      log.ip_address || "",
      log.failure_reason || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // Log the export event for audit trail
    await logAuditEvent(AuditEvents.DATA_EXPORTED(
      'audit_logs',
      'csv',
      filteredLogs.length
    ));

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${filteredLogs.length} audit log entries`,
    });
  };

  const exportToJSON = async () => {
    const exportData = {
      exported_at: new Date().toISOString(),
      total_records: filteredLogs.length,
      filters: {
        search: searchTerm,
        category: categoryFilter,
        risk: riskFilter,
        result: resultFilter,
      },
      logs: filteredLogs,
    };

    // Log the export event for audit trail
    await logAuditEvent(AuditEvents.DATA_EXPORTED(
      'audit_logs',
      'json',
      filteredLogs.length
    ));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${format(new Date(), "yyyy-MM-dd_HH-mm")}.json`;
    link.click();

    toast({
      title: "Export Complete",
      description: `Exported ${filteredLogs.length} audit log entries for SIEM import`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Audit Logs</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportToJSON}>
              <Download className="h-4 w-4 mr-1" />
              JSON (SIEM)
            </Button>
          </div>
        </div>
        <CardDescription>
          View security audit logs for SOC 2 compliance. Logs include timestamp, actor, action, target, and result.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions, emails, targets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risks</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={setResultFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Result" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} entries
        </div>

        {/* Logs table */}
        <ScrollArea className="h-[600px] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading audit logs...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No audit logs found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.action.replace(/_/g, " ")}</div>
                      {log.failure_reason && (
                        <div className="text-xs text-red-500">{log.failure_reason}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CATEGORY_LABELS[log.action_category] || log.action_category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{log.actor_email || "System"}</div>
                      {log.actor_role && (
                        <div className="text-xs text-muted-foreground">{log.actor_role}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.target_type && (
                        <div className="text-sm">
                          {log.target_type}: {log.target_name || log.target_id}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={RESULT_COLORS[log.result] || "bg-gray-100"}>
                        {log.result}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.risk_level && (
                        <Badge className={RISK_COLORS[log.risk_level] || "bg-gray-100"}>
                          {log.risk_level}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
