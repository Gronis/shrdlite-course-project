Graph.ts
=========

Our implementation uses a priority queue in order to visit nodes with lowest cost first. For the sake of being able to compare node costs, we implemented a private class called QueueElement, which contains a node and an estimated cost (cost from start + heuristic to goal). 

We also store the cost of the cheapest path for each node in a map. In another map, we store the "best" parent of each node, which is used to reconstruct the optimal path. 