///<reference path="World.ts"/>
///<reference path="lib/node.d.ts"/>

/**
* Parser module
*
* This module parses a command given as a string by the user into a
* list of possible parses, each of which contains an object of type
* `Command`.
*
*/
module Parser {
    export function parse(input:string) : ParseResult[] {
        var nearleyParser = new nearley.Parser(grammar.ParserRules, grammar.ParserStart);
        var parsestr = input.toLowerCase().replace(/\W/g, "");
        try {
            var results : Command[] = nearleyParser.feed(parsestr).results;
        } catch(err) {
            if ('offset' in err) {
                throw new Error('Parsing failed after ' + err.offset + ' characters');
            } else {
                throw err;
            }
        }
        if (!results.length) {
            throw new Error('Parsing failed, incomplete input');
        }
        return results.map((res) => {
            // We need to clone the parse result, because parts of it is shared with other parses
            return {input: input, parse: clone(res)};
        });
    }

    /** The output type of the parser */
    export interface ParseResult {
	/** The input string given by the user. */
        input : string;
	/** The `Command` structure that the parser built from `input`. */
        parse : Command;
    }

    /** The type of a command for the robot. */
    export interface Command {
	/** The verb itself, for example "move", "take", "drop" */
        command : string;
	/** The object in the world, i.e. the `Entity`, which is the patient/direct object of `command`. */
        entity? : Entity;
	/** For verbs of motion, this specifies the destination of the action. */
        location? : Location;
    }

    /** A quantified reference (as yet uninterpreted) to an object in the world. */
    export interface Entity {
	/** Specifies a determiner (e.g. "the", "a/an", "any", "all"). */
        quantifier : string;
        object : Object;
    }

    /** A location in the world. */
    export interface Location {
	/** A preposition such as "beside", "above", etc. */
        relation : string;
	/** The entity relative to which the preposition should be interpreted. */
        entity : Entity;
    }

    /**
     * A user's description of an object in the world. A basic object
     * is described by its size ("small", "large", etc.), color
     * ("black", "white", etc.) and form ("object", "ball", "box",
     * etc.), all of which are optional. An object can also be
     * described using a relative clause (e.g. "the ball inside the
     * box"), which is given as an object (field `object?`) and a
     * location (field `location?`).
     *
     * This type should really be a union type, but TypeScript doesn't
     * support that. Instead, we include all possible fields and
     * assume that if `object?` and `location?` are set, the others
     * will be undefined and vice versa.
     *
     */
    export interface Object {
	/** Recursive reference to an object using a relative clause. */
        object? : Object;
	/** Location of the object in the relative clause. */
        location? : Location;
        // Here is the union type divisor
        size? : string;
        color? : string;
        form? : string;
    }

    export function stringify(result : ParseResult) : string {
        return JSON.stringify(result.parse);
    }

    function clone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }

    //Returns a string with "that is" in the right place given a parse.
    //Used when handling certain ambiguities.
    export function intelligentStringify(parse : ParseResult) : string {
      var cmd : Command = parse.parse;
      if(cmd.entity == undefined) {
        return cmd.command + " it " + cmd.location.relation + " " +
          entityToString(cmd.location.entity);
      }
      var result = cmd.command + " " + entityToString(cmd.entity);
      if(cmd.location == undefined)
        return result;
      else {
        return result + " " + prettifyRelation(cmd.location.relation) + " " +
            entityToString(cmd.location.entity);
      }
      //Recursively builds the string.
      function entityToString(entity : Entity) : string {
        var obj = entity.object.object;
        var objQuantifier = entity.quantifier;

        if(entity.object.object == null) {
          return objQuantifier + " " +
              minimalDescription(entity.object, objQuantifier);
        } else {
          var relation = prettifyRelation(entity.object.location.relation);
          var nextEntity : Entity = entity.object.location.entity;
          return objQuantifier + " " + minimalDescription(obj, objQuantifier) +
            " that is " + relation + " " + entityToString(nextEntity);
        }
      }
    }

    export function getPlural(form : string) : string {
      switch(form) {
        case "anyform":
          return "objects"
        case "box":
          return "boxes";
        default:
          return form + "s";
      }
    }

    export function prettifyRelation(relation : string) : string {
          switch(relation) {
            case "inside":
              return "inside of"
            case "ontop":
              return "on top of"
            case "leftof":
              return "to the left of"
            case "rightof":
              return "to the right of"
            case "under":
            case "above":
            case "beside":
              return relation;
            default:
              throw "I should not be here..."
          }
        }

    //Returns the minimal description of an object given its object definition.
    export function minimalDescription(object : Object, quantifier : string) : string {
      var size : string = (object.size == undefined)? "" : object.size + " ";
      var color : string = (object.color == undefined)? "" : object.color + " ";

      if(quantifier == "all")
        var form : string = getPlural(object.form);
      else
        var form : string = (object.form == "anyform")? "object" : object.form;

      return size + color + form;
    }

}

// TypeScript declarations for external JavaScript modules

declare module "grammar" {
    export var ParserRules : { [s:string]: any };
    export var ParserStart : string;
}


declare module "nearley" {
    export class Parser {
        constructor(rules: {[s:string]:any}, start: string);
        feed(sentence: string) : {
            results : Parser.Command[];
        }
    }
}


if (typeof require !== 'undefined') {
    // Node.JS way of importing external modules
    // In a browser, they must be included from the HTML file
    var nearley = require('./lib/nearley.js');
    var grammar = require('./grammar.js');
}
