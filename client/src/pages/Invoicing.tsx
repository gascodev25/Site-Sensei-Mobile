import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, FileText, Clock, Receipt, Search, MapPin, Calendar, User, Repeat, Wrench, Package } from "lucide-react";
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
import type { Service, ServiceWithDetails } from "@shared/schema";

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

function rowKey(service: CompletedService): string {
  return service.occurrenceDate ? `${service.id}:${service.occurrenceDate}` : String(service.id);
}

export default function Invoicing() {
  const [intervalFilter, setIntervalFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [selectedServiceRow, setSelectedServiceRow] = useState<CompletedService | null>(null);
  const [dateView, setDateView] = useState<"month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/service-teams"],
  });

  const { data: allCompleted = [], isLoading: allLoading } = useQuery<CompletedService[]>({
    queryKey: ["/api/services/completed"],
    staleTime: 0,
  });

  const { data: fetchedServices = [], isLoading: filteredLoading } = useQuery<CompletedService[]>({
    queryKey: ["/api/services/completed", intervalFilter],
    staleTime: 0,
    queryFn: async () => {
      const res = await fetch(`/api/services/completed?interval=${intervalFilter}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch completed services");
      return res.json();
    },
  });

  type ServiceDetail = ServiceWithDetails & {
    equipmentItems?: { id: number; quantity: number; equipment: { name: string } }[];
    consumableItems?: { id: number; quantity: number; consumable: { name: string } }[];
  };

  const { data: serviceDetail, isLoading: detailLoading } = useQuery<ServiceDetail>({
    queryKey: ["/api/services", selectedServiceRow?.id],
    enabled: selectedServiceRow !== null,
    staleTime: 30000,
    queryFn: async () => {
      const res = await fetch(`/api/services/${selectedServiceRow!.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch service details");
      return res.json();
    },
  });

  // Date range helpers
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

  // Client-side filtering
  const filteredServices = fetchedServices.filter(service => {
    // Team filter
    if (teamFilter !== "all" && String(service.teamId) !== teamFilter) return false;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesClient = service.clientName?.toLowerCase().includes(q);
      const matchesType = service.type?.replace(/_/g, " ").toLowerCase().includes(q);
      const matchesStatus = service.invoicedStatus?.toLowerCase().includes(q);
      if (!matchesClient && !matchesType && !matchesStatus) return false;
    }

    // Date range filter
    const { start, end } = getDateRange();
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

  const markInvoicedMutation = useMutation({
    mutationFn: async ({ serviceId, occurrenceDate }: { serviceId: number; occurrenceDate?: string }) => {
      return await apiRequest("PATCH", `/api/services/${serviceId}/mark-invoiced`, occurrenceDate ? { occurrenceDate } : undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services/completed"] });
      toast({ title: "Success", description: "Service marked as invoiced" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to mark service as invoiced", variant: "destructive" });
    },
  });

  // Filter allCompleted by the current period and team for tile counts
  const periodFiltered = allCompleted.filter(service => {
    if (teamFilter !== "all" && String(service.teamId) !== teamFilter) return false;
    const { start, end } = getDateRange();
    const dateStr = service.occurrenceDate ?? (service.completedAt ? String(service.completedAt) : null);
    if (!dateStr) return false;
    try {
      const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
      return isWithinInterval(d, { start, end });
    } catch {
      return false;
    }
  });

  const totalCompleted = periodFiltered.length;
  const invoicedCount = periodFiltered.filter(s => s.invoicedStatus === "invoiced").length;
  const notInvoicedCount = periodFiltered.filter(s => s.invoicedStatus !== "invoiced").length;
  const isLoading = allLoading || filteredLoading;

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "—";
    try {
      const d = typeof date === "string" ? parseISO(date) : date;
      return format(d, "dd MMM yyyy");
    } catch {
      return "—";
    }
  };

  const getInvoicedBadge = (status: string | null) => {
    if (status === "invoiced") return <Badge className="bg-green-100 border-green-400 text-green-800">Invoiced</Badge>;
    if (status === "ready") return <Badge className="bg-blue-100 border-blue-400 text-blue-800">Ready</Badge>;
    return <Badge className="bg-amber-100 border-amber-400 text-amber-800">Not Invoiced</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-6 py-8">

        {/* Page title + filter bar on the right (matches Services layout) */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Invoicing</h1>

          <div className="flex items-center gap-4">
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-team-filter">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id.toString()}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by client, status, or type..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-invoicing"
              />
            </div>

            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant={dateView === "month" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setDateView("month")}
              >
                Month
              </Button>
              <Button
                variant={dateView === "week" ? "default" : "ghost"}
                size="sm"
                className="rounded-none border-x"
                onClick={() => setDateView("week")}
              >
                Week
              </Button>
              <Button
                variant={dateView === "day" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setDateView("day")}
              >
                Day
              </Button>
            </div>
          </div>
        </div>

        {/* Period navigation */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="icon" onClick={navigatePrev} className="h-8 w-8">{"<"}</Button>
          <span className="font-semibold text-base min-w-[180px] text-center">{getPeriodLabel()}</span>
          <Button variant="outline" size="icon" onClick={navigateNext} className="h-8 w-8">{">"}</Button>
        </div>

        {/* Stat Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => setActiveModal("all-completed")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Services</CardTitle>
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-completed">
                {allLoading ? "—" : totalCompleted}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total completed</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => setActiveModal("invoiced")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Invoiced Services</CardTitle>
              <Receipt className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600" data-testid="stat-invoiced">
                {allLoading ? "—" : invoicedCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Marked as invoiced</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]" onClick={() => setActiveModal("not-invoiced")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ready to Invoice</CardTitle>
              <Clock className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600" data-testid="stat-not-invoiced">
                {allLoading ? "—" : notInvoicedCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ready to Invoice</p>
            </CardContent>
          </Card>
        </div>

        {/* Stat tile modal */}
        <Dialog open={activeModal !== null} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {activeModal === "all-completed" && "All Completed Services"}
                {activeModal === "invoiced" && "Invoiced Services"}
                {activeModal === "not-invoiced" && "Pending Invoicing"}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2 overflow-y-auto flex-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCompleted
                    .filter(s => {
                      if (activeModal === "invoiced") return s.invoicedStatus === "invoiced";
                      if (activeModal === "not-invoiced") return s.invoicedStatus !== "invoiced";
                      return true;
                    })
                    .map((s) => (
                      <TableRow key={rowKey(s)} className="hover:!bg-blue-50 dark:hover:!bg-blue-950 transition-colors">
                        <TableCell className="font-medium">{s.clientName || 'Unknown'}</TableCell>
                        <TableCell className="capitalize">{s.type?.replace(/_/g, ' ')}</TableCell>
                        <TableCell>{s.occurrenceDate ? s.occurrenceDate : (s.scheduledDate ? s.scheduledDate.toString().slice(0, 10) : '-')}</TableCell>
                        <TableCell>{getInvoicedBadge(s.invoicedStatus)}</TableCell>
                      </TableRow>
                    ))}
                  {allCompleted.filter(s => {
                    if (activeModal === "invoiced") return s.invoicedStatus === "invoiced";
                    if (activeModal === "not-invoiced") return s.invoicedStatus !== "invoiced";
                    return true;
                  }).length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No services found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Service Detail Dialog */}
        <Dialog open={selectedServiceRow !== null} onOpenChange={() => setSelectedServiceRow(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Service Details</DialogTitle>
            </DialogHeader>
            {detailLoading ? (
              <div className="space-y-3 py-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-5 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : serviceDetail ? (
              <div className="space-y-1 text-sm pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-xl font-bold">{serviceDetail.client?.name || selectedServiceRow?.clientName || "Unknown Client"}</h2>
                  {getInvoicedBadge(selectedServiceRow?.invoicedStatus ?? null)}
                </div>
                {serviceDetail.client?.city && (
                  <div className="flex items-center text-muted-foreground mb-1">
                    <MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                    <span>{serviceDetail.client.city}</span>
                  </div>
                )}
                <div className="flex items-center text-muted-foreground mb-3">
                  <Calendar className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <span>
                    {selectedServiceRow?.occurrenceDate
                      ? formatDate(selectedServiceRow.occurrenceDate)
                      : formatDate(selectedServiceRow?.completedAt)}
                  </span>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div>
                    <span className="font-medium">Type:</span>{" "}
                    <span className="capitalize">{serviceDetail.type?.replace(/_/g, " ") || "Not specified"}</span>
                  </div>
                  {serviceDetail.team && (
                    <div className="flex items-center">
                      <User className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                      <span className="font-medium">Team:</span>
                      <span className="ml-1">{(serviceDetail.team as any).name}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Priority:</span>{" "}
                    {serviceDetail.servicePriority || "Routine"}
                  </div>
                  {serviceDetail.estimatedDuration && (
                    <div className="flex items-center">
                      <Clock className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                      <span className="font-medium">Duration:</span>
                      <span className="ml-1">{serviceDetail.estimatedDuration} minutes</span>
                    </div>
                  )}
                  {serviceDetail.contractLengthMonths && (
                    <div>
                      <span className="font-medium">Contract:</span>{" "}
                      {serviceDetail.contractLengthMonths} months
                    </div>
                  )}
                  {(serviceDetail.recurrencePattern as any)?.interval && (
                    <div className="flex items-center">
                      <Repeat className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                      <span className="font-medium">Frequency:</span>
                      <span className="ml-1">
                        {(() => {
                          const interval = (serviceDetail.recurrencePattern as any).interval;
                          const labels: Record<string, string> = { "7d": "Weekly", "14d": "Bi-weekly", "30d": "Monthly", "60d": "Bi-monthly", "90d": "Quarterly", "180d": "Semi-annually" };
                          return labels[interval] || `Every ${interval}`;
                        })()}
                      </span>
                    </div>
                  )}
                  {serviceDetail.equipmentItems && serviceDetail.equipmentItems.length > 0 && (
                    <div className="flex items-start">
                      <Wrench className="h-3.5 w-3.5 mr-1.5 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">Equipment:</span>
                        <span className="ml-1 text-muted-foreground">
                          {serviceDetail.equipmentItems.slice(0, 3).map(item =>
                            item.quantity > 1 ? `${item.equipment.name} ×${item.quantity}` : item.equipment.name
                          ).join(", ")}
                          {serviceDetail.equipmentItems.length > 3 &&
                            ` +${serviceDetail.equipmentItems.length - 3} more`}
                        </span>
                      </div>
                    </div>
                  )}
                  {serviceDetail.consumableItems && serviceDetail.consumableItems.length > 0 && (
                    <div className="flex items-start">
                      <Package className="h-3.5 w-3.5 mr-1.5 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-medium">Consumables:</span>
                        <span className="ml-1 text-muted-foreground">
                          {serviceDetail.consumableItems.slice(0, 3).map(item =>
                            item.quantity > 1 ? `${item.consumable.name} ×${item.quantity}` : item.consumable.name
                          ).join(", ")}
                          {serviceDetail.consumableItems.length > 3 &&
                            ` +${serviceDetail.consumableItems.length - 3} more`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {selectedServiceRow?.invoicedStatus !== "invoiced" && (
                  <div className="border-t pt-4 mt-2">
                    <Button
                      size="sm"
                      disabled={markInvoicedMutation.isPending}
                      onClick={() => {
                        markInvoicedMutation.mutate({
                          serviceId: selectedServiceRow!.id,
                          occurrenceDate: selectedServiceRow!.occurrenceDate,
                        });
                        setSelectedServiceRow(null);
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Invoiced
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Interval Filter + Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Completed Services
              </CardTitle>
              <Select value={intervalFilter} onValueChange={setIntervalFilter}>
                <SelectTrigger className="w-52" data-testid="select-interval">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery || teamFilter !== "all"
                  ? "No services match your search or filter."
                  : `No completed services found for ${getPeriodLabel()}.`}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Completion Date</TableHead>
                    <TableHead>Invoice Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map(service => (
                    <TableRow
                      key={rowKey(service)}
                      className="cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                      onClick={() => setSelectedServiceRow(service)}
                    >
                      <TableCell className="font-medium">{service.clientName}</TableCell>
                      <TableCell className="capitalize">{service.type?.replace(/_/g, " ") ?? "—"}</TableCell>
                      <TableCell>
                        {service.occurrenceDate
                          ? formatDate(service.occurrenceDate)
                          : formatDate(service.completedAt)}
                      </TableCell>
                      <TableCell>{getInvoicedBadge(service.invoicedStatus)}</TableCell>
                      <TableCell className="text-right">
                        {service.invoicedStatus !== "invoiced" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markInvoicedMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              markInvoicedMutation.mutate({
                                serviceId: service.id,
                                occurrenceDate: service.occurrenceDate,
                              });
                            }}
                            data-testid={`button-mark-invoiced-${rowKey(service)}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark as Invoiced
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Invoiced</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
