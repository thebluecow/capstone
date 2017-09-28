'use strict';

var gulp = require('gulp');
var eslint = require('gulp-eslint');
var stylish = require('jshint-stylish');
var angularPlugin = require('eslint-plugin-angular');
var config =
     {
         apps: ['app/**/*.js', 'src/**/*.js'],
         html: ['*.html', 'app/**/*.html']
     };

gulp.task('lint', function () {
  return gulp.src(config.apps)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('default', [ 'lint' ]);