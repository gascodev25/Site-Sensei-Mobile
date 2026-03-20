import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Download, Printer, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import {
  format, parseISO,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  startOfDay, endOfDay,
  subMonths, addMonths,
  subWeeks, addWeeks,
  subDays, addDays,
  isWithinInterval,
} from "date-fns";
import Papa from "papaparse";
import type { Service } from "@shared/schema";

type CompletedService = Service & { clientName: string; occurrenceDate?: string };
type Team = { id: number; name: string };

const INTERVAL_OPTIONS = [
  { value: "all", label: "All Intervals" },
  { value: "once", label: "Once-off" },
  { value: "7d", label: "Weekly (7d)" },
  { value: "14d", label: "Fortnightly (14d)" },
  { value: "30d", label: "Monthly (30d)" },
  { value: "60d", label: "Bi-monthly (60d)" },
  { value: "90d", label: "Quarterly (90d)" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "invoiced", label: "Invoiced" },
  { value: "not_invoiced", label: "Not Invoiced" },
];

function formatDateSafe(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd MMM yyyy");
  } catch {
    return "—";
  }
}

function InvoicingReportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [intervalFilter, setIntervalFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateView, setDateView] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: teams = [] } = useQuery<Team[]>({ queryKey: ["/api/service-teams"] });

  const { data: allCompleted = [], isLoading } = useQuery<CompletedService[]>({
    queryKey: ["/api/services/completed"],
    staleTime: 0,
    enabled: open,
  });

  const getDateRange = () => {
    if (dateView === "month") return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    if (dateView === "week") return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
    return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
  };

  const getPeriodLabel = () => {
    if (dateView === "month") return format(currentDate, "MMMM yyyy");
    if (dateView === "week") {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM d, yyyy");
  };

  const navigatePrev = () => {
    if (dateView === "month") setCurrentDate(d => subMonths(d, 1));
    else if (dateView === "week") setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subDays(d, 1));
  };

  const navigateNext = () => {
    if (dateView === "month") setCurrentDate(d => addMonths(d, 1));
    else if (dateView === "week") setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addDays(d, 1));
  };

  const filteredServices = useMemo(() => {
    const { start, end } = getDateRange();
    return allCompleted.filter(service => {
      if (intervalFilter !== "all" && service.recurrenceInterval !== intervalFilter) return false;
      if (teamFilter !== "all" && String(service.teamId) !== teamFilter) return false;
      if (statusFilter === "invoiced" && service.invoicedStatus !== "invoiced") return false;
      if (statusFilter === "not_invoiced" && service.invoicedStatus === "invoiced") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesClient = service.clientName?.toLowerCase().includes(q);
        const matchesType = service.type?.replace(/_/g, " ").toLowerCase().includes(q);
        if (!matchesClient && !matchesType) return false;
      }

      const dateStr = service.occurrenceDate ?? (service.completedAt ? String(service.completedAt) : null);
      if (!dateStr) return false;
      try {
        const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
        if (!isWithinInterval(d, { start, end })) return false;
      } catch {
        return false;
      }

      return true;
    });
  }, [allCompleted, intervalFilter, teamFilter, statusFilter, searchQuery, currentDate, dateView]);

  const serviceDate = (s: CompletedService) =>
    formatDateSafe(s.occurrenceDate ?? (s.completedAt ? String(s.completedAt) : null));

  const exportCSV = () => {
    const rows = filteredServices.map(s => ({
      Client: s.clientName || "",
      "Service Type": s.type?.replace(/_/g, " ") || "",
      Date: serviceDate(s),
      Interval: s.recurrenceInterval || "once",
      Team: teams.find(t => t.id === s.teamId)?.name || "",
      "Invoice Status": s.invoicedStatus === "invoiced" ? "Invoiced" : "Not Invoiced",
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoicing-report-${format(currentDate, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const rows = filteredServices.map(s => `
      <tr>
        <td>${s.clientName || "—"}</td>
        <td>${s.type?.replace(/_/g, " ") || "—"}</td>
        <td>${serviceDate(s)}</td>
        <td>${s.recurrenceInterval || "once"}</td>
        <td>${teams.find(t => t.id === s.teamId)?.name || "—"}</td>
        <td class="${s.invoicedStatus === "invoiced" ? "invoiced" : "not-invoiced"}">${s.invoicedStatus === "invoiced" ? "Invoiced" : "Not Invoiced"}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoicing Report – ${getPeriodLabel()}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
    td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    tr:last-child td { border-bottom: none; }
    .invoiced { color: #16a34a; font-weight: 600; }
    .not-invoiced { color: #d97706; font-weight: 600; }
    .summary { display: flex; gap: 24px; margin-bottom: 16px; }
    .summary-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 16px; }
    .summary-item .label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-item .value { font-size: 18px; font-weight: 700; color: #1e293b; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Invoicing Report</h1>
  <div class="subtitle">Period: ${getPeriodLabel()} &nbsp;|&nbsp; Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}</div>
  <div class="summary">
    <div class="summary-item"><div class="label">Total Services</div><div class="value">${filteredServices.length}</div></div>
    <div class="summary-item"><div class="label">Invoiced</div><div class="value" style="color:#16a34a">${filteredServices.filter(s => s.invoicedStatus === "invoiced").length}</div></div>
    <div class="summary-item"><div class="label">Not Invoiced</div><div class="value" style="color:#d97706">${filteredServices.filter(s => s.invoicedStatus !== "invoiced").length}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th>Service Type</th>
        <th>Date</th>
        <th>Interval</th>
        <th>Team</th>
        <th>Invoice Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999;">No services match the selected filters</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    }
  };

  const invoicedCount = filteredServices.filter(s => s.invoicedStatus === "invoiced").length;
  const notInvoicedCount = filteredServices.filter(s => s.invoicedStatus !== "invoiced").length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5 text-blue-600" />
            Invoicing Report
          </DialogTitle>
        </DialogHeader>

        {/* Filters row */}
        <div className="flex flex-wrap gap-3 py-3 border-b">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search client or service type…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={intervalFilter} onValueChange={setIntervalFilter}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="Interval" />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date navigation row */}
        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {(["month", "week", "day"] as const).map(v => (
              <button
                key={v}
                onClick={() => setDateView(v)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize ${
                  dateView === v ? "bg-white dark:bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm min-w-[160px] text-center">{getPeriodLabel()}</span>
            <Button variant="outline" size="icon" onClick={navigateNext} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Summary chips */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{filteredServices.length} total</span>
            <Badge className="bg-green-100 text-green-800 border-green-300">{invoicedCount} invoiced</Badge>
            <Badge className="bg-amber-100 text-amber-800 border-amber-300">{notInvoicedCount} pending</Badge>
          </div>
        </div>

        {/* Results table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Loading services…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map(s => (
                  <TableRow key={s.occurrenceDate ? `${s.id}:${s.occurrenceDate}` : String(s.id)}>
                    <TableCell className="font-medium">{s.clientName || "—"}</TableCell>
                    <TableCell className="capitalize">{s.type?.replace(/_/g, " ") || "—"}</TableCell>
                    <TableCell>{serviceDate(s)}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{s.recurrenceInterval || "once"}</TableCell>
                    <TableCell className="text-muted-foreground">{teams.find(t => t.id === s.teamId)?.name || "—"}</TableCell>
                    <TableCell>
                      {s.invoicedStatus === "invoiced"
                        ? <Badge className="bg-green-100 border-green-400 text-green-800">Invoiced</Badge>
                        : <Badge className="bg-amber-100 border-amber-400 text-amber-800">Not Invoiced</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredServices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No services match the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer export buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {filteredServices.length} record{filteredServices.length !== 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV} disabled={filteredServices.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={exportPDF} disabled={filteredServices.length === 0} className="gap-2">
              <Printer className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Reports() {
  const [invoicingReportOpen, setInvoicingReportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Reports</h1>
        <p className="text-muted-foreground mb-8">Generate and export reports for your service operations.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Invoicing Report card */}
          <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setInvoicingReportOpen(true)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-3">
                  <Receipt className="h-5 w-5 text-blue-600" />
                </div>
                <FileText className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
              </div>
              <CardTitle className="text-lg">Invoicing Report</CardTitle>
              <CardDescription>
                View and export completed services by date range, team, and invoicing status. Download as PDF or CSV.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full gap-2" onClick={e => { e.stopPropagation(); setInvoicingReportOpen(true); }}>
                <FileText className="h-4 w-4" />
                Generate Report
              </Button>
            </CardContent>
          </Card>

          {/* Placeholder for future reports */}
          <Card className="border-dashed opacity-60">
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle className="text-lg text-muted-foreground">More Reports</CardTitle>
              <CardDescription>Additional reporting features coming soon.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      <InvoicingReportModal open={invoicingReportOpen} onClose={() => setInvoicingReportOpen(false)} />
    </div>
  );
}
