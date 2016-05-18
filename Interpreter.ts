///<reference path="World.ts"/>
///<reference path="Parser.ts"/>
///<reference path="lib/collections.ts"/>

/**
* Interpreter module
*
* The goal of the Interpreter module is to interpret a sentence
* written by the user in the context of the current world state. In
* particular, it must figure out which objects in the world,
* i.e. which elements in the `objects` field of WorldState, correspond
* to the ones referred to in the sentence.
*
* Moreover, it has to derive what the intended goal state is and
* return it as a logical formula described in terms of literals, where
* each literal represents a relation among objects that should
* hold. For example, assuming a world state where "a" is a ball and
* "b" is a table, the command "put the ball on the table" can be
* interpreted as the literal ontop(a,b). More complex goals can be
* written using conjunctions and disjunctions of these literals.
*
* In general, the module can take a list of possible parses and return
* a list of possible interpretations, but the code to handle this has
* already been written for you. The only part you need to implement is
* the core interpretation function, namely `interpretCommand`, which produces a
* single interpretation for a single command.
*/
module Interpreter {

    //////////////////////////////////////////////////////////////////////
    // exported functions, classes and interfaces/types

/**
Top-level function for the Interpreter. It calls `interpretCommand` for each possible parse of the command. No need to change this one.
* @param parses List of parses produced by the Parser.
* @param currentState The current state of the world.
* @returns Augments ParseResult with a list of interpretations. Each interpretation is represented by a list of Literals.
*/
    export function interpret(parses : Parser.ParseResult[], currentState : WorldState) : InterpretationResult[] {
        var errors : Error[] = [];
        var interpretations : InterpretationResult[] = [];
        parses.forEach((parseresult) => {
            try {
                var result : InterpretationResult = <InterpretationResult>parseresult;
                result.interpretation = interpretCommand(result.parse, currentState);
                interpretations.push(result);
            } catch(err) {
                errors.push(err);
            }
        });
        if (interpretations.length) {
            return interpretations;
        } else {
            // only throw the first error found
            throw errors[0];
        }
    }

    export interface InterpretationResult extends Parser.ParseResult {
        interpretation : DNFFormula;
    }

    export type DNFFormula = Conjunction[];
    type Conjunction = Literal[];

    /**
    * A Literal represents a relation that is intended to
    * hold among some objects.
    */
    export interface Literal {
	/** Whether this literal asserts the relation should hold
	 * (true polarity) or not (false polarity). For example, we
	 * can specify that "a" should *not* be on top of "b" by the
	 * literal {polarity: false, relation: "ontop", args:
	 * ["a","b"]}.
	 */
        polarity : boolean;
	/** The name of the relation in question. */
        relation : string;
	/** The arguments to the relation. Usually these will be either objects
     * or special strings such as "floor" or "floor-N" (where N is a column) */
        args : string[];
    }

    export function stringify(result : InterpretationResult) : string {
        return result.interpretation.map((literals) => {
            return literals.map((lit) => stringifyLiteral(lit)).join(" & ");
            // return literals.map(stringifyLiteral).join(" & ");
        }).join(" | ");
    }

    export function stringifyLiteral(lit : Literal) : string {
        return (lit.polarity ? "" : "-") + lit.relation + "(" + lit.args.join(",") + ")";
    }

    //////////////////////////////////////////////////////////////////////
    // private functions
    /**
     * The core interpretation function. The code here is just a
     * template; you should rewrite this function entirely. In this
     * template, the code produces a dummy interpretation which is not
     * connected to `cmd`, but your version of the function should
     * analyse cmd in order to figure out what interpretation to
     * return.
     * @param cmd The actual command. Note that it is *not* a string, but rather an object of type `Command` (as it has been parsed by the parser).
     * @param state The current state of the world. Useful to look up objects in the world.
     * @returns A list of list of Literal, representing a formula in disjunctive normal form (disjunction of conjunctions). See the dummy interpetation returned in the code for an example, which means ontop(a,floor) AND holding(b).
     */
    function interpretCommand(cmd : Parser.Command, state : WorldState) : DNFFormula {
        // A label is a string id referencing an object in the world
        var labels = Array.prototype.concat.apply(["floor"], state.stacks);
        var movableLabels : string[] = [];
        var relatableLabels : string[] = [];
        var putdown = cmd.entity == undefined;
        var pickup = cmd.location == undefined;
        var relation = pickup ? "holding" : cmd.location.relation;

        //Null check?
        var movableQuantifier : string = cmd.entity.quantifier;
        var locationQuantifier : string =
          pickup ? undefined : cmd.location.entity.quantifier;
        console.log("movableQuantifier: " + movableQuantifier)
        console.log("locationQuantifier: " + locationQuantifier)

        var getMovingLables = function() {
            return matchObject(labels, cmd.entity.object, state);
        };
        var getRelatedLabels = function() {
            return matchObject(labels, cmd.location.entity.object, state);
        };

        if (state.holding != null) labels.push(state.holding);

        if(putdown){
            movableLabels = [state.holding];
            relatableLabels = getRelatedLabels();
        } else if(pickup){
            movableLabels = getMovingLables();
        } else{
            movableLabels = getMovingLables()
            relatableLabels = getRelatedLabels();
        }

        return getDNFFormula(movableLabels, relatableLabels, relation,
           movableQuantifier, locationQuantifier, state);
    }

