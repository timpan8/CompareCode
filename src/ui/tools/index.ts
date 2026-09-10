import { registerTool } from '../../core/tools/registry'
import { createTwoWayTool } from '../../core/tools/twoWay'
import { TwoWayView } from './TwoWayView'

/**
 * Where a tool is wired to its interface. `createTwoWayTool` comes from the pure
 * core, which knows how to compare but nothing about drawing; the component is
 * handed to it here.
 *
 * A second tool — "only the differences", or comparing more than two documents —
 * is another file plus another `registerTool` call, and neither the engine nor
 * anything else in the interface has to change.
 */
export const twoWayTool = createTwoWayTool(TwoWayView)

registerTool(twoWayTool)
