import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Repeat } from "lucide-react";
import { format } from "date-fns";
import type { ServiceWithDetails } from "@shared/schema";

interface RecurringServiceMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceWithDetails | null;
  originalDate: Date | null;
  newDate: Date | null;
  onMoveThisOnly: () => void;
  onMoveAllFuture: () => void;
}

export default function RecurringServiceMoveDialog({
  open,
  onOpenChange,
  service,
  originalDate,
  newDate,
  onMoveThisOnly,
  onMoveAllFuture,
}: RecurringServiceMoveDialogProps) {
  if (!service || !originalDate || !newDate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            Move Recurring Service
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            You're moving a recurring service "{service.client?.name}" from{" "}
            <strong>{format(originalDate, "MMM d, yyyy")}</strong> to{" "}
            <strong>{format(newDate, "MMM d, yyyy")}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button
            onClick={onMoveThisOnly}
            variant="outline"
            className="w-full flex items-start gap-3 h-auto p-4 text-left justify-start"
            data-testid="button-move-this-only"
          >
            <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm mb-1">Move this occurrence only</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Create a separate service for {format(newDate, "MMM d, yyyy")}
              </div>
            </div>
          </Button>

          <Button
            onClick={onMoveAllFuture}
            variant="outline"
            className="w-full flex items-start gap-3 h-auto p-4 text-left justify-start"
            data-testid="button-move-all-future"
          >
            <Repeat className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm mb-1">Move all future occurrences</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Reschedule the recurring pattern from {format(newDate, "MMM d, yyyy")} onwards
              </div>
            </div>
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
          <div className="text-xs text-amber-800 leading-relaxed">
            <strong>Note:</strong> Previous occurrences before{" "}
            {format(originalDate, "MMM d, yyyy")} will not be affected.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}