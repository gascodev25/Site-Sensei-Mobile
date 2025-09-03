import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Repeat, Wrench } from "lucide-react";

const mockServices = [
  {
    id: 1,
    client: { name: "Acme Corp", address: "123 Business St, Sydney" },
    type: "Service Contract",
    team: "Team Alpha",
    date: "Today, 2:30 PM",
    status: "completed" as const,
    icon: Repeat,
  },
  {
    id: 2,
    client: { name: "Tech Solutions Ltd", address: "456 Innovation Ave, Melbourne" },
    type: "Installation",
    team: "Team Beta",
    date: "Tomorrow, 10:00 AM",
    status: "scheduled" as const,
    icon: Wrench,
  },
  {
    id: 3,
    client: { name: "Global Industries", address: "789 Corporate Blvd, Brisbane" },
    type: "Service Contract",
    team: "Team Gamma",
    date: "Yesterday, 3:00 PM",
    status: "missed" as const,
    icon: Repeat,
  },
];

export default function RecentServices() {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default" as const;
      case "scheduled":
        return "secondary" as const;
      case "missed":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  const getStatusColor = (status: string) => {
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

  const getActionButton = (status: string, serviceId: number) => {
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
              {mockServices.map((service) => (
                <tr 
                  key={service.id} 
                  className="hover:bg-muted/50"
                  data-testid={`row-service-${service.id}`}
                >
                  <td className="py-4 px-6">
                    <div>
                      <div className="font-medium text-foreground">{service.client.name}</div>
                      <div className="text-sm text-muted-foreground">{service.client.address}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <service.icon className={`h-4 w-4 ${
                        service.type === "Service Contract" ? "text-primary" : "text-green-600"
                      }`} />
                      <span className="text-sm">{service.type}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm text-foreground">{service.team}</td>
                  <td className="py-4 px-6 text-sm text-muted-foreground">{service.date}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(service.status)}`}>
                      {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
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
      </CardContent>
    </Card>
  );
}
