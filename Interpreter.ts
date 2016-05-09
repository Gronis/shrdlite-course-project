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
        // This returns a dummy interpretation involving two random objects in the world
        var objects :string[] = Array.prototype.concat.apply([], state.stacks);
        var a : string = objects[Math.floor(Math.random() * objects.length)];
        var b : string = objects[Math.floor(Math.random() * objects.length)];
        var interpretation : DNFFormula = [[
            {polarity: true, relation: "ontop", args: [a, "floor"]}
        ],[
            {polarity: true, relation: "holding", args: [b]}
        ]];

        var possibleTargets = matchObject(objects, cmd.entity.object, state);
        for (var i = possibleTargets.length - 1; i >= 0; i--) {
          console.log(state.objects[possibleTargets[i]]);
        }
        return interpretation;
    }

    function matchObject(objects : string[], target : Parser.Object, state: WorldState) : string[]{
        var possibleTargets : string[] = [];
        console.log("calling matchObj with: " + objects);
        if(target.object != undefined ){
          var tmp = matchObject(objects, target.object, state);
          console.log("Matching: " + tmp);
          for (var j = 0; j < tmp.length; j++){
              if(checkLocation(tmp[j], target.location, state)){
                possibleTargets.push(tmp[j]);
              }
          }
        } else {
          for (var i = objects.length - 1; i >= 0; i--) {
            var id = objects[i];
            var obj = state.objects[id];
            if ((target.color == null || target.color == obj.color) &&
              (target.size == null || target.size == obj.size) &&
              (target.form == "anyform" || target.form == obj.form)) {
              possibleTargets.push(id);
            }
          }
        }
        return possibleTargets;
    }

    function checkLocation(object : string, location : Parser.Location, state: WorldState) : boolean{
      console.log("Checking location: " + location + " with: " + object);
      var stacks = state.stacks;
      var objectsToCheck : string[] = [];
      var stackIndex = findStack(object, state);
      var stack = stacks[stackIndex];
      var height = findHeight(object, stack);
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
              //TODO break if not a box
          case "ontop":
              if(height > 0){
                objectsToCheck.push(stack[height - 1]);
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
      console.log("checking:" + objectsToCheck);
      return matchObject(objectsToCheck, location.entity.object, state).length > 0;
    }

    function findHeight(object: string, stack: Stack) : number{
      for (var j = 0; j < stack.length; j++) {
        if (stack[j] == object) return j;
      }
      return null;
    }

    function findStack(object : string, state: WorldState) : number{
        for (var i = 0; i < state.stacks.length; i++){
          var stack = state.stacks[i];
          for (var j = 0; j < stack.length; j++){
            if (stack[j] == object) return i;
          }
        }
        return null;
    }



}

