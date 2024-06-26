import Catalog, { CatalogInnerData } from '../domain/catalog'

export default interface Storage {
  get(destination?: string): Catalog
  getArchive(): Catalog
  getBin(): Catalog
  set(data: CatalogInnerData, destination?: string): void
  setArchive(data: CatalogInnerData): void
  setBin(data: CatalogInnerData): void
}
