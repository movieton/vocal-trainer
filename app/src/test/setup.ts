const storageData = new Map<string, string>()

const memoryStorage: Storage = {
  get length() { return storageData.size },
  clear() { storageData.clear() },
  getItem(key: string) { return storageData.has(key) ? storageData.get(key)! : null },
  key(index: number) { return [...storageData.keys()][index] ?? null },
  removeItem(key: string) { storageData.delete(key) },
  setItem(key: string, value: string) { storageData.set(key, String(value)) },
}

const docStub = {
  documentElement: { lang: 'ru' },
  visibilityState: 'visible',
  addEventListener: () => {},
  removeEventListener: () => {},
}

const locStub = {
  href: 'http://localhost:5173/',
  origin: 'http://localhost:5173',
  pathname: '/',
  search: '',
  hash: '',
  reload: () => {},
}

const winStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => true,
  location: locStub,
}

Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })
Object.defineProperty(globalThis, 'document', { value: docStub, configurable: true })
Object.defineProperty(globalThis, 'navigator', { value: { languages: ['ru-RU'], language: 'ru-RU' }, configurable: true })
Object.defineProperty(globalThis, 'location', { value: locStub, configurable: true })
Object.defineProperty(globalThis, 'window', { value: winStub, configurable: true })
if (typeof globalThis.CustomEvent === 'undefined') {
  Object.defineProperty(globalThis, 'CustomEvent', {
    value: class CustomEventPolyfill {
      type: string
      detail: unknown
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type
        this.detail = init?.detail
      }
    },
    configurable: true,
  })
}
