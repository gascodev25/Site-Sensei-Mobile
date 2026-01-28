import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  status?: "default" | "destructive" | "warning";
  trend?: string;
  trendLabel?: string;
  label?: string;
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
}

export default function KPICard({
  title,
  value,
  icon: Icon,
  status = "default",
  trend,
  trendLabel,
  label,
  onClick,
  className,
  "data-testid": testId,
}: KPICardProps) {
  const getValueColor = () => {
    switch (status) {
      case "destructive":
        return "text-destructive";
      case "warning":
        return "text-amber-600";
      default:
        return "text-foreground";
    }
  };

  const getIconColor = () => {
    switch (status) {
      case "destructive":
        return "bg-red-100 text-red-600";
      case "warning":
        return "bg-amber-100 text-amber-600";
      default:
        return "bg-blue-100 text-blue-600";
    }
  };

  return (
    <Card 
      className={cn(
        "hover:shadow-md transition-all cursor-pointer active:scale-[0.98]",
        className
      )}
      onClick={(e) => {
        console.log(`KPICard ${title} clicked`);
        if (onClick) onClick();
      }}
      data-testid={testId}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn("text-2xl font-bold", getValueColor())}>
              {value}
            </h3>
            <p className="text-muted-foreground text-sm font-medium">
              {title}
            </p>
          </div>
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", getIconColor())}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        
        {(trend && trendLabel) && (
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600 font-medium">{trend}</span>
            <span className="text-muted-foreground ml-1">{trendLabel}</span>
          </div>
        )}
        
        {label && (
          <div className="mt-4 flex items-center text-sm">
            <span className={cn(
              "font-medium",
              status === "destructive" ? "text-destructive" : 
              status === "warning" ? "text-amber-600" : 
              "text-muted-foreground"
            )}>
              {label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
