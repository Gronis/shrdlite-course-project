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
        var objects :string[] = Array.prototype.concat.apply([], state.stacks);
        var interpretation: DNFFormula = [];

        for (var i = 0; i < objects.length; i++){
          console.log(objects[i])
          console.log(state.objects[objects[i]]);
        }

        objects.push("floor");

        if(cmd.entity == undefined){
          var targetObj = state.holding;
          var targetLocations = matchObject(objects, cmd.location.entity.object, state);
          for (var j = targetLocations.length - 1; j >= 0; j--) {
              var targetLoc = targetLocations[j];
              var lit: Literal = { polarity: true, relation: cmd.location.relation, args: [targetObj, targetLoc] };
              interpretation.push([lit]);
          }
        } else if(cmd.location == undefined){
          if(cmd.entity.object.object == undefined && cmd.entity.object.form == "floor") {
            return null;
          }
          var possibleTargets = matchObject(objects, cmd.entity.object, state);
          for (var i = possibleTargets.length - 1; i >= 0; i--) {
            var targetObj = possibleTargets[i];
            var lit: Literal = { polarity: true, relation: "holding", args: [targetObj] };
            interpretation.push([lit]);
          }
        } else{
          if(cmd.entity.object.object == undefined && cmd.entity.object.form == "floor") {
            return null;
          }
          var possibleTargets = matchObject(objects, cmd.entity.object, state);
          var targetLocations = matchObject(objects, cmd.location.entity.object, state);
          if(possibleTargets.length == 0 || targetLocations.length == 0) {
            console.log("Return: null");
            return null;
          }
          for (var i = possibleTargets.length - 1; i >= 0; i--) {
            var targetObj = possibleTargets[i];
            for (var j = targetLocations.length - 1; j >= 0; j--) {
              var targetLoc = targetLocations[j];
              if(targetObj != targetLoc && fullfilsPhysicalLaws(targetObj, targetLoc,cmd.location.relation,state)) {

                  console.log("target obj: " + targetObj + " target loc " + j + ": " + targetLoc);
                var lit: Literal = { polarity: true, relation: cmd.location.relation, args: [targetObj, targetLoc] };
                interpretation.push([lit]);
              }
            }
          }
        }
        console.log(interpretation.map((literals) => literals.map(Interpreter.stringifyLiteral).sort().join(" & ")).sort().join(" | "));
        //console.log(interpretation);
        return interpretation;
    }

    function matchObject(objects : string[], target : Parser.Object, state: WorldState) : string[]{
        var possibleTargets : string[] = [];
        console.log("Matching Obj: {" + target.object + ", " + target.size+ ", " + target.color+ ", " + target.form + "} [" + objects + "]");
        if(target.object != undefined ){
          var tmp = matchObject(objects, target.object, state);
          console.log("Found matching: " + tmp);
          for (var j = 0; j < tmp.length; j++){
              if(checkLocation(tmp[j], target.location, state)){
                possibleTargets.push(tmp[j]);
              }
          }
        } else {
          for (var i = 0; i < objects.length; i++) {
            var id = objects[i];
            console.log("Matching " + id + " to " + target.form);
            if(id == "floor") {
                if (target.form == "floor"){
                    possibleTargets.push("floor");
                    console.log("Mid pos targets: " + possibleTargets)
                    return possibleTargets;
                }
            } else {
              var obj = state.objects[id];
              if ((((target.color == null || target.color == obj.color) &&
                (target.size == null || target.size == obj.size) &&
                (target.form == "anyform" || target.form == obj.form)))) {
                possibleTargets.push(id);
              }
            }
          }
        }
        console.log("Possible targets: " + possibleTargets);
        return possibleTargets;
    }

    function checkLocation(obj : string, location : Parser.Location, state: WorldState) : boolean{
      console.log("Checking location: '" + location.relation + "' with: " + obj);
      var stacks = state.stacks;
      var objectsToCheck : string[] = [];
      var stackIndex = findStack(obj, state);
      var stack = stacks[stackIndex];
      var height = findHeight(obj, stack);
      var object = state.objects[obj];
      if(obj == "floor") {
        return false;
      }
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
              if(height > 0){
                objectsToCheck.push(stack[height - 1]);
              }
              break;
          case "ontop":
              if(height > 0){
                objectsToCheck.push(stack[height - 1]);
              } else {
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
      console.log("Objects to check:" + objectsToCheck);
      var objs = matchObject(objectsToCheck, location.entity.object, state);
      for (var i = objs.length - 1; i >= 0; i--) {
          //if (fullfilsPhysicalLaws(obj, objs[i], location.relation, state)){
              return true;
          //}
      }
      return false;
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

    function fullfilsPhysicalLaws(objLabel1 : string, objLabel2 : string, relation : string, state : WorldState) : boolean {
        var object1: ObjectDefinition = state.objects[objLabel1];
        var object2: ObjectDefinition = state.objects[objLabel2];
        var f1 = object1.form;
        var f2 = object2.form;
        var s1 = object1.size;
        var s2 = object2.size;
        if (f2 == undefined) f2 = objLabel2;
        var result = true;
        switch (relation) {
            case "inside":
                if (f2 != "box")
                    result = false;
                if ((f1 == "box" || f1 == "pyramid" || f1 == "plank") &&
                    (s2 == s1 || s2 == "small"))
                    result = false;
                if (s2 == "small" && s1 == "large")
                    result = false;
                if(!result){
                    console.log(objLabel1 + " cannot be inside " + objLabel2);
                }
                break;
            case "ontop":
                if (s2 == "small" && s1 == "large")
                    result = false;
                if (f2 == "ball")
                    result = false;
                if (f1 == "ball" && (f2 != "floor" || f2 != "box"))
                    result = false;
                if (s1 == "small" && f1 == "box" && s2 == "small" &&
                    (f2 == "brick" || f2 == "pyramid"))
                    result = false;
                if (s1 == "large" && f1 == "box" &&
                    s2 == "large" && f2 == "pyramid")
                    result = false;
                if (!result) {
                    console.log(objLabel1 + " cannot be on top " + objLabel2);
                }
                break;
            case "under":
                if (f1 == "ball")
                    result = false;
                break;
            case "above":
                if (f2 == "ball")
                    result = false;
                break;
        }
        return result;
    }
}
