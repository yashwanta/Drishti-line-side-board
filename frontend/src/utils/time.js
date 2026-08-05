export function formatHour12(hour) {
  const normalized = Number(hour) % 24
  const period = normalized >= 12 ? 'PM' : 'AM'
  const displayHour = normalized % 12 || 12
  return `${displayHour}:00 ${period}`
}
