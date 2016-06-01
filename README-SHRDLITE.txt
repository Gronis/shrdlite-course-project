Graph.ts:
Not much has changed since the aStarSearch submission. We have added our own
implementation of a node. Unfortunately we weren’t able to compare two nodes by
== so in our maps we had to add JSON.stringify.


Interpreter.ts:
Here we try to find an interpretation of a parse. We handle all quantifiers, and we throw error messages that describe the problems that could arise well. It checks the parse recursively when finding an interpretation and checks if any relation in it does not exist in the world.


An example of this is given by the following utterance in the medium world:
“Put the white ball in the yellow box that is to the left of the pyramid”


If the quantifier is “all” for both the object to be moved and the destination, it will check that one object is not found in both the possible objects and destinations.
Example: “Put all balls to the left of all white objects” will fail since it cannot move the white ball in relation to itself. While “put all balls to the left of all boxes” works fine.


If the quantifiers for the object to be moved and destination is a combination of “any” and  “all” it will try to filter out any objects that cannot fulfil this relation and give an error if no objects can fulfil this.
Example: “put all white objects to the left of a ball” works since there is a black ball in the world. While “put all white objects to the left of a white ball” will fail since the white ball cannot be moved in relation to itself. (in world medium)


It will also check the object to be moved and the given destination and check that this relation is physically valid in the world, before checking recursively for matches.
Example: “put the ball inside a box”


The interpreter also handles conversations with the user in the case of ambiguity. Take the previous example “put the ball inside a box”. If there are more than one ball, the AI will engage in a conversation asking what ball to take. In this particular example, it might ask “Do you mean the white ball or the black ball”. The user can then reply to the question if they want to, or give a new command, ending the conversation. The AI will ask for questions as long as the quantifier “the” is used and more than one object matches the description. For example “take the box” will yield the reply “There are 3 boxes, which one do you mean?”. If the user replies “The large one”, there might still be two large boxes and the AI continue to ask questions until all conflicts are resolved, or until a new command is given. On the other hand, if the user would have replied with “a large box” instead, then this is no longer an ambiguity since any large box will suffice.


Planner.ts:
In this file we have our own implementation of a node, which contains a world state and an action (the action that led to this state). 


We also have clonedWorld() which is simply a class that takes a world state in its constructor and copies it. You can then perform moves on this cloned state (p,d,r,l).


The implementation of a graph is dynamic, that is, we add edges to the graph first when outgoingEdges() is called on a node. We check simply what moves are possible and create, add and return the corresponding edges.


This file also includes a function that checks if the given literal is true given a world state.
Our heuristic is called informedHeuristics() and returns an approximate cost to fulfill the given literal given the current world state. There are five inner functions that calculate the cost to expose an object, the number of moves between two objects, the cost of moving to an object from the arms position, if two different objects are in the same stack and what index the floor has.


costToExpose():  if there are any objects above the object we want to expose = the number of objects above * 4 - 1 otherwise 0.
* If the arm is holding something = 1.
The 4 is for pickup + (left or right) + drop + (right or left) and the -1 is for the fact that when you have removed the last object above the object you want to expose, it is not certain that you will return to that stack.
indexOfFloor(): This being which index yields the minimum cost to reach the floor from the arms position. 
Then there is simply a switch statement where we call these different functions depending on the relation in the given literal.


In planInterpretation(...) there is code that makes the planner describe more understandably what it is doing, it will for example say “Putting the yellow box on the floor.”, it will say this before it actually does it as well and if there is only one box it won’t say its color or size (this is found in the function minimalInfo()).




Shrdlite.ts:
Here we handle ambiguity of this kind:
“Put the white ball in a box on the floor” will yield two parses and the program will then ask the user which parse it meant:
1. “Put the white ball that is in a box on the floor”
2. “Put the white ball in a box that is on the floor”
And the user will be prompted to answer with the number of the wanted parse or simply input a new utterance. 


An example that handles both ambiguities where “that is” is unspecified and when the use of quantifier “the” is ambiguous is the following:


1. Put the white ball in the yellow box
2. Put the ball in a box on the floor
3. “1”
4. The white one




Parser.ts:
Added functions to get a description of objects and relations depending on the quantifiers of the parse. The intelligentStringify function takes a parse and produces an utterance to be used when handling ambiguities. 


World.ts:
Variables have been added to the Worldstate interface in order to be able to resolve ambiguities.


List of extensions:
Informed heuristics
Way better output messages when doing stuff and when an error occurs (more interactive dialogue)
Handles two types of ambiguity (addition to grammar)
Clarification questions for the user for both types of ambiguity
Handles all quantifiers (all, any, the)


Extra
For the best user experience, use text to speech.