const UK_TIME_ZONE = "Europe/London";

export function ukDateKey(value: string | Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function timeZoneOffsetMs(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value || 0);
  const representedAsUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  );
  return representedAsUtc - value.getTime();
}

export function ukMidnightUtc(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let instant = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    instant = new Date(target - timeZoneOffsetMs(instant));
  }
  return instant;
}

export function shiftUkDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return date.toISOString().slice(0, 10);
}

export function ukMonthBounds(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const startKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const next = new Date(Date.UTC(year, month, 1, 12));
  const endKey = next.toISOString().slice(0, 10);
  return { start: ukMidnightUtc(startKey), end: ukMidnightUtc(endKey) };
}

export function ukHistoryBounds(filter: "all" | "today" | "7d" | "month" | "year") {
  if (filter === "all") return null;
  const today = ukDateKey();
  const [year, month] = today.split("-").map(Number);

  if (filter === "today") {
    return { start: ukMidnightUtc(today), end: ukMidnightUtc(shiftUkDateKey(today, 1)) };
  }
  if (filter === "7d") {
    return { start: ukMidnightUtc(shiftUkDateKey(today, -6)), end: ukMidnightUtc(shiftUkDateKey(today, 1)) };
  }
  if (filter === "month") return ukMonthBounds(`${year}-${String(month).padStart(2, "0")}`);
  return {
    start: ukMidnightUtc(`${year}-01-01`),
    end: ukMidnightUtc(`${year + 1}-01-01`),
  };
}
