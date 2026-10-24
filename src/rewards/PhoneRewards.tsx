import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Player } from "@/chain/types";
import type { MiningTool } from "@/chain/atomic";
import { fetchOwnedLands } from "@/chain/atomic";
import type { ToolTemplate } from "@/pools/queries";
import type { RewardLogEntry } from "@/account/queries";
import {
  bagPower,
  claimPays,
  powerScore,
  CURRENCY_ICON,
  CURRENCY_LABEL,
  CURRENCY_PRECISION,
  CURRENCY_UNCLAIMED,
  MINING_POWER,
  type Currency,
  type LogCapacity,
} from "@/account/rules";
import {
  batchableMines,
  poolAmount,
  poolPayout,
  MINE_POWER,
  type PoolEntry,
} from "@/pools/rules";
import { byQuality } from "@/dungeon/nftFighter";
import { useChainQuery } from "@/chain/useChainQuery";
import { useModal } from "@/components/useModal";
import { useSwipeToClose } from "@/components/useSwipeToClose";
import { GameImg } from "@/components/GameImg";
import { formatDecimals, formatNumber } from "@/format";
import { asset } from "@/assets";
import { MAX_TOOLS, paymentSources } from "./rules";
import { useMiningTools } from "./useMiningTools";

type RewardsTab = "mining" | Currency;

const TABS: [RewardsTab, string][] = [
  ["mining", "Mining"],
  ["tlm", CURRENCY_LABEL.tlm],
  ["shrds", CURRENCY_LABEL.shrds],
  ["wax", CURRENCY_LABEL.wax],
];

/** One currency's data and actions, as the page already reads and runs them. */
export interface PhoneCurrencyData {
  currency: Currency;
  log: RewardLogEntry[] | undefined;
  capacity: LogCapacity;
  board: PoolEntry[];
  trial: number | null;
  minedPool: string | null;
  onMine: (pool: string, times: number) => void;
  onClaim: () => void;
  onUnlock: (rows: number) => void;
}

/** What the game holds for this wallet in one currency, in whole units. */
function unclaimed(player: Player, currency: Currency): number {
  const raw = Number(
    (player.activestats as unknown as Record<string, number>)[
      CURRENCY_UNCLAIMED[currency]
    ] ?? 0,
  );
  return raw / Math.pow(10, CURRENCY_PRECISION[currency]);
}

/**
 * Rewards on a phone: one number first.
 *
 * Every tab opens with the one figure that matters there — your mining power,
 * or what is waiting to be claimed — then what acts on it: the tools, or the
 * pools as rings that turn gold and offer a Mine button the moment they can
 * be mined. The hundred-row ledger folds into one line per source, and the
 * long lists (the wallet's tools, every tool in the game) and the landowner
 * setting open as sheets rather than stacking up the page.
 */
export function PhoneRewards({
  tab,
  onTab,
  player,
  account,
  busy,
  canAct,
  onSaveTools,
  onShare,
  currency,
}: {
  tab: RewardsTab;
  onTab: (tab: RewardsTab) => void;
  player: Player;
  account: string;
  busy: string | null;
  canAct: boolean;
  onSaveTools: (ids: string[]) => void;
  onShare: (share: number) => void;
  currency: PhoneCurrencyData | null;
}) {
  return (
    <div className="prew">
      <div className="prew__tabs" role="tablist" aria-label="Rewards">
        {TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            className="prew__tab"
            onClick={() => onTab(key)}
          >
            {label}
            {key !== "mining" &&
              claimPays(key) &&
              unclaimed(player, key) > 0 && (
                <span
                  className="prew__tabdot"
                  aria-label="Something to claim"
                />
              )}
          </button>
        ))}
      </div>

      {tab === "mining" ? (
        <PhoneMining
          player={player}
          account={account}
          busy={busy}
          canAct={canAct}
          onSave={onSaveTools}
          onShare={onShare}
        />
      ) : (
        currency && (
          <PhoneCurrency
            player={player}
            busy={busy}
            canAct={canAct}
            data={currency}
          />
        )
      )}
    </div>
  );
}

/* ---------- a bottom sheet ---------- */

