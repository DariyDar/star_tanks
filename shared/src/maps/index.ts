import type { MapDefinition, MapId } from '../types.js'
import { generateLakesMap } from './lakes.js'
import { generateMegapolisMap } from './megapolis.js'
import { generateVillageMap } from './village.js'

const mapCache = new Map<MapId, MapDefinition>()

export function getMap(id: MapId): MapDefinition {
  let map = mapCache.get(id)
  if (!map) {
    switch (id) {
      case 'lakes': map = generateLakesMap(); break
      case 'megapolis': map = generateMegapolisMap(); break
      case 'village': map = generateVillageMap(); break
    }
    mapCache.set(id, map)
  }
  return map
}

export const MAP_INFO: Array<{ id: MapId; name: string; description: string; botCount: number }> = [
  { id: 'lakes', name: 'Озёра', description: 'Природный ландшафт с озёрами', botCount: 0 },
  { id: 'megapolis', name: 'Мегаполис', description: 'Городские кварталы и улицы', botCount: 0 },
  { id: 'village', name: 'Село', description: 'Деревня с полями и речкой', botCount: 0 }
]
