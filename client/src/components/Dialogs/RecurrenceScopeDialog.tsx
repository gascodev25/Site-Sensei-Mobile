import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarDays, CalendarRange, List } from "lucide-react";

export type RecurrenceScope = "this_event" | "this_and_following" | "all_events";

interface RecurrenceScopeDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (scope: RecurrenceScope) => void;
  occurrenceDate?: string;
  isPending?: boolean;
}

export default function RecurrenceScopeDialog({
  open,
  onClose,
  onSelect,
  occurrenceDate,
  isPending,
}: RecurrenceScopeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit recurring service</DialogTitle>
          <DialogDescription>
            You changed the consumable quantities. How would you like to apply this change?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => onSelect("this_event")}
            className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Only this event</p>
              <p className="text-sm text-muted-foreground">
                Changes apply to{occurrenceDate ? ` ${occurrenceDate}` : " this occurrence"} only. All other events in the series remain unchanged.
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => onSelect("this_and_following")}
            className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <CalendarRange className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">This and following events</p>
              <p className="text-sm text-muted-foreground">
                Changes apply from{occurrenceDate ? ` ${occurrenceDate}` : " this occurrence"} forward. Earlier events in the series are not affected.
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => onSelect("all_events")}
            className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <List className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">All events in the series</p>
              <p className="text-sm text-muted-foreground">
                Changes apply to every occurrence in the entire series, including past and future events.
              </p>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
