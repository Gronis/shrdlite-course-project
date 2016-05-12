We have written the method interpretCommand, it takes a parse tree and returns all possible interpretations as a DNFFormula. If no interpretations are found, it throws an error.


There are two recursive main methods that we use to find the formula. They are matchObjects and checkRelation, and they are used to find all objects that match the entity and the location respectively, then we use isPhysicallyCorrect to see which combinations of these is a legal interpretation.