this.homegrown=this.homegrown||{};
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
(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        factory(exports, require('lodash'));
    }
    else {
        factory((global.homegrown.calculations = {}), global._);
    }
}(this, function (exports, _) { 'use strict';

    var R = 3440.06479; //radius of earth in nautical miles

    var deg = function deg(radians) {
        return (radians*180/Math.PI + 360) % 360;
    };

    var rad = function rad(degrees) {
        return degrees * Math.PI / 180;
    };

    var lawOfCosines = function(a, b, gamma) {
        return Math.sqrt(a * a + b * b - 2 * b * a * Math.cos(rad(Math.abs(gamma))));
    };

    var calcs = {
        // adjustedAwa: function awa(awa, heel) {
        //     return deg(atan( tan(rad(awa)) / cos(rad(heel)) ));
        // },
        tws: function tws(speed, awa, aws) {
            //TODO: heel compensation
            return lawOfCosines(speed, aws, awa);
        },

        twa: function twa(speed, awa, tws) {
            var angle = deg(Math.asin(speed * Math.sin(rad(Math.abs(awa))) / tws)) + Math.abs(awa);
            if (awa < 0) angle *= -1;
            return angle;
        },

        gws: function gws(sog, awa, aws) {
            return lawOfCosines(sog, aws, awa);
        },

        gwd: function gwd(sog, cog, awa, gws) {
            var gwa = calcs.twa(sog, awa, gws);
            return (cog + gwa + 360) % 360;
        },

        vmg: function vmg(speed, twa) {
            return Math.abs(speed * Math.cos(rad(twa)));
        },

        twd: function twd(hdg, twa) {
            return (hdg + twa + 360) % 360;
        },

        //see: http://www.movable-type.co.uk/scripts/latlong.html
        distance: function distance(lat1, lon1, lat2, lon2) {
            lat1 = rad(lat1);
            lat2 = rad(lat2);
            lon1 = rad(lon1);
            lon2 = rad(lon2);

            var dLat = lat2-lat1,
                dLon = lon2-lon1;
            
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c;
        },

        bearing: function bearing(lat1, lon1, lat2, lon2) {
            lat1 = rad(lat1);
            lat2 = rad(lat2);
            lon1 = rad(lon1);
            lon2 = rad(lon2);
            
            var dLon = lon2-lon1;
            
            var y = Math.sin(dLon) * Math.cos(lat2);
            var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            
            return deg( Math.atan2(y, x) );
        },

        steer: function steer(from, to) {
            var diff = to - from;
            if ( diff > 180 ) {
                diff = 360 - diff;
            }
            else if ( diff < -180 ) {
                diff = 360 + diff;
            }

            return diff;
        },

        crossTrackError: function crossTrackError(fromLat, fromLon, lat, lon, toLat, toLan) {
            var d = distance(fromLat, fromLon, toLat, toLan);
            var b1 = bearing(fromLat, fromLon, toLat, toLan);
            var b2 = bearing(fromLat, fromLon, lat, lon);
            return Math.asin(Math.sin(d/R) * Math.sin(rad(b2-b1))) * R;
        },

        set: function set(speed, hdg, sog, cog) {
            //GM: TODO: understand 90 deg offset.
            //convert cog and hdg to radians, with north right
            hdg = rad(90.0 - hdg);
            cog = rad(90.0 - cog);

            //break out x and y components of current vector
            var current_x = sog * Math.cos(cog) - speed * Math.cos(hdg);
            var current_y = sog * Math.sin(cog) - speed * Math.sin(hdg);

            //set is the angle of the current vector (note we special case pure North or South)
            var _set = 0;
            if ( current_x === 0 ) {
                _set = current_y < 0? 180: 0;
            }
            else {
                //normalize 0 - 360
                _set = (90.0 - deg(Math.atan2(current_y, current_x)) + 360) % 360;
            }
            return _set;
        },

        drift: function drift(speed, hdg, sog, cog) {
            //GM: TODO: understand 90 deg offset.
            //convert cog and hdg to radians, with north right
            hdg = rad(90.0 - hdg);
            cog = rad(90.0 - cog);

            //break out x and y components of current vector
            var current_x = sog * Math.cos(cog) - speed * Math.cos(hdg);
            var current_y = sog * Math.sin(cog) - speed * Math.sin(hdg);

            //drift is the magnitude of the current vector
            var _drift = Math.sqrt(current_x * current_x + current_y * current_y);
            return _drift;
        }
    };

    _.extend(exports, calcs);
}));

