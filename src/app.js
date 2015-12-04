var params;
function getParams (key) {
	if (!params) {
		params = {};
		var entries = window.location.search.substr(1).split('&');
		entries.forEach(function (entry) {
			entry = entry.split('=');
			if (entry[0]) {
				if (!entry[1]) {
					entry[1] = '';
				}
				params[entry[0]] = entry[1];
			}
		});
	}
	return params[key];
}

var CONFIG = {
	locales: [
		'en-US',
		'fr-FR',
	],
	bundles: [
		'accounts',
		'daysOfWeek',
		'profile',
		'activation',
		'devices',
		'registration',
		'adFormats',
		'errorPage',
		'stripe',
		'ads',
		'errors',
		'tactics',
		'campaigns',
		'invoices',
		'users',
		'common',
		'navbar',
		'widgets',
		'days',
		'payments',
	]
};

angular.module('myApp', [
		'ngLocalize',
		'ngLocalize.Config',
		'ngLocalize.InstalledLanguages',
		'agGrid',
	])
    .value('localeSupported', CONFIG.locales)
    .value('localeConf', {
        basePath: getParams('basePath'),
        defaultLocale: CONFIG.locales[0],
        sharedDictionary: 'common',
        fileExtension: '.lang.json',
        persistSelection: false,
        cookieName: 'COOKIE_LOCALE_LANG',
        observableAttrs: new RegExp('^data-(?!ng-|i18n)'),
        delimiter: '::'
    })
	.controller('myApp', function ($q, $timeout, $scope, $window, $interpolate, localeConf, locale) {
		var downloadjs = $window.download;

		$window.onbeforeunload = function(e) {
		  return 'All work will be lost!!!';
		};

        $($window.document.body).keydown(function (e) {
            var elm = e.target.nodeName.toLowerCase();
            if (e.which == 8 && elm !== 'input' && elm  !== 'textarea') {
                e.preventDefault();
            }
            // stopping event bubbling up the DOM tree..
            e.stopPropagation();
        });

		$scope.localeCache = {};

		$scope.errors = [];

		$scope.localeConf = localeConf;

		$scope.locales = CONFIG.locales.slice(1);
		$scope.selectedLocale = $scope.locales[0];
		$scope.bundles = CONFIG.bundles;

		$scope.gridOptions = {
			singleClickEdit: true,
	        pinnedColumnCount: 1,
	        enableColResize: true,
		};

		// load everything into memory;
		function loadBundles (localeIndex, cb) {
			var bundleIndex = 0;
			if (!CONFIG.locales[localeIndex]) {
				(cb || angular.noop)();
				return;
			}
			var localeName = CONFIG.locales[localeIndex];
            locale.setLocale(localeName);
			$scope.localeCache[localeName] = {};

			function next() {
				bundleIndex++;
				if (bundleIndex === CONFIG.bundles.length) {
					loadBundles(localeIndex + 1, cb);
				}
			}

			angular.forEach(CONFIG.bundles, function (bundleName) {
				locale.bundleReady(bundleName).then(function (bundle) {
					$scope.localeCache[localeName][bundleName] = bundle;
					next();
				}, function () {
					console.error("Failed to find bundle: " + bundleName);
					next();
				});
			});
		}

		function forLocales (cb) {
			angular.forEach($scope.localeCache, cb);
		}

		function split (key) {
			return key && key.split('.') || [];
		}

		loadBundles(0, function () {
			var bundleNames = {},
				rowData = {},
				headers = [];


			headers.push({
				headerName: 'Bundle',
				field: 'bundle',
				editable: true,
				onCellValueChanged: function (e) {
					var newVal = split(e.newValue),
						oldVal = split(e.oldValue);

					forLocales(function (bundles, localeName) {
						bundles[newVal[0]][newVal[1]] = bundles[oldVal[0]][oldVal[1]];
						delete bundles[oldVal[0]][oldVal[1]];
					});
				}
			});
			forLocales(function (bundles, localeName) {
				headers.push({
					headerName: localeName,
					field: localeName,
					editable: true,
					onCellValueChanged: function (e) {
						var token = split(e.data.bundle),
							newVal = e.newValue;

						delete bundles[token[0]][token[1]];
						bundles[token[0]][token[1]] = newVal;
					}
				});
				angular.forEach(Object.keys(bundles), function (bundleName) {
					bundleNames[bundleName] = 1;
				});
			});
			forLocales(function (bundles, localeName) {
				angular.forEach(Object.keys(bundleNames), function (bundleName) {
					angular.forEach(bundles[bundleName], function (message, key) {
						var name = bundleName + '.' + key;
						if (!rowData[name]) {
							rowData[name] = {
								bundle: name,
							};
						}
						rowData[name][localeName] = message;
					});
				});
			});
			$scope.bundleNames = Object.keys(bundleNames);

			$scope.gridOptions.api.setColumnDefs(headers);
			$scope.gridOptions.api.setRowData(Object.keys(rowData).map(function (key) {
				return rowData[key];
			}));
			$scope.gridOptions.api.refreshView();
		});

		var entry = $interpolate('"{{ key }}":"{{ value }}"');

		function stringify (o) {
			var output = [];
			Object.keys(o).sort().forEach(function (key) {
				output.push(entry({
					key: key,
					value: o[key].replace(/"/g, '\\\"'),
				}));
			});
			return "{" + output.join() + "}";
		}

		$scope.export = function ($event) {
			var zip = new JSZip(),
				date = moment.utc().format('YYYY-MM-DDTHH_mm_00'),
			    base = zip.folder("languages_" + date);

			forLocales(function (bundles, localeName) {
				var localeFolder = base.folder(localeName);
				angular.forEach(bundles, function (bundle, bundleName) {
					var data = stringify(bundles[bundleName]);
					localeFolder.file(bundleName + ".lang.json", js_beautify(data, {

					}));
				});
			});
			download(zip.generate({type:"blob"}), "languages_" + date + ".zip", "application/zip");
		};
	});
