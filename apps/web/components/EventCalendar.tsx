"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const TYPE_COLORS: Record<string, string> = {
  Hackathon: "#FBBF24",
  Workshop: "#8B5CF6",
  Talk: "#06B6D4",
};

export default function EventCalendar({
  events,
  onEventClick,
  userId,
}: {
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
  const today = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }),
  );

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    const date = new Date(year, month, day);
    return events.filter((e) => {
      const start = e.startAt?.toDate?.();
      const end = e.endAt?.toDate?.();
      if (!start || !end) return false;
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const s = new Date(start);
      s.setHours(0, 0, 0, 0);
      const en = new Date(end);
      en.setHours(23, 59, 59, 999);
      return d >= s && d <= en;
    });
  };

  const selectedEvents = selected ? getEventsForDay(selected.getDate()) : [];

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-black text-white text-lg">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCurrent(new Date())}
            className="px-3 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/60 hover:text-white transition"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-bold text-white/20 py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dayEvents = getEventsForDay(day);
          const isToday =
            today.getDate() === day &&
            today.getMonth() === month &&
            today.getFullYear() === year;
          const isSelected =
            selected?.getDate() === day &&
            selected?.getMonth() === month &&
            selected?.getFullYear() === year;
          const isPast =
            new Date(year, month, day) <
            new Date(today.getFullYear(), today.getMonth(), today.getDate());

          return (
            <button
              key={day}
              onClick={() =>
                setSelected(isSelected ? null : new Date(year, month, day))
              }
              className={`relative min-h-[52px] rounded-2xl p-1.5 flex flex-col gap-1 transition-all ${
                isSelected
                  ? "bg-amber-400/20 border-2 border-amber-400/60"
                  : isToday
                    ? "bg-white/10 border-2 border-white/20"
                    : isPast
                      ? "bg-white/2 hover:bg-white/5"
                      : "bg-white/5 hover:bg-white/8"
              }`}
            >
              <span
                className={`text-xs font-bold self-end pr-0.5 ${
                  isToday
                    ? "text-amber-400"
                    : isPast
                      ? "text-white/20"
                      : "text-white/70"
                }`}
              >
                {day}
              </span>
              <div className="flex flex-wrap gap-0.5">
                {dayEvents.slice(0, 3).map((e, idx) => (
                  <div
                    key={idx}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: TYPE_COLORS[e.type] ?? "#10B981" }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[8px] text-white/30">
                    +{dayEvents.length - 3}
                  </span>
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
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: color }}
            />
            <span className="text-xs text-white/30">{type}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs text-white/30">Others</span>
        </div>
      </div>

      {/* Selected day events */}
      {selected && (
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-white/60">
            {selected.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-white/20">No events this day.</p>
          ) : (
            selectedEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition text-left w-full"
              >
                <div className="text-xl">{event.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {event.title}
                  </p>
                  <p className="text-xs text-white/40">
                    {event.startAt?.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {event.endAt?.toDate().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: TYPE_COLORS[event.type] ?? "#10B981" }}
                />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
