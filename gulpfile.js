const gulp = require('gulp');
const less = require('gulp-less');
const browserSync = require('browser-sync') .create();
const autoprefixer = require('gulp-autoprefixer');
const cleanCSS     = require('gulp-clean-css')

gulp.task('less', function() {
  return gulp.src('app/less/**/*.less')
  .pipe(less())
  .pipe(autoprefixer({
    browsers: ['last 12 versions'],
    cascade: false
}))
  .pipe(cleanCSS())
	.pipe(gulp.dest('app/css'))
	.pipe(browserSync.reload({stream: true}));
});


gulp.task('browser-sync', function() {
  browserSync.init({
    server: {
      baseDir: './app'
    },
    notify: false
  });
});

gulp.task('watch', ['less','browser-sync'], function() {
  gulp.watch('app/less/**/*.less',['less']);
  gulp.watch('app/css/**/*.css', browserSync.reload);
  gulp.watch('app/*.html', browserSync.reload);
});

