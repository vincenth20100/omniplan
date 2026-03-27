export function fastDifferenceInCalendarDays(dateLeft: Date, dateRight: Date): number {
  const diff = Date.UTC(dateLeft.getFullYear(), dateLeft.getMonth(), dateLeft.getDate()) -
               Date.UTC(dateRight.getFullYear(), dateRight.getMonth(), dateRight.getDate());
  return Math.round(diff / 86400000);
}
