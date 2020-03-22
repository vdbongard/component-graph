import { clusterColors } from '../constants/cluster-colors';

export function clusterColorScale(index) {
  if (index > clusterColors.length - 1) {
    return 'white';
  }

  return clusterColors[index];
}
