import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseISO, format, startOfDay } from "date-fns";
import type { ServiceWithDetails } from "@shared/schema";
import ServiceForm from "@/components/Forms/ServiceForm";
import { queryClient } from "@/lib/queryClient";

type ViewMode = "today" | "week" | "month";

interface ServiceOccurrence {
  date: Date;
  status: "scheduled" | "completed" | "missed";
  service: ServiceWithDetails;
}

interface ChartDataItem {
  label: string;
  scheduled: number;
  completed: number;
  missed: number;
  isHighlighted: boolean;
  occurrences: ServiceOccurrence[];
}

function getDateRange(view: ViewMode): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  
  if (view === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (view === "week") {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }
  
  return { start, end };
}

function parseServiceDate(dateValue: Date | string | null | undefined): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === "string") {
    return parseISO(dateValue);
  }
  return null;
}

function generateServiceOccurrences(
  service: ServiceWithDetails,
  rangeStart: Date,
  rangeEnd: Date
): ServiceOccurrence[] {
  const baseDate = parseServiceDate(service.installationDate);
  if (!baseDate) return [];

  const recurrencePattern = service.recurrencePattern as { interval?: string; end_date?: string } | null;
  const excludedDates = (service.excludedDates as string[]) || [];
  const completedDates = (service.completedDates as string[]) || [];
  const excludedSet = new Set(excludedDates.map(d => d.substring(0, 10)));
  const completedSet = new Set(completedDates.map(d => d.substring(0, 10)));

  const now = new Date();
  const occurrences: ServiceOccurrence[] = [];

  const isRecurring = recurrencePattern && recurrencePattern.interval;

  if (!isRecurring) {
    const dateStr = format(baseDate, "yyyy-MM-dd");
    if (baseDate >= rangeStart && baseDate <= rangeEnd && !excludedSet.has(dateStr)) {
      let status: "scheduled" | "completed" | "missed";
      if (service.status === "completed") {
        status = "completed";
      } else if (service.status === "missed") {
        status = "missed";
      } else if (startOfDay(baseDate) < startOfDay(now)) {
        status = "missed";
      } else {
        status = "scheduled";
      }
      occurrences.push({ date: new Date(baseDate), status, service });
    }
    return occurrences;
  }

  const intervalMatch = recurrencePattern!.interval!.match(/^(\d+)d$/);
  if (!intervalMatch) {
    const dateStr = format(baseDate, "yyyy-MM-dd");
    if (baseDate >= rangeStart && baseDate <= rangeEnd && !excludedSet.has(dateStr)) {
      occurrences.push({ date: new Date(baseDate), status: "scheduled", service });
    }
    return occurrences;
  }

  const intervalDays = parseInt(intervalMatch[1], 10);
  let currentDate = new Date(baseDate);

  const recurrenceEnd = recurrencePattern!.end_date ? parseISO(recurrencePattern!.end_date) : null;

  while (currentDate <= rangeEnd) {
    if (recurrenceEnd && currentDate > recurrenceEnd) break;

    const dateStr = format(currentDate, "yyyy-MM-dd");
    if (currentDate >= rangeStart && currentDate >= baseDate && !excludedSet.has(dateStr)) {
      let status: "scheduled" | "completed" | "missed";
      if (completedSet.has(dateStr)) {
        status = "completed";
      } else if (service.status === "completed") {
        status = "completed";
      } else if (startOfDay(currentDate) < startOfDay(now)) {
        status = "missed";
      } else {
        status = "scheduled";
      }
      occurrences.push({ date: new Date(currentDate), status, service });
    }

    currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  }

  return occurrences;
}

function aggregateServices(
  services: ServiceWithDetails[],
  view: ViewMode
): ChartDataItem[] {
  const { start, end } = getDateRange(view);
  const now = new Date();
  const today = startOfDay(now);
  const currentHour = now.getHours();

  const allOccurrences: ServiceOccurrence[] = [];
  for (const service of services) {
    allOccurrences.push(...generateServiceOccurrences(service, start, end));
  }

  if (view === "today") {
    const hours = ["6AM", "9AM", "12PM", "3PM", "6PM"];
    const hourRanges = [
      { start: 6, end: 9 },
      { start: 9, end: 12 },
      { start: 12, end: 15 },
      { start: 15, end: 18 },
      { start: 18, end: 21 },
    ];

    let currentRangeIndex = -1;
    for (let i = 0; i < hourRanges.length; i++) {
      if (currentHour >= hourRanges[i].start && currentHour < hourRanges[i].end) {
        currentRangeIndex = i;
        break;
      }
    }
    if (currentRangeIndex === -1 && currentHour >= 21) {
      currentRangeIndex = 4;
    } else if (currentRangeIndex === -1 && currentHour < 6) {
      currentRangeIndex = 0;
    }

    return hours.map((label, idx) => {
      const range = hourRanges[idx];
      const isCurrentRange = idx === currentRangeIndex;

      const inRange = allOccurrences.filter((occ) => {
        const hour = occ.date.getHours();
        return hour >= range.start && hour < range.end;
      });

      return {
        label,
        scheduled: inRange.filter((o) => o.status === "scheduled").length,
        completed: inRange.filter((o) => o.status === "completed").length,
        missed: inRange.filter((o) => o.status === "missed").length,
        isHighlighted: isCurrentRange,
        occurrences: inRange,
      };
    });
  }

  if (view === "week") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayDayOfWeek = today.getDay();
    const todayIndex = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;

    return days.map((label, idx) => {
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + idx);
      const dayStart = startOfDay(dayDate);

      const inDay = allOccurrences.filter((occ) => {
        const occDay = startOfDay(occ.date);
        return occDay.getTime() === dayStart.getTime();
      });

      return {
        label,
        scheduled: inDay.filter((o) => o.status === "scheduled").length,
        completed: inDay.filter((o) => o.status === "completed").length,
        missed: inDay.filter((o) => o.status === "missed").length,
        isHighlighted: idx === todayIndex,
        occurrences: inDay,
      };
    });
  }

  const weeksInMonth: ChartDataItem[] = [];
  let weekStart = new Date(start);
  let weekNum = 1;

  while (weekStart <= end) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    if (weekEnd > end) weekEnd.setTime(end.getTime());
    weekEnd.setHours(23, 59, 59, 999);

    const inWeek = allOccurrences.filter((occ) => {
      return occ.date >= weekStart && occ.date <= weekEnd;
    });

    const isCurrentWeek = today >= weekStart && today <= weekEnd;

    weeksInMonth.push({
      label: `Week ${weekNum}`,
      scheduled: inWeek.filter((o) => o.status === "scheduled").length,
      completed: inWeek.filter((o) => o.status === "completed").length,
      missed: inWeek.filter((o) => o.status === "missed").length,
      isHighlighted: isCurrentWeek,
      occurrences: inWeek,
    });

    weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() + 1);
    weekStart.setHours(0, 0, 0, 0);
    weekNum++;
  }

  return weeksInMonth;
}

