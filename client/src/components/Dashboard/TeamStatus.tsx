import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const mockTeams = [
  {
    id: 1,
    name: "Team Alpha",
    initials: "TA",
    members: ["Mike Johnson", "Tom Wilson"],
    status: "active" as const,
    statusColor: "bg-green-100 text-green-800",
  },
  {
    id: 2,
    name: "Team Beta",
    initials: "TB",
    members: ["Sarah Lee", "David Chen"],
    status: "scheduled" as const,
    statusColor: "bg-blue-100 text-blue-800",
  },
  {
    id: 3,
    name: "Team Gamma",
    initials: "TG",
    members: ["Alex Rodriguez"],
    status: "available" as const,
    statusColor: "bg-gray-100 text-gray-800",
  },
];

export default function TeamStatus() {
  const getInitialsColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-600";
      case "scheduled":
        return "bg-blue-100 text-blue-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <Card data-testid="card-team-status">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Team Status</CardTitle>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockTeams.map((team) => (
            <div 
              key={team.id} 
              className="flex items-center justify-between"
              data-testid={`item-team-${team.id}`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getInitialsColor(team.status)}`}>
                  <span className="text-xs font-medium">{team.initials}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{team.name}</div>
                  <div className="text-xs text-muted-foreground">{team.members.join(", ")}</div>
                </div>
              </div>
              <Badge className={team.statusColor} variant="secondary">
                {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
