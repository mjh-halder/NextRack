// Tiny renderer for @carbon/icons descriptors. Each descriptor is a plain
// `{ elem, attrs, content }` tree; this flattens it to an SVG markup string
// so we can drop it into `innerHTML` the same way as any inline SVG.

export interface CarbonIcon {
    elem: string;
    attrs: Record<string, string | number>;
    content?: CarbonIcon[];
}

function renderNode(node: CarbonIcon): string {
    const attrs = Object.entries(node.attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
    const children = (node.content ?? []).map(renderNode).join('');
    return children
        ? `<${node.elem} ${attrs}>${children}</${node.elem}>`
        : `<${node.elem} ${attrs}/>`;
}

export function carbonIconToString(
    icon: CarbonIcon,
    extraRootAttrs: Record<string, string | number> = {}
): string {
    // Force aria-hidden on the root <svg> — all our usages are decorative.
    const root: CarbonIcon = {
        ...icon,
        attrs: { ...icon.attrs, 'aria-hidden': 'true', ...extraRootAttrs },
    };
    return renderNode(root);
}
