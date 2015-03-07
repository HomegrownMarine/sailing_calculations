var assert = require('chai').assert;
var calcs = require('../src/calcs').calcs;

describe('bearing', function() {
    it(' should calculate correctly', function() {
        assert.closeTo( calcs.bearing(47.63272, -122.34746, 47.62455, -122.33107), 126.48, 0.1);
        assert.closeTo( calcs.bearing(47.62455, -122.33107, 47.63272, -122.34746), 306.49, 0.1);
        assert.closeTo( calcs.bearing(47.63272, -122.34746, 47.641666, -122.34746), 0, 0.1);
        assert.closeTo( calcs.bearing(47.641666, -122.34746, 47.63272, -122.34746), 180, 0.1);
        assert.closeTo( calcs.bearing(47.63272, -122.33107, 47.63272, -122.33100), 90, 0.1);
        assert.closeTo( calcs.bearing(47.63272, -122.33107, 47.63272, -122.3311), 270, 0.1);
    });
});

describe('distance', function() {
    it('should calculate correctly', function() {
        assert.closeTo( calcs.distance(47.67962, -122.40555, 47.67897, -122.3767), 1.1668, 0.001);
    });
});

describe('tws', function() {
    it('should calculate correctly', function() {
        assert.closeTo( calcs.tws(6, 45, 12), 8.84, 0.01 );
    });
});

describe('twa', function() {
    it('should calculate correctly', function() {
        assert.closeTo( calcs.twa( 6, 45, 8.84), 73.68, 0.01 );
    });
});