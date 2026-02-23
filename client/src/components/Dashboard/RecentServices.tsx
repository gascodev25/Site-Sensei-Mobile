import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Repeat, Wrench, Loader2, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ServiceWithDetails } from "@shared/schema";
import { format, isToday, isTomorrow, isYesterday, parseISO, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ServiceForm from "@/components/Forms/ServiceForm";
import { queryClient } from "@/lib/queryClient";

interface ServiceOccurrence {
  service: ServiceWithDetails;
  date: Date;
  status: "completed" | "scheduled" | "missed";
}

export default function RecentServices() {
  const [filter, setFilter] = useState<"completed" | "scheduled" | "missed">("completed");
  const [selectedService, setSelectedService] = useState<ServiceWithDetails | null>(null);
  
  const { data: services = [], isLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
  });

  const filteredOccurrences = useMemo(() => {
    const occurrences: ServiceOccurrence[] = [];
    const now = new Date();
    const today = startOfDay(now);

    services.forEach(service => {
      if (!service.installationDate) return;

      const baseDate = new Date(service.installationDate);
      const recurrencePattern = service.recurrencePattern as { interval?: string; end_date?: string } | null;
      const completedDates = (service.completedDates || []) as string[];
      const excludedDates = (service.excludedDates || []) as string[];
      const completedSet = new Set(completedDates.map(d => d.substring(0, 10)));
      const excludedSet = new Set(excludedDates.map(d => d.substring(0, 10)));
      const isRecurring = recurrencePattern && recurrencePattern.interval;

      if (!isRecurring) {
        const dateStr = format(baseDate, "yyyy-MM-dd");
        if (excludedSet.has(dateStr)) return;

        let status: "completed" | "scheduled" | "missed";
        if (service.status === "completed" || completedSet.has(dateStr)) {
          status = "completed";
        } else if (startOfDay(baseDate) < today) {
          status = "missed";
        } else {
          status = "scheduled";
        }
        occurrences.push({ service, date: baseDate, status });
        return;
      }

      const intervalMatch = recurrencePattern!.interval!.match(/^(\d+)d$/);
      if (!intervalMatch) {
        occurrences.push({ service, date: baseDate, status: "scheduled" });
        return;
      }

      const intervalDays = parseInt(intervalMatch[1], 10);
      const recurrenceEnd = recurrencePattern!.end_date ? parseISO(recurrencePattern!.end_date) : null;
      const futureLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      let currentDate = new Date(baseDate);

      while (currentDate <= futureLimit) {
        if (recurrenceEnd && currentDate > recurrenceEnd) break;

        const dateStr = format(currentDate, "yyyy-MM-dd");
        if (!excludedSet.has(dateStr)) {
          let status: "completed" | "scheduled" | "missed";
          if (completedSet.has(dateStr)) {
            status = "completed";
          } else if (startOfDay(currentDate) < today) {
            status = "missed";
          } else {
            status = "scheduled";
          }
          occurrences.push({ service, date: new Date(currentDate), status });
        }

        currentDate = new Date(currentDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
      }
    });

    return occurrences
      .filter(occ => occ.status === filter)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
  }, [services, filter]);

  const formatServiceDate = (date: Date): string => {
    if (isToday(date)) {
      return `Today, ${format(date, "h:mm a")}`;
    }
    if (isTomorrow(date)) {
      return `Tomorrow, ${format(date, "h:mm a")}`;
    }
    if (isYesterday(date)) {
      return `Yesterday, ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d, yyyy");
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "completed": return "status-completed";
      case "scheduled": return "bg-amber-100 text-amber-800";
      case "missed": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getServiceIcon = (type: string | null) => {
    if (type === "service_contract") {
      return <Repeat className="h-4 w-4 text-primary" />;
    }
    return <Wrench className="h-4 w-4 text-green-600" />;
  };

  const formatServiceType = (type: string | null) => {
    if (type === "service_contract") return "Service Contract";
    if (type === "installation") return "Installation";
    return type || "Service";
  };

  return (
    <Card data-testid="card-recent-services">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle>Recent Services</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-view-all-services" className="flex items-center gap-1">
                View: {filter.charAt(0).toUpperCase() + filter.slice(1)}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter("completed")}>
                Completed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("scheduled")}>
                Scheduled
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("missed")}>
                Missed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredOccurrences.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No {filter} services
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Client</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Service Type</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Team</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-6 text-sm font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredOccurrences.map((occurrence, index) => (
                  <tr 
                    key={`${occurrence.service.id}-${format(occurrence.date, 'yyyy-MM-dd')}`}
                    className="cursor-pointer hover:!bg-blue-50 dark:hover:!bg-blue-950 transition-colors"
                    data-testid={`row-service-${occurrence.service.id}-${index}`}
                    onClick={() => setSelectedService(occurrence.service)}
                  >
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-foreground">
                          {occurrence.service.client?.name || "Unknown Client"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {occurrence.service.client?.addressText || "No address"}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        {getServiceIcon(occurrence.service.type)}
                        <span className="text-sm">{formatServiceType(occurrence.service.type)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-foreground">
                      {occurrence.service.team?.name || "Unassigned"}
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">
                      {formatServiceDate(occurrence.date)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(occurrence.status)}`}>
                        {occurrence.status.charAt(0).toUpperCase() + occurrence.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        data-testid={`button-review-${occurrence.service.id}`}
                        onClick={(e) => { e.stopPropagation(); setSelectedService(occurrence.service); }}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

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
