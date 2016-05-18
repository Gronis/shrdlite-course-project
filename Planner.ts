///<reference path="World.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Graph.ts"/>
///<reference path="lib/collections.ts"/>

/**
* Planner module
*
* The goal of the Planner module is to take the interpetation(s)
* produced by the Interpreter module and to plan a sequence of actions
* for the robot to put the world into a state compatible with the
* user's command, i.e. to achieve what the user wanted.
*
* The planner should use your A* search implementation to find a plan.
*/
module Planner {

    /**
     * Top-level driver for the Planner. Calls `planInterpretation` for each given interpretation generated by the Interpreter.
     * @param interpretations List of possible interpretations.
     * @param currentState The current state of the world.
     * @returns Augments Interpreter.InterpretationResult with a plan represented by a list of strings.
     */
    export function plan(interpretations : Interpreter.InterpretationResult[], currentState : WorldState) : PlannerResult[] {
        var errors : Error[] = [];
        var plans : PlannerResult[] = [];
        interpretations.forEach((interpretation) => {
            try {
                var result : PlannerResult = <PlannerResult>interpretation;
                result.plan = planInterpretation(result.interpretation, currentState);
                if (result.plan.length == 0) {
                    result.plan.push("That is already true!");
                }
                plans.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (plans.length) {
            return plans;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface PlannerResult extends Interpreter.InterpretationResult {
        plan : string[];
    }

    export function stringify(result : PlannerResult) : string {
        return result.plan.join(", ");
    }

    class SearchNode{
        constructor(state : WorldState, action : string){
            this.state = state;
            this.action = action;
        }
        state: WorldState;
        action: string;
    }

    class ClonedWorld implements WorldState{
        constructor(state : WorldState){
            this.stacks = [];
            this.holding = state.holding;
            this.arm = state.arm;
            this.objects = state.objects;
            this.examples = state.examples;
            for(var stack of state.stacks){
                var clonedStack : string[] = [];
                for(var label of stack){
                    clonedStack.push(label);
                }
                this.stacks.push(clonedStack);
            }
        }

        moveLeft() : string{
            this.arm -= 1;
            return "l";
        }

        moveRight() : string{
            this.arm += 1;
            return "r";
        }

        drop() : string{
            var stack = this.stacks[this.arm];
            stack.push(this.holding);
            this.holding = null;
            return "d";
        }

        pickup() : string{
            var stack = this.stacks[this.arm];
            this.holding = stack.pop();
            return "p";
        }

        stacks: Stack[];
        holding: string;
        arm: number;
        objects: { [s: string]: ObjectDefinition; };
        examples: string[];
    }

    class SearchGraph implements Graph<SearchNode>{
        outgoingEdges(node: SearchNode): Edge<SearchNode>[]{
            var state = node.state;
            var outEdges: Edge<SearchNode>[] = [];
            var armpos = state.arm;

            function addEdge(state : WorldState, actionFunc : (s : ClonedWorld) => string){
                var edge = new Edge<SearchNode>();
                var clonedState = new ClonedWorld(state);
                var action = actionFunc(clonedState);
                var toNode = new SearchNode(clonedState, action);
                edge.from = node;
                edge.to = toNode;
                edge.cost = 1;
                outEdges.push(edge);
            }

            if(armpos > 0) addEdge(state, cs => cs.moveLeft());
            if(armpos < node.state.stacks.length - 1) addEdge(state, cs => cs.moveRight());
            if (node.state.holding == null){
                if(canPickup(node.state)) addEdge(state, cs => cs.pickup())
            } else {
                if(canDrop(node.state)) addEdge(state, cs => cs.drop());
            }
            return outEdges;
        }

        compareNodes: collections.ICompareFunction<SearchNode> =
        function(node1 : SearchNode, node2 : SearchNode) : number{
            var stacks1 = node1.state.stacks;
            var stacks2 = node2.state.stacks;
            if (node1.state.arm != node2.state.arm) return -1;
            if (stacks1.length != stacks2.length) return -1;
            for(var i in stacks1){
                var stack1 = stacks1[i];
                var stack2 = stacks2[i];
                if (stack1.length != stack2.length) return -1;
                for(var j in stack1){
                    if (stack1[j] != stack2[j]) return -1;
                }
            }
            return 0;
        }
    }

    function canDrop(state: WorldState) : boolean{
        var stack = state.stacks[state.arm];
        var topLabel = stack.length == 0? "floor" : stack[stack.length - 1];
        var isPhysicallyCorrect = Interpreter.isPhysicallyCorrect;
        return isPhysicallyCorrect(state.holding, topLabel, "ontop", state) ||
               isPhysicallyCorrect(state.holding, topLabel, "inside", state);
    }

    function canPickup(state: WorldState): boolean{
        return state.stacks[state.arm].length > 0;
    }

    function isLitTrue(literal: Interpreter.Literal, state : WorldState) {
        var label1 = literal.args[0];
        if(literal.relation == "holding"){
            return (label1 == state.holding) == literal.polarity;
        }
        if(label1 == state.holding){
            return false;
        }
        var stacks = state.stacks;
        var label2 = literal.args[1];
        var stackIndex = Interpreter.findStack(label1, state);
        var stack = stacks[stackIndex];
        var heightLabel1 = Interpreter.findHeight(label1, stack);
        switch (literal.relation) {
            case "leftof":
                for (var i = stackIndex + 1; i < stacks.length; i++) {
                    for(var l of stacks[i]){
                        if (l == label2) return literal.polarity;
                    }
                }
                return !literal.polarity;
            case "rightof":
                for (var i = 0; i < stackIndex; i++) {
                    for (var l of stacks[i]) {
                        if (l == label2) return literal.polarity;
                    }
                }
                return !literal.polarity;
            case "inside":
            case "ontop":
                return ((heightLabel1 > 0 && stack[heightLabel1 - 1] == label2) ||
                        (heightLabel1 == 0 && label2 == "floor")) == literal.polarity;
            case "under":
                for (var i = heightLabel1 + 1; i < stack.length; i++) {
                    if (stack[i] == label2) return literal.polarity;
                }
                return !literal.polarity;
            case "beside":
                if (stackIndex > 0) {
                    var leftStack = stacks[stackIndex - 1];
                    for (var i = 0; i < leftStack.length; i++){
                        if (leftStack[i] == label2) return literal.polarity;
                    }
                }
                if (stackIndex < stacks.length - 1) {
                    var rightStack = stacks[stackIndex + 1];
                    for (var i = 0; i < rightStack.length; i++) {
                        if (rightStack[i] == label2) return literal.polarity;
                    }
                }
                return !literal.polarity;
            case "above":
                for (var i = 0; i < heightLabel1; i++) {
                    if (stack[i] == label2) return literal.polarity;
                }
                return !literal.polarity;
        }
        return !literal.polarity;
    }

    function manhattanDistance(literal :Interpreter.Literal, state:WorldState){
        if (isLitTrue(literal, state)) return 0;
        var label1 = literal.args[0];
        if(literal.relation == "holding")
            return costToExpose(label1) + costMovingTo(label1) + 1;
        var stacks = state.stacks;
        var arm = state.arm;
        var label2 = literal.args[1];

        function stepsBetween(l1 : string, l2: string){
            var si1 = l1 == "floor" ? indexOfFloor() : Interpreter.findStack(l1, state);
            var si2 = l2 == "floor" ? indexOfFloor() : Interpreter.findStack(l2, state);
            return Math.abs(si1 - si2);
        }

        function costMovingTo(label : string){
            if (label == state.holding) return 0;
            var stackIndex = label == "floor" ? indexOfFloor() :  Interpreter.findStack(label, state);
            return Math.abs(arm - stackIndex);
        }

        function costToExpose(label : string) : number{
            if (label == state.holding) return 0;
            var stacks = state.stacks;
            if (label == "floor")
                return 4 * stacks[indexOfFloor()].length + state.holding == null ? -1 : 0;
            var stackIndex = Interpreter.findStack(label, state);
            var stack = stacks[stackIndex];
            var heightLabel1 = Interpreter.findHeight(label1, stack);
            return 4 * (stack.length - heightLabel1) - 1;
        }

        // Finds the stack index where the floor is easiest to access from the
        // arm's current location.
        function indexOfFloor() : number{
            var cost = Infinity;
            var index = -1;
            for (var i = 0; i < stacks.length; i++){
                var stackCost = Math.abs(arm - i) + 4 * stacks[i].length - 1;
                if (stackCost < cost){
                    cost = stackCost;
                    index = i;
                }
            }
            return index;
        }

        function isInSameStack(l1 : string, l2 : string){
            var si1 = l1 == "floor" ? indexOfFloor() : Interpreter.findStack(l1, state);
            var si2 = l2 == "floor" ? indexOfFloor() : Interpreter.findStack(l2, state);
            return si1 == si2;
        }

        switch (literal.relation) {
            case "leftof":
            case "rightof":
                return stepsBetween(label1, label2) + 1 +
                       Math.min(costToExpose(label1) + costMovingTo(label1),
                                costToExpose(label2) + costMovingTo(label2));
            case "inside":
            case "ontop":
                return Math.min(costMovingTo(label1), costMovingTo(label2)) +
                       stepsBetween(label1, label2) + 1 +
                       (isInSameStack(label1, label2) ?
                          Math.max(costToExpose(label1),costToExpose(label2)) :
                          costToExpose(label1) + costToExpose(label2));
            case "beside":
                return Math.min(costMovingTo(label1) + costToExpose(label1),
                                costMovingTo(label2) + costToExpose(label2)) +
                       stepsBetween(label1,label2) - 1;
            case "under":
                return costMovingTo(label2) + costToExpose(label2) +
                       stepsBetween(label2, label1);
            case "above":
                return costMovingTo(label1) + costToExpose(label1) +
                       stepsBetween(label1, label2);
        }
        return 0;
    }

    function minimalInfo(label: string, state : WorldState) : string{
        if (label == "floor") return label;
        var obj = state.objects[label];
        var labels = Array.prototype.concat.apply([], state.stacks);
        if (state.holding != null) labels.push(state.holding);
        var checks = [ {size: null, color: null, form: obj.form},
                       {size: obj.size, color : null, form : obj.form},
                       {size: null, color : obj.color, form : obj.form},
                       {size: obj.size, color : obj.color, form : obj.form} ];
        function stringify(c : ObjectDefinition) : string{
            return (c.size == null? "" : (c.size + " ")) +
                   (c.color == null? "" : (c.color + " ")) +
                   c.form;
        }
        for (var i = 0; i < checks.length; i++){
            var c = checks[i]
            if (Interpreter.filterLabels(labels, c.size, c.color, c.form, state).length == 1)
              return stringify(c);
        }
        // cannot find an individual object based on size, color and form
        return stringify(checks[3]);
    }

    /**
     * @param interpretation The logical interpretation of the user's desired goal. The plan needs to be such that by executing it, the world is put into a state that satisfies this goal.
     * @param state The current world state.
     * @returns A plan of movements (l,r,p,d).
     */
    function planInterpretation(interpretation : Interpreter.DNFFormula, state : WorldState) : string[] {
        var plan : string[] = [];
        var graph: Graph<SearchNode> = new SearchGraph;
        var startNode: SearchNode = new SearchNode(state, null);

        function goal(node : SearchNode) : boolean{
            for(var conjunction of interpretation){
                var conjunctionResult = true;
                for(var literal of conjunction){
                    if (!isLitTrue(literal, node.state)) {
                        conjunctionResult = false;
                    }
                }
                if (conjunctionResult) return true;
            }
            return false;
        }

        function heuristics(node: SearchNode): number {
            var disjunctionHeur = Infinity;
            for (var conjunction of interpretation) {
                var conjunctionHeur = 0;
                for (var literal of conjunction) {
                    var heuristic = manhattanDistance(literal, node.state);
                    if (heuristic > conjunctionHeur) {
                        conjunctionHeur = heuristic;
                    }
                }
                if(conjunctionHeur < disjunctionHeur){
                    disjunctionHeur = conjunctionHeur;
                }
            }
            return disjunctionHeur;
        }

        var result = aStarSearch(graph, startNode, goal, heuristics, 10);

        for(var r of result.path){
            plan.push(r.action);
            var label = r.state.holding;
            if (r.action == "p"){
                plan.push("Moving the " + minimalInfo(label, state));
            }
        }
        return plan;
    }
}
