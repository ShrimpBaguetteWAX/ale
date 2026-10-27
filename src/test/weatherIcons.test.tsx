import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { WeatherPanel } from '@/fight/setup'
import type { Weather } from '@/fight/weather'

/**
 * A roll's stat icons: side by side for one or two, a grid of three to a
 * row for three or more — six resistances in a line left the name no room.
 */
const roll = (stats: string[]): Weather => ({
  weather_id: 'w',
  affected_class: [],
  affected_element: [],
  affected_race: [],
  weather_effects: stats.map((statname) => ({ statname, percent_change: 10, flat_change: 0 })),
  displayname: '+10% all resistances',
  title: '',
})

const ALL_RES = ['res_gem', 'res_metal', 'res_air', 'res_fire', 'res_nature', 'res_neutral']

describe('weather stat icons', () => {
  it('keeps one or two in a line', () => {
    const { container } = render(<WeatherPanel weather={roll(['initiative', 'attackspeed'])} />)
    expect(container.querySelectorAll('.weather__stat')).toHaveLength(2)
    expect(container.querySelector('.weather__stats--grid')).toBeNull()
  })

  it('folds six resistances into the grid', () => {
    const { container } = render(<WeatherPanel weather={roll(ALL_RES)} />)
    expect(container.querySelectorAll('.weather__stat')).toHaveLength(6)
    expect(container.querySelector('.weather__stats--grid')).not.toBeNull()
  })

  it('does the same in the Dungeon and Arena head', () => {
    const { container } = render(<WeatherPanel weather={roll(ALL_RES)} twin />)
    expect(container.querySelector('.weathertwin__stats.is-grid')).not.toBeNull()
    const two = render(<WeatherPanel weather={roll(['res_fire', 'res_air'])} twin />)
    expect(two.container.querySelector('.weathertwin__stats.is-grid')).toBeNull()
  })
})
