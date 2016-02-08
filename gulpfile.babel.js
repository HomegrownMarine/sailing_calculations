import gulp from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import del from 'del';

const $ = gulpLoadPlugins();

gulp.task('lint', function () {
  return gulp.src(paths.lint)
    .pipe($.jshint('.jshintrc'))
    .pipe($.plumber(plumberConf))
    .pipe($.jscs())
    .pipe($.jshint.reporter('jshint-stylish'));
});

gulp.task('unitTest', function () {
  gulp.src(paths.tests, {cwd: __dirname})
    .pipe($.plumber(plumberConf))
    .pipe($.mocha({ reporter: 'list' }));
});

gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

gulp.task('dist', function() {
  return gulp.src(['./src/utilities.js', './src/calcs.js', './src/maneuvers.js'])
    .pipe($.file('homegrown.js', 'this.homegrown=this.homegrown||{};'))
  	.pipe($.concat('sailing.js'))
    .pipe(gulp.dest('./dist'))
});

gulp.task('bump', ['test'], function () {
  var bumpType = $.util.env.type || 'patch'; // major.minor.patch

  return gulp.src(['./package.json'])
    .pipe($.bump({ type: bumpType }))
    .pipe(gulp.dest('./'));
});


gulp.task('test', ['lint', 'unitTest']);
gulp.task('release', ['bump', 'dist', 'clean']);
gulp.task('default', ['test']);
