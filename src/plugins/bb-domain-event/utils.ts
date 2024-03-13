export function today(): string {
  // turns out Canadian format returns that ISO format we want: yyyy-mm-dd
  return new Date().toLocaleDateString('en-CA')
}

export function prettyTzOffset(dt: Date = new Date()) {
  const tzOffset = dt.getTimezoneOffset() / 60 /* it's in minutes */

  let pretty = ''
  if (tzOffset > 9) pretty = `-${tzOffset}:00`
  else if (tzOffset > 0) pretty = `-0${tzOffset}:00`
  else if (tzOffset < -9) pretty = `+${Math.abs(tzOffset)}:00`
  else if (tzOffset <= 0) pretty = `+0${Math.abs(tzOffset)}:00`

  return pretty
}