    /**
     * Creates a DNFFormula. Checks that the relation between objects is
     * physically correct.
     * @param The labels of the objects that could be moved
     * @param The labels of the objects that the movable objects could be related to
     * @param The relation we want to achieve between the movable and relatable objects
     * @returns A DNFFormula
     * @throws An error when no valid interpretations can be found
     */
    function getDNFFormula(movableLabels      : string[],
                           relatableLabels    : string[],
                           relation           : string,
                           movableQuantifier  : string,
                           locationQuantifier : string,
                           state           : WorldState) : DNFFormula {
        var interpretation: DNFFormula = [];
        // We cannot move or pick up the floor
        movableLabels = movableLabels.filter((label) => label != "floor");

        /* TODO: Make generic so it can build both conjunctions and
        disjunctions? Or just create the Literal in the loop and push
        directly. No need for function.*/
        function push(args : string[]){
            var lit: Literal = {
                polarity: true,
                relation: relation,
                args: args
            };
            interpretation.push([lit]);
        }


        function conjunctionToDisjunction(
          conjunction : Literal[][]) : DNFFormula {
            var dnf : DNFFormula = [];
            var formula : Literal [] = [];
            dfs(0, formula);

            function dfs(i: number, formula: Literal[]) {

              if (i < conjunction.length) {
                for (var j = 0; j < conjunction[i].length; j++) {
                  var formulaClone: Literal[] = [];
                  for (var f of formula) formulaClone.push(f);
                  formulaClone.push(conjunction[i][j])
                  dfs(i + 1, formulaClone);
                }
              } else {
                if (formula[0].relation == "inside" ||
                  formula[0].relation == "ontop") {
                  for (var i1 = 0; i1 < formula.length; i1++){
                    for (var i2 = i1 + 1; i2 < formula.length; i2++){
                      if (formula[i1].args[1] == formula[i2].args[1])
                        return;
                    }
                  }
                }
                dnf.push(formula);
              }
            }
            return dnf;
        }

        if(movableLabels.length == 0) {
          throw "Could not find any matching object."
        }

        //Only one object can be inside/ontop of another one, unless floor.
        if(movableQuantifier == "all" &&
            (relation == "ontop" || relation == "inside") &&
            !(relatableLabels.length == 1 && relatableLabels[0] == "floor")) {
          /* TODO: Add the form of destination object instead of "locations"*/
          if(locationQuantifier == "all") {
            throw "This is just silly."
          } else if(locationQuantifier == "the") {
            throw "There can only be one object ontop/inside another object."
          } else if(relatableLabels.length < movableLabels.length) {
            throw "There are not enough locations for this."
          }
        }

        //Cannot put an object insde/ontop of every destination location if
        //there are less objects to move than desination locations.
        if(locationQuantifier == "all" &&
            (relation == "ontop" || relation == "inside") &&
            movableLabels.length < relatableLabels.length) {
              /* TODO: Add form of object instead of "objects" */
              throw "There are not enough objects for this."
        }

        //Moving every every object of some type
        if(movableQuantifier == "all") {
          //To any location of some type.
          //Build conjunction of disjunctions.
          if(locationQuantifier == "any") {
            var conjunction : Literal[][] = [];
            //Build disjunction
            for(var i = 0; i < movableLabels.length; i++) {
              var disjunction : Literal[] = [];
              var ml = movableLabels[i];
              for(var j = 0; j < relatableLabels.length; j++) {
                var rl = relatableLabels[j];
                if(isPhysicallyCorrect(ml, rl, relation, state)) {
                  var lit : Literal = {polarity: true, relation: relation,
                    args: [ml, rl]};
                  disjunction.push(lit);
                }
              }
              //Build conjunction of disjunctions
              if(disjunction.length > 0) conjunction.push(disjunction);
            }
            console.log(conjunction.map((literals) =>
                literals.map(Interpreter.stringifyLiteral).sort().join(" | "))
                .sort().join(" & "));
            //Convert to DNF before returning.
            interpretation = conjunctionToDisjunction(conjunction);

          } else if(relation == "holding") {
            if(movableLabels.length > 1) {
              throw "I can only hold one object."
            } else {
              var lit : Literal =
                {polarity: true, relation: relation, args: [ml]};
                interpretation.push([lit]);
            }

          } else {
            //To a specific location or in relation to all objects of some type
            //Build conjunction formula.
            var formula : Literal[] = [];
            for (var i = movableLabels.length - 1; i >= 0; i--) {
                var ml = movableLabels[i];
                for (var j = relatableLabels.length - 1; j >= 0; j--) {
                    var rl = relatableLabels[j];
                    if (isPhysicallyCorrect(ml, rl, relation, state)){
                        var lit : Literal = {polarity:true, relation: relation,
                            args: [ml, rl]};
                        //Add conjunction till formula.
                        formula.push(lit);
                    }
                }
            }
            interpretation.push(formula);

          }
          //Move any, or a specific object of some type
        } else if(movableQuantifier == "any" || movableQuantifier == "the") {
          //To
          if(locationQuantifier == "all") {
            var conjunction: Literal[][] = [];
            //Build disjunction
            for (var j = 0; j < relatableLabels.length; j++) {
              var disjunction: Literal[] = [];
              var rl = relatableLabels[j];
              for (var i = 0; i < movableLabels.length; i++) {
                var ml = movableLabels[i];
                if (isPhysicallyCorrect(ml, rl, relation, state)) {
                  var lit: Literal = {
                    polarity: true, relation: relation,
                    args: [ml, rl]
                  };
                  disjunction.push(lit);
                }
              }
              //Build conjunction of disjunctions
              if (disjunction.length > 0) conjunction.push(disjunction);
            }
            console.log(conjunction.map((literals) =>
              literals.map(Interpreter.stringifyLiteral).sort()
              .join(" | ")).sort().join(" & "));
            //Convert to DNF before returning.
            interpretation = conjunctionToDisjunction(conjunction);

          }
        } else {
          for (var i = movableLabels.length - 1; i >= 0; i--) {
              var ml = movableLabels[i];
              if (relation == "holding") {
                var lit : Literal = {polarity:true, relation: relation,
                    args: [ml]};
                interpretation.push([lit]);
              } else {
                  for (var j = relatableLabels.length - 1; j >= 0; j--) {
                      var rl = relatableLabels[j];
                      if (isPhysicallyCorrect(ml, rl, relation, state)){
                        var lit : Literal = {polarity:true, relation: relation,
                            args: [ml, rl]};
                        //Add disjunction to formula.
                        interpretation.push([lit]);
                      }
                  }
              }
          }
        }

        if (interpretation.length == 0) {
            throw "No interpretation was found";
        } else if (movableQuantifier == "the" && interpretation.length > 1) {
            /* TODO: Do something funny here. Throw exception and catch in
             interpretCommand? Or just check the same condition after call
             to getDNF in interpretCommand? */
             //throw "ambiguous result";
            return interpretation;
        } else {
            return interpretation;
        }
    }

