import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Service } from "@shared/schema";

type CompletedService = Service & { clientName: string; occurrenceDate?: string };

export default function InvoicingStatus() {
  const { toast } = useToast();

  const { data: allCompleted = [], isLoading } = useQuery<CompletedService[]>({
    queryKey: ["/api/services/completed"],
    staleTime: 0,
  });

  // Filter to only show services that are not invoiced
  const notInvoiced = allCompleted.filter(service => {
    if (service.occurrenceDate) {
      // For recurring services, check if this specific occurrence is invoiced
      const invoicedDates = service.invoicedDates || [];
      return !invoicedDates.includes(service.occurrenceDate);
    } else {
      // For one-off services, check invoicedStatus
      return service.invoicedStatus !== "invoiced";
    }
  });

  const totalPending = notInvoiced.reduce((sum, service) => sum + (service.price || 0), 0);

  const markInvoicedMutation = useMutation({
    mutationFn: async (service: CompletedService) => {
      return apiRequest("PATCH", "/api/services/mark-invoiced", {
        serviceId: service.id,
        occurrenceDate: service.occurrenceDate,
      });
    },
    onSuccess: () => {
      toast({
        title: "Marked as invoiced",
        description: "Service has been marked as invoiced.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/services/completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to mark as invoiced",
        variant: "destructive",
      });
    },
  });

  const getCompletedTime = (date: string) => {
    try {
      const parsed = parseISO(date);
      const now = new Date();
      const diffMs = now.getTime() - parsed.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffHours < 1) return "less than an hour ago";
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;
      return format(parsed, "dd MMM");
    } catch {
      return "recently";
    }
  };

  return (
    <Card data-testid="card-invoicing-status">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ready to Invoice</CardTitle>
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading...</div>
          ) : notInvoiced.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No services pending invoicing</div>
          ) : (
            notInvoiced.slice(0, 2).map((service) => (
              <div 
                key={`${service.id}-${service.occurrenceDate || ''}`}
                className="flex items-center justify-between p-3 bg-blue-50 rounded-md"
                data-testid={`item-invoice-${service.id}`}
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{service.clientName} - {service.type}</div>
                  <div className="text-xs text-muted-foreground">Completed {getCompletedTime(service.completedDate || service.scheduledDate)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">
                    R{(service.price || 0).toFixed(2)}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-primary hover:text-primary/80 h-auto p-0"
                    onClick={() => markInvoicedMutation.mutate(service)}
                    disabled={markInvoicedMutation.isPending}
                    data-testid={`button-mark-invoiced-${service.id}`}
                  >
                    {markInvoicedMutation.isPending ? "..." : "Mark Invoiced"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Pending:</span>
            <span className="font-medium text-foreground" data-testid="text-total-pending">
              R{totalPending.toFixed(2)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
