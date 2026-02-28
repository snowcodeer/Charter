import { Connector } from '../types'
import { exaConnectors } from './exa'
import { passportConnectors } from './passport'
import { calendarConnectors } from './calendar'
import { gmailConnectors } from './gmail'
import { formFillerConnectors } from './form-filler'

export const allConnectors: Connector[] = [
  ...exaConnectors,
  ...passportConnectors,
  ...calendarConnectors,
  ...gmailConnectors,
  ...formFillerConnectors,
]

export function getConnector(name: string): Connector | undefined {
  return allConnectors.find((c) => c.name === name)
}

export function getConnectorNames(): string[] {
  return allConnectors.map((c) => c.name)
}
