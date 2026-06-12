"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const TYPE_COLORS: Record<string, string> = {
  Hackathon: "#E8923C",
  Workshop:  "#C9A876",
  Talk:      "#6E89B8",
};

export default function EventCalendar({ events, onEventClick }: {
  events: any[];
  onEventClick?: (event: any) => void;
  userId?: string;
}) {
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));

  const getEventsForDay = (day: number) => {
    const date = new Date(year, month, day);
    return events.filter((e) => {
      const start = e.startAt?.toDate?.();
      const end = e.endAt?.toDate?.();
      if (!start || !end) return false;
      const d = new Date(date); d.setHours(0, 0, 0, 0);
      const s = new Date(start); s.setHours(0, 0, 0, 0);
      const en = new Date(end); en.setHours(23, 59, 59, 999);
      return d >= s && d <= en;
    });
  };

  const selectedEvents = selected ? getEventsForDay(selected.getDate()) : [];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold text-lg" style={{ color: "var(--color-text-dark)", fontFamily: "var(--font-heading)" }}>
          {MONTHS[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => setCurrent(new Date(year, month - 1, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition"
            style={{ backgroundColor: "var(--color-shadow-grey)", color: "var(--color-text-dark)" }}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setCurrent(new Date())}
            className="px-3 h-8 rounded-xl text-xs font-semibold transition"
            style={{ backgroundColor: "var(--color-shadow-grey)", color: "var(--color-text-dark)" }}>
            Today
          </button>
          <button onClick={() => setCurrent(new Date(year, month + 1, 1))}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition"
            style={{ backgroundColor: "var(--color-shadow-grey)", color: "var(--color-text-dark)" }}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-bold py-2" style={{ color: "rgba(58,51,44,0.35)" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dayEvents = getEventsForDay(day);
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const isSelected = selected?.getDate() === day && selected?.getMonth() === month && selected?.getFullYear() === year;
          const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

          return (
            <button key={day}
              onClick={() => setSelected(isSelected ? null : new Date(year, month, day))}
              className="relative min-h-[52px] rounded-2xl p-1.5 flex flex-col gap-1 transition-all"
              style={{
                backgroundColor: isSelected
                  ? "rgba(232,146,60,0.15)"
                  : isToday
                    ? "rgba(110,137,184,0.12)"
                    : isPast
                      ? "rgba(58,51,44,0.04)"
                      : "rgba(58,51,44,0.06)",
                border: isSelected
                  ? "2px solid rgba(232,146,60,0.5)"
                  : isToday
                    ? "2px solid rgba(110,137,184,0.3)"
                    : "2px solid transparent",
              }}>
              <span className="text-xs font-bold self-end pr-0.5"
                style={{ color: isToday ? "var(--color-primary-orange)" : isPast ? "rgba(58,51,44,0.25)" : "rgba(58,51,44,0.7)" }}>
                {day}
              </span>
              <div className="flex flex-wrap gap-0.5">
                {dayEvents.slice(0, 3).map((e, idx) => (
                  <div key={idx} className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[e.type] ?? "#8FBF8C" }} />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[8px]" style={{ color: "rgba(58,51,44,0.4)" }}>+{dayEvents.length - 3}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs" style={{ color: "rgba(58,51,44,0.45)" }}>{type}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#8FBF8C" }} />
          <span className="text-xs" style={{ color: "rgba(58,51,44,0.45)" }}>Others</span>
        </div>
      </div>

      {/* Selected day events */}
      {selected && (
        <div className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: "#fff", border: "1px solid var(--color-shadow-grey)" }}>
          <h3 className="text-sm font-bold" style={{ color: "rgba(58,51,44,0.5)" }}>
            {selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm" style={{ color: "rgba(58,51,44,0.3)" }}>No events this day.</p>
          ) : (
            selectedEvents.map((event) => (
              <button key={event.id} onClick={() => onEventClick?.(event)}
                className="flex items-center gap-3 p-3 rounded-xl transition text-left w-full hover:opacity-80"
                style={{ backgroundColor: "var(--color-bg-cream)" }}>
                <div className="text-xl">{event.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: "var(--color-text-dark)" }}>{event.title}</p>
                  <p className="text-xs" style={{ color: "rgba(58,51,44,0.45)" }}>
                    {event.startAt?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" – "}
                    {event.endAt?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: TYPE_COLORS[event.type] ?? "#8FBF8C" }} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
