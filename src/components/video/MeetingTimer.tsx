import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface MeetingTimerProps {
  startedAt: string | null;
}

export function MeetingTimer({ startedAt }: MeetingTimerProps) {
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();

    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
          : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground font-mono">
      <Clock className="h-3.5 w-3.5" />
      {elapsed}
    </span>
  );
}
