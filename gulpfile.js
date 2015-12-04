var gulp = require('gulp'),
    $ = require('gulp-load-plugins')(),
    proxy = require('redbird')({
    	port: 8002
    });

gulp.task('server:prod', function () {
	$.connect.server({
		root: [
		    './src'
		],
		port: process.env.PORT || 8001,
		livereload: false
	});
});

gulp.task('server:dev', function () {
	// proxy.register("localhost:8002/languages", "preprod.dailymotion.com/widgets/languages");
	proxy.register("localhost:8002/languages", "localhost:8003");
	proxy.register("localhost:8002", "localhost:8001");
	$.connect.server({
		root: [
		    './src'
		],
		port: 8001,
		livereload: false
	});
	$.connect.server({
		root: [
		    '/Users/bretikehara/dailymotion/pixelle-ui/app/languages'
		],
		port: 8003
	});
});

gulp.task('default', [ 'server:dev' ]);
