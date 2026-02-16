import type { MapDefinition, MapId } from '../types.js'
import { generateLakesMap } from './lakes.js'
import { generateMegapolisMap } from './megapolis.js'
import { generateVillageMap } from './village.js'
import { generateCTFMap } from './ctf.js'

// Maps are regenerated every time - no caching for variety
export function getMap(id: MapId): MapDefinition {
  switch (id) {
    case 'lakes': return generateLakesMap()
    case 'megapolis': return generateMegapolisMap()
    case 'village': return generateVillageMap()
    case 'ctf': return generateCTFMap()
  }
}

export const MAP_INFO: Array<{ id: MapId; name: string; description: string; botCount: number }> = [
  { id: 'lakes', name: 'Озёра', description: 'Природный ландшафт с озёрами', botCount: 10 },
  { id: 'megapolis', name: 'Мегаполис', description: 'Городские кварталы и улицы', botCount: 5 },
  { id: 'village', name: 'Село', description: 'Деревня с полями и речкой', botCount: 0 },
  { id: 'ctf', name: 'Захват Флага', description: '2 команды, захвати вражеский флаг', botCount: 6 }
]
