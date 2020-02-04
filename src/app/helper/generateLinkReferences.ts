import { Link, Node, RefLink } from '../interfaces';

export function generateLinkReferences(links: Link[], nodes: Node[]): RefLink[] {
  return links.map(link => {
    const source = nodes.find(node => node.id === link.source);
    const target = nodes.find(node => node.id === link.target);

    if (!source) {
      console.error('Did not find link source in nodes:', link.source);
    }

    if (!target) {
      console.error('Did not find link target in nodes:', link.target);
    }

    return { ...link, source, target };
  });
}
