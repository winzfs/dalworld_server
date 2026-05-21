import { GAME_CONFIG } from '../config/gameConfig';
import type { MonsterSnapshot, ResourceSnapshot, ServerToClientMessage } from '../protocol/messages';
import type { BuildingGrid } from '../systems/building/BuildingGrid';
import { MonsterSystem } from './MonsterSystem';
import { PlayerSystem } from './PlayerSystem';
import { ResourceSystem } from './ResourceSystem';
import { TICK_RATE, WorldState } from './WorldState';

export type GameSimulationStepOptions = {
  buildingGrid?: BuildingGrid;
};

export class GameSimulation {
  readonly world = new WorldState();
  readonly players = new PlayerSystem();
  readonly resources = new ResourceSystem();
  readonly monsters = new MonsterSystem();

  constructor() {
    this.resources.seed(this.world, GAME_CONFIG.resource.startingTrees, GAME_CONFIG.resource.startingStones);
    this.monsters.seed(this.world, GAME_CONFIG.monster.startingMonsters);
  }

  step(dt: number, nowMs: number, options: GameSimulationStepOptions = {}): void {
    this.world.tick += 1;
    this.players.update(this.world, dt, { buildingGrid: options.buildingGrid, nowMs });
    this.resources.update(this.world, nowMs);
    this.monsters.update(this.world, dt, { buildingGrid: options.buildingGrid, nowMs });
  }

  buildSnapshot(nowMs: number): ServerToClientMessage {
    const resources: ResourceSnapshot[] = [...this.world.resources.values()].map((r) => ({
      id: r.id,
      type: r.type,
      x: r.x,
      y: r.y,
      cellX: r.cellX,
      cellY: r.cellY,
      assetUrl: r.assetUrl,
      assetScale: r.assetScale,
      displayWidth: r.displayWidth,
      displayHeight: r.displayHeight,
      sourceRect: r.sourceRect,
      hp: r.hp,
      maxHp: r.maxHp,
      respawnAt: r.respawnAt,
      alive: r.respawnAt === 0 && r.hp > 0,
    }));

    const monsters: MonsterSnapshot[] = [...this.world.monsters.values()].map((m) => ({
      id: m.id,
      type: m.type,
      x: m.x,
      y: m.y,
      hp: m.hp,
      maxHp: m.maxHp,
      state: m.state,
      facing: m.facing,
      targetPlayerId: m.targetPlayerId,
      attackCooldownMs: m.attackCooldownMs,
      attackSeq: m.attackSeq,
    }));

    return {
      type: 'snapshot',
      tick: this.world.tick,
      serverTime: nowMs,
      players: this.world.toPlayerSnapshots(),
      resources,
      monsters,
    };
  }

  get tickRate(): number {
    return TICK_RATE;
  }
}
