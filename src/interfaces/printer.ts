import signale from 'signale'

signale.config({ displayLabel: false })

// NOTE: somehow cannot find it in Signale itself
export interface SignaleLogConfig {
  prefix: string
  message: string
  suffix: string
}

// expose those methods as default to be used anywhere it makes sense, but most
// sensibly when implementing `display` method on `Item` specialised children.
export const { await: wait, error, log, note, pending, success, warn } = signale

// TODO: ideally we shouod only expose that interface, taking arbitrary number
// of custom printers, so that by default we get the core "printing" functions,
// and plugins can customise to their heart content.
export default function Printer(badge: string, name?: string) {
  // have no idea why `signal.config` doesn't work so we create a new custom logger
  return new signale.Signale({
    config: { displayLabel: false },
    types: {
      // name is for self documentation at the end. Since here we always
      // initialise only one logger, you can always use:
      //
      //    const { custom } = Printer('foo')
      //
      // But if we end up supporting several ones (which doesn't sound
      // unlikely) then it will become necessary.
      [name || 'custom']: {
        badge: badge,
        // TODO: support customisation (package in an `opts`)
        color: 'blue',
        // using it kind of an `id` but has no effect, just mandatory by type
        label: `logger-${name || 'custom'}`,
      },
    },
  })
}