    // Returns the objectdefinition of the floor.
    function getFloor(): ObjectDefinition {
        return {
            color: null,
            size: null,
            form: "floor"
        };
    }

    /**
     * Finds all labels that match the target.
     * @param List of all labels to be matched against target
     * @param The target to match against
     * @param The state of the world
     * @returns A subset of param labels, such that they match the target
     */
    function matchObject(
      lables : string[], target : Parser.Object, state: WorldState) : string[]{
        var possibleTargets : string[] = [];
        var continueRecursivly = target.object != undefined;

        if(continueRecursivly){
            var matchingObjs = matchObject(lables, target.object, state);
            for (var j = 0; j < matchingObjs.length; j++){
                var matchingObj = matchingObjs[j];
                if(checkRelation(matchingObj, target.location, state)){
                    possibleTargets.push(matchingObj);
                }
            }
        } else { // Match object specifications
          for (var i = lables.length - 1; i >= 0; i--) {
            var label  = lables[i];
            var object = label == "floor"? getFloor() : state.objects[label];
            if ((target.color == null      || target.color == object.color) &&
                (target.size  == null      || target.size  == object.size)  &&
                (target.form  == "anyform" || target.form  == object.form)) {
                possibleTargets.push(label);
            }
          }
        }
        return possibleTargets;
    }

