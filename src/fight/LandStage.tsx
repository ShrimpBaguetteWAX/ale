import type { Stage, StageForm } from './stages'

/*
 * The clumps of tall grass at the stage's edges, as [x%, y%, scale] of the
 * field: on the floor around the fighters, never on one. Each sways on its
 * own layer, a beat apart.
 */
const CLUMPS: Record<StageForm, [number, number, number][]> = {
  wide: [
    [2.6, 78, 1],
    [97.4, 74, 0.9],
    [50, 66, 0.55],
    [47, 50.5, 0.32],
  ],
  tall: [
    [4, 99, 1.1],
    [97, 80, 0.9],
    [50, 60, 0.7],
  ],
}

/**
 * The ground a fight is fought on, behind both teams.
 *
 * Back to front: the planet's sky and clouds, the turf as a floor running
 * from the horizon to the camera, the sea and the coast, the far islands on
 * the horizon, the surf, a haze where the sea meets the sky, the light from
 * the low sun and the clumps at the edges. The fighters stand on the floor
 * above all of it. Nothing here can be hit or read; it is all aria-hidden.
 */
export function LandStage({ stage, form }: { stage: Stage; form: StageForm }) {
  return (
    <div className={`lstage lstage--${form} lstage--${stage.planet}`} aria-hidden="true">
      <div className="lstage__scene">
        <div className="lstage__sky">
          <i className="lstage__sun" />
          <i className="lstage__moon" />
        </div>
        <div className="lstage__clouds">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="lstage__floorwrap">
          <div className="lstage__floor" style={{ backgroundImage: `url('${stage.floor}')` }} />
        </div>
        <img className="lstage__layer" src={stage.shore[form]} alt="" />
        <img className="lstage__layer lstage__glints" src={stage.glints[form]} alt="" />
        <img className="lstage__far" src={stage.far[form]} alt="" />
        <img className="lstage__layer lstage__foam" src={stage.foam[form][0]} alt="" />
        <img className="lstage__layer lstage__foam lstage__foam--b" src={stage.foam[form][1]} alt="" />
        <div className="lstage__haze" />
        <div className="lstage__light" />
        {CLUMPS[form].map(([x, y, s], i) => (
          <img
            key={i}
            className="lstage__clump"
            src={stage.clump}
            alt=""
            style={
              {
                left: `${x}%`,
                top: `${y}%`,
                '--cs': s,
                '--cd': `-${(i * 1.3).toFixed(1)}s`,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="lstage__vig" />
      </div>
    </div>
  )
}

/**
 * What a blow leaves on the ground where its target stands: torn turf and
 * clods thrown up, or scorched grass, embers and smoke from a fire attack.
 * It waits for --impact like everything else the blow does, and fades.
 */
export function GroundMark({
  at,
  depth,
  fire,
  big,
  blades,
}: {
  at: [number, number]
  depth: number
  fire: boolean
  /** The heavy blows, and the knockouts: one more clod. No ring: nothing is drawn round a fighter for being hit. */
  big: boolean
  blades: string
}) {
  return (
    <span
      className={`lmark${fire ? ' lmark--fire' : ''}`}
      aria-hidden="true"
      style={
        {
          left: `${at[0]}%`,
          top: `${at[1]}%`,
          '--depth': depth,
        } as React.CSSProperties
      }
    >
      {fire ? (
        <>
          <i className="lmark__burn" />
          <i className="lmark__ember" />
          {big && <i className="lmark__ember lmark__ember--b" />}
          <i className="lmark__smoke" />
        </>
      ) : (
        <>
          <i className="lmark__tear" />
          <img className="lmark__blades" src={blades} alt="" />
          <i className="lmark__clod" style={{ '--cx': '-420%', '--cy': '-900%' } as React.CSSProperties} />
          <i className="lmark__clod" style={{ '--cx': '380%', '--cy': '-760%' } as React.CSSProperties} />
          <i className="lmark__clod" style={{ '--cx': '120%', '--cy': '-1100%' } as React.CSSProperties} />
          {big && (
            <i className="lmark__clod" style={{ '--cx': '-160%', '--cy': '-1250%' } as React.CSSProperties} />
          )}
        </>
      )}
    </span>
  )
}
