# Link Types

Connections in Xyronos are typed to represent different kinds of infrastructure relationships. Each link on the canvas has a **Link Type** that determines its purpose and behavior.

## Host Access

A **Host Access** link connects a server (or other compute node) to a network switch. This represents the physical or logical network path that gives the server access to the network fabric.

Typical properties:

| Property | Example |
|----------|---------|
| **Bandwidth** | 10Gbps, 25Gbps, 100Gbps |
| **Medium** | Copper, Fiber |
| **Encryption** | None, TLS, MACsec |

Host Access links appear between individual components on the canvas.

## Cluster Link

A **Cluster Link** connects two **zones** (not individual components). It represents a high-level interconnect between infrastructure groups — for example, a cross-site replication link, a stretched VLAN, or a cluster heartbeat network.

When two or more zones are connected via Cluster Links, they automatically form a **Stretch Cluster**. The system detects these groups and:

- Labels each zone with a shared cluster name (e.g. "Stretch Cluster A")
- Aggregates resource totals (nodes, CPUs, cores, RAM, storage, power) across all zones in the cluster
- Displays combined cluster metrics in the HUD when a member zone is selected

## Creating Links

### Host Access
1. Select a server or other component on the canvas.
2. Use the connect tool (circle icon) to drag a link to a switch port.

### Cluster Link
1. Select a zone on the canvas.
2. Use the connect tool to drag a link to another zone.
3. The link is automatically typed as a Cluster Link.

## Viewing Link Properties

Click any link on the canvas to open the inspector panel. The **Link Type** field shows the current type and can be changed manually if needed.
