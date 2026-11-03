/** Allow editing a 24-hour time without admitting an out-of-range hour/minute. */
export function campaignTimeInput(raw: string): string | null {
  if (!/^[\d:]*$/.test(raw)) return null;
  if (raw === ":") return "";
  const parts = raw.includes(":")
    ? raw.split(":")
    : raw.length > 2
      ? [raw.slice(0, 2), raw.slice(2)]
      : [raw];
  if (parts.length > 2 || parts.some((part) => part.length > 2)) return null;
  const [hour, minute] = parts;
  if (hour.length === 2 && Number(hour) > 23) return null;
  if (minute?.length === 2 && Number(minute) > 59) return null;
  return parts.join(":");
}

/** Only a completed, valid value can become a stored HH:mm schedule. */
export function completeCampaignTime(raw: string): string | null {
  const draft = campaignTimeInput(raw);
  if (!draft || !/^\d{1,2}:\d{2}$/.test(draft)) return null;
  const [hour, minute] = draft.split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

export function campaignTimeOrderIssue(times: readonly string[]) {
  for (let index = 1; index < times.length; index++) {
    const previous = completeCampaignTime(times[index - 1]);
    const current = completeCampaignTime(times[index]);
    if (previous && current && current <= previous) {
      return {
        index,
        message: `Jam ${index + 1} harus lebih akhir dari Jam ${index} (${previous} WIB).`,
      };
    }
  }
  return null;
}

/** Intensity edits preserve existing times; added/restored slots enter chronological order. */
export function resizeCampaignTimes(
  schedules: readonly string[],
  count: number,
  remembered: readonly string[] = [],
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 12)
    return [...schedules];
  if (count <= schedules.length) return schedules.slice(0, count);
  if (
    schedules.some((time) => completeCampaignTime(time) !== time) ||
    campaignTimeOrderIssue(schedules)
  )
    return [...schedules];
  const times = [...schedules];
  while (times.length < count) {
    const previous = remembered[times.length];
    if (
      previous &&
      completeCampaignTime(previous) === previous &&
      !times.includes(previous)
    ) {
      times.push(previous);
    } else {
      const last = times.at(-1) || "08:00";
      const minute = Number(last.slice(0, 2)) * 60 + Number(last.slice(3));
      for (let offset = 1; offset <= 24; offset++) {
        const next = (minute + offset * 60) % 1440;
        const value = `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
        if (!times.includes(value)) {
          times.push(value);
          break;
        }
      }
    }
    times.sort();
  }
  return times;
}
