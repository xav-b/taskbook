import Catalog, { CatalogInnerData } from '../domain/catalog'
import Task from '../domain/task'
import Note from '../domain/note'
import CalendarEvent from '../plugins/bb-domain-event/event'
import Goal from '../plugins/bb-domain-goal/goal'
import Flashcard from '../plugins/bb-domain-card/card'

// TODO: type the possible `any`
export function mapFromJson(data: Record<string, any>): Catalog {
  const catalog: CatalogInnerData = {}

  Object.keys(data).forEach((id: string) => {
    if (data[id]._type === 'task') catalog[id] = new Task(data[id])
    else if (data[id]._type === 'note') catalog[id] = new Note(data[id])
    else if (data[id]._type === 'event') catalog[id] = new CalendarEvent(data[id])
    else if (data[id]._type === 'goal') catalog[id] = new Goal(data[id])
    else if (data[id]._type === 'flashcard') catalog[id] = new Flashcard(data[id])
    else console.error(`[warning] unknown item type: ${data[id]._type}`)
  })

  return new Catalog(catalog)
}

export default interface Storage {
  get(destination?: string): Catalog
  set(data: CatalogInnerData, destination?: string): void
}
