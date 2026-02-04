import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Wrench, Loader2, ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ServiceWithDetails } from "@shared/schema";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ServiceOccurrence {
  service: ServiceWithDetails;
  date: Date;
  status: "completed" | "scheduled" | "missed";
}

export default function RecentServices() {
  const [filter, setFilter] = useState<"completed" | "scheduled" | "missed">("completed");
  
  const { data: services = [], isLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
  });

  const filteredOccurrences = useMemo(() => {
    const occurrences: ServiceOccurrence[] = [];

    services.forEach(service => {
      // Completed Occurrences
      if (service.completedDates && Array.isArray(service.completedDates)) {
        service.completedDates.forEach((dateStr: string) => {
          occurrences.push({
            service,
            date: parseISO(dateStr),
            status: "completed"
          });
        });
      }
      
      if (service.status === "completed" && service.installationDate) {
        const alreadyIncluded = service.completedDates?.includes(
          format(new Date(service.installationDate), 'yyyy-MM-dd')
        );
        if (!alreadyIncluded) {
          occurrences.push({
            service,
            date: new Date(service.installationDate),
            status: "completed"
          });
        }
      }

      // Scheduled Occurrences
      if (service.status === "scheduled" && service.installationDate) {
        const isCompleted = service.completedDates?.includes(
          format(new Date(service.installationDate), 'yyyy-MM-dd')
        );
        if (!isCompleted) {
          occurrences.push({
            service,
            date: new Date(service.installationDate),
            status: "scheduled"
          });
        }
      }

      // Missed Occurrences
      if (service.status === "missed" && service.installationDate) {
        occurrences.push({
          service,
          date: new Date(service.installationDate),
          status: "missed"
        });
      }
    });

    return occurrences
      .filter(occ => occ.status === filter)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 5);
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
                    className="hover:bg-muted/50"
                    data-testid={`row-service-${occurrence.service.id}-${index}`}
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
    </Card>
  );
}
