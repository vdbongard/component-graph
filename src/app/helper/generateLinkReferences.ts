import { Link, RefLink, Node } from '../interfaces';

export function generateLinkReferences(
  links: Link[],
  nodes: Node[]
): RefLink[] {
  return links.map(link => {
    const source = nodes.find(node => node.id === link.source);
    const target = nodes.find(node => node.id === link.target);
    return { ...link, source, target };
  });
}
