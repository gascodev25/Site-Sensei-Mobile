import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Header from "@/components/Layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, FileText, Clock, Receipt } from "lucide-react";
import { format } from "date-fns";
import type { Service } from "@shared/schema";

type CompletedService = Service & { clientName: string };

const INTERVAL_OPTIONS = [
  { value: "once", label: "Once-off" },
  { value: "all", label: "All Intervals" },
  { value: "7d", label: "Weekly (7d)" },
  { value: "14d", label: "Fortnightly (14d)" },
  { value: "30d", label: "Monthly (30d)" },
  { value: "60d", label: "Bi-monthly (60d)" },
  { value: "90d", label: "Quarterly (90d)" },
];

export default function Invoicing() {
  const [intervalFilter, setIntervalFilter] = useState("once");
  const { toast } = useToast();

  const { data: allCompleted = [], isLoading: allLoading } = useQuery<CompletedService[]>({
    queryKey: ["/api/services/completed"],
  });

  const { data: filteredServices = [], isLoading: filteredLoading } = useQuery<CompletedService[]>({
    queryKey: ["/api/services/completed", intervalFilter],
    queryFn: async () => {
      const res = await fetch(`/api/services/completed?interval=${intervalFilter}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch completed services");
      return res.json();
    },
  });

  const markInvoicedMutation = useMutation({
    mutationFn: async (serviceId: number) => {
      return await apiRequest("PATCH", `/api/services/${serviceId}/mark-invoiced`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services/completed"] });
      toast({
        title: "Success",
        description: "Service marked as invoiced",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark service as invoiced",
        variant: "destructive",
      });
    },
  });

  const totalCompleted = allCompleted.length;
  const invoicedCount = allCompleted.filter(s => s.invoicedStatus === "invoiced").length;
  const notInvoicedCount = allCompleted.filter(s => s.invoicedStatus !== "invoiced").length;

  const isLoading = allLoading || filteredLoading;

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    try {
      return format(new Date(date), "dd MMM yyyy");
    } catch {
      return "—";
    }
  };

  const getInvoicedBadge = (status: string | null) => {
    if (status === "invoiced") {
      return <Badge className="bg-green-100 border-green-400 text-green-800">Invoiced</Badge>;
    }
    if (status === "ready") {
      return <Badge className="bg-blue-100 border-blue-400 text-blue-800">Ready</Badge>;
    }
    return <Badge className="bg-amber-100 border-amber-400 text-amber-800">Not Invoiced</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Invoicing</h1>
        </div>

        {/* Stat Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Services</CardTitle>
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="stat-completed">
                {allLoading ? "—" : totalCompleted}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Invoiced Services</CardTitle>
              <Receipt className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600" data-testid="stat-invoiced">
                {allLoading ? "—" : invoicedCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Marked as invoiced</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed but not Invoiced</CardTitle>
              <Clock className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600" data-testid="stat-not-invoiced">
                {allLoading ? "—" : notInvoicedCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pending invoicing</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter + Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Completed Services
              </CardTitle>
              <Select value={intervalFilter} onValueChange={setIntervalFilter}>
                <SelectTrigger className="w-52" data-testid="select-interval">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No completed services found for the selected interval.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Completion Date</TableHead>
                    <TableHead>Invoice Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map(service => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">{service.clientName}</TableCell>
                      <TableCell className="capitalize">{service.type?.replace(/_/g, " ") ?? "—"}</TableCell>
                      <TableCell>{formatDate(service.completedAt)}</TableCell>
                      <TableCell>{getInvoicedBadge(service.invoicedStatus)}</TableCell>
                      <TableCell className="text-right">
                        {service.invoicedStatus !== "invoiced" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markInvoicedMutation.isPending}
                            onClick={() => markInvoicedMutation.mutate(service.id)}
                            data-testid={`button-mark-invoiced-${service.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark as Invoiced
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Invoiced</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
