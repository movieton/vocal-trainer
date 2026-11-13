import { tr } from '../lib/i18n'
import { engine } from '../lib/audio'
import { useStored } from '../lib/store'

/** Выбор наушников: в Bluetooth звук приходит позже, и голос без поправки кажется опоздавшим */
export default function LatencySelect({ disabled }: { disabled?: boolean }) {
  const [ms, setMs] = useStored('latencyMs', 0)
  const set = (v: number) => { setMs(v); engine.latency = v / 1000 }
  return (
    <label>{tr('Наушники')}
      <select value={ms} onChange={e => set(+e.target.value)} disabled={disabled}>
        <option value={0}>{tr('Динамик или проводные')}</option>
        <option value={150}>{tr('Bluetooth')}</option>
        <option value={250}>{tr('Bluetooth, с задержкой')}</option>
      </select>
    </label>
  )
}
