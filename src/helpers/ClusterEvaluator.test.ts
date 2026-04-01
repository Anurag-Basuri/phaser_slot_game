import { describe, it, expect } from 'vitest';
import { ClusterEvaluator } from './ClusterEvaluator';

describe('ClusterEvaluator', () => {
  it('should find a basic horizontal cluster of 5', () => {
    // 5x5 grid for simplicity
    const grid = [
      [ 1,  1,  1,  1,  1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
    ];
    const evaluator = new ClusterEvaluator(grid);
    const clusters = evaluator.findClusters(5);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].symbolId).toBe(1);
    expect(clusters[0].positions).toHaveLength(5);
  });

  it('should ignore clusters smaller than the minimum size', () => {
    const grid = [
      [ 1,  1,  1,  1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
    ];
    const evaluator = new ClusterEvaluator(grid);
    const clusters = evaluator.findClusters(5);

    // Only 4 adjacent 1s
    expect(clusters).toHaveLength(0);
  });

  it('should find L-shaped and irregular clusters', () => {
    const grid = [
      [ 2,  2, -1, -1, -1],
      [ 2, -1, -1, -1, -1],
      [ 2,  2, -1, -1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
    ];
    const evaluator = new ClusterEvaluator(grid);
    const clusters = evaluator.findClusters(5);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].symbolId).toBe(2);
    expect(clusters[0].positions).toHaveLength(5);
  });

  it('should support multiple disjoint clusters of the same symbol', () => {
    const grid = [
      [ 3,  3,  3,  3,  3, -1, -1], // Cluster A (5)
      [-1, -1, -1, -1, -1, -1, -1],
      [-1,  3,  3,  3, -1, -1, -1], // Cluster B (5)
      [-1,  3,  3, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1, -1, -1],
    ];
    const evaluator = new ClusterEvaluator(grid);
    const clusters = evaluator.findClusters(5);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].symbolId).toBe(3);
    expect(clusters[1].symbolId).toBe(3);
  });

  it('should ignore scatter symbols (ID 7) for cluster grouping', () => {
    const grid = [
      [ 7,  7,  7,  7,  7],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
      [-1, -1, -1, -1, -1],
    ];
    const evaluator = new ClusterEvaluator(grid);
    const clusters = evaluator.findClusters(5);

    // Scatters evaluate separately via scatter logic, not via ClusterEvaluator.
    expect(clusters).toHaveLength(0);
  });
});
