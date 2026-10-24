import { useEffect, useMemo, useState } from 'react'
import { fetchMiningTools, type MiningTool } from '@/chain/atomic'
import { fetchToolTemplates, type ToolTemplate } from '@/pools/queries'

/**
 * Every Alien Worlds tool in a wallet, and the power of every tool in the
 * game.
 *
 * Mining power lives on the template, not the asset — the contract looks it
 * up by `template_id` and never reads the NFT's own stats — so `powerOf`
 * joins a tool to `templatemp` before anything is shown, sorted or summed.
 */
export function useMiningTools(account: string) {
  const [tools, setTools] = useState<MiningTool[]>([])
  const [templates, setTemplates] = useState<ToolTemplate[]>([])
  const [loading, setLoading] = useState(true)
  /* How many tools have arrived so far, for a wallet big enough to wait on. */
  const [loadedSoFar, setLoadedSoFar] = useState(0)

  useEffect(() => {
    let cancelled = false
    if (!account) return
    setLoading(true)
    setLoadedSoFar(0)
    Promise.all([
      fetchMiningTools(account, (n) => {
        if (!cancelled) setLoadedSoFar(n)
      }),
      fetchToolTemplates(),
    ])
      .then(([rows, temps]) => {
        if (cancelled) return
        setTools(rows)
        setTemplates(temps)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [account])

  const powerOf = useMemo(() => {
    const byTemplate = new Map(templates.map((t) => [t.template_id, t]))
    return (templateId: number) => byTemplate.get(templateId)
  }, [templates])

  return { tools, templates, loading, loadedSoFar, powerOf }
}
