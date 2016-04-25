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

//From here to aStar, this is our own code

class QueueElement<T> {
  element: T;
  costFromStart: number;
  heuristic: number;
  next: QueueElement<T>;
}

class PriorityQueue<T> {
  root: QueueElement<T>;
}

function prettyprint<T>(queue : PriorityQueue<T>){
  var current: QueueElement<T> = queue.root;
  var output: string = "queue: { ";
  while(current != null){
    output += (current.costFromStart + current.heuristic) + ", ";
    current = current.next;
  }
  output += " }"
  console.log(output);
}

function push<T>(queue     : PriorityQueue<T>, 
                 node         : T, 
                 cost      : number, 
                 heuristic : number){
    var insertedNode: QueueElement<T> = {
        element: node,
        costFromStart: cost,
        heuristic: heuristic,
        next: null
    };

    if(queue.root == null){
        queue.root = insertedNode;
        //console.log("pushed empty queue");
        return;
    }
    var current: QueueElement<T> = queue.root;
    //Find proper location for insert
    while(current.next != null && current.next.costFromStart + current.next.heuristic <= insertedNode.costFromStart + insertedNode.heuristic){
        if(node === current.next.element){
            console.log("Cheaper path exist in list, ignoring push");
            return;
        }
        current = current.next;
    }
    insertedNode.next = current.next;
    current.next = insertedNode;
    //console.log("pushed queue");
}

function pop<T>(queue: PriorityQueue<T>) : QueueElement<T>{
    if (queue == null || queue.root == null) {
        console.log("failed to pop queue");
        return null;
    }
    var cheapestNode = queue.root;
    queue.root = queue.root.next;
    //console.log("poped queue");
    return cheapestNode;
}

function prettyprintlist<T>(list : [Edge<T>]){
    var output: string = "list: { ";
    for (var i = 0; i < list.length; i++){
        output += (list[i].cost) + ", ";
    }
    output += " }"
    console.log(output);
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
* @param timeout Maximum time to spend performing A\* search.
* @returns A search result, which contains the path from `start` to a node satisfying `goal` and the cost of this path.
*/
function aStarSearch<Node> (
    graph : Graph<Node>,
    start : Node,
    goal : (n:Node) => boolean,
    heuristics : (n:Node) => number,
    timeout : number
) : SearchResult<Node> {

    var r: SearchResult<Node> = {
        path: [start],
        cost: 0
    };
    //return r;


    var queue: PriorityQueue<Node> = { root: null };
    push(queue, start, 0, 0);
    var cheapest : QueueElement<Node> = pop(queue);
    var cameFrom: [Edge<Node>] = <any>[]; 

    console.log("Start A star ");

    // Find goal
    while(!goal(cheapest.element)){
        //console.log("Inspecting parent" + cheapest);
        var outEdges = graph.outgoingEdges(cheapest.element);
        for (var i = outEdges.length - 1; i >= 0; i--) {
            //console.log("Inspecting child" + cheapest);
            var totalCost = outEdges[i].cost + cheapest.costFromStart;
            push(queue, outEdges[i].to, totalCost, heuristics(outEdges[i].to));
            prettyprint(queue);

            // Update edge with (parent -> child) with cheapest parent path
            var foundNode: boolean = false;
            for (var j = cameFrom.length - 1; j >= 0; j--) {
                if (cameFrom[j].to == outEdges[i].to) {
                    foundNode = true;
                    if (cameFrom[j].cost > totalCost) {
                        cameFrom[j].cost = totalCost;
                        cameFrom[j].from = cheapest.element;
                        //console.log("Updating child parent");
                    }
                else break;
                }
            }
            if(!foundNode){
                var edge: Edge<Node> = new Edge<Node>();
                edge.from = cheapest.element;
                edge.to = outEdges[i].to;
                edge.cost = totalCost;
                //console.log("Adding child parent");
                cameFrom.push(edge);
            }
            prettyprintlist(cameFrom);
        }
        cheapest = pop(queue);
    }

    console.log("TotalCost: " + cheapest.costFromStart);

    //Reconstruct path
    var current : Node = cheapest.element;
    var path: [Node] = <any>[current];
    while(current != start){
        for (var i = cameFrom.length - 1; i >= 0; i--) {
            if (cameFrom[i].to == current) {
                var parent = cameFrom[i].from;
                path.concat(parent);
                current = parent;
                break;
            }
        }
    }
    path.reverse();

    // A dummy search result: it just picks the first possible neighbour
    
    var result : SearchResult<Node> = {
        path: path,
        cost: cheapest.costFromStart
    };
    return result;
       
}


//////////////////////////////////////////////////////////////////////
// here is an example graph

interface Coordinate {
    x : number;
    y : number;
}


class GridNode {
    constructor(
        public pos : Coordinate
    ) {}

    add(delta : Coordinate) : GridNode {
        return new GridNode({
            x: this.pos.x + delta.x,
            y: this.pos.y + delta.y
        });
    }

    compareTo(other : GridNode) : number {
        return (this.pos.x - other.pos.x) || (this.pos.y - other.pos.y);
    }

    toString() : string {
        return "(" + this.pos.x + "," + this.pos.y + ")";
    }
}

/** Example Graph. */
class GridGraph implements Graph<GridNode> {
    private walls : collections.Set<GridNode>;

    constructor(
        public size : Coordinate,
        obstacles : Coordinate[]
    ) {
        this.walls = new collections.Set<GridNode>();
        for (var pos of obstacles) {
            this.walls.add(new GridNode(pos));
        }
        for (var x = -1; x <= size.x; x++) {
            this.walls.add(new GridNode({x:x, y:-1}));
            this.walls.add(new GridNode({x:x, y:size.y}));
        }
        for (var y = -1; y <= size.y; y++) {
            this.walls.add(new GridNode({x:-1, y:y}));
            this.walls.add(new GridNode({x:size.x, y:y}));
        }
    }

    outgoingEdges(node : GridNode) : Edge<GridNode>[] {
        var outgoing : Edge<GridNode>[] = [];
        for (var dx = -1; dx <= 1; dx++) {
            for (var dy = -1; dy <= 1; dy++) {
                if (! (dx == 0 && dy == 0)) {
                    var next = node.add({x:dx, y:dy});
                    if (! this.walls.contains(next)) {
                        outgoing.push({
                            from: node,
                            to: next,
                            cost: Math.sqrt(dx*dx + dy*dy)
                        });
                    }
                }
            }
        }
        return outgoing;
    }

    compareNodes(a : GridNode, b : GridNode) : number {
        return a.compareTo(b);
    }

    toString() : string {
        var borderRow = "+" + new Array(this.size.x + 1).join("--+");
        var betweenRow = "+" + new Array(this.size.x + 1).join("  +");
        var str = "\n" + borderRow + "\n";
        for (var y = this.size.y-1; y >= 0; y--) {
            str += "|";
            for (var x = 0; x < this.size.x; x++) {
                str += this.walls.contains(new GridNode({x:x,y:y})) ? "## " : "   ";
            }
            str += "|\n";
            if (y > 0) str += betweenRow + "\n";
        }
        str += borderRow + "\n";
        return str;
    }
}