export default function ServicesOverview() {
  const [view, setView] = useState<ViewMode>("today");
  const [selectedBar, setSelectedBar] = useState<ChartDataItem | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);

  const { data: services = [], isLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
  });

  const chartData = useMemo(
    () => aggregateServices(services, view),
    [services, view]
  );

  const maxTotal = Math.max(
    ...chartData.map((d) => d.scheduled + d.completed + d.missed),
    1
  );
  const maxHeight = 180;

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    missed: "bg-red-100 text-red-800",
  };

  return (
    <Card data-testid="card-services-overview">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Services Overview</CardTitle>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={view === "today" ? "default" : "ghost"}
              onClick={() => setView("today")}
              data-testid="button-filter-today"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={view === "week" ? "default" : "ghost"}
              onClick={() => setView("week")}
              data-testid="button-filter-week"
            >
              Week
            </Button>
            <Button
              size="sm"
              variant={view === "month" ? "default" : "ghost"}
              onClick={() => setView("month")}
              data-testid="button-filter-month"
            >
              Month
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <span className="text-muted-foreground">Loading...</span>
          </div>
        ) : (
          <div className="h-64 flex items-end justify-center space-x-4 mb-4" data-testid="chart-services">
            {chartData.map((item) => {
              const totalCount = item.scheduled + item.completed + item.missed;
              const totalHeight = totalCount > 0 ? (totalCount / maxTotal) * maxHeight : 0;
              const scheduledHeight = totalCount > 0 ? (item.scheduled / totalCount) * totalHeight : 0;
              const completedHeight = totalCount > 0 ? (item.completed / totalCount) * totalHeight : 0;
              const missedHeight = totalCount > 0 ? (item.missed / totalCount) * totalHeight : 0;

              return (
                <div
                  key={item.label}
                  className="flex flex-col items-center cursor-pointer group"
                  onClick={() => totalCount > 0 && setSelectedBar(item)}
                >
                  <div className="flex flex-col-reverse mb-2" style={{ height: `${maxHeight}px` }}>
                    <div className="flex flex-col-reverse group-hover:opacity-80 transition-opacity">
                      {scheduledHeight > 0 && (
                        <div
                          className={`w-12 ${item.isHighlighted ? "bg-blue-600" : "bg-blue-500"} group-hover:ring-2 group-hover:ring-blue-300 transition-all`}
                          style={{ height: `${scheduledHeight}px` }}
                        />
                      )}
                      {completedHeight > 0 && (
                        <div
                          className="w-12 bg-green-500 group-hover:ring-2 group-hover:ring-green-300 transition-all"
                          style={{ height: `${completedHeight}px` }}
                        />
                      )}
                      {missedHeight > 0 && (
                        <div
                          className="w-12 bg-red-500 group-hover:ring-2 group-hover:ring-red-300 transition-all"
                          style={{ height: `${missedHeight}px` }}
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-xs ${
                      item.isHighlighted ? "text-foreground font-medium" : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-muted-foreground">Scheduled</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-muted-foreground">Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-muted-foreground">Missed</span>
          </div>
        </div>
      </CardContent>

      <Dialog open={!!selectedBar} onOpenChange={(open) => { if (!open) setSelectedBar(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Services — {selectedBar?.label}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({selectedBar?.occurrences.length || 0} services)
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedBar?.occurrences.map((occ, index) => (
                  <TableRow
                    key={`${occ.service.id}-${index}`}
                    className="cursor-pointer hover:!bg-blue-50 dark:hover:!bg-blue-950 transition-colors"
                    onClick={() => setSelectedService(occ.service)}
                  >
                    <TableCell className="font-medium">{occ.service.client?.name || 'Unknown'}</TableCell>
                    <TableCell>{occ.service.type?.replace('_', ' ') || 'Unknown'}</TableCell>
                    <TableCell>{format(occ.date, 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[occ.status]}>
                        {occ.status.charAt(0).toUpperCase() + occ.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell><ExternalLink className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
                {(!selectedBar?.occurrences || selectedBar.occurrences.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No services in this period</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedService} onOpenChange={(open) => { if (!open) setSelectedService(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <ServiceForm
              service={selectedService}
              onSuccess={() => {
                setSelectedService(null);
                setSelectedBar(null);
                queryClient.invalidateQueries({ queryKey: ["/api/services"] });
                queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
              }}
              onCancel={() => setSelectedService(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
