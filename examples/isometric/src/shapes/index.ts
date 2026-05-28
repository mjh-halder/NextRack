import { shapes } from '@joint/core';

import { Link } from './link/link'
import { Rectangle } from './rectangle/rectangle'
import { Circle } from './circle/circle'
import { Frame } from './frame/frame'
import { Octagon } from './octagon/octagon'
import { Hexahedron } from './hexahedron/hexahedron'
import { SvgPolygonShape } from './svgpolygon/svg-polygon-shape'
import { Tube } from './tube/tube'
import { Pipe } from './pipe/pipe'
import { Duct } from './duct/duct'
import { Channel } from './channel/channel'
import { Area } from './area/area'
import { DoubleArrow } from './double-arrow/double-arrow'
import { GridLabel } from './grid-label/grid-label'
import { Icon } from './icon/icon'
import { ComplexComponent, ComplexComponentView } from './complex-component'

export const cellNamespace = {
    ...shapes,
    Link,
    Rectangle,
    Circle,
    Frame,
    Area,
    DoubleArrow,
    GridLabel,
    Icon,
    Octagon,
    Hexahedron,
    SvgPolygonShape,
    Tube,
    Pipe,
    Duct,
    Channel,
    // Typed as `nextrack.ComplexComponent`; JointJS resolves the matching view
    // at `nextrack.ComplexComponentView` in cellViewNamespace.
    nextrack: {
        ComplexComponent,
        ComplexComponentView,
    },
}

export {
    Link,
    Rectangle,
    Circle,
    Frame,
    Area,
    DoubleArrow,
    GridLabel,
    Icon,
    Octagon,
    Hexahedron,
    SvgPolygonShape,
    Tube,
    Pipe,
    Duct,
    Channel,
    ComplexComponent,
    ComplexComponentView,
}