    /**
     * Checks if object fullfils the location.
     */
    function checkRelation(
      label : string, location : Parser.Location, state: WorldState) : boolean{

      if (label == "floor") return false;
      if (state.holding == label) return false;
      var stacks = state.stacks;
      var objectsToCheck : string[] = [];
      var stackIndex = findStack(label, state);
      var stack = stacks[stackIndex];
      var height = findHeight(label, stack);
      switch(location.relation){
          case "leftof":
              for (var i = stackIndex + 1; i < stacks.length; i++) {
                objectsToCheck = objectsToCheck.concat(stacks[i]);
              }
              break;
          case "rightof":
              for (var i = 0; i < stackIndex; i++){
                objectsToCheck = objectsToCheck.concat(stacks[i]);
              }
              break;
          case "inside":
              if (height > 0 && state.objects[stack[height-1]].form == "box") {
                  objectsToCheck.push(stack[height - 1]);
              }
              break;
          case "ontop":
              if(height > 0){
                  objectsToCheck.push(stack[height - 1]);
              } else if(location.entity.object.form == "floor"){
                  objectsToCheck.push("floor");
              }
              break;
          case "under":
              for (var i = height + 1; i < stack.length; i++) {
                  objectsToCheck.push(stack[i]);
              }
              break;
          case "beside":
              if(stackIndex > 0){
                objectsToCheck = objectsToCheck.concat(stacks[stackIndex - 1]);
              }
              if (stackIndex < stacks.length - 1) {
                objectsToCheck = objectsToCheck.concat(stacks[stackIndex + 1]);
              }
              break;
          case "above":
              for (var i = 0; i < height; i++) {
                objectsToCheck.push(stack[i]);
              }
              break;
      }
      return matchObject(objectsToCheck,location.entity.object,state).length>0;
    }

    // Finds which stack the object is in.
    export function findStack(label : string, state: WorldState) : number{
        for (var i = 0; i < state.stacks.length; i++){
          var stack = state.stacks[i];
          for (var j = 0; j < stack.length; j++){
            if (stack[j] == label) return i;
          }
        }
        //console.log("Cannot find stack of label: " + label + " stacks: " + JSON.stringify(state.stacks));
        return state.arm;
    }

    // Finds the height of an label in the given stack.
    export function findHeight(label: string, stack: Stack) : number{
      for (var j = 0; j < stack.length; j++) {
        if (stack[j] == label) return j;
      }
      return -1;
    }

    /**
     * Checks if for two different objects the relation between them is
     * physically correct.
     */
    export function isPhysicallyCorrect(label1: string,
                                 label2: string,
                                 relation: string,
                                 state: WorldState): boolean {
        var object1 = label1 == "floor"? getFloor() : state.objects[label1];
        var object2 = label2 == "floor"? getFloor() : state.objects[label2];
        var f1 = object1.form;
        var f2 = object2.form;
        var s1 = object1.size;
        var s2 = object2.size;
        var result = label1 != label2;
        switch (relation) {
            case "inside":
                if (f2 != "box")
                    result = false;
                if ((f1 == "box" || f1 == "pyramid" || f1 == "plank") &&
                    (s2 == s1 || s2 == "small"))
                    result = false;
                if (s2 == "small" && s1 == "large")
                    result = false;
                break;
            case "ontop":
                if (f2 == "box")
                    result = false;
                if (s2 == "small" && s1 == "large")
                    result = false;
                if (f2 == "ball")
                    result = false;
                if (f1 == "ball" && f2 != "floor" && f2 != "box")
                    result = false;
                if (s1 == "small" && f1 == "box" && s2 == "small" &&
                    (f2 == "brick" || f2 == "pyramid"))
                    result = false;
                if (s1 == "large" && f1 == "box" &&
                    s2 == "large" && f2 == "pyramid")
                    result = false;
                break;
            case "under":
                if (f1 == "ball")
                    result = false;
                break;
            case "above":
                if (f2 == "ball")
                    result = false;
                if (s1 == "large" && s2 == "small")
                    result = false;
                break;
        }
        return result;
    }
}