(function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        factory(exports, require('lodash'), require('moment'), require('./calcs.js'));
    }
    else {
        factory((global.homegrown.maneuvers = {}), global._, global.moment, global.homegrown.utilities);
    }
}(this, function (exports, _, moment, utilities) {'use strict';
    function mean() {
        var sum = 0, count = 0;

        return {
            update: function(p) {
                count++;
                sum += p;
            },
            result: function() {
                if ( count ) 
                    return sum / count;
            }
        };
    }

    //each of these functions takes a "tack" object, and 
    //a section of data around the tack and adds some specific
    //metric(s) to the tack, either finding a new critical point,
    //or some property, like entry Speed, that will be used later
    //in the algorithm.  analyzeTacks() below uses these to build
    //a 'picture' of a tack.
    var tackUtils = {
        findCenter: function findCenter(tack, data) {
            var centerIdx;

            for (var j=0; j < data.length; j++) {
                if ( tack.time.isSame(data[j].t) ) {
                    centerIdx = j-1;
                    break;
                }
            }

            tack.timing.center = centerIdx;
            tack.position = [data[centerIdx].lon, data[centerIdx].lat];
        },

        findStart: function findStart(tack, data) {
            //work backwards to start of tack
            var startIdx;
            for (var j=tack.timing.center-3; j >= 0; j--) {
                if ('rot' in data[j] ) {
                    if ( Math.abs(data[j].rot) < 2.5 ) {
                        startIdx = j;
                        break;
                    }                        
                }
            }

            //TODO, default not idx based...
            if ( startIdx )
                tack.timing.start = startIdx;
            else {
                tack.timing.start = 15;
                tack.notes.push('using default start');
            }
            tack.startPosition = [data[tack.timing.start].lon, data[tack.timing.start].lat];
        },

        calculateEntrySpeeds: function calculateEntrySpeeds(tack, tackData) {
            //then 5 seconds farther back to get starting vmg/speed
            //TODO: edge cases                
            var startTime = moment(tackData[tack.timing.start].t).subtract(6, 'seconds');
            var endTime = moment(tackData[tack.timing.start].t).subtract(2, 'seconds');
            var data = getSliceBetweenTimes(tackData, startTime, endTime);

            var speedSum = 0, vmgSum = 0;
            var speedCount = 0, vmgCount = 0;
            var twaSum=0, twaCount = 0;

            var averageSpeed = mean();
            var averageTwa = mean();
            var averageVmg = mean();

            var averageTargetTwa = mean();

            var averageTgtSpd = mean();
            var hdgs = [];
            for (var j=0; j < data.length; j++) {
                if ( 'vmg' in data[j] ) {
                    averageVmg.update( data[j].vmg );
                }
                if ( 'speed' in data[j] ) {
                    averageSpeed.update( data[j].speed );
                }
                if ( 'twa' in data[j] ) {
                    averageTwa.update( data[j].twa );
                }
                if ( 'targetSpeed' in data[j] ) {
                    averageTgtSpd.update( data[j].targetSpeed );
                }
                if ( 'hdg' in data[j] ) {
                    hdgs.push( data[j].hdg );
                }
                if ( 'targetAngle' in data[j] ) {
                    averageTargetTwa.update( data[j].targetAngle );
                }            
            }

            tack.entryVmg = averageVmg.result();
            tack.entrySpeed = averageSpeed.result();
            tack.entryTwa = averageTwa.result();
            tack.entryHdg = utilities.circularMean(hdgs);

            var targetSpeed = averageTgtSpd.result();

            if (targetSpeed) {
                tack.targetSpeed = targetSpeed;
                if (tack.entrySpeed < targetSpeed * 0.9) {
                    tack.notes.push('* started tack downspeed');
                }
            }

            var targetAngle = averageTargetTwa.result();
            console.info('werid', targetAngle);
            if (targetAngle) {
                tack.targetAngle = targetAngle;
                // if (tack.entrySpeed < targetSpeed * 0.9) {
                //     tack.notes.push('* started tack downspeed');
                // }
            }

        },

        findEnd: function findEnd(tack, data) {
            //then forwards to end of tack
            //using twa here, because it lags behind hdg and is
            //what vmg is calculated based on.
            var minIdx = tack.timing.center;
            
            var findMax = (tack.board == 'U-P')>0? true: false;
            findMax = !findMax;

            for (var j=tack.timing.center; j < tack.timing.center+12; j++) {
                if ('twa' in data[j] ) {
                    //if the center didn't have twa, then use the
                    //next available
                    if (!('twa' in data[minIdx])) {
                        minIdx = j;
                    }

                    if (findMax) {
                        if (data[j].twa > data[minIdx].twa) {
                            minIdx = j;
                        }    
                    }
                    else {
                        if (data[j].twa < data[minIdx].twa) {
                            minIdx = j;
                        }
                    }
                }
            }
            
            tack.timing.end = minIdx;
            tack.maxTwa = data[tack.timing.end].twa;
            tack.endPosition = [data[tack.timing.end].lon, data[tack.timing.end].lat];
        },

        findRecoveryTime: function findRecoveryTime(tack, data) {
            //then find recovery time
            for (var j=tack.timing.end+5; j < data.length; j++) {
                if ( 'vmg' in data[j] && tack.entryVmg <= data[j].vmg) {
                    tack.timing.recovered = j;
                    break;
                }
            }

            //TODO: find better fallback
            if ( !tack.timing.recovered ) {
                tack.timing.recovered = (tack.timing.center+30);
                tack.notes.push('never found recovery');
            }
        },

        findRecoveryMetrics: function findRecoveryMetrics(tack, data) {
            //and find recovery speed and angles
            
            var hdgs = [];
            var averageSpeed = mean();
            var averageTwa = mean();

            var maxIdx = Math.min(tack.timing.recovered+6, data.length);
            for (var j=tack.timing.recovered; j < maxIdx; j++) {
                if ( 'twa' in data[j] ) {
                    averageTwa.update( data[j].twa );
                }
                if ( 'hdg' in data[j] ) {
                    hdgs.push( data[j].hdg );
                }
                if ( 'speed' in data[j] ) {
                    averageSpeed.update( data[j].speed );
                }
            }

            tack.recoveryTwa = averageTwa.result();
            tack.recoveryHdg = utilities.circularMean(hdgs);

            tack.recoverySpeed = averageSpeed.result();

            if (tack.targetSpeed && tack.recoverySpeed < tack.targetSpeed * 0.9) {
                tack.notes.push('* never came back up to speed');
            }
        },

        convertIndexesToTimes: function convertIndexesToTimes(tack, data) {
            tack.timing = _.mapValues(tack.timing, function(index) {
                return moment(data[index].t);
            });
        },

        calculateLoss: function calculateLoss(tack, data) {
            var lastTime = 0;
            var covered = 0;
            var recovered = tack.timing.recovered;
            
            _(data)
                .filter(function(m) { return m.t >= tack.timing.start && m.t <= recovered; } )
                .each(function(m) {
                    if ('vmg' in m) {
                        if ( lastTime ) {
                            covered += ((m.t - lastTime) / 1000) * m.vmg;
                        }
                        lastTime = m.t;                        
                    }
                });

            var ideal = tack.entryVmg * ((recovered - tack.timing.start) / 1000);
            tack.loss = - 6076.11549 / 3600.0 * (ideal - covered);
        },

        addClassificationStats: function addClassificationStats(tack, data) {
            var twsSum = 0, twsCount = 0;
            var twds = [];

            for (var j=0; j < tack.timing.start; j++) {
                if ( 'tws' in data[j] ) {
                    twsSum += data[j].tws;
                    twsCount++;
                }
                if ( 'twd' in data[j] ) {
                    twds.push(data[j].twd);
                }
            }

            tack.tws = twsSum / twsCount;
            tack.twd = utilities.circularMean(twds);
        }
    };

    /**
     * Gets a subset of the data, around the time specified.
     */
    function getSliceAroundTime(data, time, before, after) {
        var from = moment(time).subtract(before, 'seconds');
        var to = moment(time).add(after, 'seconds');

        return getSliceBetweenTimes(data, from, to);
    }

    /**
     * Gets a subset of the data, between the times specified
     */
    function getSliceBetweenTimes(data, from, to) {      
        var fromIdx = _.sortedIndex(data, {t: from}, function(d) { return d.t; });
        var toIdx = _.sortedIndex(data, {t: to}, function(d) { return d.t; });            

        return data.slice(fromIdx, toIdx+1);
    }
     

    function findManeuvers(data) {
        function board(point) {
            var b = null;
            if ( 'twa' in point ) {
                b = 'U-S';
                if (-90 <= point.twa && point.twa < 0)
                    b = 'U-P';
                else if (point.twa < -90)
                    b = 'D-P';
                else if (point.twa > 90)
                    b = 'D-S';

                if (point.ot < 300) {
                    b = "PS";
                }
            }
            return b;
        }

        return utilities.createChangeDataSegments(data, board);
    }

    function findLegs(data) {
        function leg(point) {
            var l = null;
            if (point.ot < 300) {
                l = "PS";
            }
            else if ('twa' in point) {
                if (Math.abs(point.twa) < 90)
                    l = 'Upwind';
                else 
                    l = 'Downwind';
            }
            return l;
        }

        return utilities.createChangeDataSegments(data, leg);
    }

    function analyzeTacks(maneuvers, data) {
        var tacks = [];

        //TODO: reverse order, so we can cap a maneuver at the beginning of the next tack (or turndown).
        //moment.max
        for (var i = 2; i < maneuvers.length; i++) {
            //TODO: gybes too
            if (maneuvers[i].board.charAt(0) == 'U' && maneuvers[i - 1].board.charAt(0) == 'U') {
                var centerTime = moment(maneuvers[i].start);

                if ( maneuvers[i-1].board == "PS" )
                    continue;

                if (i + 1 < maneuvers.length) {
                    var nextTime = moment(maneuvers[i + 1].start).subtract(45, 'seconds');
                    if (nextTime < centerTime)
                        continue;
                }

                var range = getSliceAroundTime(data, maneuvers[i].start, 30, 120);
                
                var tack = {
                    time: centerTime,
                    board: maneuvers[i].board,
                    timing: {},
                    notes: [],
                    data: getSliceAroundTime(data, maneuvers[i].start, 20, 120),
                    track: getSliceAroundTime(data, maneuvers[i].start, 15, 30),
                };
                
                //process tack, by running steps in this order.
                tackUtils.findCenter(tack, range);
                tackUtils.findStart(tack, range);
                tackUtils.calculateEntrySpeeds(tack, range);
                tackUtils.findEnd(tack, range);
                
                tackUtils.findRecoveryTime(tack, range);
                tackUtils.findRecoveryMetrics(tack, range);
                tackUtils.addClassificationStats(tack, range);

                tackUtils.convertIndexesToTimes(tack, range);
                tackUtils.calculateLoss(tack, range);

                tacks.push(tack);
                // break;
            }
        }

        return tacks;
    }

    _.extend(exports, {
        findManeuvers: findManeuvers,
        analyzeTacks: analyzeTacks,
        getSliceAroundTime: getSliceAroundTime,
        getSliceBetweenTimes: getSliceBetweenTimes        
    });

}));