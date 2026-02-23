import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ServiceForm from "../Forms/ServiceForm";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Repeat,
  Wrench,
  MapPin,
  Clock
} from "lucide-react";
import { format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday,
  parseISO,
  startOfDay
} from "date-fns";
import { cn } from "@/lib/utils";

interface Service {
  id: number;
  type: string;
  installationDate: string;
  status: string;
  client?: { name: string; address: string };
  team?: { name: string };
  recurrencePattern?: any;
}

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["/api/services", { 
      date: format(monthStart, "yyyy-MM-dd"),
      endDate: format(monthEnd, "yyyy-MM-dd")
    }],
  });

  const getServicesForDate = (date: Date) => {
    return services.filter((service: Service) => 
      isSameDay(parseISO(service.installationDate), date)
    );
  };

  const getEffectiveStatus = (service: Service, displayDate: Date): string => {
    const dateString = format(displayDate, 'yyyy-MM-dd');
    const today = startOfDay(new Date());
    const displayDay = startOfDay(displayDate);

    if (service.status === 'completed') return 'completed';

    if (displayDay < today) return 'missed';

    return service.status || 'scheduled';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-200";
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "missed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const previousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-32"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="grid grid-cols-7 gap-2 mb-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded"></div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {[...Array(35)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-calendar-view">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Service Calendar</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
              data-testid="button-previous-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium min-w-[140px] text-center">
              {format(currentDate, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
              data-testid="button-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-add-service">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Create New Service</DialogTitle>
                </DialogHeader>
                <ServiceForm
                  onSuccess={() => setIsCreateOpen(false)}
                  onCancel={() => setIsCreateOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Calendar Header - Days of Week */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((day) => {
            const dayServices = getServicesForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDayToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[100px] p-2 border border-border rounded-md cursor-pointer hover:bg-accent/50 transition-colors",
                  !isCurrentMonth && "opacity-50 bg-muted/30",
                  isDayToday && "ring-2 ring-primary ring-offset-2",
                  selectedDate && isSameDay(day, selectedDate) && "bg-accent"
                )}
                onClick={() => setSelectedDate(day)}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "text-sm",
                      isDayToday && "font-bold text-primary",
                      !isCurrentMonth && "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {dayServices.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-1 py-0 h-4"
                      data-testid={`badge-service-count-${format(day, "yyyy-MM-dd")}`}
                    >
                      {dayServices.length}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {dayServices.slice(0, 3).map((service: Service, index) => (
                    <div
                      key={service.id}
                      className={cn(
                        "text-xs p-1 rounded border",
                        getStatusColor(getEffectiveStatus(service, day))
                      )}
                      data-testid={`service-${service.id}`}
                    >
                      <div className="flex items-center space-x-1">
                        {service.type === "service_contract" ? (
                          <Repeat className="h-3 w-3" />
                        ) : (
                          <Wrench className="h-3 w-3" />
                        )}
                        <span className="truncate">
                          {service.client?.name || "Unknown Client"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 mt-1 text-[10px] opacity-75">
                        <Clock className="h-2 w-2" />
                        <span>{service.team?.name || "Unassigned"}</span>
                      </div>
                    </div>
                  ))}
                  
                  {dayServices.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayServices.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Date Details */}
        {selectedDate && (
          <div className="mt-6 p-4 border border-border rounded-lg bg-card">
            <h3 className="text-lg font-medium mb-3">
              Services for {format(selectedDate, "PPP")}
            </h3>
            
            {getServicesForDate(selectedDate).length === 0 ? (
              <p className="text-muted-foreground">No services scheduled for this date.</p>
            ) : (
              <div className="space-y-3">
                {getServicesForDate(selectedDate).map((service: Service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 border border-border rounded-md"
                    data-testid={`selected-service-${service.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn("w-3 h-3 rounded-full", {
                        "bg-green-500": service.status === "completed",
                        "bg-blue-500": service.status === "scheduled", 
                        "bg-red-500": service.status === "missed",
                      })}></div>
                      <div>
                        <div className="flex items-center space-x-2">
                          {service.type === "service_contract" ? (
                            <Repeat className="h-4 w-4 text-primary" />
                          ) : (
                            <Wrench className="h-4 w-4 text-green-600" />
                          )}
                          <span className="font-medium">
                            {service.client?.name || "Unknown Client"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          {service.client?.address && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="h-3 w-3" />
                              <span>{service.client.address}</span>
                            </div>
                          )}
                          {service.team?.name && (
                            <div className="flex items-center space-x-1">
                              <span>Team: {service.team.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(getEffectiveStatus(service, selectedDate!))}>
                      {getEffectiveStatus(service, selectedDate!).replace('_', ' ').charAt(0).toUpperCase() + getEffectiveStatus(service, selectedDate!).replace('_', ' ').slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
