import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Wrench, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ServiceWithDetails } from "@shared/schema";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";

export default function RecentServices() {
  const { data: services = [], isLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ["/api/services"],
  });

  const formatServiceDate = (date: Date | string | null): string => {
    if (!date) return "No date";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    
    if (isToday(dateObj)) {
      return `Today, ${format(dateObj, "h:mm a")}`;
    }
    if (isTomorrow(dateObj)) {
      return `Tomorrow, ${format(dateObj, "h:mm a")}`;
    }
    if (isYesterday(dateObj)) {
      return `Yesterday, ${format(dateObj, "h:mm a")}`;
    }
    return format(dateObj, "MMM d, h:mm a");
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "completed":
        return "status-completed";
      case "scheduled":
        return "status-scheduled";
      case "missed":
        return "status-missed";
      default:
        return "status-scheduled";
    }
  };

  const getActionButton = (status: string | null, serviceId: number) => {
    switch (status) {
      case "completed":
        return (
          <Button 
            variant="ghost" 
            size="sm"
            data-testid={`button-review-${serviceId}`}
          >
            Review
          </Button>
        );
      case "missed":
        return (
          <Button 
            variant="ghost" 
            size="sm"
            className="text-destructive hover:text-destructive/80"
            data-testid={`button-reschedule-${serviceId}`}
          >
            Reschedule
          </Button>
        );
      default:
        return (
          <Button 
            variant="ghost" 
            size="sm"
            data-testid={`button-view-${serviceId}`}
          >
            View
          </Button>
        );
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

  const recentServices = services.slice(0, 5);

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
        ) : recentServices.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No services scheduled
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
                {recentServices.map((service) => (
                  <tr 
                    key={service.id} 
                    className="hover:bg-muted/50"
                    data-testid={`row-service-${service.id}`}
                  >
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-foreground">
                          {service.client?.name || "Unknown Client"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {service.client?.addressText || "No address"}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        {getServiceIcon(service.type)}
                        <span className="text-sm">{formatServiceType(service.type)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-foreground">
                      {service.team?.name || "Unassigned"}
                    </td>
                    <td className="py-4 px-6 text-sm text-muted-foreground">
                      {formatServiceDate(service.installationDate)}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(service.status)}`}>
                        {(service.status || "scheduled").charAt(0).toUpperCase() + (service.status || "scheduled").slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {getActionButton(service.status, service.id)}
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
