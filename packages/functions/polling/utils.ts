export function isIsoDate(dateString: string) {
  const d = new Date(dateString)
  return d instanceof Date && !Number.isNaN(d.getTime()) && d.toISOString() === dateString // valid date
}