function Sheet({
  title,
  onClose,
  children,
  foot,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  foot?: ReactNode;
}) {
  const panel = useModal(onClose);
  const { grip } = useSwipeToClose(onClose, panel);
  return (
    <div
      className="rsheet"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="rsheet__panel"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rsheet__head" {...grip}>
          <span className="rsheet__grip" aria-hidden="true" />
          <h2 className="rsheet__title">{title}</h2>
          <button
            type="button"
            className="rsheet__x"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="rsheet__body">{children}</div>
        {foot && <div className="rsheet__foot">{foot}</div>}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="pchev" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** The two powers side by side, with their icons. */
function Power({
  tlm,
  shrd,
  big,
}: {
  tlm: number;
  shrd: number;
  big?: boolean;
}) {
  const [t, s] = MINING_POWER;
  return (
    <span className={`prew__power${big ? " prew__power--big" : ""}`}>
      <span title={t.hint}>
        <img src={t.icon} alt={t.label} />
        {formatNumber(tlm)}
      </span>
      <span title={s.hint}>
        <img src={s.icon} alt={s.label} />
        {formatNumber(shrd)}
      </span>
    </span>
  );
}

/* ---------- mining ---------- */

function PhoneMining({
  player,
  account,
  busy,
  canAct,
  onSave,
  onShare,
}: {
  player: Player;
  account: string;
  busy: string | null;
  canAct: boolean;
  onSave: (ids: string[]) => void;
  onShare: (share: number) => void;
}) {
  const { tools, templates, loading, powerOf } = useMiningTools(account);
  const [open, setOpen] = useState<"tools" | "land" | "all" | null>(null);

  /*
     Whether there is land to set anything for. The setting only decides how
     other players' mining on *your* land pays you, so without land it is
     shown greyed with the reason rather than left out — a player who buys a
     plot later should already know it is here.
  */
  const lands = useChainQuery(
    player.wallet && `owned-lands:${player.wallet}`,
    () => fetchOwnedLands(player.wallet),
  );
  const ownsLand = (lands.data?.length ?? 0) > 0;

  const stored = useMemo(
    () => (player.mine_nfts ?? []).map(String),
    [player.mine_nfts],
  );
  const equipped = useMemo(() => {
    const byId = new Map(tools.map((t) => [t.asset_id, t]));
    return stored.map((id) => byId.get(id)).filter((t): t is MiningTool => !!t);
  }, [tools, stored]);
  const bag = useMemo(
    () => bagPower(equipped.map((t) => powerOf(t.template_id) ?? {})),
    [equipped, powerOf],
  );
  const share = Number(player.landowner_tlm_share ?? 0);

  return (
    <>
      <div className="prew__hero">
        <img
          src={asset("/assets/icons/menu/rewards.png")}
          alt=""
          className="prew__heroicon"
        />
        <span className="prew__herolabel">Your mining power</span>
        {loading ? (
          <span className="prew__power prew__power--big">—</span>
        ) : (
          <Power tlm={bag.tlm_mp} shrd={bag.shrd_mp} big />
        )}
      </div>

      <div className="prew__card">
        <div className="prew__slots">
          {Array.from({ length: MAX_TOOLS }, (_, i) => {
            const t = equipped[i];
            if (loading)
              return (
                <span className="prew__slot prew__slot--loading" key={i} />
              );
            return t ? (
              <button
                type="button"
                className="prew__slot"
                key={t.asset_id}
                onClick={() => setOpen("tools")}
              >
                <GameImg
                  src={asset(`/assets/cards/${t.template_id}.webp`)}
                  alt=""
                  fallback={asset("/assets/default-card.png")}
                />
                <span>{t.name}</span>
              </button>
            ) : (
              <button
                type="button"
                className="prew__slot prew__slot--empty"
                key={`empty-${i}`}
                onClick={() => setOpen("tools")}
                aria-label="Equip a tool"
              >
                <i>+</i>
                <span>Empty</span>
              </button>
            );
          })}
        </div>
        <p className="prew__slotnote">
          {loading
            ? "Loading your tools…"
            : `${equipped.length} of ${MAX_TOOLS} tools equipped`}
        </p>
      </div>

      <div className="prew__rows">
        <button
          type="button"
          className="prew__row"
          onClick={() => setOpen("tools")}
        >
          <img src={asset("/assets/icons/menu/rewards.png")} alt="" />
          <span className="prew__rowtext">
            <strong>Change tools</strong>
            <small>
              {loading
                ? "Loading…"
                : `${formatNumber(Math.max(0, tools.length - equipped.length))} more in your wallet`}
            </small>
          </span>
          <Chevron />
        </button>
        <button
          type="button"
          className="prew__row"
          disabled={!ownsLand}
          onClick={() => setOpen("land")}
        >
          <img src={asset("/assets/icons/menu/my-land.png")} alt="" />
          <span className="prew__rowtext">
            <strong>Landowner settings</strong>
            <small>
              {lands.data === undefined
                ? "Checking your land…"
                : ownsLand
                  ? `${share}% TLM · ${100 - share}% Shards`
                  : "You own no land — nothing to set"}
            </small>
          </span>
          {ownsLand && <Chevron />}
        </button>
        <button
          type="button"
          className="prew__row"
          onClick={() => setOpen("all")}
        >
          <img src={asset("/assets/icons/menu/card.png")} alt="" />
          <span className="prew__rowtext">
            <strong>All tools</strong>
            <small>
              {templates.length
                ? `All ${formatNumber(templates.length)} tools and what each is worth`
                : "Every tool in the game and what each is worth"}
            </small>
          </span>
          <Chevron />
        </button>
      </div>

      {open === "tools" && (
        <ToolsSheet
          tools={tools}
          loading={loading}
          powerOf={powerOf}
          stored={stored}
          busy={busy}
          canAct={canAct}
          onSave={(ids) => {
            onSave(ids);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "land" && (
        <LandSheet
          stored={share}
          busy={busy}
          canAct={canAct}
          onSave={(next) => {
            onShare(next);
            setOpen(null);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "all" && (
        <AllToolsSheet
          templates={templates}
          owned={tools}
          loading={loading}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/* The wallet's spare tools, one line per template. */
interface ToolGroup {
  template_id: number;
  first: MiningTool;
  ids: string[];
}

const SPARE_PAGE = 40;

function ToolsSheet({
  tools,
  loading,
  powerOf,
  stored,
  busy,
  canAct,
  onSave,
  onClose,
}: {
  tools: MiningTool[];
  loading: boolean;
  powerOf: (templateId: number) => ToolTemplate | undefined;
  stored: string[];
  busy: string | null;
  canAct: boolean;
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const byId = useMemo(
    () => new Map(tools.map((t) => [t.asset_id, t])),
    [tools],
  );
  /*
     The pick starts from what is saved, less anything the wallet no longer
     holds: `setminenfts` aborts on an id it cannot find, so a tool that left
     the wallet is dropped here and said out loud below.
  */
  const [picked, setPicked] = useState<string[]>(() =>
    [...new Set(stored)]
      .filter((id) => loading || byId.has(id))
      .slice(0, MAX_TOOLS),
  );
  const held = picked.filter((id) => byId.has(id));
  const missing = loading ? [] : stored.filter((id) => !byId.has(id));
  /* The slot a Swap in replaces once all three are full: the last, unless chosen. */
  const [slot, setSlot] = useState<number | null>(null);
  const [shown, setShown] = useState(SPARE_PAGE);

  const groups = useMemo(() => {
    const by = new Map<number, ToolGroup>();
    for (const t of tools) {
      if (picked.includes(t.asset_id)) continue;
      const g = by.get(t.template_id);
      if (g) g.ids.push(t.asset_id);
      else
        by.set(t.template_id, {
          template_id: t.template_id,
          first: t,
          ids: [t.asset_id],
        });
    }
    return [...by.values()].sort(
      (a, b) =>
        powerScore("combined", powerOf(b.template_id)) -
          powerScore("combined", powerOf(a.template_id)) ||
        byQuality(a.first, b.first),
    );
  }, [tools, picked, powerOf]);

  const bagOf = (ids: string[]) =>
    bagPower(
      ids
        .map((id) => byId.get(id))
        .map((t) => (t ? (powerOf(t.template_id) ?? {}) : {})),
    );
  const now = bagOf(held);
  const before = bagOf(stored.filter((id) => byId.has(id)));
  const changed =
    held.length !== stored.length || held.some((id) => !stored.includes(id));

  const swapIn = (id: string) => {
    setPicked((prev) => {
      if (prev.length < MAX_TOOLS) return [...prev, id];
      const at = slot ?? prev.length - 1;
      return prev.map((x, i) => (i === at ? id : x));
    });
    setSlot(null);
  };
  const delta = (n: number) =>
    n === 0 ? null : (
      <em className={n > 0 ? "up" : "down"}>
        {n > 0 ? "+" : "−"}
        {formatNumber(Math.abs(n))}
      </em>
    );

  return (
    <Sheet
      title="Change tools"
      onClose={onClose}
      foot={
        <>
          <div className="toolsheet__sum">
            <span>{changed ? "If you save" : "Equipped"}</span>
            <Power tlm={now.tlm_mp} shrd={now.shrd_mp} />
            {changed && (
              <span className="toolsheet__delta">
                {delta(now.tlm_mp - before.tlm_mp)}
                {delta(now.shrd_mp - before.shrd_mp)}
              </span>
            )}
          </div>
          <div className="rsheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                !canAct || busy !== null || (!changed && missing.length === 0)
              }
              onClick={() => onSave(held)}
            >
              {busy === "mining" && <span className="spinner" />}
              Save tools
            </button>
          </div>
        </>
      }
    >
      <p className="rsheet__hint">
        Up to {MAX_TOOLS}.{" "}
        {held.length >= MAX_TOOLS
          ? "Tap a slot, then the tool to put in it."
          : "Tap a tool to equip it."}
      </p>
      <div className="toolsheet__slots">
        {Array.from({ length: MAX_TOOLS }, (_, i) => {
          const t = byId.get(held[i]);
          const at = slot ?? (held.length >= MAX_TOOLS ? held.length - 1 : -1);
          return t ? (
            <div
              className={`toolsheet__slot${at === i ? " is-selected" : ""}`}
              key={t.asset_id}
            >
              <button
                type="button"
                className="toolsheet__pick"
                onClick={() => setSlot(i)}
              >
                <GameImg
                  src={asset(`/assets/cards/${t.template_id}.webp`)}
                  alt=""
                  fallback={asset("/assets/default-card.png")}
                />
                <span>{t.name}</span>
              </button>
              <button
                type="button"
                className="toolsheet__remove"
                aria-label={`Take off ${t.name}`}
                onClick={() => {
                  setPicked((prev) => prev.filter((x) => x !== t.asset_id));
                  setSlot(null);
                }}
              >
                ×
              </button>
            </div>
          ) : (
            <div
              className="toolsheet__slot toolsheet__slot--empty"
              key={`empty-${i}`}
            >
              <i>+</i>
              <span>Empty</span>
            </div>
          );
        })}
      </div>
      {missing.length > 0 && (
        <p className="rsheet__hint rsheet__hint--error">
          {missing.length === 1
            ? "One equipped tool is"
            : `${missing.length} equipped tools are`}{" "}
          no longer in this wallet. Saving takes{" "}
          {missing.length === 1 ? "it" : "them"} off on chain too.
        </p>
      )}

      <div className="rsheet__cap">
        In your wallet<span>best first</span>
      </div>
      {loading ? (
        <p className="rsheet__hint">Loading your tools…</p>
      ) : groups.length === 0 ? (
        <p className="rsheet__hint">
          No other Alien Worlds tools in this wallet.
        </p>
      ) : (
        <div className="prew__rows">
          {groups.slice(0, shown).map((g) => {
            const p = powerOf(g.template_id);
            return (
              <div className="prew__row prew__row--tool" key={g.template_id}>
                <GameImg
                  className="prew__toolart"
                  src={asset(`/assets/cards/${g.template_id}.webp`)}
                  alt=""
                  loading="lazy"
                  fallback={asset("/assets/default-card.png")}
                />
                <span className="prew__rowtext">
                  <strong>
                    {g.first.name}
                    {g.ids.length > 1 && (
                      <span className="faint"> ×{g.ids.length}</span>
                    )}
                  </strong>
                  <small>
                    {g.first.shine === "Stone"
                      ? g.first.rarity
                      : `${g.first.rarity} · ${g.first.shine}`}
                  </small>
                  <Power
                    tlm={Number(p?.tlm_mp ?? 0)}
                    shrd={Number(p?.shrd_mp ?? 0)}
                  />
                </span>
                <button
                  type="button"
                  className="btn btn--sm"
                  disabled={!canAct || busy !== null}
                  onClick={() => swapIn(g.ids[0])}
                >
                  {held.length >= MAX_TOOLS ? "Swap in" : "Equip"}
                </button>
              </div>
            );
          })}
          {groups.length > shown && (
            <button
              type="button"
              className="prew__row prew__row--more"
              onClick={() => setShown((n) => n + SPARE_PAGE)}
            >
              <span className="prew__rowtext">
                <strong>Show more</strong>
                <small>
                  {formatNumber(groups.length - shown)} more kinds of tool
                </small>
              </span>
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

const SHARE_PRESETS: [number, string][] = [
  [100, "All TLM"],
  [50, "50 / 50"],
  [0, "All Shards"],
];

function LandSheet({
  stored,
  busy,
  canAct,
  onSave,
  onClose,
}: {
  stored: number;
  busy: string | null;
  canAct: boolean;
  onSave: (share: number) => void;
  onClose: () => void;
}) {
  const [share, setShare] = useState(stored);
  return (
    <Sheet
      title="Landowner settings"
      onClose={onClose}
      foot={
        <div className="rsheet__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canAct || busy !== null || share === stored}
            onClick={() => onSave(share)}
          >
            {busy === "share" && <span className="spinner" />}
            Save
          </button>
        </div>
      }
    >
      {/*
        This setting belongs to the landowner, not the miner. `pools.cpp`
        looks up whoever owns the land a mine happened on, reads *their*
        `landowner_tlm_share`, and splits the power they earn between the TLM
        pools and the shard pools.
      */}
      <p className="rsheet__hint">
        When other players mine on land you own, you earn a cut of their mining
        power. This decides which pools it goes to. It changes nothing about
        your own mining.
      </p>
      <div className="splitbar">
        <span className="splitbar__tlm" style={{ width: `${share}%` }} />
        <span
          className="splitbar__shards"
          style={{ width: `${100 - share}%` }}
        />
      </div>
      <div className="splitlabels">
        <span>
          <img
            src={asset("/assets/icons/tlm.svg")}
            alt=""
            width={14}
            height={14}
          />
          {share}% TLM
        </span>
        <span>
          {100 - share}% Shards
          <img
            src={asset("/assets/icons/shards.svg")}
            alt=""
            width={14}
            height={14}
          />
        </span>
      </div>
      <input
        type="range"
        className="landsheet__range"
        min={0}
        max={100}
        step={1}
        value={share}
        aria-label="Share paid as TLM"
        onChange={(e) => setShare(Number(e.target.value))}
        disabled={!canAct || busy !== null}
      />
      <div className="landsheet__presets">
        {SHARE_PRESETS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={share === value ? "is-on" : ""}
            aria-pressed={share === value}
            onClick={() => setShare(value)}
            disabled={!canAct || busy !== null}
          >
            {label}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

type CatalogueSort = "combined" | "tlm_mp" | "shrd_mp";
const CATALOGUE_SORTS: [CatalogueSort, string][] = [
  ["combined", "Combined"],
  ["tlm_mp", "TLM power"],
  ["shrd_mp", "Shard power"],
];

function AllToolsSheet({
  templates,
  owned,
  loading,
  onClose,
}: {
  templates: ToolTemplate[];
  owned: MiningTool[];
  loading: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogueSort>("combined");
  const [mineOnly, setMineOnly] = useState(false);

  const held = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of owned)
      map.set(t.template_id, (map.get(t.template_id) ?? 0) + 1);
    return map;
  }, [owned]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates
      .filter((t) => {
        if (mineOnly && !held.has(t.template_id)) return false;
        if (!needle) return true;
        return (
          t.toolname.toLowerCase().includes(needle) ||
          t.rarity.toLowerCase().includes(needle) ||
          t.shine.toLowerCase().includes(needle)
        );
      })
      .sort(
        (a, b) => powerScore(sort, b) - powerScore(sort, a) || byQuality(a, b),
      );
  }, [templates, query, sort, mineOnly, held]);

  return (
    <Sheet title="All tools" onClose={onClose}>
      <input
        type="search"
        className="input"
        placeholder={`Search ${templates.length ? formatNumber(templates.length) + " " : ""}tools`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="alltools__chips">
        {CATALOGUE_SORTS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={sort === key ? "is-on" : ""}
            aria-pressed={sort === key}
            onClick={() => setSort(key)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={mineOnly ? "is-on" : ""}
          aria-pressed={mineOnly}
          onClick={() => setMineOnly((v) => !v)}
        >
          Yours only
        </button>
      </div>
      {loading ? (
        <p className="rsheet__hint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rsheet__hint">No tool matches that.</p>
      ) : (
        <div className="alltools">
          <div className="alltools__head">
            <span>Tool</span>
            <span>TLM</span>
            <span>Shards</span>
          </div>
          {rows.map((t) => {
            const count = held.get(t.template_id) ?? 0;
            return (
              <div className="alltools__row" key={t.template_id}>
                <span className="alltools__name">
                  <strong>
                    {t.toolname}
                    {count > 0 && (
                      <em className="alltools__own">You own {count}</em>
                    )}
                  </strong>
                  <small>
                    {t.rarity} · {t.shine}
                  </small>
                </span>
                <span className="mono">{formatNumber(t.tlm_mp)}</span>
                <span className="mono">{formatNumber(t.shrd_mp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- a currency ---------- */

/* "Dungeon Wins" reads as "Dungeon" under a ring; the rest keep their name. */
function ringLabel(label: string): string {
  return label
    .replace(/ Wins$/i, "")
    .replace(/^Arena Domination$/i, "Domination");
}

/* Where the power for a pool is earned, when that is a place on the map. */
function earnLink(pool: string): { label: string; to: string } | null {
  if (/arena/i.test(pool)) return { label: "Find an arena", to: "/map" };
  if (/dung/i.test(pool)) return { label: "Find a dungeon", to: "/map" };
  return null;
}

function Ring({
  entry,
  symbol,
  busy,
  disabled,
  onOpen,
  onMine,
}: {
  entry: PoolEntry;
  symbol: string;
  busy: boolean;
  disabled: boolean;
  onOpen: () => void;
  onMine: () => void;
}) {
  const r = 31;
  const around = 2 * Math.PI * r;
  const fill = Math.min(
    1,
    entry.anyAmount ? (entry.power > 0 ? 1 : 0) : entry.progress,
  );
  return (
    <div className={`pring${entry.ready ? " pring--ready" : ""}`}>
      <button
        type="button"
        className="pring__dial"
        onClick={onOpen}
        aria-label={`${entry.label}: details`}
      >
        <svg viewBox="0 0 76 76" aria-hidden="true">
          <circle cx="38" cy="38" r={r} className="pring__track" />
          <circle
            cx="38"
            cy="38"
            r={r}
            className="pring__fill"
            strokeDasharray={`${around * fill} ${around}`}
            transform="rotate(-90 38 38)"
          />
        </svg>
        <span className="pring__centre">
          {entry.ready
            ? entry.mines > 1
              ? `×${formatNumber(entry.mines)}`
              : "Ready"
            : entry.anyAmount
              ? "0"
              : `${Math.floor(entry.progress * 100)}%`}
        </span>
      </button>
      <strong className="pring__name">{ringLabel(entry.label)}</strong>
      {entry.ready ? (
        <button
          type="button"
          className="btn btn--sm btn--gold pring__mine"
          disabled={disabled}
          onClick={onMine}
        >
          {busy && <span className="spinner" />}
          Mine
        </button>
      ) : (
        <small className="pring__togo">
          {entry.anyAmount
            ? "No power yet"
            : `${formatNumber(Math.max(0, MINE_POWER - entry.power))} to go`}
        </small>
      )}
      <span className="sr-only">{symbol}</span>
    </div>
  );
}

function PoolSheet({
  entry,
  places,
  symbol,
  busy,
  disabled,
  trial,
  onMine,
  onClose,
}: {
  entry: PoolEntry;
  places: number;
  symbol: string;
  busy: boolean;
  disabled: boolean;
  trial: number | null;
  onMine: (times: number) => void;
  onClose: () => void;
}) {
  const batch = batchableMines(entry);
  const pays = entry.anyAmount
    ? entry.payout
    : poolPayout(entry.balance, MINE_POWER);
  const link = earnLink(entry.pool);
  return (
    <Sheet
      title={`${entry.label} · ${symbol}`}
      onClose={onClose}
      foot={
        <div className="rsheet__actions">
          {entry.ready ? (
            <>
              <button
                type="button"
                className="btn btn--gold"
                disabled={disabled}
                onClick={() => onMine(1)}
              >
                {busy && <span className="spinner" />}
                Mine
              </button>
              {batch > 1 && (
                <button
                  type="button"
                  className="btn"
                  disabled={disabled}
                  onClick={() => onMine(batch)}
                >
                  Mine ×{batch}
                </button>
              )}
            </>
          ) : (
            <>
              {link && (
                <Link className="btn btn--primary" to={link.to}>
                  {link.label}
                </Link>
              )}
              <button type="button" className="btn" disabled>
                Mine
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="poolsheet__stats">
        <div>
          <small>In the pool</small>
          <strong className="mono">
            {poolAmount(entry.balance, places)} <em>{symbol}</em>
          </strong>
        </div>
        <div>
          <small>{entry.anyAmount ? "Mining now pays" : "A mine pays"}</small>
          <strong className="mono poolsheet__pays">
            ~{poolAmount(pays, places)} <em>{symbol}</em>
          </strong>
        </div>
      </div>
      <div className="poolsheet__power">
        <span>
          {entry.anyAmount
            ? `${formatNumber(entry.power)} power · no minimum`
            : `${formatNumber(entry.power)} / ${formatNumber(MINE_POWER)} power`}
        </span>
        <span className={entry.ready ? "poolsheet__banked" : "faint"}>
          {entry.mines > 1
            ? `${formatNumber(entry.mines)} mines banked`
            : entry.ready
              ? "Ready to mine"
              : entry.anyAmount
                ? ""
                : `${formatNumber(MINE_POWER - entry.power)} to go`}
        </span>
      </div>
      <div className={`poolsheet__bar${entry.ready ? " is-ready" : ""}`}>
        <i
          style={{
            width: `${Math.min(100, Math.round(entry.progress * 100))}%`,
          }}
        />
      </div>
      {entry.how && <p className="rsheet__hint">{entry.how}</p>}
      <p className="rsheet__hint">
        {entry.anyAmount
          ? "This pool has no minimum: mining spends all the power you have here."
          : `A mine spends ${formatNumber(MINE_POWER)} power and takes 1% of what the pool holds.`}
      </p>
      {trial !== null && (
        <p className="rsheet__hint rsheet__hint--error">
          Your Legend access has lapsed, so you are banking{" "}
          {Math.round(trial * 100)}% of the Reward Power you earn.
        </p>
      )}
    </Sheet>
  );
}

function PhoneCurrency({
  player,
  busy,
  canAct,
  data,
}: {
  player: Player;
  busy: string | null;
  canAct: boolean;
  data: PhoneCurrencyData;
}) {
  const {
    currency,
    log,
    capacity,
    board,
    trial,
    minedPool,
    onMine,
    onClaim,
    onUnlock,
  } = data;
  const places = CURRENCY_PRECISION[currency];
  const symbol = CURRENCY_LABEL[currency];
  const pending = unclaimed(player, currency);
  const pays = claimPays(currency);
  const [openPool, setOpenPool] = useState<string | null>(null);
  const pool = board.find((e) => e.pool === openPool);

  /* WAX is kept to eight places on chain; one is all a phone needs. */
  const shown = currency === "wax" ? 1 : places;
  const short = (value: number) =>
    formatDecimals(value, currency === "tlm" ? 2 : 1);
  /* The headline to two places at most: the tail is in the claim, not the read. */
  const heroAmount = (value: number) => {
    const p = Math.min(2, shown);
    return formatDecimals(Math.trunc(value * 10 ** p) / 10 ** p, p);
  };

  const rows = log ?? [];
  const total = rows.reduce(
    (sum, r) => sum + Number(String(r.reward).split(" ")[0] || 0),
    0,
  );
  const sources = useMemo(
    () => paymentSources(rows, CURRENCY_ICON[currency]),
    [rows, currency],
  );
  /* Oldest on the left, as a chart reads; at most the last forty. */
  const bars = useMemo(() => {
    const ordered = [...rows]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(-40);
    const values = ordered.map((r) =>
      Number(String(r.reward).split(" ")[0] || 0),
    );
    const top = Math.max(1e-9, ...values);
    return values.map((v) => Math.max(0.06, Math.sqrt(v / top)));
  }, [rows]);

  return (
    <>
      <div className="prew__hero">
        <img src={CURRENCY_ICON[currency]} alt="" className="prew__heroicon" />
        <span className="prew__herolabel">Waiting to claim</span>
        <strong
          className={`prew__heronum mono${pending > 0 ? " is-gold" : ""}`}
        >
          {heroAmount(pending)}
        </strong>
        {pays && pending > 0 ? (
          <button
            type="button"
            className="btn btn--gold prew__claim"
            disabled={!canAct || busy !== null}
            onClick={onClaim}
          >
            {busy === "claim" && <span className="spinner" />}
            Claim
          </button>
        ) : (
          <small className="prew__heronote">Nothing to claim</small>
        )}
        {/*
          `claimcur` zeroes unclaimed shards and WAX without sending them, so
          a balance there is named rather than offered a button that would
          destroy it.
        */}
        {!pays && pending > 0 && (
          <p className="rsheet__hint rsheet__hint--error">
            The game holds {formatDecimals(pending, places)} {symbol} against
            your account, but the claim action clears it without paying it out.
            Nothing here can release it.
          </p>
        )}
      </div>

      {board.length > 0 && (
        <>
          <div className="prew__cap">
            Reward pools<span>tap a pool for more</span>
          </div>
          <div className="prew__card prew__rings">
            {board.map((entry) => (
              <Ring
                key={entry.pool}
                entry={entry}

                symbol={symbol}
                busy={busy === "mine" && minedPool === entry.pool}
                disabled={!canAct || busy !== null}
                onOpen={() => setOpenPool(entry.pool)}
                onMine={() => onMine(entry.pool, 1)}
              />
            ))}
          </div>
        </>
      )}

      {/*
        The history is rented storage, not a record of what happened: with no
        rows unlocked nothing is written at all, so an empty ledger has to say
        which of the two it is.
      */}
      {capacity.unlocked === 0 ? (
        <>
          <div className="prew__cap">
            Payments<span>not recorded</span>
          </div>
          <div className="prew__card prew__norecord">
            <strong>{symbol} payments aren't being recorded</strong>
            <p>
              The game only keeps a history for rows you unlock. Start recording
              and everything you earn from now on is listed here — what was paid
              before can't be shown.
            </p>
            {!capacity.atMax && (
              <div className="prew__unlock">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={!canAct || busy !== null}
                  onClick={() => onUnlock(capacity.step)}
                >
                  {busy === "rows" && <span className="spinner" />}
                  Start recording
                </button>
                <span>
                  {formatNumber(capacity.step)} rows ·{" "}
                  <img
                    src={asset("/assets/icons/gems.png")}
                    alt=""
                    width={13}
                    height={13}
                  />{" "}
                  {formatNumber(capacity.price)} gems
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="prew__cap">
            {rows.length
              ? `Last ${formatNumber(rows.length)} payments`
              : "Payments"}
            {rows.length > 0 && (
              <span>
                {short(total)} {symbol}
              </span>
            )}
          </div>
          {log === undefined ? (
            <p className="prew__empty">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="prew__empty">
              Nothing recorded yet. The next {symbol} you earn appears here.
            </p>
          ) : (
            <>
              <div className="prew__card prew__chart" aria-hidden="true">
                {bars.map((h, i) => (
                  <i key={i} style={{ height: `${Math.round(h * 100)}%` }} />
                ))}
              </div>
            </>
          )}
          <div className="prew__rows">
            {sources.map((s) => (
              <div className="prew__row" key={s.key}>
                <img src={s.icon} alt="" />
                <span className="prew__rowtext">
                  <strong>{s.label}</strong>
                  <small>
                    {formatNumber(s.count)} payment{s.count === 1 ? "" : "s"}
                  </small>
                </span>
                <span className="prew__amount mono">{short(s.total)}</span>
              </div>
            ))}
            <div className="prew__keep">
              <span>
                {formatNumber(capacity.used)} /{" "}
                {formatNumber(capacity.unlocked)} kept
              </span>
              {!capacity.atMax && (
                <>
                  <span className="prew__keepprice">
                    +{formatNumber(capacity.step)} rows ·{" "}
                    <img
                      src={asset("/assets/icons/gems.png")}
                      alt=""
                      width={13}
                      height={13}
                    />{" "}
                    {formatNumber(capacity.price)}
                  </span>
                  <button
                    type="button"
                    className="btn btn--sm"
                    disabled={!canAct || busy !== null}
                    onClick={() => onUnlock(capacity.step)}
                  >
                    {busy === "rows" && <span className="spinner" />}
                    Keep more
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {pool && (
        <PoolSheet
          entry={pool}
          places={places}
          symbol={symbol}
          busy={busy === "mine" && minedPool === pool.pool}
          disabled={!canAct || busy !== null || !pool.ready}
          trial={trial}
          onMine={(times) => {
            onMine(pool.pool, times);
            setOpenPool(null);
          }}
          onClose={() => setOpenPool(null)}
        />
      )}
    </>
  );
}
