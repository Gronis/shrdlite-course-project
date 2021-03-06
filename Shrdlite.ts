///<reference path="World.ts"/>
///<reference path="Parser.ts"/>
///<reference path="Interpreter.ts"/>
///<reference path="Planner.ts"/>

module Shrdlite {

    export function interactive(world : World) : void {
        function endlessLoop(utterance : string = "") : void {
            var nextInput = () => world.readUserInput("", endlessLoop);
            if (utterance.trim()) {
                var plan : string[] = splitStringIntoPlan(utterance);
                if (!plan) {
                    plan = parseUtteranceIntoPlan(world, utterance);
                }
                if (plan) {
                    world.printDebugInfo("Plan: " + plan.join(", "));
                    world.performPlan(plan, nextInput);
                    return;
                }
            }
            nextInput();
        }
        world.printWorld(endlessLoop);
    }


    /**
     * Generic function that takes an utterance and returns a plan. It works according to the following pipeline:
     * - first it parses the utterance (Parser.ts)
     * - then it interprets the parse(s) (Interpreter.ts)
     * - then it creates plan(s) for the interpretation(s) (Planner.ts)
     *
     * Each of the modules Parser.ts, Interpreter.ts and Planner.ts
     * defines its own version of interface Result, which in the case
     * of Interpreter.ts and Planner.ts extends the Result interface
     * from the previous module in the pipeline. In essence, starting
     * from ParseResult, each module that it passes through adds its
     * own result to this structure, since each Result is fed
     * (directly or indirectly) into the next module.
     *
     * There are two sources of ambiguity: a parse might have several
     * possible interpretations, and there might be more than one plan
     * for each interpretation. In the code there are placeholders
     * that you can fill in to decide what to do in each case.
     *
     * @param world The current world.
     * @param utterance The string that represents the command.
     * @returns A plan in the form of a stack of strings, where each element is either a robot action, like "p" (for pick up) or "r" (for going right), or a system utterance in English that describes what the robot is doing.
     */
    export function parseUtteranceIntoPlan(world : World, utterance : string) : string[] {
        // Parsing
        world.printDebugInfo('Parsing utterance: "' + utterance + '"');
        var firstWord = utterance.split(" ")[0];
        var enteredNumber : number = Number(firstWord);
        if(world.currentState.ambigousParses &&
            !isNaN(enteredNumber)) {
            if(enteredNumber <= world.currentState.ambigousParses.length &&
            enteredNumber > 0) {
              var parses : Parser.ParseResult[] = [];
              parses.push(world.currentState.ambigousParses[enteredNumber - 1]);
              world.printSystemOutput("Ok, you want me to " + Parser.intelligentStringify(parses[0]));
            } else {
              world.printSystemOutput("Sorry, but " + enteredNumber +
                " was not one of the options I gave you. Please choose the number of the utterance you had in mind or give me new instructions.")
              return;
            }
        } else {
          try {
              var parses : Parser.ParseResult[] = Parser.parse(utterance);
              world.printDebugInfo("Found " + parses.length + " parses");
              parses.forEach((result, n) => {
                  world.printDebugInfo("  (" + n + ") " + Parser.stringify(result));
              });
          }
          catch(err) {
              world.printSystemOutput("Sorry I cannot understand this, please try again.")
              return;
          }
      }
      world.currentState.ambigousParses = undefined;

      if(parses.length > 1) {
        world.printSystemOutput("This utterance is ambiguous, I found "
          + parses.length + " different parses.")
        for(var i = 0; i < parses.length; i++) {
          world.printSystemOutput(" " + (i + 1) + ": " + Parser.intelligentStringify(parses[i]));
        }

        world.printSystemOutput("Please choose the number of the utterance you had in mind or give me new instructions.");
        world.currentState.ambigousParses = parses;
        return;
      }

        // Interpretation
        try {
            var interpretations : Interpreter.InterpretationResult[] = Interpreter.interpret(parses, world.currentState);
            world.printDebugInfo("Found " + interpretations.length + " interpretations");
            interpretations.forEach((result, n) => {
                world.printDebugInfo("  (" + n + ") " + Interpreter.stringify(result));
            });
        }
        catch(err) {
            world.printSystemOutput(err);
            return;
        }

        // Planning
        try {
            var plans : Planner.PlannerResult[] = Planner.plan(interpretations, world.currentState);
            world.printDebugInfo("Found " + plans.length + " plans");
            plans.forEach((result, n) => {
                world.printDebugInfo("  (" + n + ") " + Planner.stringify(result));
            });
        }
        catch(err) {
            world.printSystemOutput(err);
            return;
        }

        var finalPlan : string[] = plans[0].plan;
        world.printDebugInfo("Final plan: " + finalPlan.join(", "));
        return finalPlan;
    }


    /** This is a convenience function that recognizes strings
     * of the form "p r r d l p r d"
     */
    export function splitStringIntoPlan(planstring : string) : string[] {
        var plan : string[] = planstring.trim().split(/\s+/);
        var actions : {[act:string] : string}
            = {p:"Picking", d:"Dropping", l:"Going left", r:"Going right"};
        for (var i = plan.length-1; i >= 0; i--) {
            if (!actions[plan[i]]) {
                return;
            }
            plan.splice(i, 0, actions[plan[i]]);
        }
        return plan;
    }

}
