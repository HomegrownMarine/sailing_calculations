(function(_) {
    "use strict";

    if( typeof _ == 'undefined' && typeof require == 'function' ) {
        _ = require('lodash');
    }

    //from stack overflow
    var remove_comments_regex = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var argument_names_regex = /([^\s,]+)/g;
    function getParamNames(funct) {
      var fnStr = funct.toString().replace(remove_comments_regex, '');
      var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(argument_names_regex);
      if ( result === null )
         result = [];
      return result;
    }

    var utilities = {
        /**
         * given a metric, will compute it's derivitive.
         * @param name - the name of the derivitive
         * @param metric - the name of the metric to calculate the derivitive from
         * @param [scaleFactor] - optional conversion factor, if the new metric should
         *                        be in different units.
         * @return 

         * Example: var acceleration = derivitive('acceleration', 'speed');
         * assert acceleration({'speed': 5, 't':1000}) == null //first execution
         * assert acceleration({'speed': 5, 't':1000}) == {'acceleration': 0}
         * assert acceleration({'speed': 6, 't':1000}) == {'acceleration': 1}
         */
        derivitive: function derivitive(name, metric, scaleFactor) {
            scaleFactor = scaleFactor || 1;
            var lastValue = null, lastTime;

            return function(args) {
                var result = null;

                if (metric in args) {
                    if (lastValue !== null) {
                        var delta = (args[metric] - lastValue) / ((args.t - lastTime)/1000) * scaleFactor;

                        result = {};
                        result[name] = delta;
                    }

                    lastValue = args[metric];
                    lastTime = args.t;
                }

                return result;
            };
        },
        /**
         * Wraps function to allow it to handle streaming inputs.  
         * @param funct - the name of the function will be used to name the return value.  
         *                The name of the arguments will be used to pull the arguments out 
         *                of maps of possible arguments.
         * @return {object} - will return null if all of the arguments aren't avaible to execute the
         *                    function, or an object of the form: {function_name: result}.
         */
        delayedInputs: function delayedInputs(funct) {
            var argumentNames = getParamNames(funct);
            var runningArgs = [];

            return function(args) {
                var presentValues = _.map(argumentNames, function(name) { return args[name]; });

                var allSet = true;
                for( var i=0; i < argumentNames.length; i++ ) {
                    if ( presentValues[i] ) {
                        runningArgs[i] = presentValues[i];
                    }

                    if ( !runningArgs[i] ) {
                        allSet = false;
                    }
                }

                //if all 
                if (allSet) {
                    var result = funct.apply(this, runningArgs);
                    runningArgs = [];
                    var obj = {};
                    obj[funct.name] = result;
                    return obj;
                }

                return null;
            };
        }
    };

    if (typeof exports != 'undefined') {
        exports = utilities;
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = utilities;
    } else {
        if ( typeof homegrown == 'undefined' ) {
            window.homegrown = {};
        }
        homegrown.streamingUtilities = utilities;
    }
})(_);