///<reference path="lib/collections.ts"/>
///<reference path="lib/node.d.ts"/>

/** Graph module
*
*  Types for generic A\* implementation.
*
*  *NB.* The only part of this module
*  that you should change is the `aStarSearch` function. Everything
*  else should be used as-is.
*/

/** An edge in a graph. */
class Edge<Node> {
    from : Node;
    to   : Node;
    cost : number;
}

/** A directed graph. */
interface Graph<Node> {
    /** Computes the edges that leave from a node. */
    outgoingEdges(node : Node) : Edge<Node>[];
    /** A function that compares nodes. */
    compareNodes : collections.ICompareFunction<Node>;
}

/** Type that reports the result of a search. */
class SearchResult<Node> {
    /** The path (sequence of Nodes) found by the search algorithm. */
    path : Node[];
    /** The total cost of the path. */
    cost : number;
}

/**
* A\* search implementation, parameterised by a `Node` type. The code
* here is just a template; you should rewrite this function
* entirely. In this template, the code produces a dummy search result
* which just picks the first possible neighbour.
*
* Note that you should not change the API (type) of this function,
* only its body.
* @param graph The graph on which to perform A\* search.
* @param start The initial node.
* @param goal A function that returns true when given a goal node. Used to determine if the algorithm has reached the goal.
* @param heuristics The heuristic function. Used to estimate the cost of reaching the goal from a given Node.
* @param timeout Maximum time (in seconds) to spend performing A\* search.
* @returns A search result, which contains the path from `start` to a node satisfying `goal` and the cost of this path.
*/
function aStarSearch<Node> (
    graph : Graph<Node>,
    start : Node,
    goal : (n:Node) => boolean,
    heuristics : (n:Node) => number,
    timeout : number
) : SearchResult<Node> {

    // Private help data structure for using priority queue
    class QueueElement<T> {
        constructor(n: T, e: number) {
            this.node = n;
            this.estimatedCost = e;
        }
        node: T;
        estimatedCost: number;
    }

    // Comparator for priority queue
    var comparator : collections.ICompareFunction<QueueElement<Node>> = 
    function(a: QueueElement<Node>, b: QueueElement<Node>): number {
        var cmp = a.estimatedCost - b.estimatedCost;
        if (cmp < 0) return 1;
        else if (cmp > 0) return -1;
        else return 0;
    };

    var queue: collections.PriorityQueue<QueueElement<Node>> = 
        new collections.PriorityQueue<QueueElement<Node>>(comparator);
    var cameFrom: collections.Dictionary<Node, Node> = 
        new collections.Dictionary<Node, Node>();
    var costs: collections.Dictionary<Node, number> = 
        new collections.Dictionary<Node, number>();
    var visited: collections.Set<Node> = new collections.Set<Node>(); 
    var current: QueueElement<Node> = new QueueElement(start, 0);
    costs.setValue(start, 0);

    // Search for goal node
    while (!goal(current.node)){
        if (!visited.contains(current.node)) {
            visited.add(current.node);
            var children = graph.outgoingEdges(current.node);
            for (var i = children.length - 1; i >= 0; i--) {
                var child = children[i].to;
                var costFromStart = children[i].cost+costs.getValue(current.node);
                var heuristic = heuristics(child);
                var hasParent = cameFrom.containsKey(child);
                var oldCostFromStart = costs.getValue(child);
            if (!hasParent || oldCostFromStart > costFromStart) {
                queue.enqueue(new QueueElement(child, costFromStart+heuristic));
                cameFrom.setValue(child, current.node);
                costs.setValue(child, costFromStart);
            } 
          }
        }
        current = queue.dequeue();
    }

    //Reconstruct path
    var finalCost = costs.getValue(current.node);
    var path: [Node] = <any>[];
    while(current.node != start){
        path.push(current.node);
        current.node = cameFrom.getValue(current.node);
    }
    path.reverse();
    var result : SearchResult<Node> = {
        path: path,
        cost: finalCost
    };
    return result;
}


