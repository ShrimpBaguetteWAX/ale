import { createContext, useContext } from 'react'

/**
 * How many sections have something waiting, as the shell's chores count them,
 * for the map's rail to carry on its way to the Briefing without running the
 * chore checks a second time.
 */
export const ChoreCount = createContext(0)

export const useChoreCount = () => useContext(ChoreCount)
