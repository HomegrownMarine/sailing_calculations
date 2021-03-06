(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        factory(exports, require('lodash'));
    }
    else {
        factory((global.homegrown.utilities = {}), global._);
    }
}(this, function (exports, _) {'use strict';

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

        //TODO: rename derivative
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
        average: function average(name, metric, size) {
            var rolling = 0;
            var counter = 0;
            var windowX = [];

            return function(args) {
                var result = null;

                if (metric in args) {
                    var pos = counter % size;
                    counter++;

                    if (windowX[pos]) {
                        rolling -= windowX[pos];
                    }
                    rolling += args[metric];
                    windowX[pos] = args[metric];

                    result = {};
                    result[name] = rolling / windowX.length;
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
                // var presentValues = _.map(argumentNames, function(name) { return args[name]; });

                var allSet = true;
                for( var i=0; i < argumentNames.length; i++ ) {
                    if ( argumentNames[i] in args ) {
                        runningArgs[i] = args[argumentNames[i]];
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
        },

        /*
            Pass in a data array, where each element has a time, t and a set of segments,
            each with a start and end time, and get back a new segment array, with each having
            a data array for points within the segments start and end time.
        */
        segmentData: function segmentData(data, segments) {
            var segs = _.clone(segments, true);
            _.each(segs, function(seg) {
                seg.data = [];
            });

            var j = 0;
            for ( var i=0; i < data.length; i++ ) {
                if ( data[i].t < segs[j].start ) {
                    continue;
                }
                else if ( data[i].t < segs[j].end ) {
                    segs[j].data.push(data[i]);
                }
                else {
                    j++;
                    if (j >= segs.length) 
                        break;
                    segs[j].data.push(data[i]);
                }
            }

            return segs;
        },

        //untested: create a new segment whenever 
        createChangeDataSegments: function createSegments(data, field) {
            
            var segments = [];
            var lastValue = null;
            var startTime = null;

            //get points from data
            var getValue, fieldName;
            if (typeof field == 'function') {
                getValue = field;
                fieldName = field.name;
            }
            else {
                getValue = function getValue(point) {
                    if (field in point)
                        return point[field];
                    else 
                        return null;
                };
                fieldName = field;
            }

            var i=0;
            for (; i < data.length; i++) {
                var value = getValue(data[i]);
                if ( value ) {
                    lastValue = value;
                    startTime = data[i].t;
                    break;
                }
            }
            
            for (; i < data.length; i++) {
                var newValue = getValue(data[i]);

                if ( newValue && newValue != lastValue ) {
                    var seg = {
                        // value: lastValue,
                        start: startTime,
                        end: data[i].t
                    };
                    seg[fieldName] = lastValue;
                    segments.push(seg);

                    lastValue = newValue;
                    startTime = data[i].t;
                }
            }

            return segments;
        },

        createSummaryDataSegments: function summerizeData(data, field, timeStep) {
            timeStep = timeStep || 10000; //default 10 seconds

            var segments = [];
            var sum=0, count=0;
            var startTime = data[0].t;
            
            for (var i=0; i < data.length; i++) {
                if (data[i].t > startTime + timeStep) {
                    var seg = {
                        start: startTime,
                        end: data[i].t
                    };
                    seg[field] = sum/count;
                    segments.push(seg);

                    sum = 0; count = 0;
                    startTime = data[i].t;
                }

                if ( field in data[i] ) {
                    sum += data[i][field];
                    count++;
                }
            }

            return segments;
        }, 
        circularMean: function circularMean(dat) {
            var sinComp = 0, cosComp = 0;
            _.each(dat, function(angle) {
                sinComp += Math.sin(rad(angle));
                cosComp += Math.cos(rad(angle));
            });

            return (360+deg(Math.atan2(sinComp/dat.length, cosComp/dat.length)))%360;
        }
    };

    _.extend(exports, utilities);
}));