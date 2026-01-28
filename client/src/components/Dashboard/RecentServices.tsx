import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Wrench, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ServiceWithDetails } from "@shared/schema";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { useMemo } from "react";

interface CompletedServiceOccurrence {
  service: ServiceWithDetails;
  completedDate: Date;
}

export default function RecentServices() {
  const { data: services = [], isLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
  });

  const completedOccurrences = useMemo(() => {
    const occurrences: CompletedServiceOccurrence[] = [];

    services.forEach(service => {
      if (service.completedDates && Array.isArray(service.completedDates)) {
        service.completedDates.forEach((dateStr: string) => {
          occurrences.push({
            service,
            completedDate: parseISO(dateStr),
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
            completedDate: new Date(service.installationDate),
          });
        }
      }
    });

    return occurrences
      .sort((a, b) => b.completedDate.getTime() - a.completedDate.getTime())
      .slice(0, 5);
  }, [services]);

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

  const getStatusColor = () => {
    return "status-completed";
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
          <Button variant="ghost" size="sm" data-testid="button-view-all-services">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : completedOccurrences.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No completed services
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
                {completedOccurrences.map((occurrence, index) => (
                  <tr 
                    key={`${occurrence.service.id}-${format(occurrence.completedDate, 'yyyy-MM-dd')}`}
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
                      {formatServiceDate(occurrence.completedDate)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor()}`}>
                        Completed
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
