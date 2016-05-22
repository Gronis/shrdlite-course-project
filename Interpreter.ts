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
        var movableQuantifier : string = putdown? "any" : cmd.entity.quantifier;
        var locationQuantifier : string =
          pickup ? undefined : cmd.location.entity.quantifier;

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
            if(movableLabels.length == 0) {
              var obj = cmd.entity.object;
              var form = (obj.form == "anyform") ? "object" : obj.form;
              var col = (obj.color == undefined) ? "" : obj.color + " ";
              var size = (obj.size == undefined) ? "" : obj.size + " ";
              throw "There is no " + size + col + form + ".";
            }
            if(movableQuantifier == "all" && movableLabels.length > 1) {
              throw "I can only hold one object."
            }
        } else {
            movableLabels = getMovingLables()
            relatableLabels = getRelatedLabels();

            //Check if parse is valid and filter any objects is need to make the
            //parse physically possible to perform.
            var updatedLabels = validateParse(cmd, movableLabels, relatableLabels, state)
            movableLabels = updatedLabels.movableLabels;
            relatableLabels = updatedLabels.relatableLabels;
            /*TODO: Ta ut de faktiska */
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

        function disjunctionToString(disjunction: Literal[]): string {
          var str : string = "";
          for(var k = 0; k < disjunction.length; k++) {
            str += stringifyLiteral(disjunction[k]);
            if(k != disjunction.length -1) {
              str += " | "
            }
          }
          return str;
        }

        function conjunctionToString(conjunction: Literal[]): string {
          var str : string = "";
          for(var k = 0; k < conjunction.length; k++) {
            str += stringifyLiteral(conjunction[k]);
            if(k != conjunction.length - 1) {
              str += " & "
            }
          }
          return str;
        }

        /* Combines all labels from two lists to create a disjunction of all
        combinations. */
        function buildDisjunction(
            labels1: string[], labels2: string[]) : DNFFormula {
          var dnf : DNFFormula = [];
          for (var i = 0; i < labels1.length; i++) {
            var l1 = labels1[i];
            for(var j = 0; j < labels2.length; j++) {
              var l2 = labels2[j];
                if(isPhysicallyCorrect(l1, l2, relation, state)) {
                  var lit : Literal = {polarity: true, relation: relation,
                    args: [l1, l2]};
                  dnf.push([lit]);
                }
            }
          }
          return dnf;
        }

        function cnfToString(cnf : Literal[][]) : string {
          var str = "";
          for(var i = 0; i < cnf.length; i++) {
            var disjunction : Literal[] = cnf[i];
            for(var j = 0; j < disjunction.length; j++) {
              var lit : Literal = disjunction[j];
              str += stringifyLiteral(lit);
              if(j != disjunction.length - 1)
                str += " | ";
            }
            if(i != cnf.length - 1)
              str += " & "
          }
          return str;
        }

        function buildCNF(
            labels1: string[], labels2: string[], reversedLocation: boolean)
              : Literal[][] {
          var cnf : Literal[][] = [];
          for(var i = 0; i < labels1.length; i++) {
            var l1 = labels1[i];
            var disjunction : Literal[] = [];
            for(var j = 0; j < labels2.length; j++) {
              var l2 = labels2[j];
              if(reversedLocation) {
                if(isPhysicallyCorrect(l2, l1, relation, state)) {
                  var lit : Literal =
                      {polarity: true, relation: relation, args: [l2, l1]};
                  disjunction.push(lit);
                }

              } else {
                if(isPhysicallyCorrect(l1, l2, relation, state)) {
                  var lit : Literal =
                      {polarity: true, relation: relation, args: [l1, l2]};
                  disjunction.push(lit);
                }
              }
            }
            if(disjunction.length > 0)
              cnf.push(disjunction);
          }
          return cnf;
        }

        /* Combines all labels from two lists to create a conjunction of all
        combinations. */
        function buildConjunction(
            labels1: string[], labels2: string[]) : Conjunction {

          var conjunction : Conjunction = [];
          for(var i = 0; i < labels1.length; i++) {
            var l1 = labels1[i];
            for(var j = 0; j < labels2.length; j++) {
              var l2 = labels2[j];
              if(isPhysicallyCorrect(l1, l2, relation, state)) {
                var lit : Literal = {polarity: true, relation: relation,
                  args: [l1, l2]};
                conjunction.push(lit);
              }
            }
          }
          return conjunction;
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

        //Moving every every object of some type
        if(movableQuantifier == "all") {
          //To any location of some type.
          if(locationQuantifier == "any") {
            var cnf : Literal[][] = [];
            //Build conjunction of disjunctions and convert to DNF.
            cnf = buildCNF(movableLabels, relatableLabels, false);
            interpretation = conjunctionToDisjunction(cnf);
          } else if(relation == "holding") {
              //If only one such object exists, pick it up.
              var ml = movableLabels[0];
              var lit : Literal =
                {polarity: true, relation: relation, args: [ml]};
                interpretation.push([lit]);
          } else {
            //To a specific location or in relation to all objects of some type
            var conj : Conjunction
              = buildConjunction(movableLabels, relatableLabels);
            interpretation.push(conj);
          }
        }
        //Move any, or a specific object of some type
        else if(movableQuantifier == "any" || movableQuantifier == "the") {
          if(locationQuantifier == "all") {
            //Build conjunction of disjunctions
            var cnf: Literal[][] = [];
            cnf = buildCNF(relatableLabels, movableLabels, true);
            //Convert to DNF before returning.
            interpretation = conjunctionToDisjunction(cnf);

            //Build disjunction
          } else {
              if(relation == "holding") {
                for(var i = 0; i < movableLabels.length; i++) {
                  var ml = movableLabels[i];
                  var lit : Literal =
                      {polarity: true, relation: relation, args: [ml]};
                  interpretation.push([lit]);
                }
              } else {
                var dnf = buildDisjunction(movableLabels, relatableLabels);
                interpretation = dnf;
              }
          }
        }

        if (interpretation.length == 0) {
            throw "No interpretation was found";
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
      labels : string[], target : Parser.Object, state: WorldState) : string[]{

        var possibleTargets : string[] = [];
        var continueRecursivly = target.object != undefined;

        if(continueRecursivly){
            var rel  = target.location.relation;
            var obj1 = target.object;
            var obj2 = target.location.entity.object;
            var quantifier = target.location.entity.quantifier;
            //validateRelation(obj1, obj2, rel, quantifier);
            var matchingObjs = matchObject(labels, target.object, state);
            for (var j = 0; j < matchingObjs.length; j++){
                var matchingObj = matchingObjs[j];
                if(checkRelation(matchingObj, target.location, state)){
                    possibleTargets.push(matchingObj);
                }
            }
        } else { // Match object specifications
          return filterLabels(labels, target.size,
                 target.color, target.form, state);
        }
        if(possibleTargets.length == 0) {
          var f1 = (obj1.form == "anyform")? "object " : obj1.form + " ";
          if(quantifier == "all") {
            var f2 = getPlural(obj2.form);
          } else {
              var f2 = (obj2.form == "anyform")? "object " : obj2.form + " ";
          }
          var s1 = (obj1.size == undefined)? "" : obj1.size + " ";
          var s2 = (obj2.size == undefined)? "" : obj2.size + " ";
          var c1 = (obj1.color == undefined)? "" : obj1.color + " ";
          var c2 = (obj2.color == undefined)? "" : obj2.color + " ";
          var prettyRel = "";
          switch(rel) {
            case "inside":
              prettyRel = "inside of "
              break;
            case "ontop":
              prettyRel = "on top of "
              break;
            case "leftof":
              prettyRel = "to the left of "
              break;
            case "rightof":
              prettyRel = "to the right of "
              break;
            case "under" || "above":
              prettyRel = rel + " ";
              break;

          }
            throw "There is no " + s1 + c1 + f1 + prettyRel + quantifier + " " + s2 + c2 + f2 + "."
        } else {
            return possibleTargets;
        }
    }

    function getPlural(form : string) : string {
      switch(form) {
        case "anyform":
          return "objects"
        case "box":
          return "boxes";
        case "ball":
          return "balls";
        case "pyramid":
          return "pyramids";
        case "table":
          return "tables";
        case "brick":
          return "bricks";
        case "plank":
          return "planks";
        default:
          return form + "s";
      }
    }

    /* Throws an error if the relation between object1 and object2 breaks any
    physical laws. */
    function validateRelation(object1 : Parser.Object, object2 : Parser.Object,
        rel : string, quantifier : string) {

          var f1 = object1.form;
          var f2 = object2.form;
          var s1 = object1.size;
          var s2 = object2.size;
          //console.log("validateRelation: " + s1 + " " + f1 + " " + rel + " " + quantifier + " " + s2 + " " + f2)
          switch(rel) {
            case "inside":
              if(f2 != "box") {
                throw "An object can only be inside of a box."
              }
              if ((f1 == "box" || f1 == "pyramid" || f1 == "plank") &&
                  (s2 == s1 || s2 == "small"))
                  throw "Boxes can only a " + f1 + " of smaller size than itself."
              if (s2 == "small" && s1 == "large")
                  throw "Small boxes cannot contain large objects."
              if(quantifier == "all") {
                var obj = (f1 == "anyform") ? "object" : f1;
                throw "A " + obj + " that is inside of several boxes, this is not physically possible."
              }
              break;
            case "ontop":
              if (f2 == "box") {
                  var tempF = (f1 == "anyform")? "Objects" : "A " + f1;
                  throw tempF +" cannot be on top of a box, only inside it."
              }
              if (s2 == "small" && s1 == "large") {
                  var tempF2 = (f2 == "anyform")? "objects" : f2 + "s";
                  var tempF1 = (f1 == "anyform")? "objects" : f1 + "s";
                  throw "Small " + tempF2 + " cannot support large " + tempF1 + "."
              }
              if (f2 == "ball")
                  throw "Balls cannot support other objects."
              if (f1 == "ball" && f2 != "floor" && f2 != "box")
                  throw "Balls must be in boxes or on the floor."
              if (s1 == "small" && f1 == "box" && s2 == "small" &&
                  (f2 == "brick" || f2 == "pyramid"))
                  throw "Small boxes cannot be supported by small bricks or pyramids."
              if (s1 == "large" && f1 == "box" &&
                  s2 == "large" && f2 == "pyramid")
                  throw "Large boxes cannot be supported by large pyramids."
              if(quantifier == "all") {
                throw "An object can only be directly on top of one other object."
              }
              break;
          }
    }

    export function filterLabels(labels : string[], size: string,
      color : string, form : string, state : WorldState) : string[]{

      var filteredLabels: string[] = [];
      for (var i = labels.length - 1; i >= 0; i--) {
        var label = labels[i];
        var object = label == "floor" ? getFloor() : state.objects[label];
        // floor is not an "object"
        if (label == "floor" && form == "anyform") continue;
        if ((color == null || color == object.color) &&
          (size == null || size == object.size) &&
          (form == "anyform" || form == object.form)) {
          filteredLabels.push(label);
        }
      }
      return filteredLabels;
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

      /*If the quantifier is "all", there cannot be any object in this which
      fullfils the relation. i.e if an object is supposed to be to the left of
      all red objects there cannot be any red objects to the left of itself.*/
      var objectsToClear : string[] = [];
      var stackIndex = findStack(label, state);
      var stack = stacks[stackIndex];
      var height = findHeight(label, stack);
      var quantifier = location.entity.quantifier;
      switch(location.relation){
          case "leftof":
              for (var i = stackIndex + 1; i < stacks.length; i++) {
                objectsToCheck = objectsToCheck.concat(stacks[i]);
              }
              for (var i = 0; i <= stackIndex; i++) {
                objectsToClear = objectsToClear.concat(stacks[i]);
              }
              break;
          case "rightof":
              for (var i = 0; i < stackIndex; i++){
                objectsToCheck = objectsToCheck.concat(stacks[i]);
              }
              for( var i = stackIndex; i < stacks.length; i++) {
                objectsToClear = objectsToClear.concat(stacks[i]);
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
              for (var i = 0; i <= height; i++) {
                  objectsToClear.push(stack[i]);
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
              for (var i = height; i < stack.length; i++) {
                objectsToClear.push(stack[i]);
              }
              break;
      }
      if(quantifier == "all") {
        return matchObject(objectsToClear, location.entity.object, state).length == 0 &&
        matchObject(objectsToCheck, location.entity.object, state).length > 0;

      } else {
          return matchObject(objectsToCheck,location.entity.object,state).length>0;
      }
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

        /* TODO: Vart kasta exceptions för att säga att någon regel bröts?
        Om vi kastar istället för att returnera false här så avbryts interpetation
        efter första exception. Även om en senare match skulle vara korrekt.
        (vid any) */
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

    //Checks if a given parse if physically correct and filters impossible
    //objects from movableLabels and relatableLabels if possible.
    function validateParse(cmd : Parser.Command, movableLabels : string[],
        relatableLabels : string[], state : WorldState) :
          {movableLabels: string[], relatableLabels : string[]} {

          var obj = (cmd.entity.object.object == null) ? cmd.entity.object : cmd.entity.object.object;
          var destinationObject = findDestinationObject(cmd);
          var movableQuantifier = cmd.entity.quantifier;
          var locationQuantifier = cmd.location.entity.quantifier;
          var relation = cmd.location.relation;

          //These parses are not physically possible to perform in any world state.
          if(relation == "inside" && destinationObject.form != "box") {
            throw "Objects can only be inside boxes."
          }
          if((movableQuantifier == "all" || locationQuantifier == "all") &&
            ( (obj.form == destinationObject.form && obj.form != "anyform") ||
            (obj.size == destinationObject.size && obj.size != null) ||
            (obj.color == destinationObject.color && obj.color != null) )) {
            throw "This is not physically possible."
          }
          //Only one object can be inside/ontop of another one, unless floor.
          if(movableQuantifier == "all" &&
              (relation == "ontop" || relation == "inside") &&
              !(relatableLabels.length == 1 && relatableLabels[0] == "floor")) {
            if(locationQuantifier == "all") {
              throw "This is just silly, how would I do this?"
            } else if(locationQuantifier == "the") {
              var rel = "";
              switch(relation) {
                case "ontop":
                  throw "There can only be one object on top of another object.";
                case "inside":
                  throw "A box can only fit one object."
              }
            } else if(relatableLabels.length < movableLabels.length) {
              throw "There are not enough locations for this."
            }
          }
          //These are dependent on the world state.
          if(movableLabels.length == 0) {
            throw "Could not find any matching object to move."
          }

          //Cannot put an object insde/ontop of every destination location if
          //there are less objects to move than desination locations.
          if(locationQuantifier == "all" &&
              (relation == "ontop" || relation == "inside") &&
              movableLabels.length < relatableLabels.length) {
                throw "There are too few objects to move for this."
          }
          //Does the relation between the object to be moved and the destination
          //object break any physical law?
          validateRelation(obj, destinationObject, relation, locationQuantifier);

          //Check for cases where movable or location quantifier is "all" and
          //some objects is in both sets. Filter these objects if possible, or
          //throw exception.
          /*TODO: Egen funktion */
          var mq = movableQuantifier;
          var lq = locationQuantifier;
          for(var i = 0; i < movableLabels.length; i++) {
            var ml = movableLabels[i];
            var objDef = getObjectDefinition(ml, state);
            var rel = "";
            switch(relation) {
              case "leftof":
                rel = "to the left of";
                break;
              case "rightof":
                rel = "to the right of";
                break;
              case "inside" || "ontop" || "above" || "under":
                rel = cmd.location.relation
                break;
            }
            for(var j = 0; j < relatableLabels.length; j++) {
              var rl = relatableLabels[j];
              if(ml == rl && mq == "any" && lq == "all") {
                movableLabels =
                  movableLabels.filter((label) => label != ml);
                if(movableLabels.length == 0) {
                  throw "I cannot put the " + objDef.size + " " +
                    objDef.color + " "+ objDef.form + " " + rel + " itself."
                }
              }
              if(ml == rl && mq == "all" && lq =="any") {
                relatableLabels = relatableLabels.filter((label) => label != rl);
                if(relatableLabels.length == 0) {
                  throw "I cannot put the " + objDef.size + " " +
                    objDef.color + " "+ objDef.form + " " + rel + " itself."
                }
              }
              if( (ml == rl) &&
                  ( (mq == "the" && lq == "all") ||
                    (mq == "all" && (lq == "the" || lq == "all")) )) {
                      throw "I cannot put the " + objDef.size + " " +
                        objDef.color + " "+ objDef.form + " " + rel + " itself."
              }
            }
          }
          return {movableLabels, relatableLabels}
    }

    //Returns the ObjectDefinition given a label identifier.
    function getObjectDefinition(label : string, state : WorldState)
        : ObjectDefinition {
      var object = state.objects[label];
      var objDef : ObjectDefinition =
          {form: object.form, color: object.color, size: object.size}
      return objDef;
    }

    //Must only be used for "move", NOT pickup or putdown
    function findDestinationObject(cmd: Parser.Command) : Parser.Object {
      if(cmd.location.entity.object.object == undefined) {
        var endLocation  = cmd.location.entity.object;
      } else {
        var endLocation = cmd.location.entity.object.object;
      }
      return endLocation;
    }
}
