import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { parseISO } from "date-fns";
import type { ServiceTeam, TeamMember, ServiceWithDetails } from "@shared/schema";

interface TeamAssignment {
  teamId: number;
  memberId: number;
}

interface TeamStatusData {
  id: number;
  name: string;
  initials: string;
  members: string[];
  status: "active" | "scheduled" | "available";
  statusColor: string;
}

export default function TeamStatus() {
  const { data: teams = [], isLoading: teamsLoading } = useQuery<ServiceTeam[]>({
    queryKey: ['/api/service-teams'],
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/team-members'],
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<TeamAssignment[]>({
    queryKey: ['/api/team-assignments'],
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<ServiceWithDetails[]>({
    queryKey: ['/api/services'],
  });

  const isLoading = teamsLoading || membersLoading || assignmentsLoading || servicesLoading;

  const generateServiceOccurrences = (service: ServiceWithDetails, startDate: Date, endDate: Date): Date[] => {
    if (!service.installationDate) {
      return [];
    }

    const baseDate = typeof service.installationDate === 'string' 
      ? parseISO(service.installationDate)
      : service.installationDate;

    const recurrencePattern = service.recurrencePattern as { interval?: string; end_date?: string } | null;

    if (!recurrencePattern || !recurrencePattern.interval) {
      return [baseDate];
    }

    const intervalMatch = recurrencePattern.interval.match(/^(\d+)d$/);
    if (!intervalMatch) {
      return [baseDate];
    }

    const intervalDays = parseInt(intervalMatch[1]);
    const instances: Date[] = [];

    const excludedDates = (service.excludedDates as string[]) || [];
    const excludedDateStrings = new Set(excludedDates.map(date => date.split('T')[0]));
    const completedDates = (service.completedDates as string[]) || [];
    const completedDateStrings = new Set(completedDates.map(date => date.split('T')[0]));

    let currentDate = new Date(baseDate);
    while (currentDate <= endDate) {
      const currentDateString = currentDate.toISOString().split('T')[0];

      if (currentDate >= startDate && 
          currentDate >= baseDate && 
          !excludedDateStrings.has(currentDateString) &&
          !completedDateStrings.has(currentDateString)) {
        instances.push(new Date(currentDate));
      }
      currentDate = new Date(currentDate.getTime() + (intervalDays * 24 * 60 * 60 * 1000));

      if (recurrencePattern.end_date && currentDate > parseISO(recurrencePattern.end_date)) {
        break;
      }
    }

    return instances;
  };

  const getTeamStatus = (teamId: number): "active" | "scheduled" | "available" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 90);
    
    const teamServices = services.filter(s => 
      s.teamId === teamId && 
      s.status !== 'completed'
    );
    
    let hasTodayService = false;
    let hasFutureService = false;
    
    for (const service of teamServices) {
      const occurrences = generateServiceOccurrences(service, today, futureDate);
      
      for (const occurrence of occurrences) {
        const occurrenceDate = new Date(occurrence);
        occurrenceDate.setHours(0, 0, 0, 0);
        
        if (occurrenceDate.getTime() === today.getTime()) {
          hasTodayService = true;
        }
        if (occurrenceDate > today) {
          hasFutureService = true;
        }
      }
      
      if (hasTodayService) break;
    }
    
    if (hasTodayService) {
      return "active";
    }
    
    if (hasFutureService) {
      return "scheduled";
    }
    
    return "available";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const teamStatusData: TeamStatusData[] = teams.map(team => {
    const teamMemberIds = assignments
      .filter(a => a.teamId === team.id)
      .map(a => a.memberId);
    
    const teamMemberNames = members
      .filter(m => teamMemberIds.includes(m.id))
      .map(m => m.name);

    const status = getTeamStatus(team.id);

    return {
      id: team.id,
      name: team.name,
      initials: getInitials(team.name),
      members: teamMemberNames,
      status,
      statusColor: getStatusColor(status),
    };
  });

  return (
    <Card data-testid="card-team-status">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Team Status</CardTitle>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : teamStatusData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No teams configured
          </div>
        ) : (
          <div className="space-y-3">
            {teamStatusData.map((team) => (
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
                    <div className="text-xs text-muted-foreground">
                      {team.members.length > 0 ? team.members.join(", ") : "No members assigned"}
                    </div>
                  </div>
                </div>
                <Badge className={team.statusColor} variant="secondary">
                  {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
