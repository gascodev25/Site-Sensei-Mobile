import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, User, Clock, MapPin, Wrench, Package } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfDay } from "date-fns";
import type { ServiceWithDetails } from "@shared/schema";
import { generateOccurrences } from "@shared/recurrence";

interface ServiceCalendarProps {
  services: ServiceWithDetails[];
  onServiceClick?: (service: ServiceWithDetails, clickedDate?: Date) => void;
  onServiceMove?: (serviceId: number, newDate: Date, originalDate?: Date) => void;
  onDateClick?: (date: Date) => void;
}

export default function ServiceCalendar({ services, onServiceClick, onServiceMove, onDateClick }: ServiceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [draggedService, setDraggedService] = useState<ServiceWithDetails | null>(null);
  const [draggedFromDate, setDraggedFromDate] = useState<Date | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch all teams from API
  const { data: allTeams = [] } = useQuery({
    queryKey: ["/api/service-teams"],
  });

  // Filter services by team
  const filteredServices = useMemo(() => {
    if (selectedTeam === 'all') return services;
    return services.filter(s => s.team?.name === selectedTeam);
  }, [services, selectedTeam]);

  // Get color based on service status (for badge only)
  const getStatusColor = (status: string) => {
    const colors = {
      'scheduled': 'bg-amber-100 border-amber-400 text-amber-800',
      'completed': 'bg-green-100 border-green-400 text-green-800',
      'missed': 'bg-red-100 border-red-400 text-red-800',
      'in_progress': 'bg-blue-100 border-blue-400 text-blue-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 border-gray-400 text-gray-800';
  };

  // Get team background color for service containers
  const getTeamBackgroundColor = (teamName?: string, status?: string) => {
    if (!teamName) {
      // Fallback to status color if no team
      return getStatusColor(status || 'scheduled');
    }

    const teamColors = {
      "Hygiene": "bg-blue-50 border-blue-200 text-blue-900",
      "Deep Clean": "bg-green-50 border-green-200 text-green-900", 
      "Pest Control": "bg-orange-50 border-orange-200 text-orange-900",
    };
    return teamColors[teamName as keyof typeof teamColors] || getStatusColor(status || 'scheduled');
  };

  // Generate recurring service instances based on recurrencePattern
  const generateRecurringInstances = (service: ServiceWithDetails, startDate: Date, endDate: Date): Date[] => {
    if (!service.installationDate) {
      return [];
    }

    const baseDate = typeof service.installationDate === 'string' 
      ? parseISO(service.installationDate)
      : service.installationDate;

    // Check if service has recurrence pattern
    const recurrencePattern = service.recurrencePattern as { interval?: string; end_date?: string } | null;

    if (!recurrencePattern || !recurrencePattern.interval) {
      // Single occurrence service
      return [baseDate];
    }

    const excludedDates = (service.excludedDates as string[]) || [];
    const recurrenceEnd = recurrencePattern.end_date ? parseISO(recurrencePattern.end_date) : null;

    const instances = generateOccurrences(baseDate, recurrencePattern.interval, {
      rangeStart: startDate,
      rangeEnd: endDate,
      endDate: recurrenceEnd,
      excludedDates,
    });

    return instances.sort((a, b) => a.getTime() - b.getTime());
  };

  // Get services for a specific date (including recurring instances)
  const getServicesForDate = (date: Date) => {
    const servicesForDate: ServiceWithDetails[] = [];

    filteredServices.forEach(service => {
      // For calendar view, we need to show recurring instances within a reasonable range
      const viewStart = view === 'month' 
        ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
        : view === 'week' 
        ? startOfWeek(currentDate, { weekStartsOn: 1 })
        : startOfMonth(currentDate);

      const viewEnd = view === 'month' 
        ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
        : view === 'week' 
        ? endOfWeek(currentDate, { weekStartsOn: 1 })
        : endOfMonth(currentDate);

      const instances = generateRecurringInstances(service, viewStart, viewEnd);

      if (instances.some(instanceDate => isSameDay(instanceDate, date))) {
        servicesForDate.push(service);
      }
    });

    return servicesForDate;
  };

  // Navigation functions
  const navigatePrevious = () => {
    if (view === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000));
    }
  };

  const navigateNext = () => {
    if (view === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000));
    }
  };

  // Drag and drop handlers
  const handleDragStart = (service: ServiceWithDetails, fromDate: Date) => {
    setDraggedService(service);
    setDraggedFromDate(fromDate);
    setIsDragging(true);
  };

  const handleDrop = (date: Date) => {
    if (draggedService && onServiceMove) {
      onServiceMove(draggedService.id, date, draggedFromDate || undefined);
      setDraggedService(null);
      setDraggedFromDate(null);
      // Reset dragging state after a small delay to prevent click events
      setTimeout(() => setIsDragging(false), 0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Helper function to get effective status for a service on a specific date
  const getEffectiveStatus = (service: ServiceWithDetails, displayDate: Date): string => {
    const dateString = format(displayDate, 'yyyy-MM-dd');
    const today = startOfDay(new Date());
    const displayDay = startOfDay(displayDate);

    if (service.completedDates && Array.isArray(service.completedDates)) {
      if (service.completedDates.includes(dateString)) {
        return 'completed';
      }
    }

    if (service.status === 'completed') {
      return 'completed';
    }

    if (displayDay < today) {
      return 'missed';
    }

    return service.status || 'scheduled';
  };

  // Render individual service item
  const renderServiceItem = (service: ServiceWithDetails, size: 'small' | 'large' = 'small', displayDate: Date) => {
    const effectiveStatus = getEffectiveStatus(service, displayDate);

    return (
      <div
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          handleDragStart(service, displayDate);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDragging) {
            onServiceClick?.(service, displayDate);
          }
        }}
        className={`
          p-2 rounded cursor-pointer transition-all
          ${getTeamBackgroundColor(service.team?.name, effectiveStatus)}
          hover:shadow-md hover:scale-105
          ${size === 'large' ? 'mb-2' : 'mb-1'}
        `}
        data-testid={`calendar-service-${service.id}`}
      >
        <div className="font-medium truncate">{service.client?.name || 'Unknown'}</div>
        {size === 'large' && (
          <>
            <div className="flex items-center text-xs mt-1 opacity-75">
              <MapPin className="h-3 w-3 mr-1" />
              <span className="truncate">{service.client?.city || 'Location not set'}</span>
            </div>
            {service.team && (
              <div className="flex items-center text-xs mt-1 opacity-75">
                <User className="h-3 w-3 mr-1" />
                <span className="truncate">{service.team.name}</span>
              </div>
            )}
            {service.estimatedDuration && (
              <div className="flex items-center text-xs mt-1 opacity-75">
                <Clock className="h-3 w-3 mr-1" />
                <span>{service.estimatedDuration}min</span>
              </div>
            )}
            {(service as any).stockSummary?.equipmentNames?.length > 0 && (
              <div className="flex items-center text-xs mt-1 opacity-75">
                <Wrench className="h-3 w-3 mr-1 shrink-0" />
                <span className="truncate">{(service as any).stockSummary.equipmentNames.slice(0, 2).join(', ')}{(service as any).stockSummary.equipmentNames.length > 2 ? ` +${(service as any).stockSummary.equipmentNames.length - 2}` : ''}</span>
              </div>
            )}
            {(service as any).stockSummary?.consumableNames?.length > 0 && (
              <div className="flex items-center text-xs mt-1 opacity-75">
                <Package className="h-3 w-3 mr-1 shrink-0" />
                <span className="truncate">{(service as any).stockSummary.consumableNames.slice(0, 2).join(', ')}{(service as any).stockSummary.consumableNames.length > 2 ? ` +${(service as any).stockSummary.consumableNames.length - 2}` : ''}</span>
              </div>
            )}
          </>
        )}
        <Badge className={`mt-1 text-xs ${getStatusColor(effectiveStatus)}`}>
          {effectiveStatus.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>
    );
  };

  // Monthly view
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Days of week header */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="p-2 text-sm font-medium text-center text-muted-foreground">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map(day => {
          const dayServices = getServicesForDate(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-[100px] p-1 border border-border rounded cursor-pointer hover:bg-muted/20 transition-colors
                ${!isCurrentMonth ? 'bg-muted/50 text-muted-foreground' : 'bg-background'}
                ${isToday ? 'ring-2 ring-primary' : ''}
              `}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(day);
              }}
              onDragOver={handleDragOver}
              onClick={() => {
                if (isDragging) return;
                onDateClick?.(day);
              }}
              data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
            >
              <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary' : ''}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayServices.slice(0, 3).map(service => renderServiceItem(service, 'small', day))}
                {dayServices.length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayServices.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Weekly view
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayServices = getServicesForDate(day);
          const isToday = isSameDay(day, new Date());

          return (
            <Card key={day.toISOString()} className={isToday ? 'ring-2 ring-primary' : ''}>
              <CardHeader className="p-3">
                <CardTitle className={`text-center ${isToday ? 'text-primary' : ''}`}>
                  <div className="text-lg font-bold">{format(day, 'd')}</div>
                  <div className="text-sm font-normal">{format(day, 'EEE')}</div>
                </CardTitle>
              </CardHeader>
              <CardContent 
                className="p-3 min-h-[300px] cursor-pointer hover:bg-muted/20 transition-colors"
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(day);
                }}
                onDragOver={handleDragOver}
                onClick={() => {
                  if (isDragging) return;
                  onDateClick?.(day);
                }}
                data-testid={`calendar-week-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className="space-y-2">
                  {dayServices.map(service => renderServiceItem(service, 'large', day))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // Daily view
  const renderDayView = () => {
    const dayServices = getServicesForDate(currentDate);
    const isToday = isSameDay(currentDate, new Date());

    return (
      <Card className={isToday ? 'ring-2 ring-primary' : ''}>
        <CardHeader>
          <CardTitle className="text-center">
            <div className="text-2xl font-bold">{format(currentDate, 'd')}</div>
            <div className="text-lg">{format(currentDate, 'EEEE, MMMM yyyy')}</div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => onDateClick?.(currentDate)}>
          {dayServices.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Calendar className="h-12 w-12 mx-auto mb-4" />
              <p>No services scheduled for this day</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayServices.map(service => (
                <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={(e) => {
                  e.stopPropagation();
                  onServiceClick?.(service);
                }}>
                  <CardContent className="p-4">
                    {renderServiceItem(service, 'large', currentDate)}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const getViewTitle = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week') return `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={navigatePrevious} data-testid="calendar-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold min-w-[200px] text-center">{getViewTitle()}</h2>
            <Button variant="outline" size="sm" onClick={navigateNext} data-testid="calendar-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Team Filter */}
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-[180px]" data-testid="select-team-filter">
              <SelectValue>
                {selectedTeam === 'all' ? 'All Teams' : selectedTeam}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {allTeams.map((team: any) => (
                <SelectItem key={team.id} value={team.name}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            {['month', 'week', 'day'].map((viewOption) => (
              <Button
                key={viewOption}
                variant={view === viewOption ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView(viewOption as 'month' | 'week' | 'day')}
                className="rounded-none border-0"
                data-testid={`calendar-view-${viewOption}`}
              >
                {viewOption.charAt(0).toUpperCase() + viewOption.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Color Legend */}
      <Card className="p-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-400"></div>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-400"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-400"></div>
            <span>Missed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-400"></div>
            <span>In Progress</span>
          </div>
        </div>
      </Card>

      {/* Calendar View */}
      <div className="calendar-container">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>

      {/* Drag hint */}
      {draggedService && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg">
          Drop to reschedule "{draggedService.client?.name}"
        </div>
      )}
    </div>
  );
}