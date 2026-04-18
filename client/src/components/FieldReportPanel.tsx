import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, AlertTriangle, Camera, FileText, User, CheckCircle, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FieldReport } from "@shared/schema";

interface FieldReportPanelProps {
  serviceId: number;
  occurrenceDate?: string;
  defaultExpanded?: boolean;
  clientName?: string;
}

function printReport(report: FieldReport, clientName?: string, occurrenceDate?: string) {
  const consumables = (report.actualConsumables as {
    id: number; name: string; plannedQty: number; actualQty: number;
  }[]) ?? [];

  const photos = (report.photos as {
    dataUrl: string; comment: string; timestamp: string;
  }[]) ?? [];

  const reportDate = occurrenceDate ?? report.completionDate;
  const formattedDate = reportDate
    ? new Date(reportDate + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" })
    : "—";

  const consumablesHtml = consumables.length > 0 ? `
    <h3 style="font-size:14px;font-weight:600;color:#374151;margin:20px 0 8px;">Consumables Used</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#f3f4f6;">
          <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb;">Item</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">Planned</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">Actual</th>
          <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb;">Difference</th>
        </tr>
      </thead>
      <tbody>
        ${consumables.map(c => {
          const diff = c.actualQty - c.plannedQty;
          const rowStyle = diff !== 0 ? "background:#fffbeb;" : "";
          const diffStyle = diff !== 0 ? "color:#d97706;font-weight:600;" : "color:#9ca3af;";
          return `<tr style="${rowStyle}">
            <td style="padding:7px 12px;border:1px solid #e5e7eb;">${c.name}</td>
            <td style="text-align:center;padding:7px 12px;border:1px solid #e5e7eb;">${c.plannedQty}</td>
            <td style="text-align:center;padding:7px 12px;border:1px solid #e5e7eb;">${c.actualQty}</td>
            <td style="text-align:center;padding:7px 12px;border:1px solid #e5e7eb;${diffStyle}">${diff > 0 ? "+" + diff : diff === 0 ? "—" : diff}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>` : "";

  const sigsHtml = (report.teamSignature || report.clientSignature) ? `
    <h3 style="font-size:14px;font-weight:600;color:#374151;margin:20px 0 8px;">Signatures</h3>
    <div style="display:flex;gap:24px;">
      ${report.teamSignature ? `<div style="flex:1;">
        <p style="font-size:12px;color:#6b7280;margin-bottom:4px;font-weight:600;">TEAM MEMBER</p>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:4px;background:#fff;max-width:200px;">
          <img src="${report.teamSignature}" alt="Team signature" style="width:100%;height:80px;object-fit:contain;" />
        </div>
      </div>` : ""}
      ${report.clientSignature ? `<div style="flex:1;">
        <p style="font-size:12px;color:#6b7280;margin-bottom:4px;font-weight:600;">CLIENT</p>
        <div style="border:1px solid #e5e7eb;border-radius:6px;padding:4px;background:#fff;max-width:200px;">
          <img src="${report.clientSignature}" alt="Client signature" style="width:100%;height:80px;object-fit:contain;" />
        </div>
      </div>` : ""}
    </div>` : "";

  const photosHtml = photos.length > 0 ? `
    <h3 style="font-size:14px;font-weight:600;color:#374151;margin:20px 0 8px;">Site Photos (${photos.length})</h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      ${photos.map((p, i) => `
        <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <img src="${p.dataUrl}" alt="Photo ${i + 1}" style="width:100%;aspect-ratio:1;object-fit:cover;" />
          ${p.comment ? `<p style="font-size:11px;color:#374151;padding:4px 6px;margin:0;background:#f9fafb;">${p.comment}</p>` : ""}
          <p style="font-size:10px;color:#9ca3af;padding:2px 6px 4px;margin:0;background:#f9fafb;">
            ${new Date(p.timestamp).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>`).join("")}
    </div>` : "";

  const notesHtml = report.notes ? `
    <h3 style="font-size:14px;font-weight:600;color:#374151;margin:20px 0 8px;">Notes</h3>
    <p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;font-size:13px;color:#374151;margin:0;">${report.notes}</p>` : "";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Service Report — ${clientName ?? "Client"} — ${formattedDate}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; padding: 32px; max-width: 780px; margin: 0 auto; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #1e40af;padding-bottom:12px;margin-bottom:16px;">
    <div>
      <h1 style="font-size:20px;font-weight:700;color:#1e40af;margin:0;">Service Completion Report</h1>
      <p style="color:#6b7280;font-size:13px;margin:4px 0 0;">${clientName ? `Client: <strong>${clientName}</strong> &nbsp;|&nbsp;` : ""}Date: <strong>${formattedDate}</strong>${report.hasAdjustments ? ' &nbsp;|&nbsp; <span style="color:#d97706;">⚠ Consumable adjustments made</span>' : ""}</p>
    </div>
  </div>
  ${consumablesHtml}
  ${sigsHtml}
  ${notesHtml}
  ${photosHtml}
  <p style="margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px;">
    Generated ${new Date().toLocaleString("en-ZA")}
  </p>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function FieldReportPanel({ serviceId, occurrenceDate, defaultExpanded = false, clientName }: FieldReportPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedPhotos, setExpandedPhotos] = useState(false);

  const url = occurrenceDate
    ? `/api/field-reports/${serviceId}?date=${occurrenceDate}`
    : `/api/field-reports/${serviceId}`;

  const { data: report, isLoading, isError } = useQuery<FieldReport | null>({
    queryKey: ["/api/field-reports", serviceId, occurrenceDate ?? "latest"],
    queryFn: async (): Promise<FieldReport | null> => {
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch field report");
      return res.json() as Promise<FieldReport>;
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

  const completedAt = (() => {
    const ts = report.createdAt ?? report.updatedAt;
    if (!ts) {
      return new Date(report.completionDate).toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return new Date(ts).toLocaleString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-0 hover:bg-transparent"
          onClick={() => setExpanded(v => !v)}
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Field Report</span>
          {report.hasAdjustments && (
            <Badge className="bg-orange-100 border-orange-400 text-orange-800 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Adjusted
            </Badge>
          )}
          <span className="text-xs text-muted-foreground ml-1">{completedAt}</span>
          {!occurrenceDate && (
            <span className="text-xs text-muted-foreground italic">(latest)</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 h-7 text-xs"
          onClick={() => printReport(report, clientName, occurrenceDate)}
          title="Print or save report as PDF"
        >
          <Printer className="h-3.5 w-3.5" />
          Download
        </Button>
      </div>

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
