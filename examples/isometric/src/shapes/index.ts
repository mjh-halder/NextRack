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
}
