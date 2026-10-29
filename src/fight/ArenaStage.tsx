import { ARENA_LAYOUT } from './arenaLayout'
import type { ArenaStage as Arena, StageForm } from './stages'

/* A flag on a pole: the cloth waves on its own, gold, or a gate's team colour. */
const FLAG = (
  <svg viewBox="0 0 40 60">
    <path d="M4 0 V60" stroke="#2a2230" strokeWidth="2.6" />
    <circle cx="4" cy="1.5" r="2.4" fill="#ffd979" />
    <path className="astage__cloth" d="M5.5 4 H36 L30 13 L36 22 H5.5Z" />
  </svg>
)

/* Seeded, so the snow and the dust fall the same way every fight: [x %, y %, delay s, drift cqw, size cqw]. */
function scatter(n: number, seed: number): [number, number, number, number, number][] {
  let s = seed
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  return Array.from({ length: n }, () => [
    +(rnd() * 100).toFixed(1),
    +(-10 + rnd() * 80).toFixed(1),
    +(rnd() * 14).toFixed(1),
    +((rnd() - 0.5) * 8).toFixed(1),
    +(0.2 + rnd() * 0.35).toFixed(2),
  ])
}
export const MOTES: Record<StageForm, Record<'snow' | 'dust', ReturnType<typeof scatter>>> = {
  wide: { snow: scatter(46, 61), dust: scatter(46, 71) },
  tall: { snow: scatter(34, 61), dust: scatter(34, 71) },
}

/**
 * The arena a fight is fought in, behind both teams.
 *
 * Back to front: the planet's sky, its clouds, the strip of its country over
 * the rim, its sun and moons; then the sand as a floor running to the camera,
 * the markings on it and the bowl of stands and wall round it, the air over
 * the far side, the flags and the braziers, and the planet's light over all
 * of it. The bowl is the same on every planet; everything else is the
 * planet's. Nothing here can be hit or read; it is all aria-hidden.
 */
export function ArenaStage({ stage, form }: { stage: Arena; form: StageForm }) {
  const { sky } = stage
  const at = ARENA_LAYOUT[form]
  return (
    <div
      className={`lstage lstage--${form} astage astage--sun-${sky.side}`}
      aria-hidden="true"
      style={
        {
          '--sky': sky.gradient,
          /* The top of that sky, which a phone's taller field continues upward. */
          '--zenith': sky.gradient.match(/#[0-9a-f]{6}/i)?.[0],
          '--tint': sky.tint,
          '--ta': sky.tintStrength,
          '--shade': sky.shade,
          '--cc': sky.cloud,
          '--lx': `${sky.sun[0]}%`,
        } as React.CSSProperties
      }
    >
      <div className="lstage__scene">
        <div className="astage__sky" style={{ height: `${at.sky}%` }} />
        <div className={`astage__clouds astage__clouds--${sky.clouds}`} style={{ height: `${at.sky}%` }}>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <img className="astage__far" src={sky.far[form]} alt="" style={{ top: `${at.far[0]}%`, height: `${at.far[1]}%` }} />
        <div className="astage__orbs" style={{ height: `${at.sky}%` }}>
          <i
            className="astage__sun"
            style={
              {
                left: `${sky.sun[0]}%`,
                top: `${sky.sun[1]}%`,
                '--sz': `${sky.sun[2]}cqw`,
                '--sc': sky.sun[3],
              } as React.CSSProperties
            }
          />
          {sky.moons.map(([x, y, size, lit, dark], i) => (
            <i
              key={i}
              className="astage__moon"
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  '--sz': `${size}cqw`,
                  '--m1': lit,
                  '--m2': dark,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="lstage__floorwrap">
          <div className="lstage__floor astage__sand" style={{ backgroundImage: `url('${stage.floor}')` }} />
        </div>
        <img className="lstage__layer" src={stage.marks[form]} alt="" />
        <img className="lstage__layer" src={stage.bowl[form]} alt="" />
        <div className="astage__farhaze" style={{ top: `${at.haze[0]}%`, height: `${at.haze[1]}%` }} />
        <div className="astage__flags">
          {at.flags.map(([x, y, size, delay, team], i) => (
            <i
              key={i}
              className={`astage__flag${team ? ` astage__flag--${team === 1 ? 'mine' : 'enemy'}` : ''}`}
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  '--fs': `${size}cqw`,
                  '--fd': `-${delay}s`,
                } as React.CSSProperties
              }
            >
              {FLAG}
            </i>
          ))}
        </div>
        <div className="astage__fires">
          {at.fires.map(([x, y, size, delay], i) => (
            <i
              key={i}
              className="astage__fire"
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  '--fz': `${size}cqw`,
                  '--ff': `-${delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="astage__side" />
        <div className="astage__haze" />
        <div className="astage__light" />
        <div className="astage__tint" />
        <div className="astage__shade" />
        {sky.motes && (
          <div className={`astage__motes astage__motes--${sky.motes}`}>
            {MOTES[form][sky.motes].map(([x, y, delay, drift, size], i) => (
              <i
                key={i}
                style={
                  {
                    left: `${x}%`,
                    top: `${y}%`,
                    '--md': `-${delay}s`,
                    '--mx': `${drift}cqw`,
                    '--msz': `${size}cqw`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}
        <div className="astage__vig" />
      </div>
    </div>
  )
}
