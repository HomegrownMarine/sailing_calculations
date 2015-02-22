(function() {
    "use strict";
    var _, moment;

    if ( typeof window != 'undefined' ) {
        _ = window._;
        moment = window.moment;
    }
    else if( typeof require == 'function' ) {
        _ = require('lodash');
        moment = require('moment');
    }

    //each of these functions takes a "tack" object, and 
    //a section of data around the tack and adds some specific
    //metric(s) to the tack
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

            tack.timing.start = startIdx  || 15;
            tack.startPosition = [data[tack.timing.start].lon, data[tack.timing.start].lat];
        },

        calculateEntrySpeeds: function calculateEntrySpeeds(tack, data) {
            //then 5 seconds farther back to get starting vmg/speed
            //TODO: edge cases                
            var startingIdx = Math.max(0, tack.timing.start-6);
            var endingIdx = Math.min(data.length-2, tack.timing.start-2);

            var speedSum = 0, vmgSum = 0;
            var speedCount = 0, vmgCount = 0;
            var twaSum=0, twaCount = 0;
            var hdgSum=0, hdgCount = 0;
            for (var j=startingIdx+1; j <= endingIdx; j++) {
                if ( 'vmg' in data[j] ) {
                    vmgSum += data[j].vmg;
                    vmgCount++;
                }
                if ( 'speed' in data[j] ) {
                    speedSum += data[j].speed;
                    speedCount++;
                }
                if ( 'twa' in data[j] ) {
                    twaSum += data[j].twa;
                    twaCount++;
                }
                if ( 'hdg' in data[j] ) {
                    hdgSum += data[j].hdg+360;
                    hdgCount++;
                }
            }

            tack.entryVmg = vmgSum / vmgCount;
            tack.entrySpeed = speedSum / speedCount;
            tack.entryTwa = twaSum / twaCount;
            tack.entryHdg = (hdgSum / hdgCount) % 360;
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
            tack.timing.recovered = tack.timing.recovered || (tack.timing.center+30);
        },

        findRecoveryMetrics: function findRecoveryMetrics(tack, data) {
            //and find recovery speed and angles
            
            var twaSum=0, twaCount = 0;
            var hdgSum=0, hdgCount = 0;

            var maxIdx = Math.min(tack.timing.recovered+6, data.length);
            for (var j=tack.timing.recovered; j < maxIdx; j++) {
                if ( 'twa' in data[j] ) {
                    twaSum += data[j].twa;
                    twaCount++;
                }
                if ( 'hdg' in data[j] ) {
                    hdgSum += data[j].hdg+360;
                    hdgCount++;
                }
            }

            tack.recoveryTwa = twaSum / twaCount;
            tack.recoveryHdg = (hdgSum / hdgCount) % 360;
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
        }
    };

    function findManeuvers(data) {
        var maneuvers = [];

        //fimd maneuvers
        var lastBoard = null;
        var lastBoardStart = data[0].t;
        for (var i = 0; i < data.length; i++) {
            if ( 'twa' in data[i] ) {
                var board = 'U-S';
                if (-90 <= data[i].twa && data[i].twa < 0)
                    board = 'U-P';
                else if (data[i].twa < -90)
                    board = 'D-P';
                else if (data[i].twa > 90)
                    board = 'D-S';

                if (data[i].ot < 300) {
                    board = "PS";
                }

                if (lastBoard != board) {
                    if ( lastBoard !== null ) {
                        maneuvers.push({
                            board: lastBoard,
                            start: lastBoardStart,
                            end: data[i].t
                        });
                    }
                    lastBoard = board;
                    lastBoardStart = data[i].t;
                }

            }
        }

        return maneuvers;
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
                    return;
                // if (i + 1 < maneuvers.length) {
                //     var nextTime = moment(maneuvers[i + 1].start).subtract('seconds', 45);
                //     if (nextTime < centerTime)
                //         continue
                // }

                var from = moment(maneuvers[i].start).subtract('seconds', 20);
                var fromIdx = _.sortedIndex(data, {t: from}, function(d) { return d.t; });

                var to = moment(maneuvers[i].start).add('seconds', 120);
                var toIdx = _.sortedIndex(data, {t: to}, function(d) { return d.t; });            

                var range = data.slice(fromIdx, toIdx+1);
                

                var tack = {
                    time: centerTime,
                    board: maneuvers[i].board,
                    timing: {}
                };

                //process tack, by running steps in this order.
                tackUtils.findCenter(tack, range);
                tackUtils.findStart(tack, range);
                tackUtils.calculateEntrySpeeds(tack, range);
                tackUtils.findEnd(tack, range);
                tackUtils.findRecoveryTime(tack, range);
                tackUtils.findRecoveryMetrics(tack, range);

                tackUtils.convertIndexesToTimes(tack, range);
                tackUtils.calculateLoss(tack, range);

                tacks.push(tack);
                // break;
            }
        }

        return tacks;
    }

    var maneuverUtilities = {
        findManeuvers: findManeuvers,
        analyzeTacks: analyzeTacks
    };

    if (typeof exports != 'undefined') {
        exports.maneuvers = maneuverUtilities;
    } else if (typeof module != 'undefined' && module.exports) {
        module.exports.maneuvers = maneuverUtilities;
    } else {
        if ( typeof homegrown == 'undefined' ) {
            window.homegrown = {};
        }
        homegrown.maneuvers = maneuverUtilities;
    }
})();