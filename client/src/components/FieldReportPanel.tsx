import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, AlertTriangle, Camera, FileText, User, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FieldReport } from "@shared/schema";

interface FieldReportPanelProps {
  serviceId: number;
  occurrenceDate?: string;
}

export default function FieldReportPanel({ serviceId, occurrenceDate }: FieldReportPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedPhotos, setExpandedPhotos] = useState(false);

  const url = occurrenceDate
    ? `/api/field-reports/${serviceId}?date=${occurrenceDate}`
    : `/api/field-reports/${serviceId}`;

  const { data: report, isLoading, isError } = useQuery<FieldReport>({
    queryKey: ["/api/field-reports", serviceId, occurrenceDate ?? "latest"],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null as unknown as FieldReport;
      if (!res.ok) throw new Error("Failed to fetch field report");
      return res.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <div className="h-4 bg-muted rounded w-36 animate-pulse" />
      </div>
    );
  }

  if (isError || !report) {
    return null;
  }

  const consumables = (report.actualConsumables as {
    id: number;
    name: string;
    plannedQty: number;
    actualQty: number;
  }[]) ?? [];

  const photos = (report.photos as {
    dataUrl: string;
    comment: string;
    timestamp: string;
  }[]) ?? [];

  const completedAt = new Date(report.completionDate).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="border-t border-border pt-4 mt-4">
      <Button
        variant="ghost"
        className="w-full flex items-center justify-between px-0 hover:bg-transparent"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Field Report</span>
          {report.hasAdjustments && (
            <Badge className="bg-orange-100 border-orange-400 text-orange-800 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Adjusted
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-1">{completedAt}</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </Button>

      {expanded && (
        <div className="mt-3 space-y-5">
          {consumables.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                Consumables Used
                {report.hasAdjustments && (
                  <span className="text-orange-600 font-normal normal-case">(differences highlighted)</span>
                )}
              </h4>
              <div className="space-y-2">
                {consumables.map(c => {
                  const diff = c.actualQty - c.plannedQty;
                  const hasChange = diff !== 0;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm border ${
                        hasChange
                          ? "bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800"
                          : "bg-muted/30 border-border"
                      }`}
                    >
                      <span className="font-medium">{c.name}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Planned: <span className="font-semibold text-foreground">{c.plannedQty}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Actual: <span className={`font-semibold ${hasChange ? "text-orange-700" : "text-foreground"}`}>{c.actualQty}</span>
                        </span>
                        {hasChange && (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-xs">
                            {diff > 0 ? `+${diff}` : diff}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {report.teamSignature && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Team Signature
                </h4>
                <div className="border rounded-md overflow-hidden bg-white dark:bg-neutral-900">
                  <img
                    src={report.teamSignature}
                    alt="Team member signature"
                    className="w-full h-24 object-contain"
                  />
                </div>
              </div>
            )}
            {report.clientSignature && (
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Client Signature
                </h4>
                <div className="border rounded-md overflow-hidden bg-white dark:bg-neutral-900">
                  <img
                    src={report.clientSignature}
                    alt="Client signature"
                    className="w-full h-24 object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {photos.length > 0 && (
            <div>
              <button
                className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={() => setExpandedPhotos(v => !v)}
              >
                <Camera className="h-3 w-3" />
                Site Photos ({photos.length})
                {expandedPhotos ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {expandedPhotos && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative group rounded-md overflow-hidden border border-border bg-muted">
                      <img
                        src={p.dataUrl}
                        alt={p.comment || `Photo ${i + 1}`}
                        className="w-full aspect-square object-cover"
                      />
                      {p.comment && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1.5 py-1 line-clamp-2">
                          {p.comment}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {report.notes && (
            <div>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Notes</h4>
              <p className="text-sm text-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
                {report.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
