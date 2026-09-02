import type { Replay, SimFighter } from './sim'

/**
 * The combat log as a CSV, matching the original's export.
 *
 * Worth keeping verbatim: players use it to argue about fights and to check
 * the client against the chain, so the column set is a compatibility surface
 * rather than a design choice. Values are the contract's raw numbers, not the
 * divided-by-ten display figures, because the point of the export is to
 * reason about what the contract did.
 */

const COLUMNS = [
  'Turn',
  'Attacker Team ID',
  'Attacker Fighter ID',
  'Attacker Target',
  'Attacker Team JSON',
  'Attacker Classname',
  'Attacker Racename',
  'Attacker Element',
  'Attacker Health',
  'Defender Team ID',
  'Defender Fighter ID',
  'Defender Team JSON',
  'Defender Classname',
  'Defender Racename',
  'Defender Element',
  'Defender Health',
  'Defender Taunt',
  'Attack Value',
  'Effectiveness',
  'Post Turn Attacker Team JSON',
  'Post Turn Defender Team JSON',
  'If Effects JSON',
]

/** RFC-4180 quoting: wrap in quotes, double any quote inside. */
function cell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

/** The stat fields the original writes into its team snapshots. */
function snapshot(f: SimFighter, health: number, maxHealth: number) {
  return {
    fighter_id: f.fighter_id,
    health,
    max_health: maxHealth,
    damage: f.damage,
    taunt: f.taunt,
    initiative: f.initiative,
    attackspeed: f.attackspeed,
    res_gem: f.res_gem,
    res_metal: f.res_metal,
    res_air: f.res_air,
    res_fire: f.res_fire,
    res_nature: f.res_nature,
    res_neutral: f.res_neutral,
  }
}

export function combatLogCsv(replay: Replay): string {
  const byUid = new Map(replay.fighters.map((f) => [f.uid, f]))

  /* Health per fighter as each turn opened, rebuilt by walking the replay. */
  const opening = new Map<string, { health: number; max_health: number }>()
  for (const f of replay.fighters) {
    opening.set(f.uid, { health: f.start_health, max_health: f.max_health })
  }

  const rows: string[] = [COLUMNS.map(cell).join(',')]

  replay.turns.forEach((t, i) => {
    const attacker = byUid.get(t.attackerUid)
    const defender = byUid.get(t.defenderUid)
    if (!attacker || !defender) return

    const before = new Map(opening)
    const after = new Map(
      t.snapshot.map((s) => [s.uid, { health: s.health, max_health: s.max_health }]),
    )

    const team = (side: 1 | 2, source: typeof before) =>
      replay.fighters
        .filter((f) => f.team === side)
        .map((f) => {
          const s = source.get(f.uid)
          return snapshot(f, s?.health ?? 0, s?.max_health ?? f.max_health)
        })

    const attackerTeam = attacker.team
    const defenderTeam = defender.team

    rows.push(
      [
        i + 1,
        attackerTeam,
        attacker.fighter_id,
        attacker.target,
        JSON.stringify(team(attackerTeam, before)),
        attacker.classname,
        attacker.racename,
        attacker.element,
        before.get(t.attackerUid)?.health ?? 0,
        defenderTeam,
        defender.fighter_id,
        JSON.stringify(team(defenderTeam, before)),
        defender.classname,
        defender.racename,
        defender.element,
        t.defenderHealthBefore,
        defender.taunt,
        t.damage,
        t.effectiveness,
        JSON.stringify(team(attackerTeam, after)),
        JSON.stringify(team(defenderTeam, after)),
        JSON.stringify(
          t.effects.map((e) => ({
            ability: e.ability,
            trigger: e.trigger,
            /* Who cast it, not only who it landed on — group effects mostly
               hit fighters that are nowhere near the two trading blows. */
            source: byUid.get(e.sourceUid)?.classname ?? '',
            target: byUid.get(e.targetUid)?.classname ?? '',
            stat: e.stat,
            before: e.before,
            after: e.after,
            change: e.after - e.before,
          })),
        ),
      ]
        .map(cell)
        .join(','),
    )

    for (const [uid, v] of after) opening.set(uid, v)
  })

  return rows.join('\n')
}
