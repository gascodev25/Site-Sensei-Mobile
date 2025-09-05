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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" />
            Move Recurring Service
          </DialogTitle>
          <DialogDescription>
            You're moving a recurring service "{service.client?.name}" from{" "}
            <strong>{format(originalDate, "MMM d, yyyy")}</strong> to{" "}
            <strong>{format(newDate, "MMM d, yyyy")}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <Button
            onClick={onMoveThisOnly}
            variant="outline"
            className="w-full flex items-center gap-3 h-auto p-4"
            data-testid="button-move-this-only"
          >
            <Calendar className="h-5 w-5 text-blue-600" />
            <div className="text-left">
              <div className="font-medium">Move this occurrence only</div>
              <div className="text-sm text-muted-foreground">
                Create a separate service for {format(newDate, "MMM d, yyyy")}
              </div>
            </div>
          </Button>

          <Button
            onClick={onMoveAllFuture}
            variant="outline"
            className="w-full flex items-center gap-3 h-auto p-4"
            data-testid="button-move-all-future"
          >
            <Repeat className="h-5 w-5 text-green-600" />
            <div className="text-left">
              <div className="font-medium">Move all future occurrences</div>
              <div className="text-sm text-muted-foreground">
                Reschedule the recurring pattern from {format(newDate, "MMM d, yyyy")} onwards
              </div>
            </div>
          </Button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>Note:</strong> Previous occurrences before{" "}
          {format(originalDate, "MMM d, yyyy")} will not be affected.
        </div>
      </DialogContent>
    </Dialog>
  );
}