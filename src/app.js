function getParams (key) {
    if (!this.params) {
        this.params = {};
        var entries = window.location.search.substr(1).split('&');
        entries.forEach(function (entry) {
            entry = entry.split('=');
            if (entry[0]) {
                if (!entry[1]) {
                    entry[1] = '';
                }
                this.params[entry[0]] = entry[1];
            }
        });
    }
    return this.params[key];
}

if (getParams('url')) {
    $.ajax({
        url: getParams('url'),
        method: 'GET',
        cache: false,
        complete: function (data) {
            init(JSON.parse(data.responseText));
        }
    });
} else {
    init({
        basePath: decodeURIComponent(getParams('basePath')),
        locales: getParams('locales').split(','),
        bundles: getParams('bundles').split(','),
    });
}

function init (CONFIG) {
    var r = /chrome\/(\d+)/i,
        m = r.exec(navigator.userAgent);
    if (!m || m[1] < 40) {
        if (m && m[1]) {
            document.querySelector('#chrome').innerHTML = 'Your Chrome version is ' + m[1];
        }
        $('#untested').modal('show');
    }
    angular.module('myApp', [
            'ngLocalize',
            'ngLocalize.Config',
            'ngLocalize.InstalledLanguages',
            'agGrid',
        ])
        .value('localeSupported', CONFIG.locales)
        .value('localeConf', {
            basePath: CONFIG.basePath,
            defaultLocale: CONFIG.locales[0],
            sharedDictionary: 'common',
            fileExtension: '.lang.json',
            persistSelection: false,
            cookieName: 'COOKIE_LOCALE_LANG',
            observableAttrs: new RegExp('^data-(?!ng-|i18n)'),
            delimiter: '::'
        })
        .controller('myApp', function ($q, $timeout, $scope, $window, $interpolate, localeConf, localeEvents, locale) {
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
                groupUseEntireRow: true,
                groupKeys: [
                    'bundle'
                ],
                groupDefaultExpanded: true,
                isExternalFilterPresent: function () {
                    return $scope.missing;
                },
                doesExternalFilterPass: function (node) {
                    var locales = Object.keys($scope.localeCache),
                        passes = true;

                    if ($scope.missing) {
                        angular.forEach(locales, function (key) {
                            passes = passes && !!node.data[key];
                        });
                        passes = !passes;
                    }

                    // node.data
                    return passes;
                }
            };

            $scope.$watch('missing', function (newVal, oldVal) {
                if (newVal !== oldVal){
                    $scope.gridOptions.api.onFilterChanged();
                }
            });

            // load everything into memory;
            function loadBundles (localeIndex, cb) {
                var bundleIndex = 0;
                if (!CONFIG.locales[localeIndex]) {
                    (cb || angular.noop)();
                    return;
                }

                var localeName = CONFIG.locales[localeIndex];
                locale.setLocale(localeName);

                locale.ready(CONFIG.bundles).then(function () {
                    loadBundles(localeIndex + 1, cb)
                });
            }

            $scope.$on(localeEvents.resourceUpdates, function (e, data) {
                if (!$scope.localeCache) {
                    $scope.localeCache = {};
                }
                if (!$scope.localeCache[data.locale]) {
                    $scope.localeCache[data.locale] = {};
                }
                $scope.localeCache[data.locale][data.path] = angular.copy(data.bundle);
            });

            function forLocales (cb) {
                angular.forEach(Object.keys($scope.localeCache).sort(), function (localeName) {
                    cb($scope.localeCache[localeName], localeName);
                });
            }

            function forBundles (bundles, cb) {
                angular.forEach(Object.keys(bundles).sort(), cb);
            }

            loadBundles(0, function () {
                var bundleNames = {},
                    rowData = {},
                    headers = [];

                headers.push({
                    headerName: 'Bundle',
                    field: 'bundleKey',
                    editable: true,
                    onCellValueChanged: function (e) {
                        forLocales(function (bundles, localeName) {
                            bundles[e.data.bundle][e.newValue] = bundles[e.data.bundle][e.oldValue];
                            delete bundles[e.data.bundle][e.oldValue];
                        });
                    }
                });
                forLocales(function (bundles, localeName) {
                    headers.push({
                        headerName: localeName,
                        field: localeName,
                        editable: true,
                        onCellValueChanged: function (e) {
                            delete bundles[e.data.bundle][e.data.bundleKey];
                            bundles[e.data.bundle][e.data.bundleKey] = e.newValue;
                        }
                    });
                    forBundles(bundles, function (bundleName) {
                        bundleNames[bundleName] = 1;
                    });
                });
                forLocales(function (bundles, localeName) {
                    forBundles(bundles, function (bundleName) {
                        angular.forEach(bundles[bundleName], function (message, key) {
                            var name = bundleName + '.' + key;
                            if (!rowData[name]) {
                                rowData[name] = {
                                    bundle: bundleName,
                                    bundleKey: key,
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
                    base = zip.folder("languages_" + date),
                    beautifyOpts = {},
                    fileOpts = {
                        unixPermissions: "644"
                    };

                forLocales(function (bundles, localeName) {
                    var localeFolder = base.folder(localeName);
                    forBundles(bundles, function (bundleName) {
                        var data = stringify(bundles[bundleName]);
                        localeFolder.file(bundleName + ".lang.json", js_beautify(data, beautifyOpts), fileOpts);
                    });
                });
                download(zip.generate({type:"blob"}), "languages_" + date + ".zip", "application/zip");
            };
        });

    angular.bootstrap(document, ['myApp']);
}