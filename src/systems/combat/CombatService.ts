import { GAME_CONFIG } from '../../config/gameConfig';
import type { CombatAttackRequest, CombatServerEvent, Facing, MonsterType } from '../../protocol/messages';
import type { MonsterEntity, PlayerEntity, WorldState } from '../../sim/WorldState';
import { distance } from '../../utils/math';
import type { InventorySnapshot, InventoryStore } from '../inventory/InventoryStore';

type CombatServiceOptions = {
  now: () => number;
  getInventory: (playerId: string, player: PlayerEntity) => InventoryStore;
};

type CombatResult = {
  events: CombatServerEvent[];
  inventorySnapshot?: InventorySnapshot;
};

type MonsterReward = {
  itemId: Parameters<InventoryStore['add']>[0];
  amount: number;
};

const FACING_VECTOR: Record<Facing, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export class CombatService {
  constructor(private readonly options: CombatServiceOptions) {}

  attack(world: WorldState, playerId: string, request: CombatAttackRequest): CombatResult {
    const now = this.options.now();
    const player = world.players.get(playerId);
    if (!player) return rejected(request.requestId, '플레이어를 찾을 수 없습니다.');
    if (player.hp <= 0) return rejected(request.requestId, '행동할 수 없는 상태입니다.');
    if (now < player.nextAttackAt) return rejected(request.requestId, '공격 재사용 대기 중입니다.');

    if (!isFacing(request.facing)) {
      return rejected(request.requestId, '공격 방향이 올바르지 않습니다.');
    }

    player.facing = request.facing;
    player.lastInputSeq = Math.max(player.lastInputSeq, request.seq);
    player.nextAttackAt = now + GAME_CONFIG.combat.playerAttackCooldownMs;

    const target = this.findTarget(world, player, request);
    const events: CombatServerEvent[] = [
      {
        type: 'COMBAT_ATTACK_CONFIRMED',
        requestId: request.requestId,
        attackerId: playerId,
        facing: request.facing,
        x: player.x,
        y: player.y,
      },
    ];

    if (!target) {
      events.push({
        type: 'COMBAT_MISSED',
        requestId: request.requestId,
        attackerId: playerId,
        reason: 'range',
      });
      return { events };
    }

    const damage = GAME_CONFIG.combat.playerAttackDamage;
    target.hp = Math.max(0, target.hp - damage);
    events.push({
      type: 'COMBAT_HIT',
      requestId: request.requestId,
      attackerId: playerId,
      targetId: target.id,
      targetType: 'monster',
      damage,
      hpRemaining: target.hp,
      maxHp: target.maxHp,
      x: target.x,
      y: target.y,
    });

    if (target.hp <= 0) {
      world.monsters.delete(target.id);
      events.push({
        type: 'MONSTER_KILLED',
        requestId: request.requestId,
        attackerId: playerId,
        monsterId: target.id,
        monsterType: target.type,
        x: target.x,
        y: target.y,
      });

      const reward = getMonsterReward(target.type);
      if (reward) {
        const store = this.options.getInventory(playerId, player);
        const addResult = store.add(reward.itemId, reward.amount);
        if (addResult.ok) {
          events.push({
            type: 'COMBAT_REWARD_GRANTED',
            requestId: request.requestId,
            playerId,
            monsterId: target.id,
            itemId: reward.itemId,
            amount: reward.amount,
          });
          return { events, inventorySnapshot: addResult.snapshot };
        }
      }
    }

    return { events };
  }

  private findTarget(world: WorldState, player: PlayerEntity, request: CombatAttackRequest): MonsterEntity | null {
    const explicit = request.targetId ? world.monsters.get(request.targetId) : undefined;
    if (explicit && this.canHit(player, explicit)) return explicit;

    let best: MonsterEntity | null = null;
    let bestDistance = GAME_CONFIG.combat.playerAttackRange;

    for (const monster of world.monsters.values()) {
      if (!this.canHit(player, monster)) continue;
      const d = distance(player.x, player.y, monster.x, monster.y);
      if (d <= bestDistance && isInFront(player, monster)) {
        best = monster;
        bestDistance = d;
      }
    }

    return best;
  }

  private canHit(player: PlayerEntity, monster: MonsterEntity): boolean {
    if (monster.hp <= 0) return false;
    return distance(player.x, player.y, monster.x, monster.y) <= GAME_CONFIG.combat.playerAttackRange;
  }
}

function rejected(requestId: string, reason: string): CombatResult {
  return { events: [{ type: 'COMBAT_REJECTED', requestId, reason }] };
}

function isFacing(value: unknown): value is Facing {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function isInFront(player: PlayerEntity, monster: MonsterEntity): boolean {
  const facing = FACING_VECTOR[player.facing];
  const dx = monster.x - player.x;
  const dy = monster.y - player.y;
  const length = Math.hypot(dx, dy);
  if (length <= 0.001) return true;
  const dot = (dx / length) * facing.x + (dy / length) * facing.y;
  return dot >= -0.2;
}

function getMonsterReward(type: MonsterType): MonsterReward | null {
  if (type === 'sheep') return { itemId: 'fiber', amount: 1 };
  if (type === 'wild_slime') return { itemId: 'stone', amount: 1 };
  return null;
}
