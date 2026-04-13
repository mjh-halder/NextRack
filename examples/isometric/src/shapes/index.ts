import { shapes } from '@joint/core';

import { Link } from './link/link'
import { Switch } from './switch/switch'
import { Router } from './router/router'
import { Computer } from './computer/computer'
import { Database } from './database/database'
import { ActiveDirectory } from './active-directory/active-directory'
import { User } from './user/user'
import { Firewall } from './firewall/firewall'
import { Frame } from './frame/frame'
import { KubernetesWorkerNode } from './kubernetes-worker-node/kubernetes-worker-node'
import { Pyramid } from './pyramid/pyramid'
import { Hexagonal } from './hexagonal/hexagonal'
import { Octagon } from './octagon/octagon'
import { Hexahedron } from './hexahedron/hexahedron'

export const cellNamespace = {
    ...shapes,
    Link,
    Switch,
    Router,
    Computer,
    Database,
    ActiveDirectory,
    User,
    Firewall,
    Frame,
    KubernetesWorkerNode,
    Pyramid,
    Hexagonal,
    Octagon,
    Hexahedron,
}

export {
    Link,
    Switch,
    Router,
    Computer,
    Database,
    ActiveDirectory,
    User,
    Firewall,
    Frame,
    KubernetesWorkerNode,
    Pyramid,
    Hexagonal,
    Octagon,
    Hexahedron,
}
