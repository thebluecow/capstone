webpackJsonp([0],[
/* 0 */,
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var angular = __webpack_require__(0);
var angularUtils = __webpack_require__(3);
var xeditable = __webpack_require__(5);

angular.module('ijwApp', ['ngRoute', 'angularUtils.directives.dirPagination', 'xeditable'])
.constant('config', {
	'appName': 'ijw',
	'appVersion': '1.0',
	'BONUSES': {
		'min': -20,
		'max': 20
	},
	'MAX_MOVES': 10,
	'MOMENTUM': 4
});

__webpack_require__(6);
__webpack_require__(7);
__webpack_require__(8);
__webpack_require__(9);
__webpack_require__(10);
__webpack_require__(11);
__webpack_require__(12);
__webpack_require__(13);
__webpack_require__(14);
__webpack_require__(15);
__webpack_require__(16);
__webpack_require__(19);
__webpack_require__(20);
__webpack_require__(22);

/***/ }),
/* 2 */,
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

__webpack_require__(4);
module.exports = 'angularUtils.directives.dirPagination';


/***/ }),
/* 4 */
/***/ (function(module, exports) {

/**
 * dirPagination - AngularJS module for paginating (almost) anything.
 *
 *
 * Credits
 * =======
 *
 * Daniel Tabuenca: https://groups.google.com/d/msg/angular/an9QpzqIYiM/r8v-3W1X5vcJ
 * for the idea on how to dynamically invoke the ng-repeat directive.
 *
 * I borrowed a couple of lines and a few attribute names from the AngularUI Bootstrap project:
 * https://github.com/angular-ui/bootstrap/blob/master/src/pagination/pagination.js
 *
 * Copyright 2014 Michael Bromley <michael@michaelbromley.co.uk>
 */

(function() {

    /**
     * Config
     */
    var moduleName = 'angularUtils.directives.dirPagination';
    var DEFAULT_ID = '__default';

    /**
     * Module
     */
    angular.module(moduleName, [])
        .directive('dirPaginate', ['$compile', '$parse', 'paginationService', dirPaginateDirective])
        .directive('dirPaginateNoCompile', noCompileDirective)
        .directive('dirPaginationControls', ['paginationService', 'paginationTemplate', dirPaginationControlsDirective])
        .filter('itemsPerPage', ['paginationService', itemsPerPageFilter])
        .service('paginationService', paginationService)
        .provider('paginationTemplate', paginationTemplateProvider)
        .run(['$templateCache',dirPaginationControlsTemplateInstaller]);

    function dirPaginateDirective($compile, $parse, paginationService) {

        return  {
            terminal: true,
            multiElement: true,
            priority: 100,
            compile: dirPaginationCompileFn
        };

        function dirPaginationCompileFn(tElement, tAttrs){

            var expression = tAttrs.dirPaginate;
            // regex taken directly from https://github.com/angular/angular.js/blob/v1.4.x/src/ng/directive/ngRepeat.js#L339
            var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);

            var filterPattern = /\|\s*itemsPerPage\s*:\s*(.*\(\s*\w*\)|([^\)]*?(?=\s+as\s+))|[^\)]*)/;
            if (match[2].match(filterPattern) === null) {
                throw 'pagination directive: the \'itemsPerPage\' filter must be set.';
            }
            var itemsPerPageFilterRemoved = match[2].replace(filterPattern, '');
            var collectionGetter = $parse(itemsPerPageFilterRemoved);

            addNoCompileAttributes(tElement);

            // If any value is specified for paginationId, we register the un-evaluated expression at this stage for the benefit of any
            // dir-pagination-controls directives that may be looking for this ID.
            var rawId = tAttrs.paginationId || DEFAULT_ID;
            paginationService.registerInstance(rawId);

            return function dirPaginationLinkFn(scope, element, attrs){

                // Now that we have access to the `scope` we can interpolate any expression given in the paginationId attribute and
                // potentially register a new ID if it evaluates to a different value than the rawId.
                var paginationId = $parse(attrs.paginationId)(scope) || attrs.paginationId || DEFAULT_ID;
                
                // (TODO: this seems sound, but I'm reverting as many bug reports followed it's introduction in 0.11.0.
                // Needs more investigation.)
                // In case rawId != paginationId we deregister using rawId for the sake of general cleanliness
                // before registering using paginationId
                // paginationService.deregisterInstance(rawId);
                paginationService.registerInstance(paginationId);

                var repeatExpression = getRepeatExpression(expression, paginationId);
                addNgRepeatToElement(element, attrs, repeatExpression);

                removeTemporaryAttributes(element);
                var compiled =  $compile(element);

                var currentPageGetter = makeCurrentPageGetterFn(scope, attrs, paginationId);
                paginationService.setCurrentPageParser(paginationId, currentPageGetter, scope);

                if (typeof attrs.totalItems !== 'undefined') {
                    paginationService.setAsyncModeTrue(paginationId);
                    scope.$watch(function() {
                        return $parse(attrs.totalItems)(scope);
                    }, function (result) {
                        if (0 <= result) {
                            paginationService.setCollectionLength(paginationId, result);
                        }
                    });
                } else {
                    paginationService.setAsyncModeFalse(paginationId);
                    scope.$watchCollection(function() {
                        return collectionGetter(scope);
                    }, function(collection) {
                        if (collection) {
                            var collectionLength = (collection instanceof Array) ? collection.length : Object.keys(collection).length;
                            paginationService.setCollectionLength(paginationId, collectionLength);
                        }
                    });
                }

                // Delegate to the link function returned by the new compilation of the ng-repeat
                compiled(scope);
                 
                // (TODO: Reverting this due to many bug reports in v 0.11.0. Needs investigation as the
                // principle is sound)
                // When the scope is destroyed, we make sure to remove the reference to it in paginationService
                // so that it can be properly garbage collected
                // scope.$on('$destroy', function destroyDirPagination() {
                //     paginationService.deregisterInstance(paginationId);
                // });
            };
        }

        /**
         * If a pagination id has been specified, we need to check that it is present as the second argument passed to
         * the itemsPerPage filter. If it is not there, we add it and return the modified expression.
         *
         * @param expression
         * @param paginationId
         * @returns {*}
         */
        function getRepeatExpression(expression, paginationId) {
            var repeatExpression,
                idDefinedInFilter = !!expression.match(/(\|\s*itemsPerPage\s*:[^|]*:[^|]*)/);

            if (paginationId !== DEFAULT_ID && !idDefinedInFilter) {
                repeatExpression = expression.replace(/(\|\s*itemsPerPage\s*:\s*[^|\s]*)/, "$1 : '" + paginationId + "'");
            } else {
                repeatExpression = expression;
            }

            return repeatExpression;
        }

        /**
         * Adds the ng-repeat directive to the element. In the case of multi-element (-start, -end) it adds the
         * appropriate multi-element ng-repeat to the first and last element in the range.
         * @param element
         * @param attrs
         * @param repeatExpression
         */
        function addNgRepeatToElement(element, attrs, repeatExpression) {
            if (element[0].hasAttribute('dir-paginate-start') || element[0].hasAttribute('data-dir-paginate-start')) {
                // using multiElement mode (dir-paginate-start, dir-paginate-end)
                attrs.$set('ngRepeatStart', repeatExpression);
                element.eq(element.length - 1).attr('ng-repeat-end', true);
            } else {
                attrs.$set('ngRepeat', repeatExpression);
            }
        }

        /**
         * Adds the dir-paginate-no-compile directive to each element in the tElement range.
         * @param tElement
         */
        function addNoCompileAttributes(tElement) {
            angular.forEach(tElement, function(el) {
                if (el.nodeType === 1) {
                    angular.element(el).attr('dir-paginate-no-compile', true);
                }
            });
        }

        /**
         * Removes the variations on dir-paginate (data-, -start, -end) and the dir-paginate-no-compile directives.
         * @param element
         */
        function removeTemporaryAttributes(element) {
            angular.forEach(element, function(el) {
                if (el.nodeType === 1) {
                    angular.element(el).removeAttr('dir-paginate-no-compile');
                }
            });
            element.eq(0).removeAttr('dir-paginate-start').removeAttr('dir-paginate').removeAttr('data-dir-paginate-start').removeAttr('data-dir-paginate');
            element.eq(element.length - 1).removeAttr('dir-paginate-end').removeAttr('data-dir-paginate-end');
        }

        /**
         * Creates a getter function for the current-page attribute, using the expression provided or a default value if
         * no current-page expression was specified.
         *
         * @param scope
         * @param attrs
         * @param paginationId
         * @returns {*}
         */
        function makeCurrentPageGetterFn(scope, attrs, paginationId) {
            var currentPageGetter;
            if (attrs.currentPage) {
                currentPageGetter = $parse(attrs.currentPage);
            } else {
                // If the current-page attribute was not set, we'll make our own.
                // Replace any non-alphanumeric characters which might confuse
                // the $parse service and give unexpected results.
                // See https://github.com/michaelbromley/angularUtils/issues/233
                var defaultCurrentPage = (paginationId + '__currentPage').replace(/\W/g, '_');
                scope[defaultCurrentPage] = 1;
                currentPageGetter = $parse(defaultCurrentPage);
            }
            return currentPageGetter;
        }
    }

    /**
     * This is a helper directive that allows correct compilation when in multi-element mode (ie dir-paginate-start, dir-paginate-end).
     * It is dynamically added to all elements in the dir-paginate compile function, and it prevents further compilation of
     * any inner directives. It is then removed in the link function, and all inner directives are then manually compiled.
     */
    function noCompileDirective() {
        return {
            priority: 5000,
            terminal: true
        };
    }

    function dirPaginationControlsTemplateInstaller($templateCache) {
        $templateCache.put('angularUtils.directives.dirPagination.template', '<ul class="pagination" ng-if="1 < pages.length || !autoHide"><li ng-if="boundaryLinks" ng-class="{ disabled : pagination.current == 1 }"><a href="" ng-click="setCurrent(1)">&laquo;</a></li><li ng-if="directionLinks" ng-class="{ disabled : pagination.current == 1 }"><a href="" ng-click="setCurrent(pagination.current - 1)">&lsaquo;</a></li><li ng-repeat="pageNumber in pages track by tracker(pageNumber, $index)" ng-class="{ active : pagination.current == pageNumber, disabled : pageNumber == \'...\' || ( ! autoHide && pages.length === 1 ) }"><a href="" ng-click="setCurrent(pageNumber)">{{ pageNumber }}</a></li><li ng-if="directionLinks" ng-class="{ disabled : pagination.current == pagination.last }"><a href="" ng-click="setCurrent(pagination.current + 1)">&rsaquo;</a></li><li ng-if="boundaryLinks"  ng-class="{ disabled : pagination.current == pagination.last }"><a href="" ng-click="setCurrent(pagination.last)">&raquo;</a></li></ul>');
    }

    function dirPaginationControlsDirective(paginationService, paginationTemplate) {

        var numberRegex = /^\d+$/;

        var DDO = {
            restrict: 'AE',
            scope: {
                maxSize: '=?',
                onPageChange: '&?',
                paginationId: '=?',
                autoHide: '=?'
            },
            link: dirPaginationControlsLinkFn
        };

        // We need to check the paginationTemplate service to see whether a template path or
        // string has been specified, and add the `template` or `templateUrl` property to
        // the DDO as appropriate. The order of priority to decide which template to use is
        // (highest priority first):
        // 1. paginationTemplate.getString()
        // 2. attrs.templateUrl
        // 3. paginationTemplate.getPath()
        var templateString = paginationTemplate.getString();
        if (templateString !== undefined) {
            DDO.template = templateString;
        } else {
            DDO.templateUrl = function(elem, attrs) {
                return attrs.templateUrl || paginationTemplate.getPath();
            };
        }
        return DDO;

        function dirPaginationControlsLinkFn(scope, element, attrs) {

            // rawId is the un-interpolated value of the pagination-id attribute. This is only important when the corresponding dir-paginate directive has
            // not yet been linked (e.g. if it is inside an ng-if block), and in that case it prevents this controls directive from assuming that there is
            // no corresponding dir-paginate directive and wrongly throwing an exception.
            var rawId = attrs.paginationId ||  DEFAULT_ID;
            var paginationId = scope.paginationId || attrs.paginationId ||  DEFAULT_ID;

            if (!paginationService.isRegistered(paginationId) && !paginationService.isRegistered(rawId)) {
                var idMessage = (paginationId !== DEFAULT_ID) ? ' (id: ' + paginationId + ') ' : ' ';
                if (window.console) {
                    console.warn('Pagination directive: the pagination controls' + idMessage + 'cannot be used without the corresponding pagination directive, which was not found at link time.');
                }
            }

            if (!scope.maxSize) { scope.maxSize = 9; }
            scope.autoHide = scope.autoHide === undefined ? true : scope.autoHide;
            scope.directionLinks = angular.isDefined(attrs.directionLinks) ? scope.$parent.$eval(attrs.directionLinks) : true;
            scope.boundaryLinks = angular.isDefined(attrs.boundaryLinks) ? scope.$parent.$eval(attrs.boundaryLinks) : false;

            var paginationRange = Math.max(scope.maxSize, 5);
            scope.pages = [];
            scope.pagination = {
                last: 1,
                current: 1
            };
            scope.range = {
                lower: 1,
                upper: 1,
                total: 1
            };

            scope.$watch('maxSize', function(val) {
                if (val) {
                    paginationRange = Math.max(scope.maxSize, 5);
                    generatePagination();
                }
            });

            scope.$watch(function() {
                if (paginationService.isRegistered(paginationId)) {
                    return (paginationService.getCollectionLength(paginationId) + 1) * paginationService.getItemsPerPage(paginationId);
                }
            }, function(length) {
                if (0 < length) {
                    generatePagination();
                }
            });

            scope.$watch(function() {
                if (paginationService.isRegistered(paginationId)) {
                    return (paginationService.getItemsPerPage(paginationId));
                }
            }, function(current, previous) {
                if (current != previous && typeof previous !== 'undefined') {
                    goToPage(scope.pagination.current);
                }
            });

            scope.$watch(function() {
                if (paginationService.isRegistered(paginationId)) {
                    return paginationService.getCurrentPage(paginationId);
                }
            }, function(currentPage, previousPage) {
                if (currentPage != previousPage) {
                    goToPage(currentPage);
                }
            });

            scope.setCurrent = function(num) {
                if (paginationService.isRegistered(paginationId) && isValidPageNumber(num)) {
                    num = parseInt(num, 10);
                    paginationService.setCurrentPage(paginationId, num);
                }
            };

            /**
             * Custom "track by" function which allows for duplicate "..." entries on long lists,
             * yet fixes the problem of wrongly-highlighted links which happens when using
             * "track by $index" - see https://github.com/michaelbromley/angularUtils/issues/153
             * @param id
             * @param index
             * @returns {string}
             */
            scope.tracker = function(id, index) {
                return id + '_' + index;
            };

            function goToPage(num) {
                if (paginationService.isRegistered(paginationId) && isValidPageNumber(num)) {
                    var oldPageNumber = scope.pagination.current;

                    scope.pages = generatePagesArray(num, paginationService.getCollectionLength(paginationId), paginationService.getItemsPerPage(paginationId), paginationRange);
                    scope.pagination.current = num;
                    updateRangeValues();

                    // if a callback has been set, then call it with the page number as the first argument
                    // and the previous page number as a second argument
                    if (scope.onPageChange) {
                        scope.onPageChange({
                            newPageNumber : num,
                            oldPageNumber : oldPageNumber
                        });
                    }
                }
            }

            function generatePagination() {
                if (paginationService.isRegistered(paginationId)) {
                    var page = parseInt(paginationService.getCurrentPage(paginationId)) || 1;
                    scope.pages = generatePagesArray(page, paginationService.getCollectionLength(paginationId), paginationService.getItemsPerPage(paginationId), paginationRange);
                    scope.pagination.current = page;
                    scope.pagination.last = scope.pages[scope.pages.length - 1];
                    if (scope.pagination.last < scope.pagination.current) {
                        scope.setCurrent(scope.pagination.last);
                    } else {
                        updateRangeValues();
                    }
                }
            }

            /**
             * This function updates the values (lower, upper, total) of the `scope.range` object, which can be used in the pagination
             * template to display the current page range, e.g. "showing 21 - 40 of 144 results";
             */
            function updateRangeValues() {
                if (paginationService.isRegistered(paginationId)) {
                    var currentPage = paginationService.getCurrentPage(paginationId),
                        itemsPerPage = paginationService.getItemsPerPage(paginationId),
                        totalItems = paginationService.getCollectionLength(paginationId);

                    scope.range.lower = (currentPage - 1) * itemsPerPage + 1;
                    scope.range.upper = Math.min(currentPage * itemsPerPage, totalItems);
                    scope.range.total = totalItems;
                }
            }
            function isValidPageNumber(num) {
                return (numberRegex.test(num) && (0 < num && num <= scope.pagination.last));
            }
        }

        /**
         * Generate an array of page numbers (or the '...' string) which is used in an ng-repeat to generate the
         * links used in pagination
         *
         * @param currentPage
         * @param rowsPerPage
         * @param paginationRange
         * @param collectionLength
         * @returns {Array}
         */
        function generatePagesArray(currentPage, collectionLength, rowsPerPage, paginationRange) {
            var pages = [];
            var totalPages = Math.ceil(collectionLength / rowsPerPage);
            var halfWay = Math.ceil(paginationRange / 2);
            var position;

            if (currentPage <= halfWay) {
                position = 'start';
            } else if (totalPages - halfWay < currentPage) {
                position = 'end';
            } else {
                position = 'middle';
            }

            var ellipsesNeeded = paginationRange < totalPages;
            var i = 1;
            while (i <= totalPages && i <= paginationRange) {
                var pageNumber = calculatePageNumber(i, currentPage, paginationRange, totalPages);

                var openingEllipsesNeeded = (i === 2 && (position === 'middle' || position === 'end'));
                var closingEllipsesNeeded = (i === paginationRange - 1 && (position === 'middle' || position === 'start'));
                if (ellipsesNeeded && (openingEllipsesNeeded || closingEllipsesNeeded)) {
                    pages.push('...');
                } else {
                    pages.push(pageNumber);
                }
                i ++;
            }
            return pages;
        }

        /**
         * Given the position in the sequence of pagination links [i], figure out what page number corresponds to that position.
         *
         * @param i
         * @param currentPage
         * @param paginationRange
         * @param totalPages
         * @returns {*}
         */
        function calculatePageNumber(i, currentPage, paginationRange, totalPages) {
            var halfWay = Math.ceil(paginationRange/2);
            if (i === paginationRange) {
                return totalPages;
            } else if (i === 1) {
                return i;
            } else if (paginationRange < totalPages) {
                if (totalPages - halfWay < currentPage) {
                    return totalPages - paginationRange + i;
                } else if (halfWay < currentPage) {
                    return currentPage - halfWay + i;
                } else {
                    return i;
                }
            } else {
                return i;
            }
        }
    }

    /**
     * This filter slices the collection into pages based on the current page number and number of items per page.
     * @param paginationService
     * @returns {Function}
     */
    function itemsPerPageFilter(paginationService) {

        return function(collection, itemsPerPage, paginationId) {
            if (typeof (paginationId) === 'undefined') {
                paginationId = DEFAULT_ID;
            }
            if (!paginationService.isRegistered(paginationId)) {
                throw 'pagination directive: the itemsPerPage id argument (id: ' + paginationId + ') does not match a registered pagination-id.';
            }
            var end;
            var start;
            if (angular.isObject(collection)) {
                itemsPerPage = parseInt(itemsPerPage) || 9999999999;
                if (paginationService.isAsyncMode(paginationId)) {
                    start = 0;
                } else {
                    start = (paginationService.getCurrentPage(paginationId) - 1) * itemsPerPage;
                }
                end = start + itemsPerPage;
                paginationService.setItemsPerPage(paginationId, itemsPerPage);

                if (collection instanceof Array) {
                    // the array just needs to be sliced
                    return collection.slice(start, end);
                } else {
                    // in the case of an object, we need to get an array of keys, slice that, then map back to
                    // the original object.
                    var slicedObject = {};
                    angular.forEach(keys(collection).slice(start, end), function(key) {
                        slicedObject[key] = collection[key];
                    });
                    return slicedObject;
                }
            } else {
                return collection;
            }
        };
    }

    /**
     * Shim for the Object.keys() method which does not exist in IE < 9
     * @param obj
     * @returns {Array}
     */
    function keys(obj) {
        if (!Object.keys) {
            var objKeys = [];
            for (var i in obj) {
                if (obj.hasOwnProperty(i)) {
                    objKeys.push(i);
                }
            }
            return objKeys;
        } else {
            return Object.keys(obj);
        }
    }

    /**
     * This service allows the various parts of the module to communicate and stay in sync.
     */
    function paginationService() {

        var instances = {};
        var lastRegisteredInstance;

        this.registerInstance = function(instanceId) {
            if (typeof instances[instanceId] === 'undefined') {
                instances[instanceId] = {
                    asyncMode: false
                };
                lastRegisteredInstance = instanceId;
            }
        };

        this.deregisterInstance = function(instanceId) {
            delete instances[instanceId];
        };
        
        this.isRegistered = function(instanceId) {
            return (typeof instances[instanceId] !== 'undefined');
        };

        this.getLastInstanceId = function() {
            return lastRegisteredInstance;
        };

        this.setCurrentPageParser = function(instanceId, val, scope) {
            instances[instanceId].currentPageParser = val;
            instances[instanceId].context = scope;
        };
        this.setCurrentPage = function(instanceId, val) {
            instances[instanceId].currentPageParser.assign(instances[instanceId].context, val);
        };
        this.getCurrentPage = function(instanceId) {
            var parser = instances[instanceId].currentPageParser;
            return parser ? parser(instances[instanceId].context) : 1;
        };

        this.setItemsPerPage = function(instanceId, val) {
            instances[instanceId].itemsPerPage = val;
        };
        this.getItemsPerPage = function(instanceId) {
            return instances[instanceId].itemsPerPage;
        };

        this.setCollectionLength = function(instanceId, val) {
            instances[instanceId].collectionLength = val;
        };
        this.getCollectionLength = function(instanceId) {
            return instances[instanceId].collectionLength;
        };

        this.setAsyncModeTrue = function(instanceId) {
            instances[instanceId].asyncMode = true;
        };

        this.setAsyncModeFalse = function(instanceId) {
            instances[instanceId].asyncMode = false;
        };

        this.isAsyncMode = function(instanceId) {
            return instances[instanceId].asyncMode;
        };
    }

    /**
     * This provider allows global configuration of the template path used by the dir-pagination-controls directive.
     */
    function paginationTemplateProvider() {

        var templatePath = 'angularUtils.directives.dirPagination.template';
        var templateString;

        /**
         * Set a templateUrl to be used by all instances of <dir-pagination-controls>
         * @param {String} path
         */
        this.setPath = function(path) {
            templatePath = path;
        };

        /**
         * Set a string of HTML to be used as a template by all instances
         * of <dir-pagination-controls>. If both a path *and* a string have been set,
         * the string takes precedence.
         * @param {String} str
         */
        this.setString = function(str) {
            templateString = str;
        };

        this.$get = function() {
            return {
                getPath: function() {
                    return templatePath;
                },
                getString: function() {
                    return templateString;
                }
            };
        };
    }
})();


/***/ }),
/* 5 */
/***/ (function(module, exports) {

/*!
angular-xeditable - 0.8.0
Edit-in-place for angular.js
Build date: 2017-06-06 
*/
/**
 * Angular-xeditable module 
 *
 */
angular.module('xeditable', [])


/**
 * Default options. 
 *
 * @namespace editable-options
 */
//todo: maybe better have editableDefaults, not options...
.value('editableOptions', {
  /**
   * Theme. Possible values `bs3`, `bs2`, `default`.  
   * Default is `default`
   * 
   * @var {string} theme
   * @memberOf editable-options
   */  
  theme: 'default',
  /**
   * icon_set. Possible values `font-awesome`, `default`.  
   * Default is `default`
   * 
   * @var {string} icon set
   * @memberOf editable-options
   */  
  icon_set: 'default',
  /**
   * Whether to show buttons for single editable element.  
   * Possible values `right`, `no`.  
   * Default is `right`
   * 
   * @var {string} buttons
   * @memberOf editable-options
   */    
  buttons: 'right',
  /**
   * Default value for `blur` attribute of single editable element.  
   * Can be `cancel|submit|ignore`.  
   * Default is `cancel`
   * 
   * @var {string} blurElem
   * @memberOf editable-options
   */
  blurElem: 'cancel',
  /**
   * Default value for `blur` attribute of editable form.  
   * Can be `cancel|submit|ignore`.  
   * Default is `ignore`.
   * 
   * @var {string} blurForm
   * @memberOf editable-options
   */
  blurForm: 'ignore',
  /**
   * How input elements get activated. Possible values: `focus|select|none`.  
   * Default is `focus`
   *
   * @var {string} activate
   * @memberOf editable-options
   */
  activate: 'focus',
  /**
   * Whether to disable x-editable. Can be overloaded on each element.  
   * Default is `false`
   *
   * @var {boolean} isDisabled
   * @memberOf editable-options
   */
   isDisabled: false,
  
  /**
   * Event, on which the edit mode gets activated. 
   * Can be any event.  
   * Default is `click`
   *
   * @var {string} activationEvent
   * @memberOf editable-options
   */
  activationEvent: 'click',

  /**
   * The default title of the submit button.  
   * Default is `Submit`
   *
   * @var {string} submitButtonTitle
   * @memberOf editable-options
   */
  submitButtonTitle: 'Submit',

  /**
   * The default aria label of the submit button.  
   * Default is `Submit`
   *
   * @var {string} submitButtonAriaLabel
   * @memberOf editable-options
   */
  submitButtonAriaLabel: 'Submit',

  /**
   * The default title of the cancel button.  
   * Default is `Cancel`
   *
   * @var {string} cancelButtonTitle
   * @memberOf editable-options
   */
  cancelButtonTitle: 'Cancel',

  /**
   * The default aria label of the cancel button.  
   * Default is `Cancel`
   *
   * @var {string} cancelButtonAriaLabel
   * @memberOf editable-options
   */
  cancelButtonAriaLabel: 'Cancel',

  /**
   * The default title of the clear button.  
   * Default is `Clear`
   *
   * @var {string} clearButtonTitle
   * @memberOf editable-options
   */
  clearButtonTitle: 'Clear',

  /**
   * The default aria label of the clear button.  
   * Default is `Clear`
   *
   * @var {string} clearButtonAriaLabel
   * @memberOf editable-options
   */
  clearButtonAriaLabel: 'Clear',

  /**
   * Whether to display the clear button.  
   * Default is `false`
   *
   * @var {boolean} displayClearButton
   * @memberOf editable-options
   */
  displayClearButton: false
});

/*
 Angular-ui bootstrap datepicker
 http://angular-ui.github.io/bootstrap/#/datepicker
 */
angular.module('xeditable').directive('editableBsdate', ['editableDirectiveFactory', '$injector', '$parse',
    function(editableDirectiveFactory, $injector, $parse) {

        // Constants from Angular-ui bootstrap datepicker
        uibDatepickerConfig = $injector.get('uibDatepickerConfig');
        uibDatepickerPopupConfig = $injector.get('uibDatepickerPopupConfig');

        var popupAttrNames = [
            ['eIsOpen', 'is-open'],
            ['eDateDisabled', 'date-disabled'],
            ['eDatepickerPopup', 'uib-datepicker-popup'],
            ['eShowButtonBar', 'show-button-bar'],
            ['eCurrentText', 'current-text'],
            ['eClearText', 'clear-text'],
            ['eCloseText', 'close-text'],
            ['eCloseOnDateSelection', 'close-on-date-selection'],
            ['eDatepickerAppendToBody', 'datepicker-append-to-body'],
            ['eOnOpenFocus', 'on-open-focus'],
            ['eName', 'name'],
            ['eDateDisabled', 'date-disabled'],
            ['eAltInputFormats', 'alt-input-formats']
        ];

        var dateOptionsNames = [
            ['eFormatDay', 'formatDay'],
            ['eFormatMonth', 'formatMonth'],
            ['eFormatYear', 'formatYear'],
            ['eFormatDayHeader', 'formatDayHeader'],
            ['eFormatDayTitle', 'formatDayTitle'],
            ['eFormatMonthTitle', 'formatMonthTitle'],
            ['eMaxMode', 'maxMode'],
            ['eMinMode', 'minMode'],
            ['eDatepickerMode', 'datepickerMode']
        ];

        return editableDirectiveFactory({
            directiveName: 'editableBsdate',
            inputTpl: '<div></div>',
            render: function() {
                /** This basically renders a datepicker as in the example shown in
                 **  http://angular-ui.github.io/bootstrap/#/datepicker
                 **  The attributes are all the same as in the bootstrap-ui datepicker with e- as prefix
                 **/
                this.parent.render.call(this);

                var attrs = this.attrs;
                var scope = this.scope;

                var inputDatePicker = angular.element('<input type="text" class="form-control" ng-model="$parent.$data"/>');

                inputDatePicker.attr('uib-datepicker-popup', attrs.eDatepickerPopupXEditable || uibDatepickerPopupConfig.datepickerPopup );
                inputDatePicker.attr('year-range', attrs.eYearRange || 20);
                inputDatePicker.attr('ng-readonly', attrs.eReadonly || false);

                for (var i = popupAttrNames.length - 1; i >= 0; i--) {
                    var popupAttr = attrs[popupAttrNames[i][0]];
                    if (typeof popupAttr !== 'undefined') {
                        inputDatePicker.attr(popupAttrNames[i][1], popupAttr);
                    }
                }

                if (attrs.eNgChange) {
                    inputDatePicker.attr('ng-change', attrs.eNgChange);
                    this.inputEl.removeAttr('ng-change');
                }

                if (attrs.eStyle) {
                    inputDatePicker.attr('style', attrs.eStyle);
                    this.inputEl.removeAttr('style');
                }

                var dateOptions = {
                    maxDate: scope.$eval(attrs.eMaxDate) || uibDatepickerConfig.maxDate,
                    minDate: scope.$eval(attrs.eMinDate) || uibDatepickerConfig.minDate,
                    showWeeks: attrs.eShowWeeks ? attrs.eShowWeeks.toLowerCase() === 'true' : uibDatepickerConfig.showWeeks,
                    startingDay: attrs.eStartingDay || 0,
                    initDate: scope.$eval(attrs.eInitDate) || new Date()
                };

                if (attrs.eDatepickerOptions) {
                    var eDatepickerOptions = $parse(attrs.eDatepickerOptions)(scope);
                    angular.extend(dateOptions, eDatepickerOptions);
                }

                for (var z = dateOptionsNames.length - 1; z >= 0; z--) {
                    var doAttr = attrs[dateOptionsNames[z][0]];
                    if (typeof doAttr !== 'undefined') {
                        dateOptions[dateOptionsNames[z][1]] = doAttr;
                    }
                }

                scope.dateOptions = dateOptions;

                var showCalendarButton = angular.isDefined(attrs.eShowCalendarButton) ? attrs.eShowCalendarButton : "true";

                //See if calendar button should be displayed
                if (showCalendarButton === "true") {
                    var buttonDatePicker = angular.element('<button type="button" class="btn btn-default"><i class="glyphicon glyphicon-calendar"></i></button>');
                    var buttonWrapper = angular.element('<span class="input-group-btn"></span>');

                    buttonDatePicker.attr('ng-click', attrs.eNgClick);

                    buttonWrapper.append(buttonDatePicker);

                    this.inputEl.append(buttonWrapper);
                } else {
                    //If no calendar button, display calendar popup on click of input field
                    inputDatePicker.attr('ng-click', attrs.eNgClick);
                }

                inputDatePicker.attr('datepicker-options', "dateOptions");

                this.inputEl.prepend(inputDatePicker);

                this.inputEl.removeAttr('class');
                this.inputEl.removeAttr('ng-click');
                this.inputEl.removeAttr('is-open');
                this.inputEl.removeAttr('init-date');
                this.inputEl.removeAttr('datepicker-popup');
                this.inputEl.removeAttr('required');
                this.inputEl.removeAttr('ng-model');
                this.inputEl.removeAttr('date-picker-append-to-body');
                this.inputEl.removeAttr('name');
                this.inputEl.attr('class','input-group');
            },
            autosubmit: function() {
                var self = this;
                self.inputEl.bind('change', function() {
                    setTimeout(function() {
                        self.scope.$apply(function() {
                            self.scope.$form.$submit();
                        });
                    }, 500);
                });
                
                self.inputEl.bind('keydown', function(e) {
                    //submit on tab
                    if (e.keyCode === 9 && self.editorEl.attr('blur') === 'submit') {
                        self.scope.$apply(function() {
                            self.scope.$form.$submit();
                        });
                    }
                });
            }
    });
}]);

/*
Angular-ui bootstrap editable timepicker
http://angular-ui.github.io/bootstrap/#/timepicker
*/
angular.module('xeditable').directive('editableBstime', ['editableDirectiveFactory',
  function(editableDirectiveFactory) {
    return editableDirectiveFactory({
      directiveName: 'editableBstime',
      inputTpl: '<div uib-timepicker></div>',
      render: function() {
        this.parent.render.call(this);

        // timepicker can't update model when ng-model set directly to it
        // see: https://github.com/angular-ui/bootstrap/issues/1141
        // so we wrap it into DIV
        var div = angular.element('<div class="well well-small" style="display:inline-block;"></div>');

        // move ng-model to wrapping div
        div.attr('ng-model', this.inputEl.attr('ng-model'));
        this.inputEl.removeAttr('ng-model');

        // move ng-change to wrapping div
        if(this.attrs.eNgChange) {
          div.attr('ng-change', this.inputEl.attr('ng-change'));
          this.inputEl.removeAttr('ng-change');
        }

        // wrap
        this.inputEl.wrap(div);
      }
    });
}]);
//checkbox
angular.module('xeditable').directive('editableCheckbox', ['editableDirectiveFactory',
  function(editableDirectiveFactory) {
    return editableDirectiveFactory({
      directiveName: 'editableCheckbox',
      inputTpl: '<input type="checkbox">',
      render: function() {
        this.parent.render.call(this);
        this.inputEl.wrap('<label></label>');
        
        if (this.attrs.eTitle) {
          this.inputEl.parent().append('<span>' + this.attrs.eTitle + '</span>');
       }
      },
      autosubmit: function() {
        var self = this;
        self.inputEl.bind('change', function() {
          setTimeout(function() {
            self.scope.$apply(function() {
              self.scope.$form.$submit();
            });
          }, 500);
        });
      }
    });
}]);

// checklist
angular.module('xeditable').directive('editableChecklist', [
  'editableDirectiveFactory',
  'editableNgOptionsParser',
  function(editableDirectiveFactory, editableNgOptionsParser) {
    return editableDirectiveFactory({
      directiveName: 'editableChecklist',
      inputTpl: '<span></span>',
      useCopy: true,
      render: function() {
        this.parent.render.call(this);
        var parsed = editableNgOptionsParser(this.attrs.eNgOptions);
        var ngChangeHtml = '';
        var ngChecklistComparatorHtml = '';

        if (this.attrs.eNgChange) {
          ngChangeHtml = ' ng-change="' +  this.attrs.eNgChange + '"';
        }

        if (this.attrs.eChecklistComparator) {
          ngChecklistComparatorHtml = ' checklist-comparator="' +  this.attrs.eChecklistComparator + '"';
        }
        
        var html = '<label ng-repeat="'+parsed.ngRepeat+'">'+
          '<input type="checkbox" checklist-model="$parent.$parent.$data" checklist-value="'+parsed.locals.valueFn+'"' +
            ngChangeHtml + ngChecklistComparatorHtml + '>'+
          '<span ng-bind="'+parsed.locals.displayFn+'"></span></label>';

        this.inputEl.removeAttr('ng-model');
        this.inputEl.removeAttr('ng-options');
        this.inputEl.removeAttr('ng-change');
        this.inputEl.removeAttr('checklist-comparator');
        this.inputEl.html(html);
      }
    });
}]);

angular.module('xeditable').directive('editableCombodate', ['editableDirectiveFactory', 'editableCombodate',
  function(editableDirectiveFactory, editableCombodate) {
    return editableDirectiveFactory({
      directiveName: 'editableCombodate',
      inputTpl: '<input type="text">',
      render: function() {
        this.parent.render.call(this);

        var options = {
          value: new Date(this.scope.$data)
        };
        var self = this;
        angular.forEach(["format", "template", "minYear", "maxYear", "yearDescending", "minuteStep", "secondStep", "firstItem", "errorClass", "customClass", "roundTime", "smartDays"], function(name) {

          var attrName = "e" + name.charAt(0).toUpperCase() + name.slice(1);

          if (attrName in self.attrs) {
            if (name == "minYear" || name == "maxYear" || name == "minuteStep" || name == "secondStep") {
              options[name] = parseInt(self.attrs[attrName], 10);
            } else {
              options[name] = self.attrs[attrName];
            }
          }
        });

        var combodate = editableCombodate.getInstance(this.inputEl, options);
        combodate.$widget.find('select').bind('change', function(e) {
          //.replace is so this works in Safari
          self.scope.$data = combodate.getValue() ?
              (new Date(combodate.getValue().replace(/-/g, "/"))).toISOString() : null;
        });
      }
    });
  }
]);

/*
Input types: text|password|email|tel|number|url|search|color|date|datetime|datetime-local|time|month|week|file
*/

(function() {

  var camelCase = function(dashDelimitedString) {
    return dashDelimitedString.toLowerCase().replace(/-(.)/g, function(match, word) {
      return word.toUpperCase();
    });
  };

  var types = 'text|password|email|tel|number|url|search|color|date|datetime|datetime-local|time|month|week|file'.split('|');

  //todo: datalist
  
  // generate directives
  angular.forEach(types, function(type) {
    var directiveName = camelCase('editable' + '-' + type);
    angular.module('xeditable').directive(directiveName, ['editableDirectiveFactory',
      function(editableDirectiveFactory) {
        return editableDirectiveFactory({
          directiveName: directiveName,
          inputTpl: '<input type="'+type+'">',
          render: function() {
            this.parent.render.call(this);

            //Add bootstrap simple input groups
            if (this.attrs.eInputgroupleft || this.attrs.eInputgroupright) {
              this.inputEl.wrap('<div class="input-group"></div>');

              if (this.attrs.eInputgroupleft) {
                var inputGroupLeft = angular.element('<span class="input-group-addon">' + this.attrs.eInputgroupleft + '</span>');
                this.inputEl.parent().prepend(inputGroupLeft);
              }

              if (this.attrs.eInputgroupright) {
                var inputGroupRight = angular.element('<span class="input-group-addon">' + this.attrs.eInputgroupright + '</span>');
                this.inputEl.parent().append(inputGroupRight);
              }
            }

            // Add label to the input
            if (this.attrs.eLabel) {
              var label = angular.element('<label>' + this.attrs.eLabel + '</label>');
              if (this.attrs.eInputgroupleft || this.attrs.eInputgroupright) {
                this.inputEl.parent().parent().prepend(label);
              } else {
                this.inputEl.parent().prepend(label);
              }
            }
            
            // Add classes to the form
            if (this.attrs.eFormclass) {
              this.editorEl.addClass(this.attrs.eFormclass);
            }
          },
          autosubmit: function() {
            var self = this;
            self.inputEl.bind('keydown', function(e) {
                //submit on tab
                if (e.keyCode === 9 && self.editorEl.attr('blur') === 'submit') {
                    self.scope.$apply(function() {
                        self.scope.$form.$submit();
                    });
                }
            });
          }
        });
    }]);
  });

  //`range` is bit specific
  angular.module('xeditable').directive('editableRange', ['editableDirectiveFactory', '$interpolate',
    function(editableDirectiveFactory, $interpolate) {
      return editableDirectiveFactory({
        directiveName: 'editableRange',
        inputTpl: '<input type="range" id="range" name="range">',
        render: function() {
          this.parent.render.call(this);
          this.inputEl.after('<output>' + $interpolate.startSymbol() + '$data' + $interpolate.endSymbol()  + '</output>');
        }        
      });
  }]);

}());


/*
 Tags input directive for AngularJS
 https://github.com/mbenford/ngTagsInput
 */
angular.module('xeditable').directive('editableTagsInput', ['editableDirectiveFactory', 'editableUtils',
  function(editableDirectiveFactory, editableUtils) {
    var dir = editableDirectiveFactory({
        directiveName: 'editableTagsInput',
        inputTpl: '<tags-input></tags-input>',
        useCopy: true,
        render: function () {
            this.parent.render.call(this);
            this.inputEl.append(editableUtils.rename('auto-complete', this.attrs.$autoCompleteElement));
            this.inputEl.removeAttr('ng-model');
            this.inputEl.attr('ng-model', '$parent.$data');
        }
    });

    var linkOrg = dir.link;

    dir.link = function (scope, el, attrs, ctrl) {
        var autoCompleteEl = el.find('editable-tags-input-auto-complete');

        attrs.$autoCompleteElement = autoCompleteEl.clone();

        autoCompleteEl.remove();

        return linkOrg(scope, el, attrs, ctrl);
    };

    return dir;
}]);
// radiolist
angular.module('xeditable').directive('editableRadiolist', [
  'editableDirectiveFactory',
  'editableNgOptionsParser',
  '$interpolate',
  function(editableDirectiveFactory, editableNgOptionsParser, $interpolate) {
    return editableDirectiveFactory({
      directiveName: 'editableRadiolist',
      inputTpl: '<span></span>',
      render: function() {
        this.parent.render.call(this);
        var parsed = editableNgOptionsParser(this.attrs.eNgOptions),
            ngChangeHtml = '',
            ngNameHtml = '';

        if (this.attrs.eNgChange) {
          ngChangeHtml = ' ng-change="' +  this.attrs.eNgChange + '"';
        }
        
        if (this.attrs.eName) {
            ngNameHtml = ' name="' +  this.attrs.eName + '"';
        }
          
        var html = '<label data-ng-repeat="'+parsed.ngRepeat+'">'+
          '<input type="radio" data-ng-disabled="::' +
            this.attrs.eNgDisabled +
            '" data-ng-model="$parent.$parent.$data" data-ng-value="' + $interpolate.startSymbol() +
            '::' + parsed.locals.valueFn + $interpolate.endSymbol() +'"' +
            ngChangeHtml + ngNameHtml + '>'+
          '<span data-ng-bind="::'+parsed.locals.displayFn+'"></span></label>';

        this.inputEl.removeAttr('ng-model');
        this.inputEl.removeAttr('ng-options');
        this.inputEl.removeAttr('ng-change');
        this.inputEl.html(html);
      },
      autosubmit: function() {
        var self = this;
        self.inputEl.bind('change', function() {
          setTimeout(function() {
            self.scope.$apply(function() {
              self.scope.$form.$submit();
            });
          }, 500);
        });
      }
    });
}]);

//select
angular.module('xeditable').directive('editableSelect', ['editableDirectiveFactory',
  function(editableDirectiveFactory) {
    return editableDirectiveFactory({
      directiveName: 'editableSelect',
      inputTpl: '<select></select>',
      render: function() {
        this.parent.render.call(this);

        if (this.attrs.ePlaceholder) {
          var placeholder = angular.element('<option value="">' + this.attrs.ePlaceholder + '</option>');
          this.inputEl.append(placeholder);
        }
      },
      autosubmit: function() {
        var self = this;

        if (!self.attrs.hasOwnProperty("eMultiple")) {
          self.inputEl.bind('change', function () {
            self.scope.$apply(function () {
                self.scope.$form.$submit();
            });
          });
        }
      }
    });
}]);
//textarea
angular.module('xeditable').directive('editableTextarea', ['editableDirectiveFactory',
  function(editableDirectiveFactory) {
    return editableDirectiveFactory({
      directiveName: 'editableTextarea',
      inputTpl: '<textarea></textarea>',
      addListeners: function() {
        var self = this;
        self.parent.addListeners.call(self);
        // submit textarea by ctrl+enter even with buttons
        if (self.single && self.buttons !== 'no') {
          self.autosubmit();
        }
      },
      autosubmit: function() {
        var self = this;
        self.inputEl.bind('keydown', function(e) {
          if (self.attrs.submitOnEnter) {
            if (e.keyCode === 13 && !e.shiftKey) {
              self.scope.$apply(function() {
                self.scope.$form.$submit();
              });
            }
          } else if ((e.ctrlKey || e.metaKey) && (e.keyCode === 13) || 
                (e.keyCode === 9 && self.editorEl.attr('blur') === 'submit')) {
            self.scope.$apply(function() {
              self.scope.$form.$submit();
            });
          }
        });
      }
    });
}]);

/*
 jQuery UI Datepicker for AngularJS
 https://github.com/angular-ui/ui-date
 */
angular.module('xeditable').directive('editableUidate', ['editableDirectiveFactory',
    function(editableDirectiveFactory) {
        return editableDirectiveFactory({
            directiveName: 'editableUidate',
            inputTpl: '<input class="form-control" />',
            render: function() {
                this.parent.render.call(this);
                this.inputEl.attr('ui-date', this.attrs.eUiDate);
                this.inputEl.attr('placeholder', this.attrs.ePlaceholder);
            }
        });
}]);

/*
 AngularJS-native version of Select2 and Selectize
 https://github.com/angular-ui/ui-select
 */
angular.module('xeditable').directive('editableUiSelect',['editableDirectiveFactory', 'editableUtils',
    function(editableDirectiveFactory, editableUtils) {
        var dir = editableDirectiveFactory({
            directiveName: 'editableUiSelect',
            inputTpl: '<ui-select></ui-select>',
            render: function () {
                this.parent.render.call(this);
                this.inputEl.append(editableUtils.rename('ui-select-match', this.attrs.$matchElement));
                this.inputEl.append(editableUtils.rename('ui-select-choices', this.attrs.$choicesElement));
                this.inputEl.removeAttr('ng-model');
                this.inputEl.attr('ng-model', '$parent.$parent.$data');
            },
            autosubmit: function() {
                var self = this;
                self.inputEl.bind('change', function() {
                    setTimeout(function() {
                        self.scope.$apply(function() {
                            self.scope.$form.$submit();
                        });
                    }, 500);
                });

                self.inputEl.bind('keydown', function(e) {
                    //submit on tab
                    if (e.keyCode === 9 && self.editorEl.attr('blur') === 'submit') {
                        self.scope.$apply(function() {
                            self.scope.$form.$submit();
                        });
                    }
                });
            }
        });

        var linkOrg = dir.link;

        dir.link = function (scope, el, attrs, ctrl) {
            var matchEl = el.find('editable-ui-select-match');
            var choicesEl = el.find('editable-ui-select-choices');

            attrs.$matchElement = matchEl.clone();
            attrs.$choicesElement = choicesEl.clone();

            matchEl.remove();
            choicesEl.remove();

            return linkOrg(scope, el, attrs, ctrl);
        };

        return dir;
    }]);
/**
 * EditableController class. 
 * Attached to element with `editable-xxx` directive.
 *
 * @namespace editable-element
 */
/*
TODO: this file should be refactored to work more clear without closures!
*/
angular.module('xeditable').factory('editableController', 
  ['$q', 'editableUtils',
  function($q, editableUtils) {

  //EditableController function
  EditableController.$inject = ['$scope', '$attrs', '$element', '$parse', 'editableThemes', 'editableIcons', 'editableOptions', '$rootScope', '$compile', '$q', '$sce', '$templateCache'];
  function EditableController($scope, $attrs, $element, $parse, editableThemes, editableIcons, editableOptions, $rootScope, $compile, $q, $sce, $templateCache) {
    var valueGetter;

    //if control is disabled - it does not participate in waiting process
    var inWaiting;

    var self = this;

    self.scope = $scope;
    self.elem = $element;
    self.attrs = $attrs;
    self.inputEl = null;
    self.editorEl = null;
    self.single = true;
    self.error = '';
    self.theme =  editableThemes[$attrs.editableTheme] || editableThemes[editableOptions.theme] || editableThemes['default'];
    self.parent = {};

    //will be undefined if icon_set is default and theme is default
    var theme_name = $attrs.editableTheme || editableOptions.theme || 'default';
    // The theme_name will not be correct if the theme set in options is unavailable
    // However, in that case an undefined icon_set is not that bad...
    var icon_set_option = $attrs.editableIconSet || editableOptions.icon_set;
    self.icon_set = icon_set_option === 'default' ? editableIcons.default[theme_name] : editableIcons.external[icon_set_option];

    //to be overwritten by directive
    self.inputTpl = '';
    self.directiveName = '';

    // with majority of controls copy is not needed, but..
    // copy MUST NOT be used for `select-multiple` with objects as items
    // copy MUST be used for `checklist`
    self.useCopy = false;

    //runtime (defaults)
    self.single = null;

    /**
     * Attributes defined with `e-*` prefix automatically transferred from original element to
     * control.  
     * For example, if you set `<span editable-text="user.name" e-style="width: 100px"`>
     * then input will appear as `<input style="width: 100px">`.  
     * See [demo](#text-customize).
     * 
     * @var {any|attribute} e-*
     * @memberOf editable-element
     */ 

    /**
     * Whether to show ok/cancel buttons. Values: `right|no`.
     * If set to `no` control automatically submitted when value changed.  
     * If control is part of form buttons will never be shown. 
     * 
     * @var {string|attribute} buttons
     * @memberOf editable-element
     */    
    self.buttons = 'right';
    
    /**
     * Whether to show the editable element in a ui-bootstrap popover. Values: `true|false`.
     *
     * @var {boolean|attribute} popover
     * @memberOf editable-element
     */
    self.popover = false;
      
    /**
     * Action when control losses focus. Values: `cancel|submit|ignore`.
     * Has sense only for single editable element.
     * Otherwise, if control is part of form - you should set `blur` of form, not of individual element.
     * 
     * @var {string|attribute} blur
     * @memberOf editable-element
     */     
    // no real `blur` property as it is transferred to editable form

    //init
    self.init = function(single) {
      self.single = single;

      self.name = $attrs.eName || $attrs[self.directiveName];
      /*
      if(!$attrs[directiveName] && !$attrs.eNgModel && ($attrs.eValue === undefined)) {
        throw 'You should provide value for `'+directiveName+'` or `e-value` in editable element!';
      }
      */
      if($attrs[self.directiveName]) {
        valueGetter = $parse($attrs[self.directiveName]);
      } else {
        throw 'You should provide value for `'+self.directiveName+'` in editable element!';
      }

      // settings for single and non-single
      if (!self.single) {
        // hide buttons for non-single
        self.buttons = 'no';
      } else {
        self.buttons = self.attrs.buttons || editableOptions.buttons;
      }

      //if name defined --> watch changes and update $data in form
      if($attrs.eName) {
        self.scope.$watch('$data', function(newVal){
          self.scope.$form.$data[$attrs.eName] = newVal;
        });
      }

      /**
       * Called when control is shown.  
       * See [demo](#select-remote).
       * 
       * @var {method|attribute} onshow
       * @memberOf editable-element
       */
      if($attrs.onshow) {
        self.onshow = function() {
          return self.catchError($parse($attrs.onshow)($scope));
        };
      }

      /**
       * Called when control is hidden after both save or cancel.  
       * 
       * @var {method|attribute} onhide
       * @memberOf editable-element
       */
      if ($attrs.onhide) {
        self.onhide = function() {
          return $parse($attrs.onhide)($scope);
        };
      }

      /**
       * Called when control is cancelled.  
       * 
       * @var {method|attribute} oncancel
       * @memberOf editable-element
       */
      if ($attrs.oncancel) {
        self.oncancel = function() {
          return $parse($attrs.oncancel)($scope);
        };
      }          

      /**
       * Called during submit before value is saved to model.  
       * See [demo](#onbeforesave).
       * 
       * @var {method|attribute} onbeforesave
       * @memberOf editable-element
       */
      if ($attrs.onbeforesave) {
        self.onbeforesave = function() {
          return self.catchError($parse($attrs.onbeforesave)($scope));
        };
      }

      /**
       * Called during submit after value is saved to model.  
       * See [demo](#onaftersave).
       * 
       * @var {method|attribute} onaftersave
       * @memberOf editable-element
       */
      if ($attrs.onaftersave) {
        self.onaftersave = function() {
          return self.catchError($parse($attrs.onaftersave)($scope));
        };
      }

      if ($attrs.popover) {
        self.popover = self.attrs.popover;
      }
        
      // watch change of model to update editable element
      // now only add/remove `editable-empty` class.
      // Initially this method called with newVal = undefined, oldVal = undefined
      // so no need initially call handleEmpty() explicitly
      $scope.$parent.$watch($attrs[self.directiveName], function(newVal, oldVal) {
        self.setLocalValue();
        self.handleEmpty();
      });
    };

    self.render = function() {
      var theme = self.theme;

      //build input
      self.inputEl = angular.element(self.inputTpl);

      //build controls
      self.controlsEl = angular.element(theme.controlsTpl);
      self.controlsEl.append(self.inputEl);

      //build buttons
      if(self.buttons !== 'no') {
        self.buttonsEl = angular.element(theme.buttonsTpl);
        self.submitEl = angular.element(theme.submitTpl);
        self.resetEl = angular.element(theme.resetTpl);
        self.cancelEl = angular.element(theme.cancelTpl);
        self.submitEl.attr('title', editableOptions.submitButtonTitle);
        self.submitEl.attr('aria-label', editableOptions.submitButtonAriaLabel);
        self.cancelEl.attr('title', editableOptions.cancelButtonTitle);
        self.cancelEl.attr('aria-label', editableOptions.cancelButtonAriaLabel);
        self.resetEl.attr('title', editableOptions.clearButtonTitle);
        self.resetEl.attr('aria-label', editableOptions.clearButtonAriaLabel);

        if (self.icon_set) {
          self.submitEl.find('span').addClass(self.icon_set.ok);
          self.cancelEl.find('span').addClass(self.icon_set.cancel);
          self.resetEl.find('span').addClass(self.icon_set.clear);
        }

        self.buttonsEl.append(self.submitEl).append(self.cancelEl);

        if (editableOptions.displayClearButton) {
          self.buttonsEl.append(self.resetEl);
        }

        self.controlsEl.append(self.buttonsEl);
        
        self.inputEl.addClass('editable-has-buttons');
      }

      //build error
      self.errorEl = angular.element(theme.errorTpl);
      self.controlsEl.append(self.errorEl);

      //build editor
      self.editorEl = angular.element(self.single ? theme.formTpl : theme.noformTpl);
      self.editorEl.append(self.controlsEl);

      // transfer `e-*|data-e-*|x-e-*` attributes
      for (var k in $attrs.$attr) {
        if(k.length <= 1) {
          continue;
        }
        var transferAttr = false;
        var nextLetter = k.substring(1, 2);

        // if starts with `e` + uppercase letter
        if (k.substring(0, 1) === 'e' && nextLetter === nextLetter.toUpperCase()) {
          transferAttr = k.substring(1); // cut `e`
        } else {
          continue;
        }
        
        // exclude `form` and `ng-submit`, 
        if (transferAttr === 'Form' || transferAttr === 'NgSubmit') {
          continue;
        }

        var firstLetter = transferAttr.substring(0, 1);
        var secondLetter = transferAttr.substring(1, 2);

        // convert back to lowercase style
        if (secondLetter === secondLetter.toUpperCase() &&
            firstLetter === firstLetter.toUpperCase()) {
          transferAttr = firstLetter.toLowerCase() + '-' + editableUtils.camelToDash(transferAttr.substring(1));
        } else {
          transferAttr = firstLetter.toLowerCase() + editableUtils.camelToDash(transferAttr.substring(1));
        }

        // workaround for attributes without value (e.g. `multiple = "multiple"`)
        // except for 'e-value'
        var attrValue = (transferAttr !== 'value' && $attrs[k] === '') ? transferAttr : $attrs[k];

        // set attributes to input
        self.inputEl.attr(transferAttr, attrValue);
      }

      self.inputEl.addClass('editable-input');
      self.inputEl.attr('ng-model', '$parent.$data');

      // add directiveName class to editor, e.g. `editable-text`
      self.editorEl.addClass(editableUtils.camelToDash(self.directiveName));

      if (self.single) {
        self.editorEl.attr('editable-form', '$form');
        // transfer `blur` to form
        self.editorEl.attr('blur', self.attrs.blur || editableOptions.blurElem);
      }

      if (self.popover) {
        var wrapper = angular.element('<div></div>');
        wrapper.append(self.editorEl);
        self.editorEl = wrapper;
        $templateCache.put('popover.html', self.editorEl[0].outerHTML);
      }
        
      //apply `postrender` method of theme
      if (angular.isFunction(theme.postrender)) {
        theme.postrender.call(self);
      }

    };

    // with majority of controls copy is not needed, but..
    // copy MUST NOT be used for `select-multiple` with objects as items
    // copy MUST be used for `checklist`
    self.setLocalValue = function() {
      self.scope.$data = self.useCopy ? 
        angular.copy(valueGetter($scope.$parent)) : 
        valueGetter($scope.$parent);
    };

    // reference of the scope to use for $compile
    var newScope = null;
    //show
    self.show = function() {
      // set value of scope.$data
      self.setLocalValue();

      /*
      Originally render() was inside init() method, but some directives polluting editorEl,
      so it is broken on second opening.
      Cloning is not a solution as jqLite can not clone with event handler's.
      */
      self.render();

      // insert into DOM
      $element.after(self.editorEl);

      // compile (needed to attach ng-* events from markup)
      newScope = $scope.$new();
      $compile(self.editorEl)(newScope);

      // attach listeners (`escape`, autosubmit, etc)
      self.addListeners();

      // hide element
      $element.addClass('editable-hide');

      // onshow
      return self.onshow();
    };

    //hide
    self.hide = function() {

      // destroy the scope to prevent memory leak
      newScope.$destroy();

      self.controlsEl.remove();
      self.editorEl.remove();
      $element.removeClass('editable-hide');

      if (self.popover) {
        $templateCache.remove('popover.html');
      }
      
      // onhide
      return self.onhide();
    };

    // cancel
    self.cancel = function() {
      // oncancel
      self.oncancel();
      // don't call hide() here as it called in form's code
    };

    /*
    Called after show to attach listeners
    */
    self.addListeners = function() {
      // bind keyup for `escape`
      self.inputEl.bind('keyup', function(e) {
          if(!self.single) {
            return;
          }

          // todo: move this to editable-form!
          switch(e.keyCode) {
            // hide on `escape` press
            case 27:
              self.scope.$apply(function() {
                self.scope.$form.$cancel();
              });
            break;
          }
      });

      // autosubmit when `no buttons`
      if (self.single && self.buttons === 'no') {
        self.autosubmit();
      }

      // click - mark element as clicked to exclude in document click handler
      self.editorEl.bind('click', function(e) {
        // ignore right/middle button click
        if (e.which && e.which !== 1) {
          return;
        }

        if (self.scope.$form.$visible) {
          self.scope.$form._clicked = true;
        }
      });
    };

    // setWaiting
    self.setWaiting = function(value) {
      if (value) {
        // participate in waiting only if not disabled
        inWaiting = !self.inputEl.attr('disabled') &&
                    !self.inputEl.attr('ng-disabled') &&
                    !self.inputEl.attr('ng-enabled');
        if (inWaiting) {
          self.inputEl.attr('disabled', 'disabled');
          if(self.buttonsEl) {
            self.buttonsEl.find('button').attr('disabled', 'disabled');
          }
        }
      } else {
        if (inWaiting) {
          self.inputEl.removeAttr('disabled');
          if (self.buttonsEl) {
            self.buttonsEl.find('button').removeAttr('disabled');
          }
        }
      }
    };

    self.activate = function(start, end) {
      setTimeout(function() {
        var el = self.inputEl[0];

        if (editableOptions.activate === 'focus' && el.focus) {
          if (start !== undefined && start !== "" && el.setSelectionRange) {
            end = end || start;
            el.onfocus = function() {
              setTimeout(function() {
                try {
                  this.setSelectionRange(start,end);
                } catch(e) {
                  //do nothing, this input doesn't support setSelectionRange
                }
              }.bind(this));
            };
          }
          
          if (self.directiveName == 'editableRadiolist' || self.directiveName == 'editableChecklist' ||
              self.directiveName == 'editableBsdate' || self.directiveName == 'editableTagsInput') {
            //Set focus to first pristine element in the list
            el.querySelector('.ng-pristine').focus();
          } else {
            el.focus();
          }
        } else if (editableOptions.activate === 'select') {
          if (el.select){
            el.select();
          } else if (el.focus) {
            el.focus();
          }
        }
      }, 0);
    };

    self.setError = function(msg) {
      if(!angular.isObject(msg)) {
        $scope.$error = $sce.trustAsHtml(msg);
        self.error = msg;
      }
    };

    /*
    Checks that result is string or promise returned string and shows it as error message
    Applied to onshow, onbeforesave, onaftersave
    */
    self.catchError = function(result, noPromise) {
      if (angular.isObject(result) && noPromise !== true) {
        $q.when(result).then(
          //success and fail handlers are equal
          angular.bind(this, function(r) {
            this.catchError(r, true);
          }),
          angular.bind(this, function(r) {
            this.catchError(r, true);
          })
        );
      //check $http error
      } else if (noPromise && angular.isObject(result) && result.status &&
        (result.status !== 200) && result.data && angular.isString(result.data)) {
        this.setError(result.data);
        //set result to string: to let form know that there was error
        result = result.data;
      } else if (angular.isString(result)) {
        this.setError(result);
      }
      return result;
    };

    self.save = function() {
      valueGetter.assign($scope.$parent,
          self.useCopy ? angular.copy(self.scope.$data) : self.scope.$data);

      // no need to call handleEmpty here as we are watching change of model value
      // self.handleEmpty();
    };

    /*
    attach/detach `editable-empty` class to element
    */
    self.handleEmpty = function() {
      var val = valueGetter($scope.$parent);
      var isEmpty = val === null || val === undefined || val === "" || (angular.isArray(val) && val.length === 0); 
      $element.toggleClass('editable-empty', isEmpty);
    };

    /*
    Called when `buttons = "no"` to submit automatically
    */
    self.autosubmit = angular.noop;

    self.onshow = angular.noop;
    self.onhide = angular.noop;
    self.oncancel = angular.noop;
    self.onbeforesave = angular.noop;
    self.onaftersave = angular.noop;
  }

  return EditableController;
}]);

/*
editableFactory is used to generate editable directives (see `/directives` folder)
Inside it does several things:
- detect form for editable element. Form may be one of three types:
  1. autogenerated form (for single editable elements)
  2. wrapper form (element wrapped by <form> tag)
  3. linked form (element has `e-form` attribute pointing to existing form)

- attach editableController to element

Depends on: editableController, editableFormFactory
*/
angular.module('xeditable').factory('editableDirectiveFactory',
['$parse', '$compile', 'editableThemes', '$rootScope', '$document', 'editableController', 'editableFormController', 'editableOptions',
function($parse, $compile, editableThemes, $rootScope, $document, editableController, editableFormController, editableOptions) {

  //directive object
  return function(overwrites) {
    return {
      restrict: 'A',
      scope: true,
      require: [overwrites.directiveName, '?^form'],
      controller: editableController,
      link: function(scope, elem, attrs, ctrl) {
        // editable controller
        var eCtrl = ctrl[0];

        // form controller
        var eFormCtrl;

        // this variable indicates is element is bound to some existing form,
        // or it's single element who's form will be generated automatically
        // By default consider single element without any linked form.ß
        var hasForm = false;

        // element wrapped by form
        if (ctrl[1]) {
          eFormCtrl = ctrl[1];
          hasForm = attrs.eSingle === undefined;
        } else if (attrs.eForm) { // element not wrapped by <form>, but we have `e-form` attr
          var getter = $parse(attrs.eForm)(scope);
          if (getter) { // form exists in scope (above), e.g. editable column
            eFormCtrl = getter;
            hasForm = true;
          } else if (elem && typeof elem.parents === "function" && elem.parents().last().find('form[name='+attrs.eForm+']').length) { // form exists below or not exist at all: check document.forms
            // form is below and not processed yet
            eFormCtrl = null;
            hasForm = true;
          } else {
            // form exists below or not exist at all: check document.forms
            for (var i=0; i<$document[0].forms.length;i++) {
              if ($document[0].forms[i].name === attrs.eForm) {
                // form is below and not processed yet
                eFormCtrl = null;
                hasForm = true;
                break;
              }
            }
          }
        }

        /*
        if(hasForm && !attrs.eName) {
          throw 'You should provide `e-name` for editable element inside form!';
        }
        */

        //check for `editable-form` attr in form
        /*
        if(eFormCtrl && ) {
          throw 'You should provide `e-name` for editable element inside form!';
        }
        */

        // store original props to `parent` before merge
        angular.forEach(overwrites, function(v, k) {
          if(eCtrl[k] !== undefined) {
            eCtrl.parent[k] = eCtrl[k];
          }
        });

        // merge overwrites to base editable controller
        angular.extend(eCtrl, overwrites);

        // x-editable can be disabled using editableOption or edit-disabled attribute
        var is_disabled = function() {
          return angular.isDefined(attrs.editDisabled) ?
            scope.$eval(attrs.editDisabled) :
            editableOptions.isDisabled;
        };

        // init editable ctrl
        eCtrl.init(!hasForm);

        // publich editable controller as `$editable` to be referenced in html
        scope.$editable = eCtrl;

        // add `editable` class to element
        elem.addClass('editable');

        // hasForm
        if(hasForm) {
          if(eFormCtrl) {
            scope.$form = eFormCtrl;
            if(!scope.$form.$addEditable) {
              throw 'Form with editable elements should have `editable-form` attribute.';
            }
            scope.$form.$addEditable(eCtrl);
          } else {
            // future form (below): add editable controller to buffer and add to form later
            $rootScope.$$editableBuffer = $rootScope.$$editableBuffer || {};
            $rootScope.$$editableBuffer[attrs.eForm] = $rootScope.$$editableBuffer[attrs.eForm] || [];
            $rootScope.$$editableBuffer[attrs.eForm].push(eCtrl);
            scope.$form = null; //will be re-assigned later
          }
        // !hasForm
        } else {
          // create editableform controller
          scope.$form = editableFormController();
          // add self to editable controller
          scope.$form.$addEditable(eCtrl);

          // if `e-form` provided, publish local $form in scope
          if(attrs.eForm) {
            ($parse(attrs.eForm).assign || angular.noop)(scope.$parent, scope.$form);
          }

          // bind click - if no external form defined
          if(!attrs.eForm || attrs.eClickable) {
            elem.addClass('editable-click');
            elem.bind(editableOptions.activationEvent, function(e) {
              e.preventDefault();
              e.editable = eCtrl;
              if(!is_disabled()) {
                scope.$apply(function(){
                  scope.$form.$show();
                });
              }
            });
          }
        }

      }
    };
  };
}]);

/*
Returns editableForm controller
*/
angular.module('xeditable').factory('editableFormController', 
  ['$parse', '$document', '$rootScope', 'editablePromiseCollection', 'editableUtils',
  function($parse, $document, $rootScope, editablePromiseCollection, editableUtils) {

  // array of opened editable forms
  var shown = [];

  //Check if the child element correspond or is a descendant of the parent element
  var isSelfOrDescendant = function (parent, child) {
    if (child == parent) {
      return true;
    }

    var node = child.parentNode;
    while (node !== null) {
      if (node == parent) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  };
  
  //Check if it is a real blur : if the click event appear on a shown editable elem, this is not a blur.
  var isBlur = function(shown, event) {
    var isBlur = true;

    var editables = shown.$editables;
    angular.forEach(editables, function(v){
      var element = v.editorEl[0];
      if (isSelfOrDescendant(element, event.target))
        isBlur = false;
      
    });
    return isBlur;
  };
  
  // bind click to body: cancel|submit|ignore forms
  $document.bind('click', function(e) {
    // ignore right/middle button click
    if (e.which && e.which !== 1) {
      return;
    }

    var toCancel = [];
    var toSubmit = [];
    for (var i=0; i<shown.length; i++) {

      // exclude clicked
      if (shown[i]._clicked) {
        shown[i]._clicked = false;
        continue;
      }

      // exclude waiting
      if (shown[i].$waiting) {
        continue;
      }

      if (shown[i]._blur === 'cancel' && isBlur(shown[i], e)) {
        toCancel.push(shown[i]);
      }

      if (shown[i]._blur === 'submit' && isBlur(shown[i], e)) {
        toSubmit.push(shown[i]);
      }
    }

    if (toCancel.length || toSubmit.length) {
      $rootScope.$apply(function() {
        angular.forEach(toCancel, function(v){ v.$cancel(); });
        angular.forEach(toSubmit, function(v){ v.$submit(); });
      });
    }
  });
 
  $rootScope.$on('closeEdit', function() {
    for(var i=0; i < shown.length; i++) {
      shown[i].$hide();
    }
  }); 

  var base = {
    $addEditable: function(editable) {
      //console.log('add editable', editable.elem, editable.elem.bind);
      this.$editables.push(editable);

      //'on' is not supported in angular 1.0.8
      editable.elem.bind('$destroy', angular.bind(this, this.$removeEditable, editable));

      //bind editable's local $form to self (if not bound yet, below form) 
      if (!editable.scope.$form) {
        editable.scope.$form = this;
      }

      //if form already shown - call show() of new editable
      if (this.$visible) {
        editable.catchError(editable.show());
      }
      editable.catchError(editable.setWaiting(this.$waiting));
    },

    $removeEditable: function(editable) {
      //arrayRemove
      for(var i=0; i < this.$editables.length; i++) {
        if(this.$editables[i] === editable) {
          this.$editables.splice(i, 1);
          return;
        }
      }
    },

    /**
     * Shows form with editable controls.
     * 
     * @method $show()
     * @memberOf editable-form
     */
    $show: function() {
      if (this.$visible) {
        return;
      }

      this.$visible = true;

      var pc = editablePromiseCollection();

      //own show
      pc.when(this.$onshow());

      //clear errors
      this.$setError(null, '');

      //children show
      angular.forEach(this.$editables, function(editable) {
        pc.when(editable.show());
      });

      //wait promises and activate
      pc.then({
        onWait: angular.bind(this, this.$setWaiting), 
        onTrue: angular.bind(this, this.$activate), 
        onFalse: angular.bind(this, this.$activate), 
        onString: angular.bind(this, this.$activate)
      });

      // add to internal list of shown forms
      // setTimeout needed to prevent closing right after opening (e.g. when trigger by button)
      setTimeout(angular.bind(this, function() {
        // clear `clicked` to get ready for clicks on visible form
        this._clicked = false;
        if(editableUtils.indexOf(shown, this) === -1) {
          shown.push(this);
        }
      }), 0);      
    },

    /**
     * Sets focus on form field specified by `name`.<br/>
     * When trying to set the focus on a form field of a new row in the editable table, the `$activate` call needs to be wrapped in a `$timeout` call so that the form is rendered before the `$activate` function is called.
     * 
     * @method $activate(name)
     * @param {string} name name of field
     * @memberOf editable-form
     */
    $activate: function(name) {
      var i,
          selectionStart,
          selectionEnd;
      if (this.$editables.length) {
        //activate by name
        if (angular.isString(name)) {
          for(i=0; i<this.$editables.length; i++) {
            if (this.$editables[i].name === name) {
              this.$editables[i].activate();
              return;
            }
          }
        }

        //try activate error field
        for(i=0; i<this.$editables.length; i++) {
          if (this.$editables[i].error) {
            this.$editables[i].activate();
            return;
          }
        }

        //by default activate first field
        selectionStart = this.$editables[0].elem[0].selectionStart ? 
            this.$editables[0].elem[0].selectionStart : 
              this.$editables[0].elem[0].text ? this.$editables[0].elem[0].text.length :
                  this.$editables[0].elem[0].innerHTML ? this.$editables[0].elem[0].innerHTML.length : 0;
        selectionEnd = this.$editables[0].elem[0].selectionEnd ? 
            this.$editables[0].elem[0].selectionEnd : 
              this.$editables[0].elem[0].text ? this.$editables[0].elem[0].text.length :
                  this.$editables[0].elem[0].innerHTML ? this.$editables[0].elem[0].innerHTML.length : 0;
        this.$editables[0].activate(selectionStart, selectionEnd);
      }
    },

    /**
     * Hides form with editable controls without saving.
     * 
     * @method $hide()
     * @memberOf editable-form
     */
    $hide: function() {
      if (!this.$visible) {
        return;
      }      
      this.$visible = false;
      // self hide
      this.$onhide();
      // children's hide
      angular.forEach(this.$editables, function(editable) {
        editable.hide();
      });

      // remove from internal list of shown forms
      editableUtils.arrayRemove(shown, this);
    },

    /**
     * Triggers `oncancel` event and calls `$hide()`.
     * 
     * @method $cancel()
     * @memberOf editable-form
     */
    $cancel: function() {
      if (!this.$visible) {
        return;
      }      
      // self cancel
      this.$oncancel();
      // children's cancel      
      angular.forEach(this.$editables, function(editable) {
        editable.cancel();
      });
      // self hide
      this.$hide();
    },    

    $setWaiting: function(value) {
      this.$waiting = !!value;
      // we can't just set $waiting variable and use it via ng-disabled in children
      // because in editable-row form is not accessible
      angular.forEach(this.$editables, function(editable) {
        editable.setWaiting(!!value);
      });
    },

    /**
     * Shows error message for particular field.
     * 
     * @method $setError(name, msg)
     * @param {string} name name of field
     * @param {string} msg error message
     * @memberOf editable-form
     */
    $setError: function(name, msg) {
      angular.forEach(this.$editables, function(editable) {
        if(!name || editable.name === name) {
          editable.setError(msg);
        }
      });
    },

    $submit: function() {
      if (this.$waiting) {
        return;
      } 

      //clear errors
      this.$setError(null, '');

      //children onbeforesave
      var pc = editablePromiseCollection();
      angular.forEach(this.$editables, function(editable) {
        pc.when(editable.onbeforesave());
      });

      /*
      onbeforesave result:
      - true/undefined: save data and close form
      - false: close form without saving
      - string: keep form open and show error
      */
      pc.then({
        onWait: angular.bind(this, this.$setWaiting), 
        onTrue: angular.bind(this, checkSelf, true), 
        onFalse: angular.bind(this, checkSelf, false), 
        onString: angular.bind(this, this.$activate)
      });

      //save
      function checkSelf(childrenTrue){
        var pc = editablePromiseCollection();
        pc.when(this.$onbeforesave());
        pc.then({
          onWait: angular.bind(this, this.$setWaiting), 
          onTrue: childrenTrue ? angular.bind(this, this.$save) : angular.bind(this, this.$hide), 
          onFalse: angular.bind(this, this.$hide), 
          onString: angular.bind(this, this.$activate)
        });
      }
    },

    $save: function() {
      // write model for each editable
      angular.forEach(this.$editables, function(editable) {
        editable.save();
      });

      //call onaftersave of self and children
      var pc = editablePromiseCollection();
      pc.when(this.$onaftersave());
      angular.forEach(this.$editables, function(editable) {
        pc.when(editable.onaftersave());
      });

      /*
      onaftersave result:
      - true/undefined/false: just close form
      - string: keep form open and show error
      */
      pc.then({
        onWait: angular.bind(this, this.$setWaiting), 
        onTrue: angular.bind(this, this.$hide), 
        onFalse: angular.bind(this, this.$hide), 
        onString: angular.bind(this, this.$activate)
      });
    },

    $onshow: angular.noop,
    $oncancel: angular.noop,
    $onhide: angular.noop,
    $onbeforesave: angular.noop,
    $onaftersave: angular.noop
  };

  return function() {
    return angular.extend({
      $editables: [],
      /**
       * Form visibility flag.
       * 
       * @var {bool} $visible
       * @memberOf editable-form
       */
      $visible: false,
      /**
       * Form waiting flag. It becomes `true` when form is loading or saving data.
       * 
       * @var {bool} $waiting
       * @memberOf editable-form
       */
      $waiting: false,
      $data: {},
      _clicked: false,
      _blur: null
    }, base);
  };
}]);

/**
 * EditableForm directive. Should be defined in <form> containing editable controls.  
 * It add some usefull methods to form variable exposed to scope by `name="myform"` attribute.
 *
 * @namespace editable-form
 */
angular.module('xeditable').directive('editableForm',
  ['$rootScope', '$parse', 'editableFormController', 'editableOptions',
  function($rootScope, $parse, editableFormController, editableOptions) {
    return {
      restrict: 'A',
      require: ['form'],
      //require: ['form', 'editableForm'],
      //controller: EditableFormController,
      compile: function() {
        return {
          pre: function(scope, elem, attrs, ctrl) {
            var form = ctrl[0];
            var eForm;

            //if `editableForm` has value - publish smartly under this value
            //this is required only for single editor form that is created and removed
            if(attrs.editableForm) {
              if(scope[attrs.editableForm] && scope[attrs.editableForm].$show) {
                eForm = scope[attrs.editableForm];
                angular.extend(form, eForm);
              } else {
                eForm = editableFormController();
                scope[attrs.editableForm] = eForm;
                angular.extend(eForm, form);
              }
            } else { //just merge to form and publish if form has name
              eForm = editableFormController();
              angular.extend(form, eForm);
            }

            //read editables from buffer (that appeared before FORM tag)
            var buf = $rootScope.$$editableBuffer;
            var name = form.$name;
            if(name && buf && buf[name]) {
              angular.forEach(buf[name], function(editable) {
                eForm.$addEditable(editable);
              });
              delete buf[name];
            }
          },
          post: function(scope, elem, attrs, ctrl) {
            var eForm;

            if(attrs.editableForm && scope[attrs.editableForm] && scope[attrs.editableForm].$show) {
              eForm = scope[attrs.editableForm];
            } else {
              eForm = ctrl[0];
            }

            /**
             * Called when form is shown.
             * 
             * @var {method|attribute} onshow 
             * @memberOf editable-form
             */
            if(attrs.onshow) {
              eForm.$onshow = angular.bind(eForm, $parse(attrs.onshow), scope);
            }

            /**
             * Called when form hides after both save or cancel.
             * 
             * @var {method|attribute} onhide 
             * @memberOf editable-form
             */
            if(attrs.onhide) {
              eForm.$onhide = angular.bind(eForm, $parse(attrs.onhide), scope);
            }

            /**
             * Called when form is cancelled.
             * 
             * @var {method|attribute} oncancel
             * @memberOf editable-form
             */
            if(attrs.oncancel) {
              eForm.$oncancel = angular.bind(eForm, $parse(attrs.oncancel), scope);
            }

            /**
             * Whether form initially rendered in shown state.
             *
             * @var {bool|attribute} shown
             * @memberOf editable-form
             */
            if(attrs.shown && $parse(attrs.shown)(scope)) {
              eForm.$show();
            }

            /**
             * Action when form losses focus. Values: `cancel|submit|ignore`.
             * Default is `ignore`.
             * 
             * @var {string|attribute} blur
             * @memberOf editable-form
             */
            eForm._blur = attrs.blur || editableOptions.blurForm;

            // onbeforesave, onaftersave
            if(!attrs.ngSubmit && !attrs.submit) {
              /**
               * Called after all children `onbeforesave` callbacks but before saving form values
               * to model.  
               * If at least one children callback returns `non-string` - it will not not be called.  
               * See [editable-form demo](#editable-form) for details.
               * 
               * @var {method|attribute} onbeforesave
               * @memberOf editable-form
               * 
               */
              if(attrs.onbeforesave) {
                eForm.$onbeforesave = function() {
                  return $parse(attrs.onbeforesave)(scope, {$data: eForm.$data});
                };
              }

              /**
               * Called when form values are saved to model.  
               * See [editable-form demo](#editable-form) for details.
               * 
               * @var {method|attribute} onaftersave 
               * @memberOf editable-form
               * 
               */
              if(attrs.onaftersave) {
                eForm.$onaftersave = function() {
                  return $parse(attrs.onaftersave)(scope, {$data: eForm.$data});
                };
              }

              elem.bind('submit', function(event) {
                event.preventDefault();
                scope.$apply(function() {
                  eForm.$submit();
                });
              });
            }


            // click - mark form as clicked to exclude in document click handler
            elem.bind('click', function(e) {
              // ignore right/middle button click
              if (e.which && e.which !== 1) {
                return;
              }

              if (eForm.$visible) {
                eForm._clicked = true;
              }
            });   

          }
        };
      }
    };
}]);
/**
 * editablePromiseCollection
 *  
 * Collect results of function calls. Shows waiting if there are promises. 
 * Finally, applies callbacks if:
 * - onTrue(): all results are true and all promises resolved to true
 * - onFalse(): at least one result is false or promise resolved to false
 * - onString(): at least one result is string or promise rejected or promise resolved to string
 */

angular.module('xeditable').factory('editablePromiseCollection', ['$q', function($q) { 

  function promiseCollection() {
    return {
      promises: [],
      hasFalse: false,
      hasString: false,
      when: function(result, noPromise) {
        if (result === false) {
          this.hasFalse = true;
        } else if (!noPromise && angular.isObject(result)) {
          this.promises.push($q.when(result));
        } else if (angular.isString(result)){
          this.hasString = true;
        } else { //result === true || result === undefined || result === null
          return;
        }
      },
      //callbacks: onTrue, onFalse, onString
      then: function(callbacks) {
        callbacks = callbacks || {};
        var onTrue = callbacks.onTrue || angular.noop;
        var onFalse = callbacks.onFalse || angular.noop;
        var onString = callbacks.onString || angular.noop;
        var onWait = callbacks.onWait || angular.noop;

        var self = this;

        if (this.promises.length) {
          onWait(true);
          $q.all(this.promises).then(
            //all resolved       
            function(results) {
              onWait(false);
              //check all results via same `when` method (without checking promises)
              angular.forEach(results, function(result) {
                self.when(result, true);  
              });
              applyCallback();
            },
            //some rejected
            function(error) { 
              onWait(false);
              onString();
            }
            );
        } else {
          applyCallback();
        }

        function applyCallback() {
          if (!self.hasString && !self.hasFalse) {
            onTrue();
          } else if (!self.hasString && self.hasFalse) {
            onFalse();
          } else {
            onString();
          }
        }

      }
    };
  }

  return promiseCollection;

}]);

/**
 * editableUtils
 */
 angular.module('xeditable').factory('editableUtils', [function() {
  return {
    indexOf: function (array, obj) {
      if (array.indexOf) return array.indexOf(obj);

      for ( var i = 0; i < array.length; i++) {
        if (obj === array[i]) return i;
      }
      return -1;
    },

    arrayRemove: function (array, value) {
      var index = this.indexOf(array, value);
      if (index >= 0) {
        array.splice(index, 1);
      }
      return value;
    },

    // copy from https://github.com/angular/angular.js/blob/master/src/Angular.js
    camelToDash: function(str) {
      var SNAKE_CASE_REGEXP = /[A-Z]/g;
      return str.replace(SNAKE_CASE_REGEXP, function(letter, pos) {
        return (pos ? '-' : '') + letter.toLowerCase();
      });
    },

    dashToCamel: function(str) {
      var SPECIAL_CHARS_REGEXP = /([\:\-\_]+(.))/g;
      var MOZ_HACK_REGEXP = /^moz([A-Z])/;
      return str.
      replace(SPECIAL_CHARS_REGEXP, function(_, separator, letter, offset) {
        return offset ? letter.toUpperCase() : letter;
      }).
      replace(MOZ_HACK_REGEXP, 'Moz$1');
    },

    rename: function (tag, el) {
      if (el[0] && el[0].attributes) {
        var newEl = angular.element('<' + tag + '/>');
        newEl.html(el.html());
        var attrs = el[0].attributes;
        for (var i = 0; i < attrs.length; ++i) {
            newEl.attr(attrs.item(i).nodeName, attrs.item(i).value);
        }
        return newEl;
      }
    }
  };
}]);

/**
 * editableNgOptionsParser
 *
 * see: https://github.com/angular/angular.js/blob/master/src/ng/directive/select.js#L131
 */
 angular.module('xeditable').factory('editableNgOptionsParser', [function() {
  //0000111110000000000022220000000000000000000000333300000000000000444444444444444000000000555555555555555000000066666666666666600000000000000007777000000000000000000088888
  var NG_OPTIONS_REGEXP = /^\s*(.*?)(?:\s+as\s+(.*?))?(?:\s+group\s+by\s+(.*))?\s+for\s+(?:([\$\w][\$\w]*)|(?:\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)))\s+in\s+(.*?)(?:\s+track\s+by\s+(.*?))?$/;

  function parser(optionsExp) {
    var match;

    if (! (match = optionsExp.match(NG_OPTIONS_REGEXP))) {
      throw 'ng-options parse error';
    }

    var 
    displayFn = match[2] || match[1],
    valueName = match[4] || match[6],
    keyName = match[5],
    groupByFn = match[3] || '',
    valueFn = match[2] ? match[1] : valueName,
    valuesFn = match[7],
    track = match[8],
    trackFn = track ? match[8] : null;

    var ngRepeat;
    if (keyName === undefined) { // array
      ngRepeat = valueName + ' in ' + valuesFn;
      if (track !== undefined) {
        ngRepeat += ' track by '+trackFn;
      }
    } else { // object
      ngRepeat = '('+keyName+', '+valueName+') in '+valuesFn;
    }
    
    // group not supported yet
    return {
      ngRepeat: ngRepeat,
      locals: {
        valueName: valueName,
        keyName: keyName,
        valueFn: valueFn,
        displayFn: displayFn
      }
    };
  }

  return parser;
}]);

/**
 * editableCombodate
 *
 * angular version of https://github.com/vitalets/combodate
 */
angular.module('xeditable').factory('editableCombodate', [function() {
  function Combodate(element, options) {
    this.$element = angular.element(element);

    if(this.$element[0].nodeName != 'INPUT') {
      throw 'Combodate should be applied to INPUT element';
    }

    var currentYear = new Date().getFullYear();
    this.defaults = {
      //in this format value stored in original input
      format: 'YYYY-MM-DD HH:mm',
      //in this format items in dropdowns are displayed
      template: 'D / MMM / YYYY   H : mm',
      //initial value, can be `new Date()`
      value: null,
      minYear: 1970,
      maxYear: currentYear,
      yearDescending: true,
      minuteStep: 5,
      secondStep: 1,
      firstItem: 'empty', //'name', 'empty', 'none'
      errorClass: null,
      customClass: '',
      roundTime: true, // whether to round minutes and seconds if step > 1
      smartDays: true // whether days in combo depend on selected month: 31, 30, 28
    };

    this.options = angular.extend({}, this.defaults, options);
    this.init();
  }

  Combodate.prototype = {
    constructor: Combodate,
    init: function () {
      this.map = {
        //key   regexp    moment.method
        day:    ['D',    'date'], 
        month:  ['M',    'month'], 
        year:   ['Y',    'year'], 
        hour:   ['[Hh]', 'hours'],
        minute: ['m',    'minutes'], 
        second: ['s',    'seconds'],
        ampm:   ['[Aa]', ''] 
      };
      
      this.$widget = angular.element('<span class="combodate"></span>').html(this.getTemplate());
      
      this.initCombos();
      
      if (this.options.smartDays) {
        var combo = this;
        this.$widget.find('select').bind('change', function(e) {
          // update days count if month or year changes
          if (angular.element(e.target).hasClass('month') || angular.element(e.target).hasClass('year')) {
            combo.fillCombo('day');
          }
        });        
      }

      this.$widget.find('select').css('width', 'auto');

      // hide original input and insert widget                                       
      this.$element.css('display', 'none').after(this.$widget);
      
      // set initial value
      this.setValue(this.$element.val() || this.options.value);
    },
    
    /*
     Replace tokens in template with <select> elements 
     */         
     getTemplate: function() {
      var tpl = this.options.template;
      var customClass = this.options.customClass;

      //first pass
      angular.forEach(this.map, function(v, k) {
        v = v[0]; 
        var r = new RegExp(v+'+');
        var token = v.length > 1 ? v.substring(1, 2) : v;
        
        tpl = tpl.replace(r, '{'+token+'}');
      });

      //replace spaces with &nbsp;
      tpl = tpl.replace(/ /g, '&nbsp;');

      //second pass
      angular.forEach(this.map, function(v, k) {
        v = v[0];
        var token = v.length > 1 ? v.substring(1, 2) : v;

        tpl = tpl.replace('{'+token+'}', '<select class="'+k+' '+customClass+'"></select>');
      });   

      return tpl;
    },
    
    /*
     Initialize combos that presents in template 
     */        
     initCombos: function() {
      for (var k in this.map) {
        var c = this.$widget[0].querySelectorAll('.'+k);
        // set properties like this.$day, this.$month etc.
        this['$'+k] = c.length ? angular.element(c) : null;
        // fill with items
        this.fillCombo(k);
      }
    },

    /*
     Fill combo with items 
     */        
     fillCombo: function(k) {
      var $combo = this['$'+k];
      if (!$combo) {
        return;
      }

      // define method name to fill items, e.g `fillDays`
      var f = 'fill' + k.charAt(0).toUpperCase() + k.slice(1); 
      var items = this[f]();
      var value = $combo.val();

      $combo.html('');
      for(var i=0; i<items.length; i++) {
        $combo.append('<option value="'+items[i][0]+'">'+items[i][1]+'</option>');
      }

      $combo.val(value);
    },

    /*
     Initialize items of combos. Handles `firstItem` option 
     */
     fillCommon: function(key) {
      var values = [], relTime;

      if(this.options.firstItem === 'name') {
        //need both to support moment ver < 2 and  >= 2
        relTime = moment.relativeTime || moment.langData()._relativeTime; 
        var header = typeof relTime[key] === 'function' ? relTime[key](1, true, key, false) : relTime[key];
        //take last entry (see momentjs lang files structure) 
        header = header.split(' ').reverse()[0];                
        values.push(['', header]);
      } else if(this.options.firstItem === 'empty') {
        values.push(['', '']);
      }
      return values;
    },  


    /*
    fill day
    */
    fillDay: function() {
      var items = this.fillCommon('d'), name, i,
      twoDigit = this.options.template.indexOf('DD') !== -1,
      daysCount = 31;

      // detect days count (depends on month and year)
      // originally https://github.com/vitalets/combodate/pull/7
      if (this.options.smartDays && this.$month && this.$year) {
        var month = parseInt(this.$month.val(), 10);
        var year = parseInt(this.$year.val(), 10);

        if (!isNaN(month) && !isNaN(year)) {
          daysCount = moment([year, month]).daysInMonth();
        }
      }

      for (i = 1; i <= daysCount; i++) {
        name = twoDigit ? this.leadZero(i) : i;
        items.push([i, name]);
      }
      return items;
    },
    
    /*
    fill month
    */
    fillMonth: function() {
      var items = this.fillCommon('M'), name, i, 
      longNames = this.options.template.indexOf('MMMM') !== -1,
      shortNames = this.options.template.indexOf('MMM') !== -1,
      twoDigit = this.options.template.indexOf('MM') !== -1;

      for(i=0; i<=11; i++) {
        if(longNames) {
          //see https://github.com/timrwood/momentjs.com/pull/36
          name = moment().date(1).month(i).format('MMMM');
        } else if(shortNames) {
          name = moment().date(1).month(i).format('MMM');
        } else if(twoDigit) {
          name = this.leadZero(i+1);
        } else {
          name = i+1;
        }
        items.push([i, name]);
      } 
      return items;
    },
    
    /*
    fill year
    */
    fillYear: function() {
      var items = [], name, i, 
      longNames = this.options.template.indexOf('YYYY') !== -1;

      for(i=this.options.maxYear; i>=this.options.minYear; i--) {
        name = longNames ? i : (i+'').substring(2);
        items[this.options.yearDescending ? 'push' : 'unshift']([i, name]);
      }
      
      items = this.fillCommon('y').concat(items);
      
      return items;
    },
    
    /*
    fill hour
    */
    fillHour: function() {
      var items = this.fillCommon('h'), name, i,
      h12 = this.options.template.indexOf('h') !== -1,
      h24 = this.options.template.indexOf('H') !== -1,
      twoDigit = this.options.template.toLowerCase().indexOf('hh') !== -1,
      min = h12 ? 1 : 0, 
      max = h12 ? 12 : 23;

      for(i=min; i<=max; i++) {
        name = twoDigit ? this.leadZero(i) : i;
        items.push([i, name]);
      } 
      return items;
    },

    /*
    fill minute
    */
    fillMinute: function() {
      var items = this.fillCommon('m'), name, i,
      twoDigit = this.options.template.indexOf('mm') !== -1;

      for(i=0; i<=59; i+= this.options.minuteStep) {
        name = twoDigit ? this.leadZero(i) : i;
        items.push([i, name]);
      }
      return items;
    },
    
    /*
    fill second
    */
    fillSecond: function() {
      var items = this.fillCommon('s'), name, i,
      twoDigit = this.options.template.indexOf('ss') !== -1;

      for(i=0; i<=59; i+= this.options.secondStep) {
        name = twoDigit ? this.leadZero(i) : i;
        items.push([i, name]);
      }    
      return items;
    },
    
    /*
    fill ampm
    */
    fillAmpm: function() {
      var ampmL = this.options.template.indexOf('a') !== -1,
      ampmU = this.options.template.indexOf('A') !== -1,            
      items = [
      ['am', ampmL ? 'am' : 'AM'],
      ['pm', ampmL ? 'pm' : 'PM']
      ];
      return items;
    },

    /*
     Returns current date value from combos. 
     If format not specified - `options.format` used.
     If format = `null` - Moment object returned.
     */
     getValue: function(format) {
      var dt, values = {}, 
      that = this,
      notSelected = false;

      //getting selected values    
      angular.forEach(this.map, function(v, k) {
        if(k === 'ampm') {
          return;
        }
        var def = k === 'day' ? 1 : 0;

        values[k] = that['$'+k] ? parseInt(that['$'+k].val(), 10) : def; 
        
        if(isNaN(values[k])) {
         notSelected = true;
         return false; 
       }
     });
      
      //if at least one visible combo not selected - return empty string
      if(notSelected) {
       return '';
     }

      //convert hours 12h --> 24h 
      if(this.$ampm) {
        //12:00 pm --> 12:00 (24-h format, midday), 12:00 am --> 00:00 (24-h format, midnight, start of day)
        if(values.hour === 12) {
          values.hour = this.$ampm.val() === 'am' ? 0 : 12;                    
        } else {
          values.hour = this.$ampm.val() === 'am' ? values.hour : values.hour+12;
        }
      }
      
      dt = moment([values.year, values.month, values.day, values.hour, values.minute, values.second]);
      
      //highlight invalid date
      this.highlight(dt);

      format = format === undefined ? this.options.format : format;
      if(format === null) {
       return dt.isValid() ? dt : null; 
     } else {
       return dt.isValid() ? dt.format(format) : ''; 
     }
   },

   setValue: function(value) {
    if(!value) {
      return;
    }

      // parse in strict mode (third param `true`)
      var dt = typeof value === 'string' ? moment(value, this.options.format, true) : moment(value),
      that = this,
      values = {};
      
      //function to find nearest value in select options
      function getNearest($select, value) {
        var delta = {};
        angular.forEach($select.children('option'), function(opt, i){
          var optValue = angular.element(opt).attr('value');

          if(optValue === '') return;
          var distance = Math.abs(optValue - value); 
          if(typeof delta.distance === 'undefined' || distance < delta.distance) {
            delta = {value: optValue, distance: distance};
          } 
        }); 
        return delta.value;
      }
      
      if(dt.isValid()) {
        //read values from date object
        angular.forEach(this.map, function(v, k) {
          if(k === 'ampm') {
            return; 
          }
          values[k] = dt[v[1]]();
        });

        if(this.$ampm) {
          //12:00 pm --> 12:00 (24-h format, midday), 12:00 am --> 00:00 (24-h format, midnight, start of day)
          if(values.hour >= 12) {
            values.ampm = 'pm';
            if(values.hour > 12) {
              values.hour -= 12;
            }
          } else {
            values.ampm = 'am';
            if(values.hour === 0) {
              values.hour = 12;
            }
          }
        }

        angular.forEach(values, function(v, k) {
          //call val() for each existing combo, e.g. this.$hour.val()
          if(that['$'+k]) {

            if(k === 'minute' && that.options.minuteStep > 1 && that.options.roundTime) {
             v = getNearest(that['$'+k], v);
           }
           
           if(k === 'second' && that.options.secondStep > 1 && that.options.roundTime) {
             v = getNearest(that['$'+k], v);
           }                       
           
           that['$'+k].val(v);
         }
       });

        // update days count
        if (this.options.smartDays) {
          this.fillCombo('day');
        }

        this.$element.val(dt.format(this.options.format)).triggerHandler('change');
      }
    },
    
    /*
     highlight combos if date is invalid
     */
     highlight: function(dt) {
      if(!dt.isValid()) {
        if(this.options.errorClass) {
          this.$widget.addClass(this.options.errorClass);
        } else {
          //store original border color
          if(!this.borderColor) {
            this.borderColor = this.$widget.find('select').css('border-color'); 
          }
          this.$widget.find('select').css('border-color', 'red');
        }
      } else {
        if(this.options.errorClass) {
          this.$widget.removeClass(this.options.errorClass);
        } else {
          this.$widget.find('select').css('border-color', this.borderColor);
        }  
      }
    },
    
    leadZero: function(v) {
      return v <= 9 ? '0' + v : v; 
    },
    
    destroy: function() {
      this.$widget.remove();
      this.$element.removeData('combodate').show();
    }

  };

  return {
    getInstance: function(element, options) {
      return new Combodate(element, options);
    }
  };
}]);

/*
Editable icons:
- default
- font-awesome

*/
angular.module('xeditable').factory('editableIcons', function() {

  var icons = {
    //Icon-set to use, defaults to bootstrap icons
    default: {
      'bs2': {
        ok: 'icon-ok icon-white',
        cancel: 'icon-remove',
        clear: 'icon-trash'
      },
      'bs3': {
        ok: 'glyphicon glyphicon-ok',
        cancel: 'glyphicon glyphicon-remove',
        clear: 'glyphicon glyphicon-trash'
      }
    },
    external: {
      'font-awesome': {
        ok: 'fa fa-check',
        cancel: 'fa fa-times',
        clear: 'fa fa-trash'
      }
    }
  };

  return icons;
});

/* jshint -W086 */
/*
Editable themes:
- default
- bootstrap 2
- bootstrap 3
- semantic-ui

Note: in postrender() `this` is instance of editableController
*/
angular.module('xeditable').factory('editableThemes', function() {
  var themes = {
    //default
    'default': {
      formTpl:      '<form class="editable-wrap"></form>',
      noformTpl:    '<span class="editable-wrap"></span>',
      controlsTpl:  '<span class="editable-controls"></span>',
      inputTpl:     '',
      errorTpl:     '<div class="editable-error" data-ng-if="$error" data-ng-bind-html="$error"></div>',
      buttonsTpl:   '<span class="editable-buttons"></span>',
      submitTpl:    '<button type="submit">save</button>',
      cancelTpl:    '<button type="button" ng-click="$form.$cancel()">cancel</button>',
      resetTpl:    '<button type="reset">clear</button>'
    },

    //bs2
    'bs2': {
      formTpl:     '<form class="form-inline editable-wrap" role="form"></form>',
      noformTpl:   '<span class="editable-wrap"></span>',
      controlsTpl: '<div class="editable-controls controls control-group" ng-class="{\'error\': $error}"></div>',
      inputTpl:    '',
      errorTpl:    '<div class="editable-error help-block" data-ng-if="$error" data-ng-bind-html="$error"></div>',
      buttonsTpl:  '<span class="editable-buttons"></span>',
      submitTpl:   '<button type="submit" class="btn btn-primary"><span></span></button>',
      cancelTpl:   '<button type="button" class="btn" ng-click="$form.$cancel()">'+
                      '<span></span>'+
                   '</button>',
      resetTpl:    '<button type="reset" class="btn btn-danger">clear</button>'

    },

    //bs3
    'bs3': {
      formTpl:     '<form class="form-inline editable-wrap" role="form"></form>',
      noformTpl:   '<span class="editable-wrap"></span>',
      controlsTpl: '<div class="editable-controls form-group" ng-class="{\'has-error\': $error}"></div>',
      inputTpl:    '',
      errorTpl:    '<div class="editable-error help-block" data-ng-if="$error" data-ng-bind-html="$error"></div>',
      buttonsTpl:  '<span class="editable-buttons"></span>',
      submitTpl:   '<button type="submit" class="btn btn-primary"><span></span></button>',
      cancelTpl:   '<button type="button" class="btn btn-default" ng-click="$form.$cancel()">'+
                     '<span></span>'+
                   '</button>',
      resetTpl:    '<button type="reset" class="btn btn-danger">clear</button>',

      //bs3 specific prop to change buttons class: btn-sm, btn-lg
      buttonsClass: '',
      //bs3 specific prop to change standard inputs class: input-sm, input-lg
      inputClass: '',
      postrender: function() {
        //apply `form-control` class to std inputs
        switch(this.directiveName) {
          case 'editableText':
          case 'editableSelect':
          case 'editableTextarea':
          case 'editableEmail':
          case 'editableTel':
          case 'editableNumber':
          case 'editableUrl':
          case 'editableSearch':
          case 'editableDate':
          case 'editableDatetime':
          case 'editableBsdate':
          case 'editableTime':
          case 'editableMonth':
          case 'editableWeek':
          case 'editablePassword':
          case 'editableDatetimeLocal':
            this.inputEl.addClass('form-control');
            if(this.theme.inputClass) {
              // don`t apply `input-sm` and `input-lg` to select multiple
              // should be fixed in bs itself!
              if(this.inputEl.attr('multiple') &&
                (this.theme.inputClass === 'input-sm' || this.theme.inputClass === 'input-lg')) {
                  break;
              }
              this.inputEl.addClass(this.theme.inputClass);
            }
          break;
          case 'editableCheckbox':
              this.editorEl.addClass('checkbox');
        }

        //apply buttonsClass (bs3 specific!)
        if(this.buttonsEl && this.theme.buttonsClass) {
          this.buttonsEl.find('button').addClass(this.theme.buttonsClass);
        }
      }
    },
    
    //semantic-ui
    'semantic': {
      formTpl:     '<form class="editable-wrap ui form" ng-class="{\'error\': $error}" role="form"></form>',
      noformTpl:   '<span class="editable-wrap"></span>',
      controlsTpl: '<div class="editable-controls ui fluid input" ng-class="{\'error\': $error}"></div>',
      inputTpl:    '',
      errorTpl:    '<div class="editable-error ui error message" data-ng-if="$error" data-ng-bind-html="$error"></div>',
      buttonsTpl:  '<span class="mini ui buttons"></span>',
      submitTpl:   '<button type="submit" class="ui primary button"><i class="ui check icon"></i></button>',
      cancelTpl:   '<button type="button" class="ui button" ng-click="$form.$cancel()">'+
                      '<i class="ui cancel icon"></i>'+
                   '</button>',
      resetTpl:    '<button type="reset" class="ui button">clear</button>'
    }
  };

  return themes;
});


/***/ }),
/* 6 */
/***/ (function(module, exports) {


(function() {
  'use strict';

  // The Angular $routeProvider is used to configure routes for your application.
  
  // Three routes are configured below:
  // 1) The root of the application "/" which serves up the "Recipes" view.
  // 2) The recipe edit route "/edit/:id" which serves up the "Recipe Detail" view.
  // 3) The recipe add route "/add" which also serves up the "Recipe Detail" view.

  // TODO Uncomment this code after you've configured the `app` module.
  
   angular
     .module('ijwApp')
     .config(config)
     .run(run)
     .run(function(editableOptions) {
        editableOptions.theme = 'bs3';
      });

   function config($locationProvider, $routeProvider) {

    $locationProvider.hashPrefix('!');

     $routeProvider
     .when('/', {
         controller: 'homeCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/home.html',
         access: {restricted: false, admin: false}
     })
     .when('/login', {
         controller: 'loginCtrl',
         templateUrl: 'templates/login.html',
         access: {restricted: false, admin: false}
     })
     .when('/logout', {
         controller: 'logoutCtrl',
         access: {restricted: true, admin: false}
     })
     .when('/register', {
         controller: 'registerCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/register.html',
         access: {restricted: false, admin: false}
     })
      .when('/about', {
         templateUrl: 'templates/about.html',
         access: {restricted: false, admin: false}
     })
      .when('/profile', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/profile.html',
         access: {restricted: true, admin: false}
     })
      .when('/mission', {
         controller: 'missionCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/mission.html',
         access: {restricted: true, admin: false}
     })
       .when('/deck', {
         controller: 'deckBuildCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/deck-build.html',
         access: {restricted: true, admin: false}
       })
     .when('/match', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/match.html',
         access: {restricted: true, admin: false}
     })
     .when('/results', {
         controller: 'matchCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/results.html',
         access: {restricted: true, admin: false}
     })
     .when('/admin', {
         controller: 'adminCtrl',
         controllerAs: 'vm',
         templateUrl: 'templates/admin.html',
         access: {restricted: true, admin: true}
     })
       .otherwise({
         redirectTo: '/'
       });
   }

   function run($rootScope, $location, $route, AuthService) {
      $rootScope.$on('$routeChangeStart',
        function (event, next, current) {
          AuthService.getUserStatus()
          .then(function(){
            if (next.access.restricted && !AuthService.isLoggedIn()){
              $location.path('/login');
              $route.reload();
            }
          })
          .then(function() {
            if (next.access.admin) {
              AuthService.getUserRoles()
              .then(function() {
                if (!AuthService.isAdmin()) {
                  $location.path('/');
                  $route.reload();
                }
              })
            }
          });
        });
    }
})();

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var angular = __webpack_require__(0);

angular.module('ijwApp').controller('loginCtrl',
  ['$scope', '$location', 'AuthService',
  function ($scope, $location, AuthService) {

    $scope.login = function () {

      // initial values
      $scope.error = false;
      $scope.disabled = true;

      // call login from service
      AuthService.login($scope.loginForm.email, $scope.loginForm.password)
        // handle success
        .then(function () {
          $location.path('/profile');
          $scope.disabled = false;
          $scope.loginForm = {};
        })
        // handle error
        .catch(function () {
          $scope.error = true;
          $scope.errorMessage = "Invalid email and/or password";
          $scope.disabled = false;
          $scope.loginForm = {};
        });

    };

}]);

/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var angular = __webpack_require__(0);

angular.module('ijwApp').controller('logoutCtrl',
  ['$scope', '$location', 'AuthService',
  function ($scope, $location, AuthService) {

    $scope.logout = function () {

    	// initial values
      $scope.error = false;

      // call logout from service
      AuthService.logout()
        .then(function () {
          $location.path('/login');
        })
        .catch(function() {
        	$scope.error = true;
          	$scope.errorMessage = "There's an error on logout";
        });

    };

}]);

/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var angular = __webpack_require__(0);

angular.module('ijwApp').controller('registerCtrl',
  ['$scope', '$location', 'AuthService',
  function ($scope, $location, AuthService) {

    $scope.register = function () {

      // initial values
      $scope.error = false;
      $scope.disabled = true;

      // call register from service
      AuthService.register($scope.registerForm.email, $scope.registerForm.name, $scope.registerForm.password, $scope.registerForm.confirmPassword)
        // handle success
        .then(function () {
          $location.path('/login');
          $scope.disabled = false;
          $scope.registerForm = {};
        })
        // handle error
        .catch(function () {
          $scope.error = true;
          $scope.errorMessage = "Something went wrong!";
          $scope.disabled = false;
          $scope.registerForm = {};
        });

    };

}]);

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);

angular.module('ijwApp')
    .controller('homeCtrl', function($scope, $log, $q, dataService) {

        ! function(vm) {

            // get user from dataService
            (function() {
                dataService.getAllUsers().then( users => {
                    vm.users = users.data;
                }, error => {
                    $log.error(error);
                });
            }());

            // used to sort table
            vm.sort = function(header) {
                vm.sortKey = header;
                vm.reverse = !vm.reverse;
            }

            // returns a float as string
            vm.returnPercentage = function(user) {
                var float = parseFloat(user.results.wins / (user.results.wins + user.results.losses) * 100).toFixed(2);
                if (isNaN(float)) {
                    float = '0.00';
                }
                return float;
            }

            return vm;

        }(this);

    })

/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);

angular.module('ijwApp')
    .controller('deckBuildCtrl', function($scope, $log, $interval, dataService, config) {

        ! function(vm) {

            var MAX_MOVES = config.MAX_MOVES;
            vm.deck = [];
            vm.error = null;
            vm.actions = [];
            var mission = {};

            // user does not need to be visible to scope
            var user = {
                _id: dataService.getUserId()
            };

            // get actions from dataService
            (function() {
                dataService.getActions(['_id', 'name'])
                    .then(function(result) {
                        vm.actions = (result !== 'null') ? result.data : {};
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            // get mission from dataService
            (function() {
                mission = dataService.getMission();
                vm.title = mission.location.title;
                vm.story = mission.location.story;
            }());


            // add an action to the deck
            vm.addToDeck = function(action) {
                if (vm.deck.length < MAX_MOVES) {
                    vm.deck.push(action);
                    vm.error = null;
                } else {
                    vm.error = 'Action list can contain no more than ' + MAX_MOVES + ' actions.';
                }
            }

            // remove an action from the deck
            vm.remove = function(index) {
                vm.deck.splice(index, 1);
                vm.error = null;
            }

            // clear the deck
            vm.clear = function() {
                vm.deck = [];
                vm.error = null;
            }

            // update the deck if it already exists or create a new one
            vm.updateOrCreateDeck = function() {

                var newDeck = {};

                if (vm.deck.length < MAX_MOVES) {
                    vm.error = 'Action list must contain ' + MAX_MOVES + ' actions to submit.';
                    return $log.error('Array less than appropriate');
                } else if (user === null) {
                    return $log.error('User is null');
                } else {
                    newDeck.user = {
                        '_id': user._id
                    };
                    newDeck.actions = [];
                    for (var i = 0; i < vm.deck.length; i++) {
                        var action = {
                            '_id': vm.deck[i]._id
                        };
                        newDeck.actions.push(action);
                    }
                }

                // after modifying/creating the deck, route to the /match screen
                dataService.updateOrCreateDeck(newDeck, user._id)
                    .then(result => {
                        dataService.go('/match');
                    }, reason => {
                        $log.error(reason);
                    });
            };

            return vm;

        }(this);

    })

/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);

// http://www.christophbrill.de/en_US/marking-bootstrap-navigation-tags-as-active-using-angularjs/
angular.module('ijwApp')
    .controller('headerCtrl', function($scope, $log, $location) {

        $scope.isActive = function (viewLocation) { 
	      return viewLocation === $location.path();
	    };

    })

/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);

angular.module('ijwApp')
    .controller('matchCtrl', function($scope, $log, $q, $interval, dataService, gameService, config) {

        ! function(vm) {

            vm.user = {
                _id: dataService.getUserId()
            };
            
            vm.active = {
                elm: -1
            };

            vm.deck_active = {
                elm: -1
            };

            vm.error = null;

            var MAX_MOVES = config.MAX_MOVES;

            // used on controller only
            var _decks = [];
            // available to scope, listing only users with decks
            vm.decks = [];

            // get user from dataService
            (function() {
                dataService.getCurrentUser().then( user => {
                    vm.currentUser = user;
                }, error => {
                    $log.error(error);
                });
            }());

            // get all decks from dataService
            (function() {
                dataService.getAllDecks().then( decks => {
                    _decks = decks.data;
                    _buildDeckArrays(_decks);
                }, error => {
                    $log.error(error);
                });
            }());

            // get user's matches from dataService
            (function() {
                dataService.getCurrentUserMatches().then( matches => {
                    vm.matches = matches;
                }, error => {
                    $log.error(error);
                });
            }());

            // get the last game log from service
            // will be empty if singleton is reloaded
            (function() {
                vm.log = gameService.getLastLog() || null;
            }());

            // as a means of hiding player deck values
            var _buildDeckArrays = function(decks) {
                if (decks.length > 0) {
                    for (var i = 0; i < decks.length; i++) {
                        // create user deck to show user on match page
                        if (decks[i]['user']['_id'] === vm.user._id) {
                            vm.userDeck = decks[i];
                        }
                        // build out the deck values for each user
                        var deck = {};
                        deck.user = decks[i]['user'];
                        deck._id = decks[i]['_id'];
                        var actions = [];
                        // attempting to obfuscate the actions
                        for (var j = 0; j < decks[i]['actions'].length; j++) {
                            var action = {};
                            action._id = decks[i]['actions'][j]['_id'];
                            actions.push(action);
                        }

                        deck.actions = actions;
                        vm.decks.push(deck);
                    }
                }
            }

            // delete the deck from the database
            vm.deleteDeck = function(deckId) {
                dataService.deleteDeck(deckId)
                    .then(function(deck) {
                        vm.userDeck = null;
                    }, function(reason) {
                        $log.error(reason);
                    });
            };

            // route user to /deck
            vm.buildDeck = function() {
                dataService.go('/deck');
            }

            // play the game
            vm.smackdown = function() {
                var opponent = angular.element(document.getElementsByClassName('opponent-selected'));
                var results = {};
                // later we can add a variable on the page
                var mode = 'vs';
                if (opponent.length > 0 && (vm.userDeck != null || vm.userDeck === undefined)) {
                    var player1 = {};
                    player1.user = vm.userDeck.user;
                    player1.actions = vm.userDeck.actions;
                    player1._id = vm.userDeck._id;

                    // player2 is chosen opponent
                    var player2 = vm.decks[vm.active.elm];
    
                    results = gameService.playGame(player1, player2, mode);

                    vm.error = null;

                } else {
                    vm.error = 'You must choose an opponent and a deck to continue.';
                }
            }

            return vm;

        }(this);

    })

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);

angular.module('ijwApp')
    .controller('missionCtrl', function($scope, $log, $interval, dataService) {

        ! function(vm) {

            var mission = {};
            var weather = {};

            // get mission from dataService
            (function() {
                mission = dataService.getMission();
                dataService.getWeather().then(function(result) {
                    vm.weather = result.weather;
                    vm.timezone = result.timezone;
                    vm.latitude = vm.weather.coord.lat;
                    vm.longitude = vm.weather.coord.lon;
                    vm.temp = vm.weather.main.temp;
                    vm.humidity = vm.weather.main.humidity;
                    vm.conditions = vm.weather.weather['0']['main'];
                    vm.icon = vm.weather.weather['0']['icon'];
                    vm.windspeed = vm.weather.wind.speed;
                    vm.local = vm.timezone.formatted;
                });

                vm.coordinates = mission;
                vm.title = mission.location.title;
                vm.story = mission.location.story;

            }());

            // routes user based on if deck is already created
            vm.playGame = function() {
                var userId = dataService.getUserId();
                dataService.getUserDecks(userId)
                    .then(function(deck) {
                        if (deck.data.length > 0) {
                            dataService.go('/match');
                        } else {
                            dataService.go('/deck');
                        }
                    }, function(reason) {
                        $log.error(reason);
                    });
            }

            // Gets called when the directive is ready:
            vm.callback = function(map) {
                // Map is available here to use:
                map.center = [82.93573270000002, 55.00835259999999];
            };

            return vm;

        }(this);

    })

/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);

angular.module('ijwApp')
    .controller('adminCtrl', function($scope, $log, $q, $interval, dataService, config) {

        ! function(vm) {

            /*vm.user = {
                _id: dataService.getUserId()
            };*/

            vm.actionForm = {};
            vm.errorMessage = [];
            vm.error = false;
            vm.sortKey = 'name';
            vm.reverse = false;

            // set bonus min and max
            var BONUSES = {
                'min': config.BONUSES.min,
                'max': config.BONUSES.max
            };
            
            // get all actions from dataService
            (function() {
                dataService.getAllActions().then( actions => {
                    vm.actions = actions.data;
                }, error => {
                    $log.error(error);
                });
            }());

            // updates the status of an action to either true or false
            vm.actionStatus = function(actionId, status, $index) {
                dataService.updateActionStatus(actionId, status)
                .then(function() {
                    vm.actions[$index].active = (status === 'enable') ? true : false;
                })
            }

            // updates the values of actions
            vm.updateActionValues = function() {
                dataService.updateActionValues()
                .then(function() {
                    dataService.getAllActions().then( actions => {
                        vm.actions = actions.data;
                        $log.info(actions.data);
                    }, error => {
                        $log.error(error);
                    });
                })
            }

            // used to sort the tables
            vm.sort = function(header) {
                vm.sortKey = header;
                vm.reverse = !vm.reverse;
            }

            // validates if action can be saved
            vm.validateAction = function(action) {
                var error = '';
                var valid = true;

                if (action.name === 'undefined' || action.name.length === 0) {
                    error = 'Action name must be populated.';
                    vm.errorMessage.push(error);
                    valid = false;
                }

                for (var bonus in action.bonuses) {
                    if (action.bonuses.hasOwnProperty(bonus)) {
                        if (action.bonuses[bonus] < BONUSES.min || action.bonuses[bonus] > BONUSES.max || action.bonuses[bonus] === undefined ) {
                            error = `Bonus value ${bonus} must fall between ${BONUSES.min} and ${BONUSES.max}.`;
                            vm.errorMessage.push(error);
                            valid = false;
                        }
                    }
                }

                return valid;
            }

            // validates if a bonus value falls within the min/max
            vm.validateBonuses = function(bonus) {

                if (typeof bonus === "number") {
                    if (bonus < BONUSES.min || bonus > BONUSES.max || bonus === undefined) {
                        return `Value must fall between ${BONUSES.min} and ${BONUSES.max}.`;
                    }
                } else {
                    return `Value must be a number.`;
                }
                
                return true;
            }

            // validates if the name is present
            vm.validateName = function(name) {
                if (name === undefined || name.length === 0) {
                    return `Name cannot be null.`;
                }

                return true;
            }

            // first validates the action, then saves
            vm.saveAction = function($index) {
                var action = angular.copy(vm.actions[$index]);
                
                // validate if name and bonus values are valid
                if (vm.validateAction(action)) {
                    // if action._id is undefined, create a new action
                    if (action._id === undefined) {
                        dataService.createAction(action)
                        .then(function() {
                            vm.error = false;
                            vm.errorMessage = null;
                        }, function(err) {
                            vm.error = true;
                            vm.errorMessage = err;
                        });
                    } else {
                        // save existing action
                        dataService.updateActionBonuses(action._id, action)
                        .then(function() {
                            vm.error = false;
                            vm.errorMessage = null;
                        }, function(err) {
                            vm.error = true;
                            vm.errorMessage = err;
                        });
                    }  
                } else {
                    vm.error = true;
                }
            }

            // add user
          vm.addAction = function() {
            // insert a new action into the vm.actions array
            vm.inserted = {
              name: '',
              active: false,
              value: 0,
              bonuses: {
                city: 0,
                jungle: 0,
                desert: 0,
                extreme: 0,
                rain: 0,
                snow: 0
              }
            };
            vm.actions.push(vm.inserted);
          };

            return vm;

        }(this);

    })

/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);
const mapboxgl = __webpack_require__(17);

const styles = {
    'satellite': 'mapbox://styles/mapbox/satellite-v9',
    'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v9',
    'streets': 'mapbox://styles/mapbox/streets-v9',
    'outdoors': 'mapbox://styles/mapbox/outdoors-v10',
    'light': 'mapbox://styles/mapbox/light-v9',
    'dark': 'mapbox://styles/mapbox/dark-v9',
    'northstar': 'mapbox://styles/thebluecow/cj7t3fpw70uo12sphdf24ihyo',
    'icecream': 'mapbox://styles/thebluecow/cj8260bmq9acn2rqp6rmlay4o'
}

angular.module('ijwApp')

.directive('mapbox', [
    function() {
        return {
            restrict: 'EA',
            replace: true,
            scope: {
                callback: "=",
                gsCoordinates: "=gsCoordinates"
            },
            template: "<div id='map' style='width: 600px; height: 400px;'></div>",
            link: function(scope, element, attributes) {

                var currentTime = new Date().getHours();
                var mapStyle = null;
                var offset = (currentTime + scope.gsCoordinates.location.offset) % 24;

                if (offset <= 5 || offset >= 18) {
                  mapStyle = 'icecream';
                } else {
                  mapStyle = 'streets';
                }

                mapboxgl.accessToken = 'pk.eyJ1IjoidGhlYmx1ZWNvdyIsImEiOiJjajdzdndjd3AxZDl4MzducWNsMHprMzl2In0._WHslvWYG1dB7GQQGJJ6dw';
                var map = new mapboxgl.Map({
                    container: 'map',
                    center: scope.gsCoordinates.location.global,
                    interactive: true,
                    zoom: 6,
                    style: styles[mapStyle]
                });

                // return a random floating point
                function _getRandom(min, max) {
                  return Math.random() * (max - min) + min;
                }

                // populate markerLocations array with random floats  
                var markerLocations = [];
                for (var i = 0; i < 3; i++) {
                  markerLocations.push(_getRandom(-1.5, 1.5));
                }

                // build random coordinates for the marker location
                var pointCoordinates1 = [];
                pointCoordinates1.push(scope.gsCoordinates.location.global[0] + markerLocations.pop());
                pointCoordinates1.push(scope.gsCoordinates.location.global[1] + markerLocations.pop());

                var geojson = {
                  type: 'FeatureCollection',
                  features: [{
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: pointCoordinates1
                    },
                    properties: {
                      title: 'Mapbox',
                      description: 'Cobra Operative Spotted'
                    }
                  },
                  {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: scope.gsCoordinates.location.global
                    },
                    properties: {
                      title: 'Mapbox',
                      description: 'Cobra Operative Spotted'
                    }
                  }]
                };
                var point = 1;
                geojson.features.forEach(function(marker) {
                // create a HTML element for each feature
                var el = document.createElement('div');
                if (point % 2 === 1) {
                  el.className = 'marker';
                } else {
                  el.className = 'marker-player';
                }

                point++;

                // make a marker for each feature and add to the map
                new mapboxgl.Marker(el, /*{ offset: [-50 / 2, -50 / 2] }*/)
                .setLngLat(marker.geometry.coordinates)
                .addTo(map);
              });

              new mapboxgl.Marker(el/*, { offset: [-50 / 2, -50 / 2] }*/)
                  .setLngLat(marker.geometry.coordinates)
                  .setPopup(new mapboxgl.Popup({ offset: 25 }) // add popups
                  .setHTML('<h3>' + marker.properties.title + '</h3><p>' + marker.properties.description + '</p>'))
                  .addTo(map);
            }
        };
    }
])

.directive('ngConfirmClick', [
    function(){
        return {
            link: function (scope, element, attributes) {
                var msg = attributes.ngConfirmClick || "Are you sure?";
                var clickAction = attributes.confirmedClick;
                element.bind('click',function (event) {
                    if ( window.confirm(msg) ) {
                        scope.$eval(clickAction);
                        scope.$apply();
                    }
                });
            },
      
        };
  }]);

/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(global) {var require;var require;(function(f){if(true){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.mapboxgl = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return require(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?module.exports=n():"function"==typeof define&&define.amd?define(n):t.glMatrix=n()}(this,function(){"use strict";function t(t,n,r){var e=n[0],a=n[1],o=n[2];return t[0]=e*r[0]+a*r[3]+o*r[6],t[1]=e*r[1]+a*r[4]+o*r[7],t[2]=e*r[2]+a*r[5]+o*r[8],t}function n(t,n,r){var e=n[0],a=n[1],o=n[2],u=n[3];return t[0]=r[0]*e+r[4]*a+r[8]*o+r[12]*u,t[1]=r[1]*e+r[5]*a+r[9]*o+r[13]*u,t[2]=r[2]*e+r[6]*a+r[10]*o+r[14]*u,t[3]=r[3]*e+r[7]*a+r[11]*o+r[15]*u,t}function r(){var t=new Float32Array(4);return t[0]=1,t[1]=0,t[2]=0,t[3]=1,t}function e(t,n,r){var e=n[0],a=n[1],o=n[2],u=n[3],i=Math.sin(r),c=Math.cos(r);return t[0]=e*c+o*i,t[1]=a*c+u*i,t[2]=e*-i+o*c,t[3]=a*-i+u*c,t}function a(t,n,r){var e=n[0],a=n[1],o=n[2],u=n[3],i=r[0],c=r[1];return t[0]=e*i,t[1]=a*i,t[2]=o*c,t[3]=u*c,t}function o(){var t=new Float32Array(9);return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=1,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t}function u(t,n){var r=Math.sin(n),e=Math.cos(n);return t[0]=e,t[1]=r,t[2]=0,t[3]=-r,t[4]=e,t[5]=0,t[6]=0,t[7]=0,t[8]=1,t}function i(){var t=new Float32Array(16);return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t}function c(t){return t[0]=1,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=1,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=1,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,t}function f(t,n){var r=n[0],e=n[1],a=n[2],o=n[3],u=n[4],i=n[5],c=n[6],f=n[7],v=n[8],s=n[9],l=n[10],M=n[11],h=n[12],m=n[13],y=n[14],d=n[15],p=r*i-e*u,w=r*c-a*u,A=r*f-o*u,F=e*c-a*i,x=e*f-o*i,b=a*f-o*c,g=v*m-s*h,j=v*y-l*h,R=v*d-M*h,X=s*y-l*m,Z=s*d-M*m,k=l*d-M*y,q=p*k-w*Z+A*X+F*R-x*j+b*g;return q?(q=1/q,t[0]=(i*k-c*Z+f*X)*q,t[1]=(a*Z-e*k-o*X)*q,t[2]=(m*b-y*x+d*F)*q,t[3]=(l*x-s*b-M*F)*q,t[4]=(c*R-u*k-f*j)*q,t[5]=(r*k-a*R+o*j)*q,t[6]=(y*A-h*b-d*w)*q,t[7]=(v*b-l*A+M*w)*q,t[8]=(u*Z-i*R+f*g)*q,t[9]=(e*R-r*Z-o*g)*q,t[10]=(h*x-m*A+d*p)*q,t[11]=(s*A-v*x-M*p)*q,t[12]=(i*j-u*X-c*g)*q,t[13]=(r*X-e*j+a*g)*q,t[14]=(m*w-h*F-y*p)*q,t[15]=(v*F-s*w+l*p)*q,t):null}function v(t,n,r){var e=n[0],a=n[1],o=n[2],u=n[3],i=n[4],c=n[5],f=n[6],v=n[7],s=n[8],l=n[9],M=n[10],h=n[11],m=n[12],y=n[13],d=n[14],p=n[15],w=r[0],A=r[1],F=r[2],x=r[3];return t[0]=w*e+A*i+F*s+x*m,t[1]=w*a+A*c+F*l+x*y,t[2]=w*o+A*f+F*M+x*d,t[3]=w*u+A*v+F*h+x*p,w=r[4],A=r[5],F=r[6],x=r[7],t[4]=w*e+A*i+F*s+x*m,t[5]=w*a+A*c+F*l+x*y,t[6]=w*o+A*f+F*M+x*d,t[7]=w*u+A*v+F*h+x*p,w=r[8],A=r[9],F=r[10],x=r[11],t[8]=w*e+A*i+F*s+x*m,t[9]=w*a+A*c+F*l+x*y,t[10]=w*o+A*f+F*M+x*d,t[11]=w*u+A*v+F*h+x*p,w=r[12],A=r[13],F=r[14],x=r[15],t[12]=w*e+A*i+F*s+x*m,t[13]=w*a+A*c+F*l+x*y,t[14]=w*o+A*f+F*M+x*d,t[15]=w*u+A*v+F*h+x*p,t}function s(t,n,r){var e,a,o,u,i,c,f,v,s,l,M,h,m=r[0],y=r[1],d=r[2];return n===t?(t[12]=n[0]*m+n[4]*y+n[8]*d+n[12],t[13]=n[1]*m+n[5]*y+n[9]*d+n[13],t[14]=n[2]*m+n[6]*y+n[10]*d+n[14],t[15]=n[3]*m+n[7]*y+n[11]*d+n[15]):(e=n[0],a=n[1],o=n[2],u=n[3],i=n[4],c=n[5],f=n[6],v=n[7],s=n[8],l=n[9],M=n[10],h=n[11],t[0]=e,t[1]=a,t[2]=o,t[3]=u,t[4]=i,t[5]=c,t[6]=f,t[7]=v,t[8]=s,t[9]=l,t[10]=M,t[11]=h,t[12]=e*m+i*y+s*d+n[12],t[13]=a*m+c*y+l*d+n[13],t[14]=o*m+f*y+M*d+n[14],t[15]=u*m+v*y+h*d+n[15]),t}function l(t,n,r){var e=r[0],a=r[1],o=r[2];return t[0]=n[0]*e,t[1]=n[1]*e,t[2]=n[2]*e,t[3]=n[3]*e,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=n[7]*a,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=n[11]*o,t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],t}function M(t,n,r){var e=Math.sin(r),a=Math.cos(r),o=n[4],u=n[5],i=n[6],c=n[7],f=n[8],v=n[9],s=n[10],l=n[11];return n!==t&&(t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[4]=o*a+f*e,t[5]=u*a+v*e,t[6]=i*a+s*e,t[7]=c*a+l*e,t[8]=f*a-o*e,t[9]=v*a-u*e,t[10]=s*a-i*e,t[11]=l*a-c*e,t}function h(t,n,r){var e=Math.sin(r),a=Math.cos(r),o=n[0],u=n[1],i=n[2],c=n[3],f=n[4],v=n[5],s=n[6],l=n[7];return n!==t&&(t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15]),t[0]=o*a+f*e,t[1]=u*a+v*e,t[2]=i*a+s*e,t[3]=c*a+l*e,t[4]=f*a-o*e,t[5]=v*a-u*e,t[6]=s*a-i*e,t[7]=l*a-c*e,t}function m(t,n,r,e,a){var o=1/Math.tan(n/2),u=1/(e-a);return t[0]=o/r,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=o,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=(a+e)*u,t[11]=-1,t[12]=0,t[13]=0,t[14]=2*a*e*u,t[15]=0,t}function y(t,n,r,e,a,o,u){var i=1/(n-r),c=1/(e-a),f=1/(o-u);return t[0]=-2*i,t[1]=0,t[2]=0,t[3]=0,t[4]=0,t[5]=-2*c,t[6]=0,t[7]=0,t[8]=0,t[9]=0,t[10]=2*f,t[11]=0,t[12]=(n+r)*i,t[13]=(a+e)*c,t[14]=(u+o)*f,t[15]=1,t}(function(){var t=new Float32Array(3);t[0]=0,t[1]=0,t[2]=0})(),function(){var t=new Float32Array(4);t[0]=0,t[1]=0,t[2]=0,t[3]=0}();return{vec3:{transformMat3:t},vec4:{transformMat4:n},mat2:{create:r,rotate:e,scale:a},mat3:{create:o,fromRotation:u},mat4:{create:i,identity:c,translate:s,scale:l,multiply:v,perspective:m,rotateX:M,rotateZ:h,invert:f,ortho:y}}});
},{}],2:[function(_dereq_,module,exports){
"use strict";function Point(t,n){this.x=t,this.y=n}module.exports=Point,Point.prototype={clone:function(){return new Point(this.x,this.y)},add:function(t){return this.clone()._add(t)},sub:function(t){return this.clone()._sub(t)},multByPoint:function(t){return this.clone()._multByPoint(t)},divByPoint:function(t){return this.clone()._divByPoint(t)},mult:function(t){return this.clone()._mult(t)},div:function(t){return this.clone()._div(t)},rotate:function(t){return this.clone()._rotate(t)},rotateAround:function(t,n){return this.clone()._rotateAround(t,n)},matMult:function(t){return this.clone()._matMult(t)},unit:function(){return this.clone()._unit()},perp:function(){return this.clone()._perp()},round:function(){return this.clone()._round()},mag:function(){return Math.sqrt(this.x*this.x+this.y*this.y)},equals:function(t){return this.x===t.x&&this.y===t.y},dist:function(t){return Math.sqrt(this.distSqr(t))},distSqr:function(t){var n=t.x-this.x,i=t.y-this.y;return n*n+i*i},angle:function(){return Math.atan2(this.y,this.x)},angleTo:function(t){return Math.atan2(this.y-t.y,this.x-t.x)},angleWith:function(t){return this.angleWithSep(t.x,t.y)},angleWithSep:function(t,n){return Math.atan2(this.x*n-this.y*t,this.x*t+this.y*n)},_matMult:function(t){var n=t[0]*this.x+t[1]*this.y,i=t[2]*this.x+t[3]*this.y;return this.x=n,this.y=i,this},_add:function(t){return this.x+=t.x,this.y+=t.y,this},_sub:function(t){return this.x-=t.x,this.y-=t.y,this},_mult:function(t){return this.x*=t,this.y*=t,this},_div:function(t){return this.x/=t,this.y/=t,this},_multByPoint:function(t){return this.x*=t.x,this.y*=t.y,this},_divByPoint:function(t){return this.x/=t.x,this.y/=t.y,this},_unit:function(){return this._div(this.mag()),this},_perp:function(){var t=this.y;return this.y=this.x,this.x=-t,this},_rotate:function(t){var n=Math.cos(t),i=Math.sin(t),s=n*this.x-i*this.y,r=i*this.x+n*this.y;return this.x=s,this.y=r,this},_rotateAround:function(t,n){var i=Math.cos(t),s=Math.sin(t),r=n.x+i*(this.x-n.x)-s*(this.y-n.y),h=n.y+s*(this.x-n.x)+i*(this.y-n.y);return this.x=r,this.y=h,this},_round:function(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}},Point.convert=function(t){return t instanceof Point?t:Array.isArray(t)?new Point(t[0],t[1]):t};
},{}],3:[function(_dereq_,module,exports){
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):t.ShelfPack=e()}(this,function(){function t(t,e,i){i=i||{},this.w=t||64,this.h=e||64,this.autoResize=!!i.autoResize,this.shelves=[],this.freebins=[],this.stats={},this.bins={},this.maxId=0}function e(t,e,i){this.x=0,this.y=t,this.w=this.free=e,this.h=i}function i(t,e,i,s,h,n,r){this.id=t,this.x=e,this.y=i,this.w=s,this.h=h,this.maxw=n||s,this.maxh=r||h,this.refcount=0}return t.prototype.pack=function(t,e){t=[].concat(t),e=e||{};for(var i,s,h,n,r=[],f=0;f<t.length;f++)if(i=t[f].w||t[f].width,s=t[f].h||t[f].height,h=t[f].id,i&&s){if(!(n=this.packOne(i,s,h)))continue;e.inPlace&&(t[f].x=n.x,t[f].y=n.y,t[f].id=n.id),r.push(n)}return this.shrink(),r},t.prototype.packOne=function(t,i,s){var h,n,r,f,o={freebin:-1,shelf:-1,waste:1/0},a=0;if("string"==typeof s||"number"==typeof s){if(h=this.getBin(s))return this.ref(h),h;"number"==typeof s&&(this.maxId=Math.max(s,this.maxId))}else s=++this.maxId;for(f=0;f<this.freebins.length;f++){if(h=this.freebins[f],i===h.maxh&&t===h.maxw)return this.allocFreebin(f,t,i,s);i>h.maxh||t>h.maxw||i<=h.maxh&&t<=h.maxw&&(r=h.maxw*h.maxh-t*i)<o.waste&&(o.waste=r,o.freebin=f)}for(f=0;f<this.shelves.length;f++)if(n=this.shelves[f],a+=n.h,!(t>n.free)){if(i===n.h)return this.allocShelf(f,t,i,s);i>n.h||i<n.h&&(r=(n.h-i)*t)<o.waste&&(o.freebin=-1,o.waste=r,o.shelf=f)}if(-1!==o.freebin)return this.allocFreebin(o.freebin,t,i,s);if(-1!==o.shelf)return this.allocShelf(o.shelf,t,i,s);if(i<=this.h-a&&t<=this.w)return n=new e(a,this.w,i),this.allocShelf(this.shelves.push(n)-1,t,i,s);if(this.autoResize){var u,l,c,p;return u=l=this.h,c=p=this.w,(c<=u||t>c)&&(p=2*Math.max(t,c)),(u<c||i>u)&&(l=2*Math.max(i,u)),this.resize(p,l),this.packOne(t,i,s)}return null},t.prototype.allocFreebin=function(t,e,i,s){var h=this.freebins.splice(t,1)[0];return h.id=s,h.w=e,h.h=i,h.refcount=0,this.bins[s]=h,this.ref(h),h},t.prototype.allocShelf=function(t,e,i,s){var h=this.shelves[t],n=h.alloc(e,i,s);return this.bins[s]=n,this.ref(n),n},t.prototype.shrink=function(){if(this.shelves.length>0){for(var t=0,e=0,i=0;i<this.shelves.length;i++){var s=this.shelves[i];e+=s.h,t=Math.max(s.w-s.free,t)}this.resize(t,e)}},t.prototype.getBin=function(t){return this.bins[t]},t.prototype.ref=function(t){if(1==++t.refcount){var e=t.h;this.stats[e]=1+(0|this.stats[e])}return t.refcount},t.prototype.unref=function(t){return 0===t.refcount?0:(0==--t.refcount&&(this.stats[t.h]--,delete this.bins[t.id],this.freebins.push(t)),t.refcount)},t.prototype.clear=function(){this.shelves=[],this.freebins=[],this.stats={},this.bins={},this.maxId=0},t.prototype.resize=function(t,e){this.w=t,this.h=e;for(var i=0;i<this.shelves.length;i++)this.shelves[i].resize(t);return!0},e.prototype.alloc=function(t,e,s){if(t>this.free||e>this.h)return null;var h=this.x;return this.x+=t,this.free-=t,new i(s,h,this.y,t,e,t,this.h)},e.prototype.resize=function(t){return this.free+=t-this.w,this.w=t,!0},t});
},{}],4:[function(_dereq_,module,exports){
"use strict";function TinySDF(t,i,s,e,h,r){this.fontSize=t||24,this.buffer=void 0===i?3:i,this.cutoff=e||.25,this.fontFamily=h||"sans-serif",this.fontWeight=r||"normal",this.radius=s||8;var a=this.size=this.fontSize+2*this.buffer;this.canvas=document.createElement("canvas"),this.canvas.width=this.canvas.height=a,this.ctx=this.canvas.getContext("2d"),this.ctx.font=this.fontWeight+" "+this.fontSize+"px "+this.fontFamily,this.ctx.textBaseline="middle",this.ctx.fillStyle="black",this.gridOuter=new Float64Array(a*a),this.gridInner=new Float64Array(a*a),this.f=new Float64Array(a),this.d=new Float64Array(a),this.z=new Float64Array(a+1),this.v=new Int16Array(a),this.middle=Math.round(a/2*(navigator.userAgent.indexOf("Gecko/")>=0?1.2:1))}function edt(t,i,s,e,h,r,a){for(var n=0;n<i;n++){for(var o=0;o<s;o++)e[o]=t[o*i+n];for(edt1d(e,h,r,a,s),o=0;o<s;o++)t[o*i+n]=h[o]}for(o=0;o<s;o++){for(n=0;n<i;n++)e[n]=t[o*i+n];for(edt1d(e,h,r,a,i),n=0;n<i;n++)t[o*i+n]=Math.sqrt(h[n])}}function edt1d(t,i,s,e,h){s[0]=0,e[0]=-INF,e[1]=+INF;for(var r=1,a=0;r<h;r++){for(var n=(t[r]+r*r-(t[s[a]]+s[a]*s[a]))/(2*r-2*s[a]);n<=e[a];)a--,n=(t[r]+r*r-(t[s[a]]+s[a]*s[a]))/(2*r-2*s[a]);a++,s[a]=r,e[a]=n,e[a+1]=+INF}for(r=0,a=0;r<h;r++){for(;e[a+1]<r;)a++;i[r]=(r-s[a])*(r-s[a])+t[s[a]]}}module.exports=TinySDF;var INF=1e20;TinySDF.prototype.draw=function(t){this.ctx.clearRect(0,0,this.size,this.size),this.ctx.fillText(t,this.buffer,this.middle);for(var i=this.ctx.getImageData(0,0,this.size,this.size),s=new Uint8ClampedArray(this.size*this.size),e=0;e<this.size*this.size;e++){var h=i.data[4*e+3]/255;this.gridOuter[e]=1===h?0:0===h?INF:Math.pow(Math.max(0,.5-h),2),this.gridInner[e]=1===h?INF:0===h?0:Math.pow(Math.max(0,h-.5),2)}for(edt(this.gridOuter,this.size,this.size,this.f,this.d,this.v,this.z),edt(this.gridInner,this.size,this.size,this.f,this.d,this.v,this.z),e=0;e<this.size*this.size;e++){var r=this.gridOuter[e]-this.gridInner[e];s[e]=Math.max(0,Math.min(255,Math.round(255-255*(r/this.radius+this.cutoff))))}return s};
},{}],5:[function(_dereq_,module,exports){
function UnitBezier(t,i,e,r){this.cx=3*t,this.bx=3*(e-t)-this.cx,this.ax=1-this.cx-this.bx,this.cy=3*i,this.by=3*(r-i)-this.cy,this.ay=1-this.cy-this.by,this.p1x=t,this.p1y=r,this.p2x=e,this.p2y=r}module.exports=UnitBezier,UnitBezier.prototype.sampleCurveX=function(t){return((this.ax*t+this.bx)*t+this.cx)*t},UnitBezier.prototype.sampleCurveY=function(t){return((this.ay*t+this.by)*t+this.cy)*t},UnitBezier.prototype.sampleCurveDerivativeX=function(t){return(3*this.ax*t+2*this.bx)*t+this.cx},UnitBezier.prototype.solveCurveX=function(t,i){void 0===i&&(i=1e-6);var e,r,s,h,n;for(s=t,n=0;n<8;n++){if(h=this.sampleCurveX(s)-t,Math.abs(h)<i)return s;var u=this.sampleCurveDerivativeX(s);if(Math.abs(u)<1e-6)break;s-=h/u}if(e=0,r=1,(s=t)<e)return e;if(s>r)return r;for(;e<r;){if(h=this.sampleCurveX(s),Math.abs(h-t)<i)return s;t>h?e=s:r=s,s=.5*(r-e)+e}return s},UnitBezier.prototype.solve=function(t,i){return this.sampleCurveY(this.solveCurveX(t,i))};
},{}],6:[function(_dereq_,module,exports){
module.exports.VectorTile=_dereq_("./lib/vectortile.js"),module.exports.VectorTileFeature=_dereq_("./lib/vectortilefeature.js"),module.exports.VectorTileLayer=_dereq_("./lib/vectortilelayer.js");
},{"./lib/vectortile.js":7,"./lib/vectortilefeature.js":8,"./lib/vectortilelayer.js":9}],7:[function(_dereq_,module,exports){
"use strict";function VectorTile(e,r){this.layers=e.readFields(readTile,{},r)}function readTile(e,r,i){if(3===e){var t=new VectorTileLayer(i,i.readVarint()+i.pos);t.length&&(r[t.name]=t)}}var VectorTileLayer=_dereq_("./vectortilelayer");module.exports=VectorTile;
},{"./vectortilelayer":9}],8:[function(_dereq_,module,exports){
"use strict";function VectorTileFeature(e,t,r,a,i){this.properties={},this.extent=r,this.type=0,this._pbf=e,this._geometry=-1,this._keys=a,this._values=i,e.readFields(readFeature,this,t)}function readFeature(e,t,r){1==e?t.id=r.readVarint():2==e?readTag(r,t):3==e?t.type=r.readVarint():4==e&&(t._geometry=r.pos)}function readTag(e,t){for(var r=e.readVarint()+e.pos;e.pos<r;){var a=t._keys[e.readVarint()],i=t._values[e.readVarint()];t.properties[a]=i}}function classifyRings(e){var t=e.length;if(t<=1)return[e];for(var r,a,i=[],o=0;o<t;o++){var n=signedArea(e[o]);0!==n&&(void 0===a&&(a=n<0),a===n<0?(r&&i.push(r),r=[e[o]]):r.push(e[o]))}return r&&i.push(r),i}function signedArea(e){for(var t,r,a=0,i=0,o=e.length,n=o-1;i<o;n=i++)t=e[i],r=e[n],a+=(r.x-t.x)*(t.y+r.y);return a}var Point=_dereq_("@mapbox/point-geometry");module.exports=VectorTileFeature,VectorTileFeature.types=["Unknown","Point","LineString","Polygon"],VectorTileFeature.prototype.loadGeometry=function(){var e=this._pbf;e.pos=this._geometry;for(var t,r=e.readVarint()+e.pos,a=1,i=0,o=0,n=0,s=[];e.pos<r;){if(!i){var p=e.readVarint();a=7&p,i=p>>3}if(i--,1===a||2===a)o+=e.readSVarint(),n+=e.readSVarint(),1===a&&(t&&s.push(t),t=[]),t.push(new Point(o,n));else{if(7!==a)throw new Error("unknown command "+a);t&&t.push(t[0].clone())}}return t&&s.push(t),s},VectorTileFeature.prototype.bbox=function(){var e=this._pbf;e.pos=this._geometry;for(var t=e.readVarint()+e.pos,r=1,a=0,i=0,o=0,n=1/0,s=-1/0,p=1/0,h=-1/0;e.pos<t;){if(!a){var u=e.readVarint();r=7&u,a=u>>3}if(a--,1===r||2===r)i+=e.readSVarint(),o+=e.readSVarint(),i<n&&(n=i),i>s&&(s=i),o<p&&(p=o),o>h&&(h=o);else if(7!==r)throw new Error("unknown command "+r)}return[n,p,s,h]},VectorTileFeature.prototype.toGeoJSON=function(e,t,r){function a(e){for(var t=0;t<e.length;t++){var r=e[t],a=180-360*(r.y+p)/n;e[t]=[360*(r.x+s)/n-180,360/Math.PI*Math.atan(Math.exp(a*Math.PI/180))-90]}}var i,o,n=this.extent*Math.pow(2,r),s=this.extent*e,p=this.extent*t,h=this.loadGeometry(),u=VectorTileFeature.types[this.type];switch(this.type){case 1:var d=[];for(i=0;i<h.length;i++)d[i]=h[i][0];h=d,a(h);break;case 2:for(i=0;i<h.length;i++)a(h[i]);break;case 3:for(h=classifyRings(h),i=0;i<h.length;i++)for(o=0;o<h[i].length;o++)a(h[i][o])}1===h.length?h=h[0]:u="Multi"+u;var f={type:"Feature",geometry:{type:u,coordinates:h},properties:this.properties};return"id"in this&&(f.id=this.id),f};
},{"@mapbox/point-geometry":2}],9:[function(_dereq_,module,exports){
"use strict";function VectorTileLayer(e,t){this.version=1,this.name=null,this.extent=4096,this.length=0,this._pbf=e,this._keys=[],this._values=[],this._features=[],e.readFields(readLayer,this,t),this.length=this._features.length}function readLayer(e,t,r){15===e?t.version=r.readVarint():1===e?t.name=r.readString():5===e?t.extent=r.readVarint():2===e?t._features.push(r.pos):3===e?t._keys.push(r.readString()):4===e&&t._values.push(readValueMessage(r))}function readValueMessage(e){for(var t=null,r=e.readVarint()+e.pos;e.pos<r;){var a=e.readVarint()>>3;t=1===a?e.readString():2===a?e.readFloat():3===a?e.readDouble():4===a?e.readVarint64():5===a?e.readVarint():6===a?e.readSVarint():7===a?e.readBoolean():null}return t}var VectorTileFeature=_dereq_("./vectortilefeature.js");module.exports=VectorTileLayer,VectorTileLayer.prototype.feature=function(e){if(e<0||e>=this._features.length)throw new Error("feature index out of bounds");this._pbf.pos=this._features[e];var t=this._pbf.readVarint()+this._pbf.pos;return new VectorTileFeature(this._pbf,t,this.extent,this._keys,this._values)};
},{"./vectortilefeature.js":8}],10:[function(_dereq_,module,exports){
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t(e.WhooTS=e.WhooTS||{})}(this,function(e){function t(e,t,r,n,i,s){return s=s||{},e+"?"+["bbox="+o(r,n,i),"format="+(s.format||"image/png"),"service="+(s.service||"WMS"),"version="+(s.version||"1.1.1"),"request="+(s.request||"GetMap"),"srs="+(s.srs||"EPSG:3857"),"width="+(s.width||256),"height="+(s.height||256),"layers="+t].join("&")}function o(e,t,o){t=Math.pow(2,o)-t-1;var n=r(256*e,256*t,o),i=r(256*(e+1),256*(t+1),o);return n[0]+","+n[1]+","+i[0]+","+i[1]}function r(e,t,o){var r=2*Math.PI*6378137/256/Math.pow(2,o);return[e*r-2*Math.PI*6378137/2,t*r-2*Math.PI*6378137/2]}e.getURL=t,e.getTileBBox=o,e.getMercCoords=r,Object.defineProperty(e,"__esModule",{value:!0})});
},{}],11:[function(_dereq_,module,exports){
"use strict";function earcut(e,n,r){r=r||2;var t=n&&n.length,i=t?n[0]*r:e.length,x=linkedList(e,0,i,r,!0),a=[];if(!x)return a;var o,l,u,s,v,f,y;if(t&&(x=eliminateHoles(e,n,x,r)),e.length>80*r){o=u=e[0],l=s=e[1];for(var d=r;d<i;d+=r)v=e[d],f=e[d+1],v<o&&(o=v),f<l&&(l=f),v>u&&(u=v),f>s&&(s=f);y=Math.max(u-o,s-l)}return earcutLinked(x,a,r,o,l,y),a}function linkedList(e,n,r,t,i){var x,a;if(i===signedArea(e,n,r,t)>0)for(x=n;x<r;x+=t)a=insertNode(x,e[x],e[x+1],a);else for(x=r-t;x>=n;x-=t)a=insertNode(x,e[x],e[x+1],a);return a&&equals(a,a.next)&&(removeNode(a),a=a.next),a}function filterPoints(e,n){if(!e)return e;n||(n=e);var r,t=e;do{if(r=!1,t.steiner||!equals(t,t.next)&&0!==area(t.prev,t,t.next))t=t.next;else{if(removeNode(t),(t=n=t.prev)===t.next)return null;r=!0}}while(r||t!==n);return n}function earcutLinked(e,n,r,t,i,x,a){if(e){!a&&x&&indexCurve(e,t,i,x);for(var o,l,u=e;e.prev!==e.next;)if(o=e.prev,l=e.next,x?isEarHashed(e,t,i,x):isEar(e))n.push(o.i/r),n.push(e.i/r),n.push(l.i/r),removeNode(e),e=l.next,u=l.next;else if((e=l)===u){a?1===a?(e=cureLocalIntersections(e,n,r),earcutLinked(e,n,r,t,i,x,2)):2===a&&splitEarcut(e,n,r,t,i,x):earcutLinked(filterPoints(e),n,r,t,i,x,1);break}}}function isEar(e){var n=e.prev,r=e,t=e.next;if(area(n,r,t)>=0)return!1;for(var i=e.next.next;i!==e.prev;){if(pointInTriangle(n.x,n.y,r.x,r.y,t.x,t.y,i.x,i.y)&&area(i.prev,i,i.next)>=0)return!1;i=i.next}return!0}function isEarHashed(e,n,r,t){var i=e.prev,x=e,a=e.next;if(area(i,x,a)>=0)return!1;for(var o=i.x<x.x?i.x<a.x?i.x:a.x:x.x<a.x?x.x:a.x,l=i.y<x.y?i.y<a.y?i.y:a.y:x.y<a.y?x.y:a.y,u=i.x>x.x?i.x>a.x?i.x:a.x:x.x>a.x?x.x:a.x,s=i.y>x.y?i.y>a.y?i.y:a.y:x.y>a.y?x.y:a.y,v=zOrder(o,l,n,r,t),f=zOrder(u,s,n,r,t),y=e.nextZ;y&&y.z<=f;){if(y!==e.prev&&y!==e.next&&pointInTriangle(i.x,i.y,x.x,x.y,a.x,a.y,y.x,y.y)&&area(y.prev,y,y.next)>=0)return!1;y=y.nextZ}for(y=e.prevZ;y&&y.z>=v;){if(y!==e.prev&&y!==e.next&&pointInTriangle(i.x,i.y,x.x,x.y,a.x,a.y,y.x,y.y)&&area(y.prev,y,y.next)>=0)return!1;y=y.prevZ}return!0}function cureLocalIntersections(e,n,r){var t=e;do{var i=t.prev,x=t.next.next;!equals(i,x)&&intersects(i,t,t.next,x)&&locallyInside(i,x)&&locallyInside(x,i)&&(n.push(i.i/r),n.push(t.i/r),n.push(x.i/r),removeNode(t),removeNode(t.next),t=e=x),t=t.next}while(t!==e);return t}function splitEarcut(e,n,r,t,i,x){var a=e;do{for(var o=a.next.next;o!==a.prev;){if(a.i!==o.i&&isValidDiagonal(a,o)){var l=splitPolygon(a,o);return a=filterPoints(a,a.next),l=filterPoints(l,l.next),earcutLinked(a,n,r,t,i,x),void earcutLinked(l,n,r,t,i,x)}o=o.next}a=a.next}while(a!==e)}function eliminateHoles(e,n,r,t){var i,x,a,o,l,u=[];for(i=0,x=n.length;i<x;i++)a=n[i]*t,o=i<x-1?n[i+1]*t:e.length,l=linkedList(e,a,o,t,!1),l===l.next&&(l.steiner=!0),u.push(getLeftmost(l));for(u.sort(compareX),i=0;i<u.length;i++)eliminateHole(u[i],r),r=filterPoints(r,r.next);return r}function compareX(e,n){return e.x-n.x}function eliminateHole(e,n){if(n=findHoleBridge(e,n)){var r=splitPolygon(n,e);filterPoints(r,r.next)}}function findHoleBridge(e,n){var r,t=n,i=e.x,x=e.y,a=-1/0;do{if(x<=t.y&&x>=t.next.y){var o=t.x+(x-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(o<=i&&o>a){if(a=o,o===i){if(x===t.y)return t;if(x===t.next.y)return t.next}r=t.x<t.next.x?t:t.next}}t=t.next}while(t!==n);if(!r)return null;if(i===a)return r.prev;var l,u=r,s=r.x,v=r.y,f=1/0;for(t=r.next;t!==u;)i>=t.x&&t.x>=s&&pointInTriangle(x<v?i:a,x,s,v,x<v?a:i,x,t.x,t.y)&&((l=Math.abs(x-t.y)/(i-t.x))<f||l===f&&t.x>r.x)&&locallyInside(t,e)&&(r=t,f=l),t=t.next;return r}function indexCurve(e,n,r,t){var i=e;do{null===i.z&&(i.z=zOrder(i.x,i.y,n,r,t)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next}while(i!==e);i.prevZ.nextZ=null,i.prevZ=null,sortLinked(i)}function sortLinked(e){var n,r,t,i,x,a,o,l,u=1;do{for(r=e,e=null,x=null,a=0;r;){for(a++,t=r,o=0,n=0;n<u&&(o++,t=t.nextZ);n++);for(l=u;o>0||l>0&&t;)0===o?(i=t,t=t.nextZ,l--):0!==l&&t?r.z<=t.z?(i=r,r=r.nextZ,o--):(i=t,t=t.nextZ,l--):(i=r,r=r.nextZ,o--),x?x.nextZ=i:e=i,i.prevZ=x,x=i;r=t}x.nextZ=null,u*=2}while(a>1);return e}function zOrder(e,n,r,t,i){return e=32767*(e-r)/i,n=32767*(n-t)/i,e=16711935&(e|e<<8),e=252645135&(e|e<<4),e=858993459&(e|e<<2),e=1431655765&(e|e<<1),n=16711935&(n|n<<8),n=252645135&(n|n<<4),n=858993459&(n|n<<2),n=1431655765&(n|n<<1),e|n<<1}function getLeftmost(e){var n=e,r=e;do{n.x<r.x&&(r=n),n=n.next}while(n!==e);return r}function pointInTriangle(e,n,r,t,i,x,a,o){return(i-a)*(n-o)-(e-a)*(x-o)>=0&&(e-a)*(t-o)-(r-a)*(n-o)>=0&&(r-a)*(x-o)-(i-a)*(t-o)>=0}function isValidDiagonal(e,n){return e.next.i!==n.i&&e.prev.i!==n.i&&!intersectsPolygon(e,n)&&locallyInside(e,n)&&locallyInside(n,e)&&middleInside(e,n)}function area(e,n,r){return(n.y-e.y)*(r.x-n.x)-(n.x-e.x)*(r.y-n.y)}function equals(e,n){return e.x===n.x&&e.y===n.y}function intersects(e,n,r,t){return!!(equals(e,n)&&equals(r,t)||equals(e,t)&&equals(r,n))||area(e,n,r)>0!=area(e,n,t)>0&&area(r,t,e)>0!=area(r,t,n)>0}function intersectsPolygon(e,n){var r=e;do{if(r.i!==e.i&&r.next.i!==e.i&&r.i!==n.i&&r.next.i!==n.i&&intersects(r,r.next,e,n))return!0;r=r.next}while(r!==e);return!1}function locallyInside(e,n){return area(e.prev,e,e.next)<0?area(e,n,e.next)>=0&&area(e,e.prev,n)>=0:area(e,n,e.prev)<0||area(e,e.next,n)<0}function middleInside(e,n){var r=e,t=!1,i=(e.x+n.x)/2,x=(e.y+n.y)/2;do{r.y>x!=r.next.y>x&&i<(r.next.x-r.x)*(x-r.y)/(r.next.y-r.y)+r.x&&(t=!t),r=r.next}while(r!==e);return t}function splitPolygon(e,n){var r=new Node(e.i,e.x,e.y),t=new Node(n.i,n.x,n.y),i=e.next,x=n.prev;return e.next=n,n.prev=e,r.next=i,i.prev=r,t.next=r,r.prev=t,x.next=t,t.prev=x,t}function insertNode(e,n,r,t){var i=new Node(e,n,r);return t?(i.next=t.next,i.prev=t,t.next.prev=i,t.next=i):(i.prev=i,i.next=i),i}function removeNode(e){e.next.prev=e.prev,e.prev.next=e.next,e.prevZ&&(e.prevZ.nextZ=e.nextZ),e.nextZ&&(e.nextZ.prevZ=e.prevZ)}function Node(e,n,r){this.i=e,this.x=n,this.y=r,this.prev=null,this.next=null,this.z=null,this.prevZ=null,this.nextZ=null,this.steiner=!1}function signedArea(e,n,r,t){for(var i=0,x=n,a=r-t;x<r;x+=t)i+=(e[a]-e[x])*(e[x+1]+e[a+1]),a=x;return i}module.exports=earcut,earcut.deviation=function(e,n,r,t){var i=n&&n.length,x=i?n[0]*r:e.length,a=Math.abs(signedArea(e,0,x,r));if(i)for(var o=0,l=n.length;o<l;o++){var u=n[o]*r,s=o<l-1?n[o+1]*r:e.length;a-=Math.abs(signedArea(e,u,s,r))}var v=0;for(o=0;o<t.length;o+=3){var f=t[o]*r,y=t[o+1]*r,d=t[o+2]*r;v+=Math.abs((e[f]-e[d])*(e[y+1]-e[f+1])-(e[f]-e[y])*(e[d+1]-e[f+1]))}return 0===a&&0===v?0:Math.abs((v-a)/a)},earcut.flatten=function(e){for(var n=e[0][0].length,r={vertices:[],holes:[],dimensions:n},t=0,i=0;i<e.length;i++){for(var x=0;x<e[i].length;x++)for(var a=0;a<n;a++)r.vertices.push(e[i][x][a]);i>0&&(t+=e[i-1].length,r.holes.push(t))}return r};
},{}],12:[function(_dereq_,module,exports){
function geometry(r){if("Polygon"===r.type)return polygonArea(r.coordinates);if("MultiPolygon"===r.type){for(var e=0,n=0;n<r.coordinates.length;n++)e+=polygonArea(r.coordinates[n]);return e}return null}function polygonArea(r){var e=0;if(r&&r.length>0){e+=Math.abs(ringArea(r[0]));for(var n=1;n<r.length;n++)e-=Math.abs(ringArea(r[n]))}return e}function ringArea(r){var e=0;if(r.length>2){for(var n,t,o=0;o<r.length-1;o++)n=r[o],t=r[o+1],e+=rad(t[0]-n[0])*(2+Math.sin(rad(n[1]))+Math.sin(rad(t[1])));e=e*wgs84.RADIUS*wgs84.RADIUS/2}return e}function rad(r){return r*Math.PI/180}var wgs84=_dereq_("wgs84");module.exports.geometry=geometry,module.exports.ring=ringArea;
},{"wgs84":40}],13:[function(_dereq_,module,exports){
function rewind(r,e){switch(r&&r.type||null){case"FeatureCollection":return r.features=r.features.map(curryOuter(rewind,e)),r;case"Feature":return r.geometry=rewind(r.geometry,e),r;case"Polygon":case"MultiPolygon":return correct(r,e);default:return r}}function curryOuter(r,e){return function(n){return r(n,e)}}function correct(r,e){return"Polygon"===r.type?r.coordinates=correctRings(r.coordinates,e):"MultiPolygon"===r.type&&(r.coordinates=r.coordinates.map(curryOuter(correctRings,e))),r}function correctRings(r,e){e=!!e,r[0]=wind(r[0],e);for(var n=1;n<r.length;n++)r[n]=wind(r[n],!e);return r}function wind(r,e){return cw(r)===e?r:r.reverse()}function cw(r){return geojsonArea.ring(r)>=0}var geojsonArea=_dereq_("geojson-area");module.exports=rewind;
},{"geojson-area":12}],14:[function(_dereq_,module,exports){
"use strict";function clip(e,r,t,n,u,i,l,s){if(t/=r,n/=r,l>=t&&s<=n)return e;if(l>n||s<t)return null;for(var h=[],p=0;p<e.length;p++){var a,c,o=e[p],f=o.geometry,g=o.type;if(a=o.min[u],c=o.max[u],a>=t&&c<=n)h.push(o);else if(!(a>n||c<t)){var v=1===g?clipPoints(f,t,n,u):clipGeometry(f,t,n,u,i,3===g);v.length&&h.push(createFeature(o.tags,g,v,o.id))}}return h.length?h:null}function clipPoints(e,r,t,n){for(var u=[],i=0;i<e.length;i++){var l=e[i],s=l[n];s>=r&&s<=t&&u.push(l)}return u}function clipGeometry(e,r,t,n,u,i){for(var l=[],s=0;s<e.length;s++){var h,p,a,c=0,o=0,f=null,g=e[s],v=g.area,m=g.dist,w=g.outer,S=g.length,d=[];for(p=0;p<S-1;p++)h=f||g[p],f=g[p+1],c=o||h[n],o=f[n],c<r?o>t?(d.push(u(h,f,r),u(h,f,t)),i||(d=newSlice(l,d,v,m,w))):o>=r&&d.push(u(h,f,r)):c>t?o<r?(d.push(u(h,f,t),u(h,f,r)),i||(d=newSlice(l,d,v,m,w))):o<=t&&d.push(u(h,f,t)):(d.push(h),o<r?(d.push(u(h,f,r)),i||(d=newSlice(l,d,v,m,w))):o>t&&(d.push(u(h,f,t)),i||(d=newSlice(l,d,v,m,w))));h=g[S-1],c=h[n],c>=r&&c<=t&&d.push(h),a=d[d.length-1],i&&a&&(d[0][0]!==a[0]||d[0][1]!==a[1])&&d.push(d[0]),newSlice(l,d,v,m,w)}return l}function newSlice(e,r,t,n,u){return r.length&&(r.area=t,r.dist=n,void 0!==u&&(r.outer=u),e.push(r)),[]}module.exports=clip;var createFeature=_dereq_("./feature");
},{"./feature":16}],15:[function(_dereq_,module,exports){
"use strict";function convert(e,t){var r=[];if("FeatureCollection"===e.type)for(var o=0;o<e.features.length;o++)convertFeature(r,e.features[o],t);else"Feature"===e.type?convertFeature(r,e,t):convertFeature(r,{geometry:e},t);return r}function convertFeature(e,t,r){if(null!==t.geometry){var o,a,i,n,u=t.geometry,c=u.type,l=u.coordinates,s=t.properties,p=t.id;if("Point"===c)e.push(createFeature(s,1,[projectPoint(l)],p));else if("MultiPoint"===c)e.push(createFeature(s,1,project(l),p));else if("LineString"===c)e.push(createFeature(s,2,[project(l,r)],p));else if("MultiLineString"===c||"Polygon"===c){for(i=[],o=0;o<l.length;o++)n=project(l[o],r),"Polygon"===c&&(n.outer=0===o),i.push(n);e.push(createFeature(s,"Polygon"===c?3:2,i,p))}else if("MultiPolygon"===c){for(i=[],o=0;o<l.length;o++)for(a=0;a<l[o].length;a++)n=project(l[o][a],r),n.outer=0===a,i.push(n);e.push(createFeature(s,3,i,p))}else{if("GeometryCollection"!==c)throw new Error("Input data is not a valid GeoJSON object.");for(o=0;o<u.geometries.length;o++)convertFeature(e,{geometry:u.geometries[o],properties:s},r)}}}function project(e,t){for(var r=[],o=0;o<e.length;o++)r.push(projectPoint(e[o]));return t&&(simplify(r,t),calcSize(r)),r}function projectPoint(e){var t=Math.sin(e[1]*Math.PI/180),r=e[0]/360+.5,o=.5-.25*Math.log((1+t)/(1-t))/Math.PI;return o=o<0?0:o>1?1:o,[r,o,0]}function calcSize(e){for(var t,r,o=0,a=0,i=0;i<e.length-1;i++)t=r||e[i],r=e[i+1],o+=t[0]*r[1]-r[0]*t[1],a+=Math.abs(r[0]-t[0])+Math.abs(r[1]-t[1]);e.area=Math.abs(o/2),e.dist=a}module.exports=convert;var simplify=_dereq_("./simplify"),createFeature=_dereq_("./feature");
},{"./feature":16,"./simplify":18}],16:[function(_dereq_,module,exports){
"use strict";function createFeature(e,t,a,n){var r={id:n||null,type:t,geometry:a,tags:e||null,min:[1/0,1/0],max:[-1/0,-1/0]};return calcBBox(r),r}function calcBBox(e){var t=e.geometry,a=e.min,n=e.max;if(1===e.type)calcRingBBox(a,n,t);else for(var r=0;r<t.length;r++)calcRingBBox(a,n,t[r]);return e}function calcRingBBox(e,t,a){for(var n,r=0;r<a.length;r++)n=a[r],e[0]=Math.min(n[0],e[0]),t[0]=Math.max(n[0],t[0]),e[1]=Math.min(n[1],e[1]),t[1]=Math.max(n[1],t[1])}module.exports=createFeature;
},{}],17:[function(_dereq_,module,exports){
"use strict";function geojsonvt(e,t){return new GeoJSONVT(e,t)}function GeoJSONVT(e,t){t=this.options=extend(Object.create(this.options),t);var i=t.debug;i&&console.time("preprocess data");var o=1<<t.maxZoom,n=convert(e,t.tolerance/(o*t.extent));this.tiles={},this.tileCoords=[],i&&(console.timeEnd("preprocess data"),console.log("index: maxZoom: %d, maxPoints: %d",t.indexMaxZoom,t.indexMaxPoints),console.time("generate tiles"),this.stats={},this.total=0),n=wrap(n,t.buffer/t.extent,intersectX),n.length&&this.splitTile(n,0,0,0),i&&(n.length&&console.log("features: %d, points: %d",this.tiles[0].numFeatures,this.tiles[0].numPoints),console.timeEnd("generate tiles"),console.log("tiles generated:",this.total,JSON.stringify(this.stats)))}function toID(e,t,i){return 32*((1<<e)*i+t)+e}function intersectX(e,t,i){return[i,(i-e[0])*(t[1]-e[1])/(t[0]-e[0])+e[1],1]}function intersectY(e,t,i){return[(i-e[1])*(t[0]-e[0])/(t[1]-e[1])+e[0],i,1]}function extend(e,t){for(var i in t)e[i]=t[i];return e}function isClippedSquare(e,t,i){var o=e.source;if(1!==o.length)return!1;var n=o[0];if(3!==n.type||n.geometry.length>1)return!1;var r=n.geometry[0].length;if(5!==r)return!1;for(var s=0;s<r;s++){var l=transform.point(n.geometry[0][s],t,e.z2,e.x,e.y);if(l[0]!==-i&&l[0]!==t+i||l[1]!==-i&&l[1]!==t+i)return!1}return!0}module.exports=geojsonvt;var convert=_dereq_("./convert"),transform=_dereq_("./transform"),clip=_dereq_("./clip"),wrap=_dereq_("./wrap"),createTile=_dereq_("./tile");GeoJSONVT.prototype.options={maxZoom:14,indexMaxZoom:5,indexMaxPoints:1e5,solidChildren:!1,tolerance:3,extent:4096,buffer:64,debug:0},GeoJSONVT.prototype.splitTile=function(e,t,i,o,n,r,s){for(var l=[e,t,i,o],a=this.options,u=a.debug,c=null;l.length;){o=l.pop(),i=l.pop(),t=l.pop(),e=l.pop();var p=1<<t,d=toID(t,i,o),m=this.tiles[d],f=t===a.maxZoom?0:a.tolerance/(p*a.extent);if(!m&&(u>1&&console.time("creation"),m=this.tiles[d]=createTile(e,p,i,o,f,t===a.maxZoom),this.tileCoords.push({z:t,x:i,y:o}),u)){u>1&&(console.log("tile z%d-%d-%d (features: %d, points: %d, simplified: %d)",t,i,o,m.numFeatures,m.numPoints,m.numSimplified),console.timeEnd("creation"));var h="z"+t;this.stats[h]=(this.stats[h]||0)+1,this.total++}if(m.source=e,n){if(t===a.maxZoom||t===n)continue;var x=1<<n-t;if(i!==Math.floor(r/x)||o!==Math.floor(s/x))continue}else if(t===a.indexMaxZoom||m.numPoints<=a.indexMaxPoints)continue;if(a.solidChildren||!isClippedSquare(m,a.extent,a.buffer)){m.source=null,u>1&&console.time("clipping");var g,v,M,T,b,y,S=.5*a.buffer/a.extent,Z=.5-S,q=.5+S,w=1+S;g=v=M=T=null,b=clip(e,p,i-S,i+q,0,intersectX,m.min[0],m.max[0]),y=clip(e,p,i+Z,i+w,0,intersectX,m.min[0],m.max[0]),b&&(g=clip(b,p,o-S,o+q,1,intersectY,m.min[1],m.max[1]),v=clip(b,p,o+Z,o+w,1,intersectY,m.min[1],m.max[1])),y&&(M=clip(y,p,o-S,o+q,1,intersectY,m.min[1],m.max[1]),T=clip(y,p,o+Z,o+w,1,intersectY,m.min[1],m.max[1])),u>1&&console.timeEnd("clipping"),e.length&&(l.push(g||[],t+1,2*i,2*o),l.push(v||[],t+1,2*i,2*o+1),l.push(M||[],t+1,2*i+1,2*o),l.push(T||[],t+1,2*i+1,2*o+1))}else n&&(c=t)}return c},GeoJSONVT.prototype.getTile=function(e,t,i){var o=this.options,n=o.extent,r=o.debug,s=1<<e;t=(t%s+s)%s;var l=toID(e,t,i);if(this.tiles[l])return transform.tile(this.tiles[l],n);r>1&&console.log("drilling down to z%d-%d-%d",e,t,i);for(var a,u=e,c=t,p=i;!a&&u>0;)u--,c=Math.floor(c/2),p=Math.floor(p/2),a=this.tiles[toID(u,c,p)];if(!a||!a.source)return null;if(r>1&&console.log("found parent tile z%d-%d-%d",u,c,p),isClippedSquare(a,n,o.buffer))return transform.tile(a,n);r>1&&console.time("drilling down");var d=this.splitTile(a.source,u,c,p,e,t,i);if(r>1&&console.timeEnd("drilling down"),null!==d){var m=1<<e-d;l=toID(d,Math.floor(t/m),Math.floor(i/m))}return this.tiles[l]?transform.tile(this.tiles[l],n):null};
},{"./clip":14,"./convert":15,"./tile":19,"./transform":20,"./wrap":21}],18:[function(_dereq_,module,exports){
"use strict";function simplify(t,i){var e,p,r,s,o=i*i,f=t.length,u=0,n=f-1,g=[];for(t[u][2]=1,t[n][2]=1;n;){for(p=0,e=u+1;e<n;e++)(r=getSqSegDist(t[e],t[u],t[n]))>p&&(s=e,p=r);p>o?(t[s][2]=p,g.push(u),g.push(s),u=s):(n=g.pop(),u=g.pop())}}function getSqSegDist(t,i,e){var p=i[0],r=i[1],s=e[0],o=e[1],f=t[0],u=t[1],n=s-p,g=o-r;if(0!==n||0!==g){var l=((f-p)*n+(u-r)*g)/(n*n+g*g);l>1?(p=s,r=o):l>0&&(p+=n*l,r+=g*l)}return n=f-p,g=u-r,n*n+g*g}module.exports=simplify;
},{}],19:[function(_dereq_,module,exports){
"use strict";function createTile(e,n,r,i,t,u){for(var a={features:[],numPoints:0,numSimplified:0,numFeatures:0,source:null,x:r,y:i,z2:n,transformed:!1,min:[2,1],max:[-1,0]},m=0;m<e.length;m++){a.numFeatures++,addFeature(a,e[m],t,u);var s=e[m].min,l=e[m].max;s[0]<a.min[0]&&(a.min[0]=s[0]),s[1]<a.min[1]&&(a.min[1]=s[1]),l[0]>a.max[0]&&(a.max[0]=l[0]),l[1]>a.max[1]&&(a.max[1]=l[1])}return a}function addFeature(e,n,r,i){var t,u,a,m,s=n.geometry,l=n.type,o=[],f=r*r;if(1===l)for(t=0;t<s.length;t++)o.push(s[t]),e.numPoints++,e.numSimplified++;else for(t=0;t<s.length;t++)if(a=s[t],i||!(2===l&&a.dist<r||3===l&&a.area<f)){var d=[];for(u=0;u<a.length;u++)m=a[u],(i||m[2]>f)&&(d.push(m),e.numSimplified++),e.numPoints++;3===l&&rewind(d,a.outer),o.push(d)}else e.numPoints+=a.length;if(o.length){var g={geometry:o,type:l,tags:n.tags||null};null!==n.id&&(g.id=n.id),e.features.push(g)}}function rewind(e,n){signedArea(e)<0===n&&e.reverse()}function signedArea(e){for(var n,r,i=0,t=0,u=e.length,a=u-1;t<u;a=t++)n=e[t],r=e[a],i+=(r[0]-n[0])*(n[1]+r[1]);return i}module.exports=createTile;
},{}],20:[function(_dereq_,module,exports){
"use strict";function transformTile(r,t){if(r.transformed)return r;var n,e,o,f=r.z2,a=r.x,s=r.y;for(n=0;n<r.features.length;n++){var i=r.features[n],u=i.geometry;if(1===i.type)for(e=0;e<u.length;e++)u[e]=transformPoint(u[e],t,f,a,s);else for(e=0;e<u.length;e++){var m=u[e];for(o=0;o<m.length;o++)m[o]=transformPoint(m[o],t,f,a,s)}}return r.transformed=!0,r}function transformPoint(r,t,n,e,o){return[Math.round(t*(r[0]*n-e)),Math.round(t*(r[1]*n-o))]}exports.tile=transformTile,exports.point=transformPoint;
},{}],21:[function(_dereq_,module,exports){
"use strict";function wrap(r,e,t){var o=r,a=clip(r,1,-1-e,e,0,t,-1,2),s=clip(r,1,1-e,2+e,0,t,-1,2);return(a||s)&&(o=clip(r,1,-e,1+e,0,t,-1,2)||[],a&&(o=shiftFeatureCoords(a,1).concat(o)),s&&(o=o.concat(shiftFeatureCoords(s,-1)))),o}function shiftFeatureCoords(r,e){for(var t=[],o=0;o<r.length;o++){var a,s=r[o],i=s.type;if(1===i)a=shiftCoords(s.geometry,e);else{a=[];for(var u=0;u<s.geometry.length;u++)a.push(shiftCoords(s.geometry[u],e))}t.push(createFeature(s.tags,i,a,s.id))}return t}function shiftCoords(r,e){var t=[];t.area=r.area,t.dist=r.dist;for(var o=0;o<r.length;o++)t.push([r[o][0]+e,r[o][1],r[o][2]]);return t}var clip=_dereq_("./clip"),createFeature=_dereq_("./feature");module.exports=wrap;
},{"./clip":14,"./feature":16}],22:[function(_dereq_,module,exports){
"use strict";function GridIndex(t,r,e){var s=this.cells=[];if(t instanceof ArrayBuffer){this.arrayBuffer=t;var i=new Int32Array(this.arrayBuffer);t=i[0],r=i[1],e=i[2],this.d=r+2*e;for(var h=0;h<this.d*this.d;h++){var n=i[NUM_PARAMS+h],o=i[NUM_PARAMS+h+1];s.push(n===o?null:i.subarray(n,o))}var l=i[NUM_PARAMS+s.length],a=i[NUM_PARAMS+s.length+1];this.keys=i.subarray(l,a),this.bboxes=i.subarray(a),this.insert=this._insertReadonly}else{this.d=r+2*e;for(var d=0;d<this.d*this.d;d++)s.push([]);this.keys=[],this.bboxes=[]}this.n=r,this.extent=t,this.padding=e,this.scale=r/t,this.uid=0;var f=e/r*t;this.min=-f,this.max=t+f}module.exports=GridIndex;var NUM_PARAMS=3;GridIndex.prototype.insert=function(t,r,e,s,i){this._forEachCell(r,e,s,i,this._insertCell,this.uid++),this.keys.push(t),this.bboxes.push(r),this.bboxes.push(e),this.bboxes.push(s),this.bboxes.push(i)},GridIndex.prototype._insertReadonly=function(){throw"Cannot insert into a GridIndex created from an ArrayBuffer."},GridIndex.prototype._insertCell=function(t,r,e,s,i,h){this.cells[i].push(h)},GridIndex.prototype.query=function(t,r,e,s){var i=this.min,h=this.max;if(t<=i&&r<=i&&h<=e&&h<=s)return Array.prototype.slice.call(this.keys);var n=[],o={};return this._forEachCell(t,r,e,s,this._queryCell,n,o),n},GridIndex.prototype._queryCell=function(t,r,e,s,i,h,n){var o=this.cells[i];if(null!==o)for(var l=this.keys,a=this.bboxes,d=0;d<o.length;d++){var f=o[d];if(void 0===n[f]){var u=4*f;t<=a[u+2]&&r<=a[u+3]&&e>=a[u+0]&&s>=a[u+1]?(n[f]=!0,h.push(l[f])):n[f]=!1}}},GridIndex.prototype._forEachCell=function(t,r,e,s,i,h,n){for(var o=this._convertToCellCoord(t),l=this._convertToCellCoord(r),a=this._convertToCellCoord(e),d=this._convertToCellCoord(s),f=o;f<=a;f++)for(var u=l;u<=d;u++){var y=this.d*u+f;if(i.call(this,t,r,e,s,y,h,n))return}},GridIndex.prototype._convertToCellCoord=function(t){return Math.max(0,Math.min(this.d-1,Math.floor(t*this.scale)+this.padding))},GridIndex.prototype.toArrayBuffer=function(){if(this.arrayBuffer)return this.arrayBuffer;for(var t=this.cells,r=NUM_PARAMS+this.cells.length+1+1,e=0,s=0;s<this.cells.length;s++)e+=this.cells[s].length;var i=new Int32Array(r+e+this.keys.length+this.bboxes.length);i[0]=this.extent,i[1]=this.n,i[2]=this.padding;for(var h=r,n=0;n<t.length;n++){var o=t[n];i[NUM_PARAMS+n]=h,i.set(o,h),h+=o.length}return i[NUM_PARAMS+t.length]=h,i.set(this.keys,h),h+=this.keys.length,i[NUM_PARAMS+t.length+1]=h,i.set(this.bboxes,h),h+=this.bboxes.length,i.buffer};
},{}],23:[function(_dereq_,module,exports){
exports.read=function(a,o,t,r,h){var M,p,w=8*h-r-1,f=(1<<w)-1,e=f>>1,i=-7,N=t?h-1:0,n=t?-1:1,s=a[o+N];for(N+=n,M=s&(1<<-i)-1,s>>=-i,i+=w;i>0;M=256*M+a[o+N],N+=n,i-=8);for(p=M&(1<<-i)-1,M>>=-i,i+=r;i>0;p=256*p+a[o+N],N+=n,i-=8);if(0===M)M=1-e;else{if(M===f)return p?NaN:1/0*(s?-1:1);p+=Math.pow(2,r),M-=e}return(s?-1:1)*p*Math.pow(2,M-r)},exports.write=function(a,o,t,r,h,M){var p,w,f,e=8*M-h-1,i=(1<<e)-1,N=i>>1,n=23===h?Math.pow(2,-24)-Math.pow(2,-77):0,s=r?0:M-1,u=r?1:-1,l=o<0||0===o&&1/o<0?1:0;for(o=Math.abs(o),isNaN(o)||o===1/0?(w=isNaN(o)?1:0,p=i):(p=Math.floor(Math.log(o)/Math.LN2),o*(f=Math.pow(2,-p))<1&&(p--,f*=2),o+=p+N>=1?n/f:n*Math.pow(2,1-N),o*f>=2&&(p++,f/=2),p+N>=i?(w=0,p=i):p+N>=1?(w=(o*f-1)*Math.pow(2,h),p+=N):(w=o*Math.pow(2,N-1)*Math.pow(2,h),p=0));h>=8;a[t+s]=255&w,s+=u,w/=256,h-=8);for(p=p<<h|w,e+=h;e>0;a[t+s]=255&p,s+=u,p/=256,e-=8);a[t+s-u]|=128*l};
},{}],24:[function(_dereq_,module,exports){
"use strict";function kdbush(t,i,e,s,n){return new KDBush(t,i,e,s,n)}function KDBush(t,i,e,s,n){i=i||defaultGetX,e=e||defaultGetY,n=n||Array,this.nodeSize=s||64,this.points=t,this.ids=new n(t.length),this.coords=new n(2*t.length);for(var r=0;r<t.length;r++)this.ids[r]=r,this.coords[2*r]=i(t[r]),this.coords[2*r+1]=e(t[r]);sort(this.ids,this.coords,this.nodeSize,0,this.ids.length-1,0)}function defaultGetX(t){return t[0]}function defaultGetY(t){return t[1]}var sort=_dereq_("./sort"),range=_dereq_("./range"),within=_dereq_("./within");module.exports=kdbush,KDBush.prototype={range:function(t,i,e,s){return range(this.ids,this.coords,t,i,e,s,this.nodeSize)},within:function(t,i,e){return within(this.ids,this.coords,t,i,e,this.nodeSize)}};
},{"./range":25,"./sort":26,"./within":27}],25:[function(_dereq_,module,exports){
"use strict";function range(p,r,s,u,h,e,o){for(var a,t,n=[0,p.length-1,0],f=[];n.length;){var l=n.pop(),v=n.pop(),g=n.pop();if(v-g<=o)for(var i=g;i<=v;i++)a=r[2*i],t=r[2*i+1],a>=s&&a<=h&&t>=u&&t<=e&&f.push(p[i]);else{var c=Math.floor((g+v)/2);a=r[2*c],t=r[2*c+1],a>=s&&a<=h&&t>=u&&t<=e&&f.push(p[c]);var d=(l+1)%2;(0===l?s<=a:u<=t)&&(n.push(g),n.push(c-1),n.push(d)),(0===l?h>=a:e>=t)&&(n.push(c+1),n.push(v),n.push(d))}}return f}module.exports=range;
},{}],26:[function(_dereq_,module,exports){
"use strict";function sortKD(t,a,o,s,r,e){if(!(r-s<=o)){var f=Math.floor((s+r)/2);select(t,a,f,s,r,e%2),sortKD(t,a,o,s,f-1,e+1),sortKD(t,a,o,f+1,r,e+1)}}function select(t,a,o,s,r,e){for(;r>s;){if(r-s>600){var f=r-s+1,p=o-s+1,w=Math.log(f),m=.5*Math.exp(2*w/3),n=.5*Math.sqrt(w*m*(f-m)/f)*(p-f/2<0?-1:1);select(t,a,o,Math.max(s,Math.floor(o-p*m/f+n)),Math.min(r,Math.floor(o+(f-p)*m/f+n)),e)}var c=a[2*o+e],h=s,i=r;for(swapItem(t,a,s,o),a[2*r+e]>c&&swapItem(t,a,s,r);h<i;){for(swapItem(t,a,h,i),h++,i--;a[2*h+e]<c;)h++;for(;a[2*i+e]>c;)i--}a[2*s+e]===c?swapItem(t,a,s,i):(i++,swapItem(t,a,i,r)),i<=o&&(s=i+1),o<=i&&(r=i-1)}}function swapItem(t,a,o,s){swap(t,o,s),swap(a,2*o,2*s),swap(a,2*o+1,2*s+1)}function swap(t,a,o){var s=t[a];t[a]=t[o],t[o]=s}module.exports=sortKD;
},{}],27:[function(_dereq_,module,exports){
"use strict";function within(s,p,r,t,u,h){for(var i=[0,s.length-1,0],o=[],n=u*u;i.length;){var e=i.pop(),a=i.pop(),f=i.pop();if(a-f<=h)for(var v=f;v<=a;v++)sqDist(p[2*v],p[2*v+1],r,t)<=n&&o.push(s[v]);else{var l=Math.floor((f+a)/2),c=p[2*l],q=p[2*l+1];sqDist(c,q,r,t)<=n&&o.push(s[l]);var D=(e+1)%2;(0===e?r-u<=c:t-u<=q)&&(i.push(f),i.push(l-1),i.push(D)),(0===e?r+u>=c:t+u>=q)&&(i.push(l+1),i.push(a),i.push(D))}}return o}function sqDist(s,p,r,t){var u=s-r,h=p-t;return u*u+h*h}module.exports=within;
},{}],28:[function(_dereq_,module,exports){
"use strict";function isSupported(e){return!!(isBrowser()&&isArraySupported()&&isFunctionSupported()&&isObjectSupported()&&isJSONSupported()&&isWorkerSupported()&&isUint8ClampedArraySupported()&&isWebGLSupportedCached(e&&e.failIfMajorPerformanceCaveat))}function isBrowser(){return"undefined"!=typeof window&&"undefined"!=typeof document}function isArraySupported(){return Array.prototype&&Array.prototype.every&&Array.prototype.filter&&Array.prototype.forEach&&Array.prototype.indexOf&&Array.prototype.lastIndexOf&&Array.prototype.map&&Array.prototype.some&&Array.prototype.reduce&&Array.prototype.reduceRight&&Array.isArray}function isFunctionSupported(){return Function.prototype&&Function.prototype.bind}function isObjectSupported(){return Object.keys&&Object.create&&Object.getPrototypeOf&&Object.getOwnPropertyNames&&Object.isSealed&&Object.isFrozen&&Object.isExtensible&&Object.getOwnPropertyDescriptor&&Object.defineProperty&&Object.defineProperties&&Object.seal&&Object.freeze&&Object.preventExtensions}function isJSONSupported(){return"JSON"in window&&"parse"in JSON&&"stringify"in JSON}function isWorkerSupported(){return"Worker"in window}function isUint8ClampedArraySupported(){return"Uint8ClampedArray"in window}function isWebGLSupportedCached(e){return void 0===isWebGLSupportedCache[e]&&(isWebGLSupportedCache[e]=isWebGLSupported(e)),isWebGLSupportedCache[e]}function isWebGLSupported(e){var t=document.createElement("canvas"),r=Object.create(isSupported.webGLContextAttributes);return r.failIfMajorPerformanceCaveat=e,t.probablySupportsContext?t.probablySupportsContext("webgl",r)||t.probablySupportsContext("experimental-webgl",r):t.supportsContext?t.supportsContext("webgl",r)||t.supportsContext("experimental-webgl",r):t.getContext("webgl",r)||t.getContext("experimental-webgl",r)}"undefined"!=typeof module&&module.exports?module.exports=isSupported:window&&(window.mapboxgl=window.mapboxgl||{},window.mapboxgl.supported=isSupported);var isWebGLSupportedCache={};isSupported.webGLContextAttributes={antialias:!1,alpha:!0,stencil:!0,depth:!0};
},{}],29:[function(_dereq_,module,exports){
"use strict";function Pbf(t){this.buf=ArrayBuffer.isView&&ArrayBuffer.isView(t)?t:new Uint8Array(t||0),this.pos=0,this.type=0,this.length=this.buf.length}function readVarintRemainder(t,i,e){var r,s,n=e.buf;if(s=n[e.pos++],r=(112&s)>>4,s<128)return toNum(t,r,i);if(s=n[e.pos++],r|=(127&s)<<3,s<128)return toNum(t,r,i);if(s=n[e.pos++],r|=(127&s)<<10,s<128)return toNum(t,r,i);if(s=n[e.pos++],r|=(127&s)<<17,s<128)return toNum(t,r,i);if(s=n[e.pos++],r|=(127&s)<<24,s<128)return toNum(t,r,i);if(s=n[e.pos++],r|=(1&s)<<31,s<128)return toNum(t,r,i);throw new Error("Expected varint not more than 10 bytes")}function readPackedEnd(t){return t.type===Pbf.Bytes?t.readVarint()+t.pos:t.pos+1}function toNum(t,i,e){return e?4294967296*i+(t>>>0):4294967296*(i>>>0)+(t>>>0)}function writeBigVarint(t,i){var e,r;if(t>=0?(e=t%4294967296|0,r=t/4294967296|0):(e=~(-t%4294967296),r=~(-t/4294967296),4294967295^e?e=e+1|0:(e=0,r=r+1|0)),t>=0x10000000000000000||t<-0x10000000000000000)throw new Error("Given varint doesn't fit into 10 bytes");i.realloc(10),writeBigVarintLow(e,r,i),writeBigVarintHigh(r,i)}function writeBigVarintLow(t,i,e){e.buf[e.pos++]=127&t|128,t>>>=7,e.buf[e.pos++]=127&t|128,t>>>=7,e.buf[e.pos++]=127&t|128,t>>>=7,e.buf[e.pos++]=127&t|128,t>>>=7,e.buf[e.pos]=127&t}function writeBigVarintHigh(t,i){var e=(7&t)<<4;i.buf[i.pos++]|=e|((t>>>=3)?128:0),t&&(i.buf[i.pos++]=127&t|((t>>>=7)?128:0),t&&(i.buf[i.pos++]=127&t|((t>>>=7)?128:0),t&&(i.buf[i.pos++]=127&t|((t>>>=7)?128:0),t&&(i.buf[i.pos++]=127&t|((t>>>=7)?128:0),t&&(i.buf[i.pos++]=127&t)))))}function makeRoomForExtraLength(t,i,e){var r=i<=16383?1:i<=2097151?2:i<=268435455?3:Math.ceil(Math.log(i)/(7*Math.LN2));e.realloc(r);for(var s=e.pos-1;s>=t;s--)e.buf[s+r]=e.buf[s]}function writePackedVarint(t,i){for(var e=0;e<t.length;e++)i.writeVarint(t[e])}function writePackedSVarint(t,i){for(var e=0;e<t.length;e++)i.writeSVarint(t[e])}function writePackedFloat(t,i){for(var e=0;e<t.length;e++)i.writeFloat(t[e])}function writePackedDouble(t,i){for(var e=0;e<t.length;e++)i.writeDouble(t[e])}function writePackedBoolean(t,i){for(var e=0;e<t.length;e++)i.writeBoolean(t[e])}function writePackedFixed32(t,i){for(var e=0;e<t.length;e++)i.writeFixed32(t[e])}function writePackedSFixed32(t,i){for(var e=0;e<t.length;e++)i.writeSFixed32(t[e])}function writePackedFixed64(t,i){for(var e=0;e<t.length;e++)i.writeFixed64(t[e])}function writePackedSFixed64(t,i){for(var e=0;e<t.length;e++)i.writeSFixed64(t[e])}function readUInt32(t,i){return(t[i]|t[i+1]<<8|t[i+2]<<16)+16777216*t[i+3]}function writeInt32(t,i,e){t[e]=i,t[e+1]=i>>>8,t[e+2]=i>>>16,t[e+3]=i>>>24}function readInt32(t,i){return(t[i]|t[i+1]<<8|t[i+2]<<16)+(t[i+3]<<24)}function readUtf8(t,i,e){for(var r="",s=i;s<e;){var n=t[s],o=null,a=n>239?4:n>223?3:n>191?2:1;if(s+a>e)break;var h,u,f;1===a?n<128&&(o=n):2===a?128==(192&(h=t[s+1]))&&(o=(31&n)<<6|63&h)<=127&&(o=null):3===a?(h=t[s+1],u=t[s+2],128==(192&h)&&128==(192&u)&&((o=(15&n)<<12|(63&h)<<6|63&u)<=2047||o>=55296&&o<=57343)&&(o=null)):4===a&&(h=t[s+1],u=t[s+2],f=t[s+3],128==(192&h)&&128==(192&u)&&128==(192&f)&&((o=(15&n)<<18|(63&h)<<12|(63&u)<<6|63&f)<=65535||o>=1114112)&&(o=null)),null===o?(o=65533,a=1):o>65535&&(o-=65536,r+=String.fromCharCode(o>>>10&1023|55296),o=56320|1023&o),r+=String.fromCharCode(o),s+=a}return r}function writeUtf8(t,i,e){for(var r,s,n=0;n<i.length;n++){if((r=i.charCodeAt(n))>55295&&r<57344){if(!s){r>56319||n+1===i.length?(t[e++]=239,t[e++]=191,t[e++]=189):s=r;continue}if(r<56320){t[e++]=239,t[e++]=191,t[e++]=189,s=r;continue}r=s-55296<<10|r-56320|65536,s=null}else s&&(t[e++]=239,t[e++]=191,t[e++]=189,s=null);r<128?t[e++]=r:(r<2048?t[e++]=r>>6|192:(r<65536?t[e++]=r>>12|224:(t[e++]=r>>18|240,t[e++]=r>>12&63|128),t[e++]=r>>6&63|128),t[e++]=63&r|128)}return e}module.exports=Pbf;var ieee754=_dereq_("ieee754");Pbf.Varint=0,Pbf.Fixed64=1,Pbf.Bytes=2,Pbf.Fixed32=5;var SHIFT_LEFT_32=4294967296,SHIFT_RIGHT_32=1/SHIFT_LEFT_32;Pbf.prototype={destroy:function(){this.buf=null},readFields:function(t,i,e){for(e=e||this.length;this.pos<e;){var r=this.readVarint(),s=r>>3,n=this.pos;this.type=7&r,t(s,i,this),this.pos===n&&this.skip(r)}return i},readMessage:function(t,i){return this.readFields(t,i,this.readVarint()+this.pos)},readFixed32:function(){var t=readUInt32(this.buf,this.pos);return this.pos+=4,t},readSFixed32:function(){var t=readInt32(this.buf,this.pos);return this.pos+=4,t},readFixed64:function(){var t=readUInt32(this.buf,this.pos)+readUInt32(this.buf,this.pos+4)*SHIFT_LEFT_32;return this.pos+=8,t},readSFixed64:function(){var t=readUInt32(this.buf,this.pos)+readInt32(this.buf,this.pos+4)*SHIFT_LEFT_32;return this.pos+=8,t},readFloat:function(){var t=ieee754.read(this.buf,this.pos,!0,23,4);return this.pos+=4,t},readDouble:function(){var t=ieee754.read(this.buf,this.pos,!0,52,8);return this.pos+=8,t},readVarint:function(t){var i,e,r=this.buf;return e=r[this.pos++],i=127&e,e<128?i:(e=r[this.pos++],i|=(127&e)<<7,e<128?i:(e=r[this.pos++],i|=(127&e)<<14,e<128?i:(e=r[this.pos++],i|=(127&e)<<21,e<128?i:(e=r[this.pos],i|=(15&e)<<28,readVarintRemainder(i,t,this)))))},readVarint64:function(){return this.readVarint(!0)},readSVarint:function(){var t=this.readVarint();return t%2==1?(t+1)/-2:t/2},readBoolean:function(){return Boolean(this.readVarint())},readString:function(){var t=this.readVarint()+this.pos,i=readUtf8(this.buf,this.pos,t);return this.pos=t,i},readBytes:function(){var t=this.readVarint()+this.pos,i=this.buf.subarray(this.pos,t);return this.pos=t,i},readPackedVarint:function(t,i){var e=readPackedEnd(this);for(t=t||[];this.pos<e;)t.push(this.readVarint(i));return t},readPackedSVarint:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readSVarint());return t},readPackedBoolean:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readBoolean());return t},readPackedFloat:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readFloat());return t},readPackedDouble:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readDouble());return t},readPackedFixed32:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readFixed32());return t},readPackedSFixed32:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readSFixed32());return t},readPackedFixed64:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readFixed64());return t},readPackedSFixed64:function(t){var i=readPackedEnd(this);for(t=t||[];this.pos<i;)t.push(this.readSFixed64());return t},skip:function(t){var i=7&t;if(i===Pbf.Varint)for(;this.buf[this.pos++]>127;);else if(i===Pbf.Bytes)this.pos=this.readVarint()+this.pos;else if(i===Pbf.Fixed32)this.pos+=4;else{if(i!==Pbf.Fixed64)throw new Error("Unimplemented type: "+i);this.pos+=8}},writeTag:function(t,i){this.writeVarint(t<<3|i)},realloc:function(t){for(var i=this.length||16;i<this.pos+t;)i*=2;if(i!==this.length){var e=new Uint8Array(i);e.set(this.buf),this.buf=e,this.length=i}},finish:function(){return this.length=this.pos,this.pos=0,this.buf.subarray(0,this.length)},writeFixed32:function(t){this.realloc(4),writeInt32(this.buf,t,this.pos),this.pos+=4},writeSFixed32:function(t){this.realloc(4),writeInt32(this.buf,t,this.pos),this.pos+=4},writeFixed64:function(t){this.realloc(8),writeInt32(this.buf,-1&t,this.pos),writeInt32(this.buf,Math.floor(t*SHIFT_RIGHT_32),this.pos+4),this.pos+=8},writeSFixed64:function(t){this.realloc(8),writeInt32(this.buf,-1&t,this.pos),writeInt32(this.buf,Math.floor(t*SHIFT_RIGHT_32),this.pos+4),this.pos+=8},writeVarint:function(t){if((t=+t||0)>268435455||t<0)return void writeBigVarint(t,this);this.realloc(4),this.buf[this.pos++]=127&t|(t>127?128:0),t<=127||(this.buf[this.pos++]=127&(t>>>=7)|(t>127?128:0),t<=127||(this.buf[this.pos++]=127&(t>>>=7)|(t>127?128:0),t<=127||(this.buf[this.pos++]=t>>>7&127)))},writeSVarint:function(t){this.writeVarint(t<0?2*-t-1:2*t)},writeBoolean:function(t){this.writeVarint(Boolean(t))},writeString:function(t){t=String(t),this.realloc(4*t.length),this.pos++;var i=this.pos;this.pos=writeUtf8(this.buf,t,this.pos);var e=this.pos-i;e>=128&&makeRoomForExtraLength(i,e,this),this.pos=i-1,this.writeVarint(e),this.pos+=e},writeFloat:function(t){this.realloc(4),ieee754.write(this.buf,t,this.pos,!0,23,4),this.pos+=4},writeDouble:function(t){this.realloc(8),ieee754.write(this.buf,t,this.pos,!0,52,8),this.pos+=8},writeBytes:function(t){var i=t.length;this.writeVarint(i),this.realloc(i);for(var e=0;e<i;e++)this.buf[this.pos++]=t[e]},writeRawMessage:function(t,i){this.pos++;var e=this.pos;t(i,this);var r=this.pos-e;r>=128&&makeRoomForExtraLength(e,r,this),this.pos=e-1,this.writeVarint(r),this.pos+=r},writeMessage:function(t,i,e){this.writeTag(t,Pbf.Bytes),this.writeRawMessage(i,e)},writePackedVarint:function(t,i){this.writeMessage(t,writePackedVarint,i)},writePackedSVarint:function(t,i){this.writeMessage(t,writePackedSVarint,i)},writePackedBoolean:function(t,i){this.writeMessage(t,writePackedBoolean,i)},writePackedFloat:function(t,i){this.writeMessage(t,writePackedFloat,i)},writePackedDouble:function(t,i){this.writeMessage(t,writePackedDouble,i)},writePackedFixed32:function(t,i){this.writeMessage(t,writePackedFixed32,i)},writePackedSFixed32:function(t,i){this.writeMessage(t,writePackedSFixed32,i)},writePackedFixed64:function(t,i){this.writeMessage(t,writePackedFixed64,i)},writePackedSFixed64:function(t,i){this.writeMessage(t,writePackedSFixed64,i)},writeBytesField:function(t,i){this.writeTag(t,Pbf.Bytes),this.writeBytes(i)},writeFixed32Field:function(t,i){this.writeTag(t,Pbf.Fixed32),this.writeFixed32(i)},writeSFixed32Field:function(t,i){this.writeTag(t,Pbf.Fixed32),this.writeSFixed32(i)},writeFixed64Field:function(t,i){this.writeTag(t,Pbf.Fixed64),this.writeFixed64(i)},writeSFixed64Field:function(t,i){this.writeTag(t,Pbf.Fixed64),this.writeSFixed64(i)},writeVarintField:function(t,i){this.writeTag(t,Pbf.Varint),this.writeVarint(i)},writeSVarintField:function(t,i){this.writeTag(t,Pbf.Varint),this.writeSVarint(i)},writeStringField:function(t,i){this.writeTag(t,Pbf.Bytes),this.writeString(i)},writeFloatField:function(t,i){this.writeTag(t,Pbf.Fixed32),this.writeFloat(i)},writeDoubleField:function(t,i){this.writeTag(t,Pbf.Fixed64),this.writeDouble(i)},writeBooleanField:function(t,i){this.writeVarintField(t,Boolean(i))}};
},{"ieee754":23}],30:[function(_dereq_,module,exports){
function defaultSetTimout(){throw new Error("setTimeout has not been defined")}function defaultClearTimeout(){throw new Error("clearTimeout has not been defined")}function runTimeout(e){if(cachedSetTimeout===setTimeout)return setTimeout(e,0);if((cachedSetTimeout===defaultSetTimout||!cachedSetTimeout)&&setTimeout)return cachedSetTimeout=setTimeout,setTimeout(e,0);try{return cachedSetTimeout(e,0)}catch(t){try{return cachedSetTimeout.call(null,e,0)}catch(t){return cachedSetTimeout.call(this,e,0)}}}function runClearTimeout(e){if(cachedClearTimeout===clearTimeout)return clearTimeout(e);if((cachedClearTimeout===defaultClearTimeout||!cachedClearTimeout)&&clearTimeout)return cachedClearTimeout=clearTimeout,clearTimeout(e);try{return cachedClearTimeout(e)}catch(t){try{return cachedClearTimeout.call(null,e)}catch(t){return cachedClearTimeout.call(this,e)}}}function cleanUpNextTick(){draining&&currentQueue&&(draining=!1,currentQueue.length?queue=currentQueue.concat(queue):queueIndex=-1,queue.length&&drainQueue())}function drainQueue(){if(!draining){var e=runTimeout(cleanUpNextTick);draining=!0;for(var t=queue.length;t;){for(currentQueue=queue,queue=[];++queueIndex<t;)currentQueue&&currentQueue[queueIndex].run();queueIndex=-1,t=queue.length}currentQueue=null,draining=!1,runClearTimeout(e)}}function Item(e,t){this.fun=e,this.array=t}function noop(){}var process=module.exports={},cachedSetTimeout,cachedClearTimeout;!function(){try{cachedSetTimeout="function"==typeof setTimeout?setTimeout:defaultSetTimout}catch(e){cachedSetTimeout=defaultSetTimout}try{cachedClearTimeout="function"==typeof clearTimeout?clearTimeout:defaultClearTimeout}catch(e){cachedClearTimeout=defaultClearTimeout}}();var queue=[],draining=!1,currentQueue,queueIndex=-1;process.nextTick=function(e){var t=new Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];queue.push(new Item(e,t)),1!==queue.length||draining||runTimeout(drainQueue)},Item.prototype.run=function(){this.fun.apply(null,this.array)},process.title="browser",process.browser=!0,process.env={},process.argv=[],process.version="",process.versions={},process.on=noop,process.addListener=noop,process.once=noop,process.off=noop,process.removeListener=noop,process.removeAllListeners=noop,process.emit=noop,process.prependListener=noop,process.prependOnceListener=noop,process.listeners=function(e){return[]},process.binding=function(e){throw new Error("process.binding is not supported")},process.cwd=function(){return"/"},process.chdir=function(e){throw new Error("process.chdir is not supported")},process.umask=function(){return 0};
},{}],31:[function(_dereq_,module,exports){
"use strict";function partialSort(a,t,r,o,p){for(r=r||0,o=o||a.length-1,p=p||defaultCompare;o>r;){if(o-r>600){var f=o-r+1,e=t-r+1,l=Math.log(f),s=.5*Math.exp(2*l/3),i=.5*Math.sqrt(l*s*(f-s)/f)*(e-f/2<0?-1:1);partialSort(a,t,Math.max(r,Math.floor(t-e*s/f+i)),Math.min(o,Math.floor(t+(f-e)*s/f+i)),p)}var n=a[t],h=r,u=o;for(swap(a,r,t),p(a[o],n)>0&&swap(a,r,o);h<u;){for(swap(a,h,u),h++,u--;p(a[h],n)<0;)h++;for(;p(a[u],n)>0;)u--}0===p(a[r],n)?swap(a,r,u):(u++,swap(a,u,o)),u<=t&&(r=u+1),t<=u&&(o=u-1)}}function swap(a,t,r){var o=a[t];a[t]=a[r],a[r]=o}function defaultCompare(a,t){return a<t?-1:a>t?1:0}module.exports=partialSort;
},{}],32:[function(_dereq_,module,exports){
"use strict";function supercluster(t){return new SuperCluster(t)}function SuperCluster(t){this.options=extend(Object.create(this.options),t),this.trees=new Array(this.options.maxZoom+1)}function createCluster(t,e,n,o,i){return{x:t,y:e,zoom:1/0,id:o,properties:i,parentId:-1,numPoints:n}}function createPointCluster(t,e){var n=t.geometry.coordinates;return{x:lngX(n[0]),y:latY(n[1]),zoom:1/0,id:e,parentId:-1}}function getClusterJSON(t){return{type:"Feature",properties:getClusterProperties(t),geometry:{type:"Point",coordinates:[xLng(t.x),yLat(t.y)]}}}function getClusterProperties(t){var e=t.numPoints,n=e>=1e4?Math.round(e/1e3)+"k":e>=1e3?Math.round(e/100)/10+"k":e;return extend(extend({},t.properties),{cluster:!0,cluster_id:t.id,point_count:e,point_count_abbreviated:n})}function lngX(t){return t/360+.5}function latY(t){var e=Math.sin(t*Math.PI/180),n=.5-.25*Math.log((1+e)/(1-e))/Math.PI;return n<0?0:n>1?1:n}function xLng(t){return 360*(t-.5)}function yLat(t){var e=(180-360*t)*Math.PI/180;return 360*Math.atan(Math.exp(e))/Math.PI-90}function extend(t,e){for(var n in e)t[n]=e[n];return t}function getX(t){return t.x}function getY(t){return t.y}var kdbush=_dereq_("kdbush");module.exports=supercluster,SuperCluster.prototype={options:{minZoom:0,maxZoom:16,radius:40,extent:512,nodeSize:64,log:!1,reduce:null,initial:function(){return{}},map:function(t){return t}},load:function(t){var e=this.options.log;e&&console.time("total time");var n="prepare "+t.length+" points";e&&console.time(n),this.points=t;var o=t.map(createPointCluster);e&&console.timeEnd(n);for(var i=this.options.maxZoom;i>=this.options.minZoom;i--){var r=+Date.now();this.trees[i+1]=kdbush(o,getX,getY,this.options.nodeSize,Float32Array),o=this._cluster(o,i),e&&console.log("z%d: %d clusters in %dms",i,o.length,+Date.now()-r)}return this.trees[this.options.minZoom]=kdbush(o,getX,getY,this.options.nodeSize,Float32Array),e&&console.timeEnd("total time"),this},getClusters:function(t,e){for(var n=this.trees[this._limitZoom(e)],o=n.range(lngX(t[0]),latY(t[3]),lngX(t[2]),latY(t[1])),i=[],r=0;r<o.length;r++){var s=n.points[o[r]];i.push(s.numPoints?getClusterJSON(s):this.points[s.id])}return i},getChildren:function(t,e){for(var n=this.trees[e+1].points[t],o=this.options.radius/(this.options.extent*Math.pow(2,e)),i=this.trees[e+1].within(n.x,n.y,o),r=[],s=0;s<i.length;s++){var u=this.trees[e+1].points[i[s]];u.parentId===t&&r.push(u.numPoints?getClusterJSON(u):this.points[u.id])}return r},getLeaves:function(t,e,n,o){n=n||10,o=o||0;var i=[];return this._appendLeaves(i,t,e,n,o,0),i},getTile:function(t,e,n){var o=this.trees[this._limitZoom(t)],i=Math.pow(2,t),r=this.options.extent,s=this.options.radius,u=s/r,a=(n-u)/i,p=(n+1+u)/i,h={features:[]};return this._addTileFeatures(o.range((e-u)/i,a,(e+1+u)/i,p),o.points,e,n,i,h),0===e&&this._addTileFeatures(o.range(1-u/i,a,1,p),o.points,i,n,i,h),e===i-1&&this._addTileFeatures(o.range(0,a,u/i,p),o.points,-1,n,i,h),h.features.length?h:null},getClusterExpansionZoom:function(t,e){for(;e<this.options.maxZoom;){var n=this.getChildren(t,e);if(e++,1!==n.length)break;t=n[0].properties.cluster_id}return e},_appendLeaves:function(t,e,n,o,i,r){for(var s=this.getChildren(e,n),u=0;u<s.length;u++){var a=s[u].properties;if(a.cluster?r+a.point_count<=i?r+=a.point_count:r=this._appendLeaves(t,a.cluster_id,n+1,o,i,r):r<i?r++:t.push(s[u]),t.length===o)break}return r},_addTileFeatures:function(t,e,n,o,i,r){for(var s=0;s<t.length;s++){var u=e[t[s]];r.features.push({type:1,geometry:[[Math.round(this.options.extent*(u.x*i-n)),Math.round(this.options.extent*(u.y*i-o))]],tags:u.numPoints?getClusterProperties(u):this.points[u.id].properties})}},_limitZoom:function(t){return Math.max(this.options.minZoom,Math.min(t,this.options.maxZoom+1))},_cluster:function(t,e){for(var n=[],o=this.options.radius/(this.options.extent*Math.pow(2,e)),i=0;i<t.length;i++){var r=t[i];if(!(r.zoom<=e)){r.zoom=e;var s=this.trees[e+1],u=s.within(r.x,r.y,o),a=r.numPoints||1,p=r.x*a,h=r.y*a,l=null;this.options.reduce&&(l=this.options.initial(),this._accumulate(l,r));for(var c=0;c<u.length;c++){var d=s.points[u[c]];if(e<d.zoom){var m=d.numPoints||1;d.zoom=e,p+=d.x*m,h+=d.y*m,a+=m,d.parentId=i,this.options.reduce&&this._accumulate(l,d)}}1===a?n.push(r):(r.parentId=i,n.push(createCluster(p/a,h/a,a,i,l)))}}return n},_accumulate:function(t,e){var n=e.numPoints?e.properties:this.options.map(this.points[e.id].properties);this.options.reduce(t,n)}};
},{"kdbush":24}],33:[function(_dereq_,module,exports){
"use strict";function TinyQueue(t,i){if(!(this instanceof TinyQueue))return new TinyQueue(t,i);if(this.data=t||[],this.length=this.data.length,this.compare=i||defaultCompare,this.length>0)for(var e=this.length>>1;e>=0;e--)this._down(e)}function defaultCompare(t,i){return t<i?-1:t>i?1:0}module.exports=TinyQueue,TinyQueue.prototype={push:function(t){this.data.push(t),this.length++,this._up(this.length-1)},pop:function(){if(0!==this.length){var t=this.data[0];return this.length--,this.length>0&&(this.data[0]=this.data[this.length],this._down(0)),this.data.pop(),t}},peek:function(){return this.data[0]},_up:function(t){for(var i=this.data,e=this.compare,h=i[t];t>0;){var n=t-1>>1,a=i[n];if(e(h,a)>=0)break;i[t]=a,t=n}i[t]=h},_down:function(t){for(var i=this.data,e=this.compare,h=this.length,n=h>>1,a=i[t];t<n;){var s=1+(t<<1),u=s+1,r=i[s];if(u<h&&e(i[u],r)<0&&(s=u,r=i[u]),e(r,a)>=0)break;i[t]=r,t=s}i[t]=a}};
},{}],34:[function(_dereq_,module,exports){
"function"==typeof Object.create?module.exports=function(t,e){t.super_=e,t.prototype=Object.create(e.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}})}:module.exports=function(t,e){t.super_=e;var o=function(){};o.prototype=e.prototype,t.prototype=new o,t.prototype.constructor=t};
},{}],35:[function(_dereq_,module,exports){
module.exports=function(o){return o&&"object"==typeof o&&"function"==typeof o.copy&&"function"==typeof o.fill&&"function"==typeof o.readUInt8};
},{}],36:[function(_dereq_,module,exports){
(function (process,global){
function inspect(e,r){var t={seen:[],stylize:stylizeNoColor};return arguments.length>=3&&(t.depth=arguments[2]),arguments.length>=4&&(t.colors=arguments[3]),isBoolean(r)?t.showHidden=r:r&&exports._extend(t,r),isUndefined(t.showHidden)&&(t.showHidden=!1),isUndefined(t.depth)&&(t.depth=2),isUndefined(t.colors)&&(t.colors=!1),isUndefined(t.customInspect)&&(t.customInspect=!0),t.colors&&(t.stylize=stylizeWithColor),formatValue(t,e,t.depth)}function stylizeWithColor(e,r){var t=inspect.styles[r];return t?"["+inspect.colors[t][0]+"m"+e+"["+inspect.colors[t][1]+"m":e}function stylizeNoColor(e,r){return e}function arrayToHash(e){var r={};return e.forEach(function(e,t){r[e]=!0}),r}function formatValue(e,r,t){if(e.customInspect&&r&&isFunction(r.inspect)&&r.inspect!==exports.inspect&&(!r.constructor||r.constructor.prototype!==r)){var n=r.inspect(t,e);return isString(n)||(n=formatValue(e,n,t)),n}var i=formatPrimitive(e,r);if(i)return i;var o=Object.keys(r),s=arrayToHash(o);if(e.showHidden&&(o=Object.getOwnPropertyNames(r)),isError(r)&&(o.indexOf("message")>=0||o.indexOf("description")>=0))return formatError(r);if(0===o.length){if(isFunction(r)){var u=r.name?": "+r.name:"";return e.stylize("[Function"+u+"]","special")}if(isRegExp(r))return e.stylize(RegExp.prototype.toString.call(r),"regexp");if(isDate(r))return e.stylize(Date.prototype.toString.call(r),"date");if(isError(r))return formatError(r)}var c="",a=!1,l=["{","}"];if(isArray(r)&&(a=!0,l=["[","]"]),isFunction(r)){c=" [Function"+(r.name?": "+r.name:"")+"]"}if(isRegExp(r)&&(c=" "+RegExp.prototype.toString.call(r)),isDate(r)&&(c=" "+Date.prototype.toUTCString.call(r)),isError(r)&&(c=" "+formatError(r)),0===o.length&&(!a||0==r.length))return l[0]+c+l[1];if(t<0)return isRegExp(r)?e.stylize(RegExp.prototype.toString.call(r),"regexp"):e.stylize("[Object]","special");e.seen.push(r);var p;return p=a?formatArray(e,r,t,s,o):o.map(function(n){return formatProperty(e,r,t,s,n,a)}),e.seen.pop(),reduceToSingleString(p,c,l)}function formatPrimitive(e,r){if(isUndefined(r))return e.stylize("undefined","undefined");if(isString(r)){var t="'"+JSON.stringify(r).replace(/^"|"$/g,"").replace(/'/g,"\\'").replace(/\\"/g,'"')+"'";return e.stylize(t,"string")}return isNumber(r)?e.stylize(""+r,"number"):isBoolean(r)?e.stylize(""+r,"boolean"):isNull(r)?e.stylize("null","null"):void 0}function formatError(e){return"["+Error.prototype.toString.call(e)+"]"}function formatArray(e,r,t,n,i){for(var o=[],s=0,u=r.length;s<u;++s)hasOwnProperty(r,String(s))?o.push(formatProperty(e,r,t,n,String(s),!0)):o.push("");return i.forEach(function(i){i.match(/^\d+$/)||o.push(formatProperty(e,r,t,n,i,!0))}),o}function formatProperty(e,r,t,n,i,o){var s,u,c;if(c=Object.getOwnPropertyDescriptor(r,i)||{value:r[i]},c.get?u=c.set?e.stylize("[Getter/Setter]","special"):e.stylize("[Getter]","special"):c.set&&(u=e.stylize("[Setter]","special")),hasOwnProperty(n,i)||(s="["+i+"]"),u||(e.seen.indexOf(c.value)<0?(u=isNull(t)?formatValue(e,c.value,null):formatValue(e,c.value,t-1),u.indexOf("\n")>-1&&(u=o?u.split("\n").map(function(e){return"  "+e}).join("\n").substr(2):"\n"+u.split("\n").map(function(e){return"   "+e}).join("\n"))):u=e.stylize("[Circular]","special")),isUndefined(s)){if(o&&i.match(/^\d+$/))return u;s=JSON.stringify(""+i),s.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)?(s=s.substr(1,s.length-2),s=e.stylize(s,"name")):(s=s.replace(/'/g,"\\'").replace(/\\"/g,'"').replace(/(^"|"$)/g,"'"),s=e.stylize(s,"string"))}return s+": "+u}function reduceToSingleString(e,r,t){var n=0;return e.reduce(function(e,r){return n++,r.indexOf("\n")>=0&&n++,e+r.replace(/\u001b\[\d\d?m/g,"").length+1},0)>60?t[0]+(""===r?"":r+"\n ")+" "+e.join(",\n  ")+" "+t[1]:t[0]+r+" "+e.join(", ")+" "+t[1]}function isArray(e){return Array.isArray(e)}function isBoolean(e){return"boolean"==typeof e}function isNull(e){return null===e}function isNullOrUndefined(e){return null==e}function isNumber(e){return"number"==typeof e}function isString(e){return"string"==typeof e}function isSymbol(e){return"symbol"==typeof e}function isUndefined(e){return void 0===e}function isRegExp(e){return isObject(e)&&"[object RegExp]"===objectToString(e)}function isObject(e){return"object"==typeof e&&null!==e}function isDate(e){return isObject(e)&&"[object Date]"===objectToString(e)}function isError(e){return isObject(e)&&("[object Error]"===objectToString(e)||e instanceof Error)}function isFunction(e){return"function"==typeof e}function isPrimitive(e){return null===e||"boolean"==typeof e||"number"==typeof e||"string"==typeof e||"symbol"==typeof e||void 0===e}function objectToString(e){return Object.prototype.toString.call(e)}function pad(e){return e<10?"0"+e.toString(10):e.toString(10)}function timestamp(){var e=new Date,r=[pad(e.getHours()),pad(e.getMinutes()),pad(e.getSeconds())].join(":");return[e.getDate(),months[e.getMonth()],r].join(" ")}function hasOwnProperty(e,r){return Object.prototype.hasOwnProperty.call(e,r)}var formatRegExp=/%[sdj%]/g;exports.format=function(e){if(!isString(e)){for(var r=[],t=0;t<arguments.length;t++)r.push(inspect(arguments[t]));return r.join(" ")}for(var t=1,n=arguments,i=n.length,o=String(e).replace(formatRegExp,function(e){if("%%"===e)return"%";if(t>=i)return e;switch(e){case"%s":return String(n[t++]);case"%d":return Number(n[t++]);case"%j":try{return JSON.stringify(n[t++])}catch(e){return"[Circular]"}default:return e}}),s=n[t];t<i;s=n[++t])isNull(s)||!isObject(s)?o+=" "+s:o+=" "+inspect(s);return o},exports.deprecate=function(e,r){function t(){if(!n){if(process.throwDeprecation)throw new Error(r);process.traceDeprecation?console.trace(r):console.error(r),n=!0}return e.apply(this,arguments)}if(isUndefined(global.process))return function(){return exports.deprecate(e,r).apply(this,arguments)};if(!0===process.noDeprecation)return e;var n=!1;return t};var debugs={},debugEnviron;exports.debuglog=function(e){if(isUndefined(debugEnviron)&&(debugEnviron=process.env.NODE_DEBUG||""),e=e.toUpperCase(),!debugs[e])if(new RegExp("\\b"+e+"\\b","i").test(debugEnviron)){var r=process.pid;debugs[e]=function(){var t=exports.format.apply(exports,arguments);console.error("%s %d: %s",e,r,t)}}else debugs[e]=function(){};return debugs[e]},exports.inspect=inspect,inspect.colors={bold:[1,22],italic:[3,23],underline:[4,24],inverse:[7,27],white:[37,39],grey:[90,39],black:[30,39],blue:[34,39],cyan:[36,39],green:[32,39],magenta:[35,39],red:[31,39],yellow:[33,39]},inspect.styles={special:"cyan",number:"yellow",boolean:"yellow",undefined:"grey",null:"bold",string:"green",date:"magenta",regexp:"red"},exports.isArray=isArray,exports.isBoolean=isBoolean,exports.isNull=isNull,exports.isNullOrUndefined=isNullOrUndefined,exports.isNumber=isNumber,exports.isString=isString,exports.isSymbol=isSymbol,exports.isUndefined=isUndefined,exports.isRegExp=isRegExp,exports.isObject=isObject,exports.isDate=isDate,exports.isError=isError,exports.isFunction=isFunction,exports.isPrimitive=isPrimitive,exports.isBuffer=_dereq_("./support/isBuffer");var months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];exports.log=function(){console.log("%s - %s",timestamp(),exports.format.apply(exports,arguments))},exports.inherits=_dereq_("inherits"),exports._extend=function(e,r){if(!r||!isObject(r))return e;for(var t=Object.keys(r),n=t.length;n--;)e[t[n]]=r[t[n]];return e};
}).call(this,_dereq_('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./support/isBuffer":35,"_process":30,"inherits":34}],37:[function(_dereq_,module,exports){
function fromVectorTileJs(e){var r=new Pbf;return writeTile(e,r),r.finish()}function fromGeojsonVt(e){var r={};for(var t in e)r[t]=new GeoJSONWrapper(e[t].features),r[t].name=t;return fromVectorTileJs({layers:r})}function writeTile(e,r){for(var t in e.layers)r.writeMessage(3,writeLayer,e.layers[t])}function writeLayer(e,r){r.writeVarintField(15,e.version||1),r.writeStringField(1,e.name||""),r.writeVarintField(5,e.extent||4096);var t,i={keys:[],values:[],keycache:{},valuecache:{}};for(t=0;t<e.length;t++)i.feature=e.feature(t),r.writeMessage(2,writeFeature,i);var a=i.keys;for(t=0;t<a.length;t++)r.writeStringField(3,a[t]);var o=i.values;for(t=0;t<o.length;t++)r.writeMessage(4,writeValue,o[t])}function writeFeature(e,r){var t=e.feature;void 0!==t.id&&r.writeVarintField(1,t.id),r.writeMessage(2,writeProperties,e),r.writeVarintField(3,t.type),r.writeMessage(4,writeGeometry,t)}function writeProperties(e,r){var t=e.feature,i=e.keys,a=e.values,o=e.keycache,n=e.valuecache;for(var l in t.properties){var s=o[l];void 0===s&&(i.push(l),s=i.length-1,o[l]=s),r.writeVarint(s);var u=t.properties[l],f=typeof u;"string"!==f&&"boolean"!==f&&"number"!==f&&(u=JSON.stringify(u));var w=f+":"+u,v=n[w];void 0===v&&(a.push(u),v=a.length-1,n[w]=v),r.writeVarint(v)}}function command(e,r){return(r<<3)+(7&e)}function zigzag(e){return e<<1^e>>31}function writeGeometry(e,r){for(var t=e.loadGeometry(),i=e.type,a=0,o=0,n=t.length,l=0;l<n;l++){var s=t[l],u=1;1===i&&(u=s.length),r.writeVarint(command(1,u));for(var f=0;f<s.length;f++){1===f&&1!==i&&r.writeVarint(command(2,s.length-1));var w=s[f].x-a,v=s[f].y-o;r.writeVarint(zigzag(w)),r.writeVarint(zigzag(v)),a+=w,o+=v}}}function writeValue(e,r){var t=typeof e;"string"===t?r.writeStringField(1,e):"boolean"===t?r.writeBooleanField(7,e):"number"===t&&(e%1!=0?r.writeDoubleField(3,e):e<0?r.writeSVarintField(6,e):r.writeVarintField(5,e))}var Pbf=_dereq_("pbf"),GeoJSONWrapper=_dereq_("./lib/geojson_wrapper");module.exports=fromVectorTileJs,module.exports.fromVectorTileJs=fromVectorTileJs,module.exports.fromGeojsonVt=fromGeojsonVt,module.exports.GeoJSONWrapper=GeoJSONWrapper;
},{"./lib/geojson_wrapper":38,"pbf":29}],38:[function(_dereq_,module,exports){
"use strict";function GeoJSONWrapper(e){this.features=e,this.length=e.length}function FeatureWrapper(e){this.id="number"==typeof e.id?e.id:void 0,this.type=e.type,this.rawGeometry=1===e.type?[e.geometry]:e.geometry,this.properties=e.tags,this.extent=4096}var Point=_dereq_("@mapbox/point-geometry"),VectorTileFeature=_dereq_("@mapbox/vector-tile").VectorTileFeature;module.exports=GeoJSONWrapper,GeoJSONWrapper.prototype.feature=function(e){return new FeatureWrapper(this.features[e])},FeatureWrapper.prototype.loadGeometry=function(){var e=this.rawGeometry;this.geometry=[];for(var t=0;t<e.length;t++){for(var r=e[t],o=[],a=0;a<r.length;a++)o.push(new Point(r[a][0],r[a][1]));this.geometry.push(o)}return this.geometry},FeatureWrapper.prototype.bbox=function(){this.geometry||this.loadGeometry();for(var e=this.geometry,t=1/0,r=-1/0,o=1/0,a=-1/0,p=0;p<e.length;p++)for(var i=e[p],n=0;n<i.length;n++){var h=i[n];t=Math.min(t,h.x),r=Math.max(r,h.x),o=Math.min(o,h.y),a=Math.max(a,h.y)}return[t,o,r,a]},FeatureWrapper.prototype.toGeoJSON=VectorTileFeature.prototype.toGeoJSON;
},{"@mapbox/point-geometry":2,"@mapbox/vector-tile":6}],39:[function(_dereq_,module,exports){
var bundleFn=arguments[3],sources=arguments[4],cache=arguments[5],stringify=JSON.stringify;module.exports=function(r,e){function t(r){d[r]=!0;for(var e in sources[r][1]){var n=sources[r][1][e];d[n]||t(n)}}for(var n,o=Object.keys(cache),a=0,i=o.length;a<i;a++){var s=o[a],u=cache[s].exports;if(u===r||u&&u.default===r){n=s;break}}if(!n){n=Math.floor(Math.pow(16,8)*Math.random()).toString(16);for(var f={},a=0,i=o.length;a<i;a++){var s=o[a];f[s]=s}sources[n]=[Function(["require","module","exports"],"("+r+")(self)"),f]}var c=Math.floor(Math.pow(16,8)*Math.random()).toString(16),l={};l[n]=n,sources[c]=[Function(["require"],"var f = require("+stringify(n)+");(f.default ? f.default : f)(self);"),l];var d={};t(c);var g="("+bundleFn+")({"+Object.keys(d).map(function(r){return stringify(r)+":["+sources[r][0]+","+stringify(sources[r][1])+"]"}).join(",")+"},{},["+stringify(c)+"])",v=window.URL||window.webkitURL||window.mozURL||window.msURL,w=new Blob([g],{type:"text/javascript"});if(e&&e.bare)return w;var h=v.createObjectURL(w),b=new Worker(h);return b.objectURL=h,b};
},{}],40:[function(_dereq_,module,exports){
module.exports.RADIUS=6378137,module.exports.FLATTENING=1/298.257223563,module.exports.POLAR_RADIUS=6356752.3142;
},{}],41:[function(_dereq_,module,exports){
module.exports={"version":"0.40.1"}
},{}],42:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util");module.exports={deserialize:function(e,r){var t={};if(!r)return t;for(var i=0,a=e;i<a.length;i+=1){var l=a[i],u=l.layerIds.map(function(e){return r.getLayer(e)}).filter(Boolean);if(0!==u.length)for(var n=u[0].createBucket(util.extend({layers:u},l)),o=0,f=u;o<f.length;o+=1){var s=f[o];t[s.id]=n}}return t}};
},{"../util/util":223}],43:[function(_dereq_,module,exports){
"use strict";function addCircleVertex(e,r,t,i,a){e.emplaceBack(2*r+(i+1)/2,2*t+(a+1)/2)}var ref=_dereq_("../segment"),SegmentVector=ref.SegmentVector,VertexBuffer=_dereq_("../../gl/vertex_buffer"),IndexBuffer=_dereq_("../../gl/index_buffer"),ref$1=_dereq_("../program_configuration"),ProgramConfigurationSet=ref$1.ProgramConfigurationSet,createVertexArrayType=_dereq_("../vertex_array_type"),ref$2=_dereq_("../index_array_type"),TriangleIndexArray=ref$2.TriangleIndexArray,loadGeometry=_dereq_("../load_geometry"),EXTENT=_dereq_("../extent"),circleInterface={layoutAttributes:[{name:"a_pos",components:2,type:"Int16"}],indexArrayType:TriangleIndexArray,paintAttributes:[{property:"circle-color"},{property:"circle-radius"},{property:"circle-blur"},{property:"circle-opacity"},{property:"circle-stroke-color"},{property:"circle-stroke-width"},{property:"circle-stroke-opacity"}]},LayoutVertexArrayType=createVertexArrayType(circleInterface.layoutAttributes),CircleBucket=function(e){this.zoom=e.zoom,this.overscaling=e.overscaling,this.layers=e.layers,this.index=e.index,this.layoutVertexArray=new LayoutVertexArrayType(e.layoutVertexArray),this.indexArray=new TriangleIndexArray(e.indexArray),this.programConfigurations=new ProgramConfigurationSet(circleInterface,e.layers,e.zoom,e.programConfigurations),this.segments=new SegmentVector(e.segments)};CircleBucket.prototype.populate=function(e,r){for(var t=this,i=0,a=e;i<a.length;i+=1){var o=a[i],n=o.feature,y=o.index,u=o.sourceLayerIndex;if(t.layers[0].filter(n)){var s=loadGeometry(n);t.addFeature(n,s),r.featureIndex.insert(n,s,y,u,t.index)}}},CircleBucket.prototype.isEmpty=function(){return 0===this.layoutVertexArray.length},CircleBucket.prototype.serialize=function(e){return{zoom:this.zoom,layerIds:this.layers.map(function(e){return e.id}),layoutVertexArray:this.layoutVertexArray.serialize(e),indexArray:this.indexArray.serialize(e),programConfigurations:this.programConfigurations.serialize(e),segments:this.segments.get()}},CircleBucket.prototype.upload=function(e){this.layoutVertexBuffer=new VertexBuffer(e,this.layoutVertexArray),this.indexBuffer=new IndexBuffer(e,this.indexArray),this.programConfigurations.upload(e)},CircleBucket.prototype.destroy=function(){this.layoutVertexBuffer&&(this.layoutVertexBuffer.destroy(),this.indexBuffer.destroy(),this.programConfigurations.destroy(),this.segments.destroy())},CircleBucket.prototype.addFeature=function(e,r){for(var t=this,i=0,a=r;i<a.length;i+=1)for(var o=a[i],n=0,y=o;n<y.length;n+=1){var u=y[n],s=u.x,c=u.y;if(!(s<0||s>=EXTENT||c<0||c>=EXTENT)){var l=t.segments.prepareSegment(4,t.layoutVertexArray,t.indexArray),p=l.vertexLength;addCircleVertex(t.layoutVertexArray,s,c,-1,-1),addCircleVertex(t.layoutVertexArray,s,c,1,-1),addCircleVertex(t.layoutVertexArray,s,c,1,1),addCircleVertex(t.layoutVertexArray,s,c,-1,1),t.indexArray.emplaceBack(p,p+1,p+2),t.indexArray.emplaceBack(p,p+3,p+2),l.vertexLength+=4,l.primitiveLength+=2}}this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length,e.properties)},CircleBucket.programInterface=circleInterface,module.exports=CircleBucket;
},{"../../gl/index_buffer":61,"../../gl/vertex_buffer":62,"../extent":48,"../index_array_type":50,"../load_geometry":51,"../program_configuration":53,"../segment":55,"../vertex_array_type":56}],44:[function(_dereq_,module,exports){
"use strict";var ref=_dereq_("../segment"),SegmentVector=ref.SegmentVector,VertexBuffer=_dereq_("../../gl/vertex_buffer"),IndexBuffer=_dereq_("../../gl/index_buffer"),ref$1=_dereq_("../program_configuration"),ProgramConfigurationSet=ref$1.ProgramConfigurationSet,createVertexArrayType=_dereq_("../vertex_array_type"),ref$2=_dereq_("../index_array_type"),LineIndexArray=ref$2.LineIndexArray,TriangleIndexArray=ref$2.TriangleIndexArray,loadGeometry=_dereq_("../load_geometry"),earcut=_dereq_("earcut"),classifyRings=_dereq_("../../util/classify_rings"),EARCUT_MAX_RINGS=500,fillInterface={layoutAttributes:[{name:"a_pos",components:2,type:"Int16"}],indexArrayType:TriangleIndexArray,indexArrayType2:LineIndexArray,paintAttributes:[{property:"fill-color"},{property:"fill-outline-color"},{property:"fill-opacity"}]},LayoutVertexArrayType=createVertexArrayType(fillInterface.layoutAttributes),FillBucket=function(e){this.zoom=e.zoom,this.overscaling=e.overscaling,this.layers=e.layers,this.index=e.index,this.layoutVertexArray=new LayoutVertexArrayType(e.layoutVertexArray),this.indexArray=new TriangleIndexArray(e.indexArray),this.indexArray2=new LineIndexArray(e.indexArray2),this.programConfigurations=new ProgramConfigurationSet(fillInterface,e.layers,e.zoom,e.programConfigurations),this.segments=new SegmentVector(e.segments),this.segments2=new SegmentVector(e.segments2)};FillBucket.prototype.populate=function(e,r){for(var t=this,i=0,a=e;i<a.length;i+=1){var n=a[i],o=n.feature,s=n.index,y=n.sourceLayerIndex;if(t.layers[0].filter(o)){var l=loadGeometry(o);t.addFeature(o,l),r.featureIndex.insert(o,l,s,y,t.index)}}},FillBucket.prototype.isEmpty=function(){return 0===this.layoutVertexArray.length},FillBucket.prototype.serialize=function(e){return{zoom:this.zoom,layerIds:this.layers.map(function(e){return e.id}),layoutVertexArray:this.layoutVertexArray.serialize(e),indexArray:this.indexArray.serialize(e),indexArray2:this.indexArray2.serialize(e),programConfigurations:this.programConfigurations.serialize(e),segments:this.segments.get(),segments2:this.segments2.get()}},FillBucket.prototype.upload=function(e){this.layoutVertexBuffer=new VertexBuffer(e,this.layoutVertexArray),this.indexBuffer=new IndexBuffer(e,this.indexArray),this.indexBuffer2=new IndexBuffer(e,this.indexArray2),this.programConfigurations.upload(e)},FillBucket.prototype.destroy=function(){this.layoutVertexBuffer&&(this.layoutVertexBuffer.destroy(),this.indexBuffer.destroy(),this.indexBuffer2.destroy(),this.programConfigurations.destroy(),this.segments.destroy(),this.segments2.destroy())},FillBucket.prototype.addFeature=function(e,r){for(var t=this,i=0,a=classifyRings(r,EARCUT_MAX_RINGS);i<a.length;i+=1){for(var n=a[i],o=0,s=0,y=n;s<y.length;s+=1){o+=y[s].length}for(var l=t.segments.prepareSegment(o,t.layoutVertexArray,t.indexArray),u=l.vertexLength,f=[],g=[],x=0,p=n;x<p.length;x+=1){var h=p[x];if(0!==h.length){h!==n[0]&&g.push(f.length/2);var d=t.segments2.prepareSegment(h.length,t.layoutVertexArray,t.indexArray2),c=d.vertexLength;t.layoutVertexArray.emplaceBack(h[0].x,h[0].y),t.indexArray2.emplaceBack(c+h.length-1,c),f.push(h[0].x),f.push(h[0].y);for(var m=1;m<h.length;m++)t.layoutVertexArray.emplaceBack(h[m].x,h[m].y),t.indexArray2.emplaceBack(c+m-1,c+m),f.push(h[m].x),f.push(h[m].y);d.vertexLength+=h.length,d.primitiveLength+=h.length}}for(var A=earcut(f,g),B=0;B<A.length;B+=3)t.indexArray.emplaceBack(u+A[B],u+A[B+1],u+A[B+2]);l.vertexLength+=o,l.primitiveLength+=A.length/3}this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length,e.properties)},FillBucket.programInterface=fillInterface,module.exports=FillBucket;
},{"../../gl/index_buffer":61,"../../gl/vertex_buffer":62,"../../util/classify_rings":205,"../index_array_type":50,"../load_geometry":51,"../program_configuration":53,"../segment":55,"../vertex_array_type":56,"earcut":11}],45:[function(_dereq_,module,exports){
"use strict";function addVertex(e,r,t,a,i,n,o,s){e.emplaceBack(r,t,2*Math.floor(a*FACTOR)+o,i*FACTOR*2,n*FACTOR*2,Math.round(s))}function isBoundaryEdge(e,r){return e.x===r.x&&(e.x<0||e.x>EXTENT)||e.y===r.y&&(e.y<0||e.y>EXTENT)}var ref=_dereq_("../segment"),SegmentVector=ref.SegmentVector,MAX_VERTEX_ARRAY_LENGTH=ref.MAX_VERTEX_ARRAY_LENGTH,VertexBuffer=_dereq_("../../gl/vertex_buffer"),IndexBuffer=_dereq_("../../gl/index_buffer"),ref$1=_dereq_("../program_configuration"),ProgramConfigurationSet=ref$1.ProgramConfigurationSet,createVertexArrayType=_dereq_("../vertex_array_type"),ref$2=_dereq_("../index_array_type"),TriangleIndexArray=ref$2.TriangleIndexArray,loadGeometry=_dereq_("../load_geometry"),EXTENT=_dereq_("../extent"),earcut=_dereq_("earcut"),classifyRings=_dereq_("../../util/classify_rings"),EARCUT_MAX_RINGS=500,fillExtrusionInterface={layoutAttributes:[{name:"a_pos",components:2,type:"Int16"},{name:"a_normal",components:3,type:"Int16"},{name:"a_edgedistance",components:1,type:"Int16"}],indexArrayType:TriangleIndexArray,paintAttributes:[{property:"fill-extrusion-base"},{property:"fill-extrusion-height"},{property:"fill-extrusion-color"}]},FACTOR=Math.pow(2,13),LayoutVertexArrayType=createVertexArrayType(fillExtrusionInterface.layoutAttributes),FillExtrusionBucket=function(e){this.zoom=e.zoom,this.overscaling=e.overscaling,this.layers=e.layers,this.index=e.index,this.layoutVertexArray=new LayoutVertexArrayType(e.layoutVertexArray),this.indexArray=new TriangleIndexArray(e.indexArray),this.programConfigurations=new ProgramConfigurationSet(fillExtrusionInterface,e.layers,e.zoom,e.programConfigurations),this.segments=new SegmentVector(e.segments)};FillExtrusionBucket.prototype.populate=function(e,r){for(var t=this,a=0,i=e;a<i.length;a+=1){var n=i[a],o=n.feature,s=n.index,u=n.sourceLayerIndex;if(t.layers[0].filter(o)){var y=loadGeometry(o);t.addFeature(o,y),r.featureIndex.insert(o,y,s,u,t.index)}}},FillExtrusionBucket.prototype.isEmpty=function(){return 0===this.layoutVertexArray.length},FillExtrusionBucket.prototype.serialize=function(e){return{zoom:this.zoom,layerIds:this.layers.map(function(e){return e.id}),layoutVertexArray:this.layoutVertexArray.serialize(e),indexArray:this.indexArray.serialize(e),programConfigurations:this.programConfigurations.serialize(e),segments:this.segments.get()}},FillExtrusionBucket.prototype.upload=function(e){this.layoutVertexBuffer=new VertexBuffer(e,this.layoutVertexArray),this.indexBuffer=new IndexBuffer(e,this.indexArray),this.programConfigurations.upload(e)},FillExtrusionBucket.prototype.destroy=function(){this.layoutVertexBuffer&&(this.layoutVertexBuffer.destroy(),this.indexBuffer.destroy(),this.programConfigurations.destroy(),this.segments.destroy())},FillExtrusionBucket.prototype.addFeature=function(e,r){for(var t=this,a=0,i=classifyRings(r,EARCUT_MAX_RINGS);a<i.length;a+=1){for(var n=i[a],o=0,s=0,u=n;s<u.length;s+=1){o+=u[s].length}for(var y=t.segments.prepareSegment(4,t.layoutVertexArray,t.indexArray),l=0,x=n;l<x.length;l+=1){var f=x[l];if(0!==f.length)for(var g=0,p=0;p<f.length;p++){var d=f[p];if(p>=1){var h=f[p-1];if(!isBoundaryEdge(d,h)){y.vertexLength+4>MAX_VERTEX_ARRAY_LENGTH&&(y=t.segments.prepareSegment(4,t.layoutVertexArray,t.indexArray));var A=d.sub(h)._perp()._unit();addVertex(t.layoutVertexArray,d.x,d.y,A.x,A.y,0,0,g),addVertex(t.layoutVertexArray,d.x,d.y,A.x,A.y,0,1,g),g+=h.dist(d),addVertex(t.layoutVertexArray,h.x,h.y,A.x,A.y,0,0,g),addVertex(t.layoutVertexArray,h.x,h.y,A.x,A.y,0,1,g);var c=y.vertexLength;t.indexArray.emplaceBack(c,c+1,c+2),t.indexArray.emplaceBack(c+1,c+2,c+3),y.vertexLength+=4,y.primitiveLength+=2}}}}y.vertexLength+o>MAX_VERTEX_ARRAY_LENGTH&&(y=t.segments.prepareSegment(o,t.layoutVertexArray,t.indexArray));for(var m=[],V=[],E=y.vertexLength,v=0,_=n;v<_.length;v+=1){var T=_[v];if(0!==T.length){T!==n[0]&&V.push(m.length/2);for(var B=0;B<T.length;B++){var R=T[B];addVertex(t.layoutVertexArray,R.x,R.y,0,0,1,1,0),m.push(R.x),m.push(R.y)}}}for(var I=earcut(m,V),C=0;C<I.length;C+=3)t.indexArray.emplaceBack(E+I[C],E+I[C+1],E+I[C+2]);y.primitiveLength+=I.length/3,y.vertexLength+=o}this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length,e.properties)},FillExtrusionBucket.programInterface=fillExtrusionInterface,module.exports=FillExtrusionBucket;
},{"../../gl/index_buffer":61,"../../gl/vertex_buffer":62,"../../util/classify_rings":205,"../extent":48,"../index_array_type":50,"../load_geometry":51,"../program_configuration":53,"../segment":55,"../vertex_array_type":56,"earcut":11}],46:[function(_dereq_,module,exports){
"use strict";function addLineVertex(e,t,r,i,a,n,s){e.emplaceBack(t.x,t.y,i?1:0,a?1:-1,Math.round(EXTRUDE_SCALE*r.x)+128,Math.round(EXTRUDE_SCALE*r.y)+128,1+(0===n?0:n<0?-1:1)|(s*LINE_DISTANCE_SCALE&63)<<2,s*LINE_DISTANCE_SCALE>>6)}var ref=_dereq_("../segment"),SegmentVector=ref.SegmentVector,VertexBuffer=_dereq_("../../gl/vertex_buffer"),IndexBuffer=_dereq_("../../gl/index_buffer"),ref$1=_dereq_("../program_configuration"),ProgramConfigurationSet=ref$1.ProgramConfigurationSet,createVertexArrayType=_dereq_("../vertex_array_type"),ref$2=_dereq_("../index_array_type"),TriangleIndexArray=ref$2.TriangleIndexArray,loadGeometry=_dereq_("../load_geometry"),EXTENT=_dereq_("../extent"),vectorTileFeatureTypes=_dereq_("@mapbox/vector-tile").VectorTileFeature.types,EXTRUDE_SCALE=63,COS_HALF_SHARP_CORNER=Math.cos(Math.PI/180*37.5),SHARP_CORNER_OFFSET=15,LINE_DISTANCE_BUFFER_BITS=15,LINE_DISTANCE_SCALE=.5,MAX_LINE_DISTANCE=Math.pow(2,LINE_DISTANCE_BUFFER_BITS-1)/LINE_DISTANCE_SCALE,lineInterface={layoutAttributes:[{name:"a_pos_normal",components:4,type:"Int16"},{name:"a_data",components:4,type:"Uint8"}],paintAttributes:[{property:"line-color"},{property:"line-blur"},{property:"line-opacity"},{property:"line-gap-width",name:"gapwidth"},{property:"line-offset"},{property:"line-width"},{property:"line-width",name:"floorwidth",useIntegerZoom:!0}],indexArrayType:TriangleIndexArray},LayoutVertexArrayType=createVertexArrayType(lineInterface.layoutAttributes),LineBucket=function(e){this.zoom=e.zoom,this.overscaling=e.overscaling,this.layers=e.layers,this.index=e.index,this.layoutVertexArray=new LayoutVertexArrayType(e.layoutVertexArray),this.indexArray=new TriangleIndexArray(e.indexArray),this.programConfigurations=new ProgramConfigurationSet(lineInterface,e.layers,e.zoom,e.programConfigurations),this.segments=new SegmentVector(e.segments)};LineBucket.prototype.populate=function(e,t){for(var r=this,i=0,a=e;i<a.length;i+=1){var n=a[i],s=n.feature,o=n.index,u=n.sourceLayerIndex;if(r.layers[0].filter(s)){var d=loadGeometry(s);r.addFeature(s,d),t.featureIndex.insert(s,d,o,u,r.index)}}},LineBucket.prototype.isEmpty=function(){return 0===this.layoutVertexArray.length},LineBucket.prototype.serialize=function(e){return{zoom:this.zoom,layerIds:this.layers.map(function(e){return e.id}),layoutVertexArray:this.layoutVertexArray.serialize(e),indexArray:this.indexArray.serialize(e),programConfigurations:this.programConfigurations.serialize(e),segments:this.segments.get()}},LineBucket.prototype.upload=function(e){this.layoutVertexBuffer=new VertexBuffer(e,this.layoutVertexArray),this.indexBuffer=new IndexBuffer(e,this.indexArray),this.programConfigurations.upload(e)},LineBucket.prototype.destroy=function(){this.layoutVertexBuffer&&(this.layoutVertexBuffer.destroy(),this.indexBuffer.destroy(),this.programConfigurations.destroy(),this.segments.destroy())},LineBucket.prototype.addFeature=function(e,t){for(var r=this,i=this.layers[0].layout,a=this.layers[0].getLayoutValue("line-join",{zoom:this.zoom},e.properties),n=i["line-cap"],s=i["line-miter-limit"],o=i["line-round-limit"],u=0,d=t;u<d.length;u+=1){var l=d[u];r.addLine(l,e,a,n,s,o)}},LineBucket.prototype.addLine=function(e,t,r,i,a,n){for(var s=this,o=t.properties,u="Polygon"===vectorTileFeatureTypes[t.type],d=e.length;d>=2&&e[d-1].equals(e[d-2]);)d--;for(var l=0;l<d-1&&e[l].equals(e[l+1]);)l++;if(!(d<(u?3:2))){"bevel"===r&&(a=1.05);var y=SHARP_CORNER_OFFSET*(EXTENT/(512*this.overscaling)),h=e[l],p=this.segments.prepareSegment(10*d,this.layoutVertexArray,this.indexArray);this.distance=0;var c,f,x,m=i,g=u?"butt":i,_=!0,A=void 0,v=void 0,V=void 0,C=void 0;this.e1=this.e2=this.e3=-1,u&&(c=e[d-2],C=h.sub(c)._unit()._perp());for(var L=l;L<d;L++)if(!(v=u&&L===d-1?e[l+1]:e[L+1])||!e[L].equals(v)){C&&(V=C),c&&(A=c),c=e[L],C=v?v.sub(c)._unit()._perp():V,V=V||C;var E=V.add(C);0===E.x&&0===E.y||E._unit();var S=E.x*C.x+E.y*C.y,I=0!==S?1/S:1/0,T=S<COS_HALF_SHARP_CORNER&&A&&v;if(T&&L>l){var B=c.dist(A);if(B>2*y){var b=c.sub(c.sub(A)._mult(y/B)._round());s.distance+=b.dist(A),s.addCurrentVertex(b,s.distance,V.mult(1),0,0,!1,p),A=b}}var N=A&&v,k=N?r:v?m:g;if(N&&"round"===k&&(I<n?k="miter":I<=2&&(k="fakeround")),"miter"===k&&I>a&&(k="bevel"),"bevel"===k&&(I>2&&(k="flipbevel"),I<a&&(k="miter")),A&&(s.distance+=c.dist(A)),"miter"===k)E._mult(I),s.addCurrentVertex(c,s.distance,E,0,0,!1,p);else if("flipbevel"===k){if(I>100)E=C.clone().mult(-1);else{var R=V.x*C.y-V.y*C.x>0?-1:1,F=I*V.add(C).mag()/V.sub(C).mag();E._perp()._mult(F*R)}s.addCurrentVertex(c,s.distance,E,0,0,!1,p),s.addCurrentVertex(c,s.distance,E.mult(-1),0,0,!1,p)}else if("bevel"===k||"fakeround"===k){var q=V.x*C.y-V.y*C.x>0,P=-Math.sqrt(I*I-1);if(q?(x=0,f=P):(f=0,x=P),_||s.addCurrentVertex(c,s.distance,V,f,x,!1,p),"fakeround"===k){for(var w=Math.floor(8*(.5-(S-.5))),z=void 0,D=0;D<w;D++)z=C.mult((D+1)/(w+1))._add(V)._unit(),s.addPieSliceVertex(c,s.distance,z,q,p);s.addPieSliceVertex(c,s.distance,E,q,p);for(var M=w-1;M>=0;M--)z=V.mult((M+1)/(w+1))._add(C)._unit(),s.addPieSliceVertex(c,s.distance,z,q,p)}v&&s.addCurrentVertex(c,s.distance,C,-f,-x,!1,p)}else"butt"===k?(_||s.addCurrentVertex(c,s.distance,V,0,0,!1,p),v&&s.addCurrentVertex(c,s.distance,C,0,0,!1,p)):"square"===k?(_||(s.addCurrentVertex(c,s.distance,V,1,1,!1,p),s.e1=s.e2=-1),v&&s.addCurrentVertex(c,s.distance,C,-1,-1,!1,p)):"round"===k&&(_||(s.addCurrentVertex(c,s.distance,V,0,0,!1,p),s.addCurrentVertex(c,s.distance,V,1,1,!0,p),s.e1=s.e2=-1),v&&(s.addCurrentVertex(c,s.distance,C,-1,-1,!0,p),s.addCurrentVertex(c,s.distance,C,0,0,!1,p)));if(T&&L<d-1){var O=c.dist(v);if(O>2*y){var X=c.add(v.sub(c)._mult(y/O)._round());s.distance+=X.dist(c),s.addCurrentVertex(X,s.distance,C.mult(1),0,0,!1,p),c=X}}_=!1}this.programConfigurations.populatePaintArrays(this.layoutVertexArray.length,o)}},LineBucket.prototype.addCurrentVertex=function(e,t,r,i,a,n,s){var o,u=this.layoutVertexArray,d=this.indexArray;o=r.clone(),i&&o._sub(r.perp()._mult(i)),addLineVertex(u,e,o,n,!1,i,t),this.e3=s.vertexLength++,this.e1>=0&&this.e2>=0&&(d.emplaceBack(this.e1,this.e2,this.e3),s.primitiveLength++),this.e1=this.e2,this.e2=this.e3,o=r.mult(-1),a&&o._sub(r.perp()._mult(a)),addLineVertex(u,e,o,n,!0,-a,t),this.e3=s.vertexLength++,this.e1>=0&&this.e2>=0&&(d.emplaceBack(this.e1,this.e2,this.e3),s.primitiveLength++),this.e1=this.e2,this.e2=this.e3,t>MAX_LINE_DISTANCE/2&&(this.distance=0,this.addCurrentVertex(e,this.distance,r,i,a,n,s))},LineBucket.prototype.addPieSliceVertex=function(e,t,r,i,a){r=r.mult(i?-1:1);var n=this.layoutVertexArray,s=this.indexArray;addLineVertex(n,e,r,!1,i,0,t),this.e3=a.vertexLength++,this.e1>=0&&this.e2>=0&&(s.emplaceBack(this.e1,this.e2,this.e3),a.primitiveLength++),i?this.e2=this.e3:this.e1=this.e3},LineBucket.programInterface=lineInterface,module.exports=LineBucket;
},{"../../gl/index_buffer":61,"../../gl/vertex_buffer":62,"../extent":48,"../index_array_type":50,"../load_geometry":51,"../program_configuration":53,"../segment":55,"../vertex_array_type":56,"@mapbox/vector-tile":6}],47:[function(_dereq_,module,exports){
"use strict";function addVertex(e,t,o,r,a,i,n,s){e.emplaceBack(t,o,Math.round(64*r),Math.round(64*a),i,n,s?s[0]:void 0,s?s[1]:void 0)}function addDynamicAttributes(e,t,o,r){var a=2*Math.PI,i=packUint8ToFloat((o+a)%a/a*255,10*r);e.emplaceBack(t.x,t.y,i),e.emplaceBack(t.x,t.y,i),e.emplaceBack(t.x,t.y,i),e.emplaceBack(t.x,t.y,i)}function addCollisionBoxVertex(e,t,o,r,a,i){return e.emplaceBack(t.x,t.y,o.x,o.y,Math.round(r.x),Math.round(r.y),10*a,10*i)}function getSizeData(e,t,o){var r={};if(r.isFeatureConstant=t.isLayoutValueFeatureConstant(o),r.isZoomConstant=t.isLayoutValueZoomConstant(o),r.isFeatureConstant&&(r.layoutSize=t.getLayoutValue(o,{zoom:e+1})),!r.isZoomConstant){for(var a=t.getLayoutValueStopZoomLevels(o),i=0;i<a.length&&a[i]<=e;)i++;i=Math.max(0,i-1);for(var n=i;n<a.length&&a[n]<e+1;)n++;n=Math.min(a.length-1,n),r.coveringZoomRange=[a[i],a[n]],t.isLayoutValueFeatureConstant(o)&&(r.coveringStopValues=[t.getLayoutValue(o,{zoom:a[i]}),t.getLayoutValue(o,{zoom:a[n]})]),r.functionBase=t.getLayoutProperty(o).base,void 0===r.functionBase&&(r.functionBase=1),r.functionType=t.getLayoutProperty(o).type||"exponential"}return r}function getSizeVertexData(e,t,o,r,a){return e.isLayoutValueZoomConstant(r)&&!e.isLayoutValueFeatureConstant(r)?[10*e.getLayoutValue(r,{},a)]:e.isLayoutValueZoomConstant(r)||e.isLayoutValueFeatureConstant(r)?null:[10*e.getLayoutValue(r,{zoom:o[0]},a),10*e.getLayoutValue(r,{zoom:o[1]},a)]}var Point=_dereq_("@mapbox/point-geometry"),ref=_dereq_("../segment"),SegmentVector=ref.SegmentVector,VertexBuffer=_dereq_("../../gl/vertex_buffer"),IndexBuffer=_dereq_("../../gl/index_buffer"),ref$1=_dereq_("../program_configuration"),ProgramConfigurationSet=ref$1.ProgramConfigurationSet,createVertexArrayType=_dereq_("../vertex_array_type"),ref$2=_dereq_("../index_array_type"),TriangleIndexArray=ref$2.TriangleIndexArray,LineIndexArray=ref$2.LineIndexArray,EXTENT=_dereq_("../extent"),ref$3=_dereq_("../../shaders/encode_attribute"),packUint8ToFloat=ref$3.packUint8ToFloat,Anchor=_dereq_("../../symbol/anchor"),getAnchors=_dereq_("../../symbol/get_anchors"),resolveTokens=_dereq_("../../util/token"),ref$4=_dereq_("../../symbol/quads"),getGlyphQuads=ref$4.getGlyphQuads,getIconQuads=ref$4.getIconQuads,ref$5=_dereq_("../../symbol/shaping"),shapeText=ref$5.shapeText,shapeIcon=ref$5.shapeIcon,WritingMode=ref$5.WritingMode,transformText=_dereq_("../../symbol/transform_text"),mergeLines=_dereq_("../../symbol/mergelines"),clipLine=_dereq_("../../symbol/clip_line"),util=_dereq_("../../util/util"),scriptDetection=_dereq_("../../util/script_detection"),loadGeometry=_dereq_("../load_geometry"),CollisionFeature=_dereq_("../../symbol/collision_feature"),findPoleOfInaccessibility=_dereq_("../../util/find_pole_of_inaccessibility"),classifyRings=_dereq_("../../util/classify_rings"),vectorTileFeatureTypes=_dereq_("@mapbox/vector-tile").VectorTileFeature.types,createStructArrayType=_dereq_("../../util/struct_array"),verticalizePunctuation=_dereq_("../../util/verticalize_punctuation"),PlacedSymbolArray=createStructArrayType({members:[{type:"Int16",name:"anchorX"},{type:"Int16",name:"anchorY"},{type:"Uint16",name:"glyphStartIndex"},{type:"Uint16",name:"numGlyphs"},{type:"Uint32",name:"lineStartIndex"},{type:"Uint32",name:"lineLength"},{type:"Uint16",name:"segment"},{type:"Uint16",name:"lowerSize"},{type:"Uint16",name:"upperSize"},{type:"Float32",name:"lineOffsetX"},{type:"Float32",name:"lineOffsetY"},{type:"Float32",name:"placementZoom"},{type:"Uint8",name:"vertical"}]}),GlyphOffsetArray=createStructArrayType({members:[{type:"Float32",name:"offsetX"}]}),LineVertexArray=createStructArrayType({members:[{type:"Int16",name:"x"},{type:"Int16",name:"y"}]}),layoutAttributes=[{name:"a_pos_offset",components:4,type:"Int16"},{name:"a_data",components:4,type:"Uint16"}],dynamicLayoutAttributes=[{name:"a_projected_pos",components:3,type:"Float32"}],symbolInterfaces={text:{layoutAttributes:layoutAttributes,dynamicLayoutAttributes:dynamicLayoutAttributes,indexArrayType:TriangleIndexArray,paintAttributes:[{property:"text-color",name:"fill_color"},{property:"text-halo-color",name:"halo_color"},{property:"text-halo-width",name:"halo_width"},{property:"text-halo-blur",name:"halo_blur"},{property:"text-opacity",name:"opacity"}]},icon:{layoutAttributes:layoutAttributes,dynamicLayoutAttributes:dynamicLayoutAttributes,indexArrayType:TriangleIndexArray,paintAttributes:[{property:"icon-color",name:"fill_color"},{property:"icon-halo-color",name:"halo_color"},{property:"icon-halo-width",name:"halo_width"},{property:"icon-halo-blur",name:"halo_blur"},{property:"icon-opacity",name:"opacity"}]},collisionBox:{layoutAttributes:[{name:"a_pos",components:2,type:"Int16"},{name:"a_anchor_pos",components:2,type:"Int16"},{name:"a_extrude",components:2,type:"Int16"},{name:"a_data",components:2,type:"Uint8"}],indexArrayType:LineIndexArray}},SymbolBuffers=function(e,t,o,r){this.programInterface=e;var a=createVertexArrayType(e.layoutAttributes),i=e.indexArrayType;if(this.layoutVertexArray=new a(r&&r.layoutVertexArray),this.indexArray=new i(r&&r.indexArray),this.programConfigurations=new ProgramConfigurationSet(e,t,o,r&&r.programConfigurations),this.segments=new SegmentVector(r&&r.segments),e.dynamicLayoutAttributes){var n=createVertexArrayType(e.dynamicLayoutAttributes);this.dynamicLayoutVertexArray=new n(r&&r.dynamicLayoutVertexArray)}};SymbolBuffers.prototype.serialize=function(e){return{layoutVertexArray:this.layoutVertexArray.serialize(e),indexArray:this.indexArray.serialize(e),programConfigurations:this.programConfigurations.serialize(e),segments:this.segments.get(),dynamicLayoutVertexArray:this.dynamicLayoutVertexArray&&this.dynamicLayoutVertexArray.serialize(e)}},SymbolBuffers.prototype.upload=function(e){this.layoutVertexBuffer=new VertexBuffer(e,this.layoutVertexArray),this.indexBuffer=new IndexBuffer(e,this.indexArray),this.programConfigurations.upload(e),this.programInterface.dynamicLayoutAttributes&&(this.dynamicLayoutVertexBuffer=new VertexBuffer(e,this.dynamicLayoutVertexArray,!0))},SymbolBuffers.prototype.destroy=function(){this.layoutVertexBuffer&&(this.layoutVertexBuffer.destroy(),this.indexBuffer.destroy(),this.programConfigurations.destroy(),this.segments.destroy(),this.dynamicLayoutVertexBuffer&&this.dynamicLayoutVertexBuffer.destroy())};var SymbolBucket=function(e){if(this.collisionBoxArray=e.collisionBoxArray,this.zoom=e.zoom,this.overscaling=e.overscaling,this.layers=e.layers,this.index=e.index,this.sdfIcons=e.sdfIcons,this.iconsNeedLinear=e.iconsNeedLinear,this.pixelRatio=e.pixelRatio,e.text)this.text=new SymbolBuffers(symbolInterfaces.text,e.layers,e.zoom,e.text),this.icon=new SymbolBuffers(symbolInterfaces.icon,e.layers,e.zoom,e.icon),this.collisionBox=new SymbolBuffers(symbolInterfaces.collisionBox,e.layers,e.zoom,e.collisionBox),this.textSizeData=e.textSizeData,this.iconSizeData=e.iconSizeData,this.placedGlyphArray=new PlacedSymbolArray(e.placedGlyphArray),this.placedIconArray=new PlacedSymbolArray(e.placedIconArray),this.glyphOffsetArray=new GlyphOffsetArray(e.glyphOffsetArray),this.lineVertexArray=new LineVertexArray(e.lineVertexArray);else{var t=this.layers[0];this.textSizeData=getSizeData(this.zoom,t,"text-size"),this.iconSizeData=getSizeData(this.zoom,t,"icon-size")}};SymbolBucket.prototype.populate=function(e,t){var o=this,r=this.layers[0],a=r.layout,i=a["text-font"],n=(!r.isLayoutValueFeatureConstant("text-field")||a["text-field"])&&i,s=!r.isLayoutValueFeatureConstant("icon-image")||a["icon-image"];if(this.features=[],n||s){for(var l=t.iconDependencies,y=t.glyphDependencies,c=y[i]=y[i]||{},u={zoom:this.zoom},p=0,x=e;p<x.length;p+=1){var m=x[p],h=m.feature,d=m.index,f=m.sourceLayerIndex;if(r.filter(h)){var g=void 0;n&&(g=r.getLayoutValue("text-field",u,h.properties),r.isLayoutValueFeatureConstant("text-field")&&(g=resolveTokens(h.properties,g)),g=transformText(g,r,u,h.properties));var b=void 0;if(s&&(b=r.getLayoutValue("icon-image",u,h.properties),r.isLayoutValueFeatureConstant("icon-image")&&(b=resolveTokens(h.properties,b))),(g||b)&&(o.features.push({text:g,icon:b,index:d,sourceLayerIndex:f,geometry:loadGeometry(h),properties:h.properties,type:vectorTileFeatureTypes[h.type]}),b&&(l[b]=!0),g))for(var A="map"===a["text-rotation-alignment"]&&"line"===a["symbol-placement"],v=scriptDetection.allowsVerticalWritingMode(g),S=0;S<g.length;S++)if(c[g.charCodeAt(S)]=!0,A&&v){var I=verticalizePunctuation.lookup[g.charAt(S)];I&&(c[I.charCodeAt(0)]=!0)}}}"line"===a["symbol-placement"]&&(this.features=mergeLines(this.features))}},SymbolBucket.prototype.isEmpty=function(){return 0===this.icon.layoutVertexArray.length&&0===this.text.layoutVertexArray.length&&0===this.collisionBox.layoutVertexArray.length},SymbolBucket.prototype.serialize=function(e){return{zoom:this.zoom,layerIds:this.layers.map(function(e){return e.id}),sdfIcons:this.sdfIcons,iconsNeedLinear:this.iconsNeedLinear,textSizeData:this.textSizeData,iconSizeData:this.iconSizeData,placedGlyphArray:this.placedGlyphArray.serialize(e),placedIconArray:this.placedIconArray.serialize(e),glyphOffsetArray:this.glyphOffsetArray.serialize(e),lineVertexArray:this.lineVertexArray.serialize(e),text:this.text.serialize(e),icon:this.icon.serialize(e),collisionBox:this.collisionBox.serialize(e)}},SymbolBucket.prototype.upload=function(e){this.text.upload(e),this.icon.upload(e),this.collisionBox.upload(e)},SymbolBucket.prototype.destroy=function(){this.text.destroy(),this.icon.destroy(),this.collisionBox.destroy()},SymbolBucket.prototype.prepare=function(e,t,o,r){var a=this;this.symbolInstances=[];var i=512*this.overscaling;this.tilePixelRatio=EXTENT/i,this.compareText={},this.iconsNeedLinear=!1;for(var n=this.layers[0].layout,s=24*n["text-line-height"],l=n["text-font"].join(","),y="map"===n["text-rotation-alignment"]&&"line"===n["symbol-placement"],c=e[l]||{},u=t[l]||{},p=0,x=a.features;p<x.length;p+=1){var m=x[p],h={},d=m.text;if(d){var f=a.layers[0].getLayoutValue("text-offset",{zoom:a.zoom},m.properties).map(function(e){return 24*e}),g=24*a.layers[0].getLayoutValue("text-letter-spacing",{zoom:a.zoom},m.properties),b=scriptDetection.allowsLetterSpacing(d)?g:0,A=a.layers[0].getLayoutValue("text-anchor",{zoom:a.zoom},m.properties),v=a.layers[0].getLayoutValue("text-justify",{zoom:a.zoom},m.properties),S="line"!==n["symbol-placement"]?24*a.layers[0].getLayoutValue("text-max-width",{zoom:a.zoom},m.properties):0,I=function(e,t){return shapeText(e,c,S,s,A,v,b,f,24,t)};h[WritingMode.horizontal]=I(d,WritingMode.horizontal),scriptDetection.allowsVerticalWritingMode(d)&&y&&(h[WritingMode.vertical]=I(d,WritingMode.vertical))}var B=void 0;if(m.icon){var z=o[m.icon];z&&(B=shapeIcon(r[m.icon],a.layers[0].getLayoutValue("icon-offset",{zoom:a.zoom},m.properties),a.layers[0].getLayoutValue("icon-anchor",{zoom:a.zoom},m.properties)),void 0===a.sdfIcons?a.sdfIcons=z.sdf:a.sdfIcons!==z.sdf&&util.warnOnce("Style sheet warning: Cannot mix SDF and non-SDF icons in one buffer"),z.pixelRatio!==a.pixelRatio?a.iconsNeedLinear=!0:0===n["icon-rotate"]&&a.layers[0].isLayoutValueFeatureConstant("icon-rotate")||(a.iconsNeedLinear=!0))}(h[WritingMode.horizontal]||B)&&a.addFeature(m,h,B,u)}},SymbolBucket.prototype.addFeature=function(e,t,o,r){var a=this,i=this.layers[0].getLayoutValue("text-size",{zoom:this.zoom+1},e.properties),n=this.layers[0].getLayoutValue("icon-size",{zoom:this.zoom+1},e.properties),s=this.layers[0].getLayoutValue("text-offset",{zoom:this.zoom},e.properties),l=this.layers[0].getLayoutValue("icon-offset",{zoom:this.zoom},e.properties),y=this.layers[0].getLayoutValue("text-size",{zoom:18},e.properties);void 0===y&&(y=i);var c=this.layers[0].layout,u=i/24,p=this.tilePixelRatio*u,x=this.tilePixelRatio*y/24,m=this.tilePixelRatio*n,h=this.tilePixelRatio*c["symbol-spacing"],d=c["symbol-avoid-edges"],f=c["text-padding"]*this.tilePixelRatio,g=c["icon-padding"]*this.tilePixelRatio,b=c["text-max-angle"]/180*Math.PI,A="map"===c["text-rotation-alignment"]&&"line"===c["symbol-placement"],v="map"===c["icon-rotation-alignment"]&&"line"===c["symbol-placement"],S=c["text-allow-overlap"]||c["icon-allow-overlap"]||c["text-ignore-placement"]||c["icon-ignore-placement"],I=c["symbol-placement"],B=h/2,z=function(i,n){var y=!(n.x<0||n.x>EXTENT||n.y<0||n.y>EXTENT);if(!d||y){var c=y||S;a.addSymbolInstance(n,i,t,o,a.layers[0],c,a.collisionBoxArray,e.index,e.sourceLayerIndex,a.index,p,f,A,s,m,g,v,l,{zoom:a.zoom},e.properties,r)}};if("line"===I)for(var V=0,L=clipLine(e.geometry,0,0,EXTENT,EXTENT);V<L.length;V+=1)for(var T=L[V],w=getAnchors(T,h,b,t[WritingMode.vertical]||t[WritingMode.horizontal],o,24,x,a.overscaling,EXTENT),M=0,C=w;M<C.length;M+=1){var _=C[M],k=t[WritingMode.horizontal];k&&a.anchorIsTooClose(k.text,B,_)||z(T,_)}else if("Polygon"===e.type)for(var P=0,F=classifyRings(e.geometry,0);P<F.length;P+=1){var E=F[P],D=findPoleOfInaccessibility(E,16);z(E[0],new Anchor(D.x,D.y,0))}else if("LineString"===e.type)for(var q=0,O=e.geometry;q<O.length;q+=1){var N=O[q];z(N,new Anchor(N[0].x,N[0].y,0))}else if("Point"===e.type)for(var W=0,R=e.geometry;W<R.length;W+=1)for(var G=R[W],$=0,U=G;$<U.length;$+=1){var X=U[$];z([X],new Anchor(X.x,X.y,0))}},SymbolBucket.prototype.anchorIsTooClose=function(e,t,o){var r=this.compareText;if(e in r){for(var a=r[e],i=a.length-1;i>=0;i--)if(o.dist(a[i])<t)return!0}else r[e]=[];return r[e].push(o),!1},SymbolBucket.prototype.place=function(e,t){var o=this;this.text=new SymbolBuffers(symbolInterfaces.text,this.layers,this.zoom),this.icon=new SymbolBuffers(symbolInterfaces.icon,this.layers,this.zoom),this.collisionBox=new SymbolBuffers(symbolInterfaces.collisionBox,this.layers,this.zoom),this.placedGlyphArray=new PlacedSymbolArray,this.placedIconArray=new PlacedSymbolArray,this.glyphOffsetArray=new GlyphOffsetArray,this.lineVertexArray=new LineVertexArray;var r=this.layers[0],a=r.layout,i=e.maxScale,n="map"===a["text-rotation-alignment"]&&"line"===a["symbol-placement"],s="map"===a["icon-rotation-alignment"]&&"line"===a["symbol-placement"];if(a["text-allow-overlap"]||a["icon-allow-overlap"]||a["text-ignore-placement"]||a["icon-ignore-placement"]){var l=e.angle,y=Math.sin(l),c=Math.cos(l);this.symbolInstances.sort(function(e,t){return(y*e.anchor.x+c*e.anchor.y|0)-(y*t.anchor.x+c*t.anchor.y|0)||t.featureIndex-e.featureIndex})}for(var u=0,p=o.symbolInstances;u<p.length;u+=1){var x=p[u],m={boxStartIndex:x.textBoxStartIndex,boxEndIndex:x.textBoxEndIndex},h={boxStartIndex:x.iconBoxStartIndex,boxEndIndex:x.iconBoxEndIndex},d=!(x.textBoxStartIndex===x.textBoxEndIndex),f=!(x.iconBoxStartIndex===x.iconBoxEndIndex),g=a["text-optional"]||!d,b=a["icon-optional"]||!f,A=d?e.placeCollisionFeature(m,a["text-allow-overlap"],a["symbol-avoid-edges"]):e.minScale,v=f?e.placeCollisionFeature(h,a["icon-allow-overlap"],a["symbol-avoid-edges"]):e.minScale;if(g||b?!b&&A?A=Math.max(v,A):!g&&v&&(v=Math.max(v,A)):v=A=Math.max(v,A),d||f){for(var S=x.line,I=o.lineVertexArray.length,B=0;B<S.length;B++)o.lineVertexArray.emplaceBack(S[B].x,S[B].y);var z=o.lineVertexArray.length-I;if(d&&(e.insertCollisionFeature(m,A,a["text-ignore-placement"]),A<=i)){var V=getSizeVertexData(r,o.zoom,o.textSizeData.coveringZoomRange,"text-size",x.featureProperties);o.addSymbols(o.text,x.glyphQuads,A,V,a["text-keep-upright"],x.textOffset,n,e.angle,x.featureProperties,x.writingModes,x.anchor,I,z,o.placedGlyphArray)}if(f&&(e.insertCollisionFeature(h,v,a["icon-ignore-placement"]),v<=i)){var L=getSizeVertexData(r,o.zoom,o.iconSizeData.coveringZoomRange,"icon-size",x.featureProperties);o.addSymbols(o.icon,x.iconQuads,v,L,a["icon-keep-upright"],x.iconOffset,s,e.angle,x.featureProperties,0,x.anchor,I,z,o.placedIconArray)}}}t&&this.addToDebugBuffers(e)},SymbolBucket.prototype.addSymbols=function(e,t,o,r,a,i,n,s,l,y,c,u,p,x){for(var m=this,h=e.indexArray,d=e.layoutVertexArray,f=e.dynamicLayoutVertexArray,g=this.zoom,b=Math.max(Math.log(o)/Math.LN2+g,0),A=this.glyphOffsetArray.length,v=(c.angle+s+2*Math.PI)%(2*Math.PI),S=v>1*Math.PI/4&&v<=3*Math.PI/4||v>5*Math.PI/4&&v<=7*Math.PI/4,I=Boolean(y&WritingMode.vertical)&&S,B=0,z=t;B<z.length;B+=1){var V=z[B];if(!n||!a||V.writingMode===WritingMode.vertical===I){var L=V.tl,T=V.tr,w=V.bl,M=V.br,C=V.tex,_=e.segments.prepareSegment(4,e.layoutVertexArray,e.indexArray),k=_.vertexLength,P=V.glyphOffset[1];addVertex(d,c.x,c.y,L.x,P+L.y,C.x,C.y,r),addVertex(d,c.x,c.y,T.x,P+T.y,C.x+C.w,C.y,r),addVertex(d,c.x,c.y,w.x,P+w.y,C.x,C.y+C.h,r),addVertex(d,c.x,c.y,M.x,P+M.y,C.x+C.w,C.y+C.h,r),addDynamicAttributes(f,c,0,b),h.emplaceBack(k,k+1,k+2),h.emplaceBack(k+1,k+2,k+3),_.vertexLength+=4,_.primitiveLength+=2,m.glyphOffsetArray.emplaceBack(V.glyphOffset[0])}}x.emplaceBack(c.x,c.y,A,this.glyphOffsetArray.length-A,u,p,c.segment,r?r[0]:0,r?r[1]:0,i[0],i[1],b,I),e.programConfigurations.populatePaintArrays(e.layoutVertexArray.length,l)},SymbolBucket.prototype.addToDebugBuffers=function(e){for(var t=this,o=this.collisionBox,r=o.layoutVertexArray,a=o.indexArray,i=-e.angle,n=e.yStretch,s=0,l=t.symbolInstances;s<l.length;s+=1){var y=l[s];y.textCollisionFeature={boxStartIndex:y.textBoxStartIndex,boxEndIndex:y.textBoxEndIndex},y.iconCollisionFeature={boxStartIndex:y.iconBoxStartIndex,boxEndIndex:y.iconBoxEndIndex};for(var c=0;c<2;c++){var u=y[0===c?"textCollisionFeature":"iconCollisionFeature"];if(u)for(var p=u.boxStartIndex;p<u.boxEndIndex;p++){var x=t.collisionBoxArray.get(p);if(!(1===e.perspectiveRatio&&x.maxScale<1)){var m=x.anchorPoint,h=new Point(x.x1,x.y1*n)._rotate(i),d=new Point(x.x2,x.y1*n)._rotate(i),f=new Point(x.x1,x.y2*n)._rotate(i),g=new Point(x.x2,x.y2*n)._rotate(i),b=Math.max(0,Math.min(25,t.zoom+Math.log(x.maxScale)/Math.LN2)),A=Math.max(0,Math.min(25,t.zoom+Math.log(x.placementScale)/Math.LN2)),v=o.segments.prepareSegment(4,o.layoutVertexArray,o.indexArray),S=v.vertexLength;addCollisionBoxVertex(r,m,y.anchor,h,b,A),addCollisionBoxVertex(r,m,y.anchor,d,b,A),addCollisionBoxVertex(r,m,y.anchor,g,b,A),addCollisionBoxVertex(r,m,y.anchor,f,b,A),a.emplaceBack(S,S+1),a.emplaceBack(S+1,S+2),a.emplaceBack(S+2,S+3),a.emplaceBack(S+3,S),v.vertexLength+=4,v.primitiveLength+=4}}}}},SymbolBucket.prototype.addSymbolInstance=function(e,t,o,r,a,i,n,s,l,y,c,u,p,x,m,h,d,f,g,b,A){var v,S,I=[],B=[];for(var z in o){var V=parseInt(z,10);o[V]&&(B=B.concat(i?getGlyphQuads(e,o[V],a,p,g,b,A):[]),v=new CollisionFeature(n,t,e,s,l,y,o[V],c,u,p,!1))}var L=v?v.boxStartIndex:this.collisionBoxArray.length,T=v?v.boxEndIndex:this.collisionBoxArray.length;r&&(I=i?getIconQuads(e,r,a,d,o[WritingMode.horizontal],g,b):[],S=new CollisionFeature(n,t,e,s,l,y,r,m,h,d,!0));var w=S?S.boxStartIndex:this.collisionBoxArray.length,M=S?S.boxEndIndex:this.collisionBoxArray.length;T>SymbolBucket.MAX_INSTANCES&&util.warnOnce("Too many symbols being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907"),M>SymbolBucket.MAX_INSTANCES&&util.warnOnce("Too many glyphs being rendered in a tile. See https://github.com/mapbox/mapbox-gl-js/issues/2907");var C=(o[WritingMode.vertical]?WritingMode.vertical:0)|(o[WritingMode.horizontal]?WritingMode.horizontal:0);this.symbolInstances.push({textBoxStartIndex:L,textBoxEndIndex:T,iconBoxStartIndex:w,iconBoxEndIndex:M,glyphQuads:B,iconQuads:I,textOffset:x,iconOffset:f,anchor:e,line:t,featureIndex:s,featureProperties:b,writingModes:C})},SymbolBucket.programInterfaces=symbolInterfaces,SymbolBucket.MAX_INSTANCES=65535,SymbolBucket.addDynamicAttributes=addDynamicAttributes,module.exports=SymbolBucket;
},{"../../gl/index_buffer":61,"../../gl/vertex_buffer":62,"../../shaders/encode_attribute":85,"../../symbol/anchor":167,"../../symbol/clip_line":169,"../../symbol/collision_feature":171,"../../symbol/get_anchors":173,"../../symbol/mergelines":174,"../../symbol/quads":176,"../../symbol/shaping":177,"../../symbol/transform_text":179,"../../util/classify_rings":205,"../../util/find_pole_of_inaccessibility":211,"../../util/script_detection":218,"../../util/struct_array":220,"../../util/token":222,"../../util/util":223,"../../util/verticalize_punctuation":225,"../extent":48,"../index_array_type":50,"../load_geometry":51,"../program_configuration":53,"../segment":55,"../vertex_array_type":56,"@mapbox/point-geometry":2,"@mapbox/vector-tile":6}],48:[function(_dereq_,module,exports){
"use strict";module.exports=8192;
},{}],49:[function(_dereq_,module,exports){
"use strict";function topDownFeatureComparator(e,r){return r-e}var Point=_dereq_("@mapbox/point-geometry"),loadGeometry=_dereq_("./load_geometry"),EXTENT=_dereq_("./extent"),featureFilter=_dereq_("../style-spec/feature_filter"),createStructArrayType=_dereq_("../util/struct_array"),Grid=_dereq_("grid-index"),DictionaryCoder=_dereq_("../util/dictionary_coder"),vt=_dereq_("@mapbox/vector-tile"),Protobuf=_dereq_("pbf"),GeoJSONFeature=_dereq_("../util/vectortile_to_geojson"),arraysIntersect=_dereq_("../util/util").arraysIntersect,FeatureIndexArray=createStructArrayType({members:[{type:"Uint32",name:"featureIndex"},{type:"Uint16",name:"sourceLayerIndex"},{type:"Uint16",name:"bucketIndex"}]}),FeatureIndex=function(e,r,t,a){this.coord=e,this.overscaling=r,this.x=e.x,this.y=e.y,this.z=e.z-Math.log(r)/Math.LN2,this.grid=t||new Grid(EXTENT,16,0),this.featureIndexArray=a||new FeatureIndexArray};FeatureIndex.deserialize=function(e,r,t){var a=new FeatureIndex(e.coord,e.overscaling,new Grid(e.grid),new FeatureIndexArray(e.featureIndexArray));return a.rawTileData=r,a.bucketLayerIDs=e.bucketLayerIDs,a.setCollisionTile(t),a},FeatureIndex.prototype.insert=function(e,r,t,a,i){var n=this,o=this.featureIndexArray.length;this.featureIndexArray.emplaceBack(t,a,i);for(var s=0;s<r.length;s++){for(var u=r[s],y=[1/0,1/0,-1/0,-1/0],l=0;l<u.length;l++){var d=u[l];y[0]=Math.min(y[0],d.x),y[1]=Math.min(y[1],d.y),y[2]=Math.max(y[2],d.x),y[3]=Math.max(y[3],d.y)}n.grid.insert(o,y[0],y[1],y[2],y[3])}},FeatureIndex.prototype.setCollisionTile=function(e){this.collisionTile=e},FeatureIndex.prototype.serialize=function(e){var r=this.grid.toArrayBuffer();return e&&e.push(r),{coord:this.coord,overscaling:this.overscaling,grid:r,featureIndexArray:this.featureIndexArray.serialize(e),bucketLayerIDs:this.bucketLayerIDs}},FeatureIndex.prototype.query=function(e,r){this.vtLayers||(this.vtLayers=new vt.VectorTile(new Protobuf(this.rawTileData)).layers,this.sourceLayerCoder=new DictionaryCoder(this.vtLayers?Object.keys(this.vtLayers).sort():["_geojsonTileLayer"]));for(var t={},a=e.params||{},i=EXTENT/e.tileSize/e.scale,n=featureFilter(a.filter),o=e.queryGeometry,s=e.additionalRadius*i,u=1/0,y=1/0,l=-1/0,d=-1/0,c=0;c<o.length;c++)for(var h=o[c],f=0;f<h.length;f++){var x=h[f];u=Math.min(u,x.x),y=Math.min(y,x.y),l=Math.max(l,x.x),d=Math.max(d,x.y)}var v=this.grid.query(u-s,y-s,l+s,d+s);v.sort(topDownFeatureComparator),this.filterMatching(t,v,this.featureIndexArray,o,n,a.layers,r,e.bearing,i);var I=this.collisionTile.queryRenderedSymbols(o,e.scale);return I.sort(),this.filterMatching(t,I,this.collisionTile.collisionBoxArray,o,n,a.layers,r,e.bearing,i),t},FeatureIndex.prototype.filterMatching=function(e,r,t,a,i,n,o,s,u){for(var y,l=this,d=0;d<r.length;d++){var c=r[d];if(c!==y){y=c;var h=t.get(c),f=l.bucketLayerIDs[h.bucketIndex];if(!n||arraysIntersect(n,f)){var x=l.sourceLayerCoder.decode(h.sourceLayerIndex),v=l.vtLayers[x],I=v.feature(h.featureIndex);if(i(I))for(var p=null,g=0;g<f.length;g++){var m=f[g];if(!(n&&n.indexOf(m)<0)){var F=o[m];if(F&&("symbol"===F.type||(p||(p=loadGeometry(I)),F.queryIntersectsFeature(a,I,p,l.z,s,u)))){var b=new GeoJSONFeature(I,l.z,l.x,l.y);b.layer=F.serialize();var L=e[m];void 0===L&&(L=e[m]=[]),L.push({featureIndex:c,feature:b})}}}}}}},FeatureIndex.prototype.hasLayer=function(e){for(var r=this,t=0,a=r.bucketLayerIDs;t<a.length;t+=1)for(var i=a[t],n=0,o=i;n<o.length;n+=1){var s=o[n];if(e===s)return!0}return!1},module.exports=FeatureIndex;
},{"../style-spec/feature_filter":110,"../util/dictionary_coder":207,"../util/struct_array":220,"../util/util":223,"../util/vectortile_to_geojson":224,"./extent":48,"./load_geometry":51,"@mapbox/point-geometry":2,"@mapbox/vector-tile":6,"grid-index":22,"pbf":29}],50:[function(_dereq_,module,exports){
"use strict";function createIndexArrayType(e){return createStructArrayType({members:[{type:"Uint16",name:"vertices",components:e}]})}var createStructArrayType=_dereq_("../util/struct_array");module.exports={LineIndexArray:createIndexArrayType(2),TriangleIndexArray:createIndexArrayType(3)};
},{"../util/struct_array":220}],51:[function(_dereq_,module,exports){
"use strict";function createBounds(e){return{min:-1*Math.pow(2,e-1),max:Math.pow(2,e-1)-1}}var util=_dereq_("../util/util"),EXTENT=_dereq_("./extent"),bounds=createBounds(16);module.exports=function(e){for(var t=EXTENT/e.extent,r=e.loadGeometry(),n=0;n<r.length;n++)for(var u=r[n],o=0;o<u.length;o++){var a=u[o];a.x=Math.round(a.x*t),a.y=Math.round(a.y*t),(a.x<bounds.min||a.x>bounds.max||a.y<bounds.min||a.y>bounds.max)&&util.warnOnce("Geometry exceeds allowed extent, reduce your vector tile buffer size")}return r};
},{"../util/util":223,"./extent":48}],52:[function(_dereq_,module,exports){
"use strict";var createStructArrayType=_dereq_("../util/struct_array"),PosArray=createStructArrayType({members:[{name:"a_pos",type:"Int16",components:2}]});module.exports=PosArray;
},{"../util/struct_array":220}],53:[function(_dereq_,module,exports){
"use strict";function packColor(r){return[packUint8ToFloat(255*r[0],255*r[1]),packUint8ToFloat(255*r[2],255*r[3])]}var createVertexArrayType=_dereq_("./vertex_array_type"),interpolationFactor=_dereq_("../style-spec/function").interpolationFactor,packUint8ToFloat=_dereq_("../shaders/encode_attribute").packUint8ToFloat,VertexBuffer=_dereq_("../gl/vertex_buffer"),ConstantBinder=function(r,t,o,e){this.name=r,this.type=t,this.property=o,this.useIntegerZoom=e};ConstantBinder.prototype.defines=function(){return["#define HAS_UNIFORM_u_"+this.name]},ConstantBinder.prototype.populatePaintArray=function(){},ConstantBinder.prototype.setUniforms=function(r,t,o,e){var i=e.zoom,n=o.getPaintValue(this.property,{zoom:this.useIntegerZoom?Math.floor(i):i});"color"===this.type?r.uniform4fv(t.uniforms["u_"+this.name],n):r.uniform1f(t.uniforms["u_"+this.name],n)};var SourceFunctionBinder=function(r,t,o){this.name=r,this.type=t,this.property=o};SourceFunctionBinder.prototype.defines=function(){return[]},SourceFunctionBinder.prototype.populatePaintArray=function(r,t,o,e,i,n){var a=this,s=r.getPaintValue(this.property,void 0,n);if("color"===this.type)for(var p=packColor(s),u=e;u<i;u++){var f=t.get(u);f["a_"+a.name+"0"]=p[0],f["a_"+a.name+"1"]=p[1]}else{for(var c=e;c<i;c++){t.get(c)["a_"+a.name]=s}var m=o[this.property];m.max=Math.max(m.max,s)}},SourceFunctionBinder.prototype.setUniforms=function(r,t){r.uniform1f(t.uniforms["a_"+this.name+"_t"],0)};var CompositeFunctionBinder=function(r,t,o,e,i){this.name=r,this.type=t,this.property=o,this.useIntegerZoom=e,this.zoom=i};CompositeFunctionBinder.prototype.defines=function(){return[]},CompositeFunctionBinder.prototype.populatePaintArray=function(r,t,o,e,i,n){var a=this,s=r.getPaintValue(this.property,{zoom:this.zoom},n),p=r.getPaintValue(this.property,{zoom:this.zoom+1},n);if("color"===this.type)for(var u=packColor(s),f=packColor(p),c=e;c<i;c++){var m=t.get(c);m["a_"+a.name+"0"]=u[0],m["a_"+a.name+"1"]=u[1],m["a_"+a.name+"2"]=f[0],m["a_"+a.name+"3"]=f[1]}else{for(var y=e;y<i;y++){var g=t.get(y);g["a_"+a.name+"0"]=s,g["a_"+a.name+"1"]=p}var h=o[this.property];h.max=Math.max(h.max,s,p)}},CompositeFunctionBinder.prototype.setUniforms=function(r,t,o,e){var i=e.zoom,n=interpolationFactor(this.useIntegerZoom?Math.floor(i):i,1,this.zoom,this.zoom+1);r.uniform1f(t.uniforms["a_"+this.name+"_t"],n)};var ProgramConfiguration=function(){this.binders={},this.cacheKey=""};ProgramConfiguration.createDynamic=function(r,t,o){for(var e=new ProgramConfiguration,i=[],n=0,a=r.paintAttributes||[];n<a.length;n+=1){var s=a[n],p=s.property,u=s.useIntegerZoom||!1,f=s.name||p.replace(t.type+"-","").replace(/-/g,"_"),c=t._paintSpecifications[p].type;t.isPaintValueFeatureConstant(p)?(e.binders[f]=new ConstantBinder(f,c,p,u),e.cacheKey+="/u_"+f):t.isPaintValueZoomConstant(p)?(e.binders[f]=new SourceFunctionBinder(f,c,p),e.cacheKey+="/a_"+f,i.push({name:"a_"+f,type:"Float32",components:"color"===c?2:1})):(e.binders[f]=new CompositeFunctionBinder(f,c,p,u,o),e.cacheKey+="/z_"+f,i.push({name:"a_"+f,type:"Float32",components:"color"===c?4:2}))}return e.PaintVertexArray=createVertexArrayType(i),e.interface=r,e.layer=t,e},ProgramConfiguration.createBasicFill=function(){var r=new ProgramConfiguration;return r.binders.color=new ConstantBinder("color","color","fill-color",!1),r.cacheKey+="/u_color",r.binders.opacity=new ConstantBinder("opacity","number","fill-opacity",!1),r.cacheKey+="/u_opacity",r},ProgramConfiguration.prototype.createPaintPropertyStatistics=function(){var r=this,t={};for(var o in r.binders)t[r.binders[o].property]={max:-1/0};return t},ProgramConfiguration.prototype.populatePaintArray=function(r,t){var o=this,e=this.paintVertexArray;if(0!==e.bytesPerElement){var i=e.length;e.resize(r);for(var n in o.binders)o.binders[n].populatePaintArray(o.layer,e,o.paintPropertyStatistics,i,r,t)}},ProgramConfiguration.prototype.defines=function(){var r=this,t=[];for(var o in r.binders)t.push.apply(t,r.binders[o].defines());return t},ProgramConfiguration.prototype.setUniforms=function(r,t,o,e){var i=this;for(var n in i.binders)i.binders[n].setUniforms(r,t,o,e)},ProgramConfiguration.prototype.serialize=function(r){return 0===this.paintVertexArray.length?null:{array:this.paintVertexArray.serialize(r),type:this.paintVertexArray.constructor.serialize(),statistics:this.paintPropertyStatistics}},ProgramConfiguration.deserialize=function(r,t,o,e){var i=ProgramConfiguration.createDynamic(r,t,o);return e&&(i.PaintVertexArray=createVertexArrayType(e.type.members),i.paintVertexArray=new i.PaintVertexArray(e.array),i.paintPropertyStatistics=e.statistics),i},ProgramConfiguration.prototype.upload=function(r){this.paintVertexArray&&(this.paintVertexBuffer=new VertexBuffer(r,this.paintVertexArray))},ProgramConfiguration.prototype.destroy=function(){this.paintVertexBuffer&&this.paintVertexBuffer.destroy()};var ProgramConfigurationSet=function(r,t,o,e){var i=this;if(this.programConfigurations={},e)for(var n=0,a=t;n<a.length;n+=1){var s=a[n];i.programConfigurations[s.id]=ProgramConfiguration.deserialize(r,s,o,e[s.id])}else for(var p=0,u=t;p<u.length;p+=1){var f=u[p],c=ProgramConfiguration.createDynamic(r,f,o);c.paintVertexArray=new c.PaintVertexArray,c.paintPropertyStatistics=c.createPaintPropertyStatistics(),i.programConfigurations[f.id]=c}};ProgramConfigurationSet.prototype.populatePaintArrays=function(r,t){var o=this;for(var e in o.programConfigurations)o.programConfigurations[e].populatePaintArray(r,t)},ProgramConfigurationSet.prototype.serialize=function(r){var t=this,o={};for(var e in t.programConfigurations){var i=t.programConfigurations[e].serialize(r);i&&(o[e]=i)}return o},ProgramConfigurationSet.prototype.get=function(r){return this.programConfigurations[r]},ProgramConfigurationSet.prototype.upload=function(r){var t=this;for(var o in t.programConfigurations)t.programConfigurations[o].upload(r)},ProgramConfigurationSet.prototype.destroy=function(){var r=this;for(var t in r.programConfigurations)r.programConfigurations[t].destroy()},module.exports={ProgramConfiguration:ProgramConfiguration,ProgramConfigurationSet:ProgramConfigurationSet};
},{"../gl/vertex_buffer":62,"../shaders/encode_attribute":85,"../style-spec/function":112,"./vertex_array_type":56}],54:[function(_dereq_,module,exports){
"use strict";var createStructArrayType=_dereq_("../util/struct_array"),RasterBoundsArray=createStructArrayType({members:[{name:"a_pos",type:"Int16",components:2},{name:"a_texture_pos",type:"Int16",components:2}]});module.exports=RasterBoundsArray;
},{"../util/struct_array":220}],55:[function(_dereq_,module,exports){
"use strict";var ref=_dereq_("../util/util"),warnOnce=ref.warnOnce,MAX_VERTEX_ARRAY_LENGTH=Math.pow(2,16)-1,SegmentVector=function(e){void 0===e&&(e=[]),this.segments=e};SegmentVector.prototype.prepareSegment=function(e,t,r){var n=this.segments[this.segments.length-1];return e>MAX_VERTEX_ARRAY_LENGTH&&warnOnce("Max vertices per segment is "+MAX_VERTEX_ARRAY_LENGTH+": bucket requested "+e),(!n||n.vertexLength+e>module.exports.MAX_VERTEX_ARRAY_LENGTH)&&(n={vertexOffset:t.length,primitiveOffset:r.length,vertexLength:0,primitiveLength:0},this.segments.push(n)),n},SegmentVector.prototype.get=function(){return this.segments},SegmentVector.prototype.destroy=function(){for(var e=this,t=0,r=e.segments;t<r.length;t+=1){var n=r[t];for(var s in n.vaos)n.vaos[s].destroy()}},module.exports={SegmentVector:SegmentVector,MAX_VERTEX_ARRAY_LENGTH:MAX_VERTEX_ARRAY_LENGTH};
},{"../util/util":223}],56:[function(_dereq_,module,exports){
"use strict";function createVertexArrayType(r){return createStructArrayType({members:r,alignment:4})}var createStructArrayType=_dereq_("../util/struct_array");module.exports=createVertexArrayType;
},{"../util/struct_array":220}],57:[function(_dereq_,module,exports){
"use strict";var Coordinate=function(o,t,n){this.column=o,this.row=t,this.zoom=n};Coordinate.prototype.clone=function(){return new Coordinate(this.column,this.row,this.zoom)},Coordinate.prototype.zoomTo=function(o){return this.clone()._zoomTo(o)},Coordinate.prototype.sub=function(o){return this.clone()._sub(o)},Coordinate.prototype._zoomTo=function(o){var t=Math.pow(2,o-this.zoom);return this.column*=t,this.row*=t,this.zoom=o,this},Coordinate.prototype._sub=function(o){return o=o.zoomTo(this.zoom),this.column-=o.column,this.row-=o.row,this},module.exports=Coordinate;
},{}],58:[function(_dereq_,module,exports){
"use strict";var wrap=_dereq_("../util/util").wrap,LngLat=function(t,n){if(isNaN(t)||isNaN(n))throw new Error("Invalid LngLat object: ("+t+", "+n+")");if(this.lng=+t,this.lat=+n,this.lat>90||this.lat<-90)throw new Error("Invalid LngLat latitude value: must be between -90 and 90")};LngLat.prototype.wrap=function(){return new LngLat(wrap(this.lng,-180,180),this.lat)},LngLat.prototype.toArray=function(){return[this.lng,this.lat]},LngLat.prototype.toString=function(){return"LngLat("+this.lng+", "+this.lat+")"},LngLat.prototype.toBounds=function(t){var n=360*t/40075017,r=n/Math.cos(Math.PI/180*this.lat);return new(_dereq_("./lng_lat_bounds"))(new LngLat(this.lng-r,this.lat-n),new LngLat(this.lng+r,this.lat+n))},LngLat.convert=function(t){if(t instanceof LngLat)return t;if(Array.isArray(t)&&2===t.length)return new LngLat(Number(t[0]),Number(t[1]));if(!Array.isArray(t)&&"object"==typeof t&&null!==t)return new LngLat(Number(t.lng),Number(t.lat));throw new Error("`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]")},module.exports=LngLat;
},{"../util/util":223,"./lng_lat_bounds":59}],59:[function(_dereq_,module,exports){
"use strict";var LngLat=_dereq_("./lng_lat"),LngLatBounds=function(t,n){t&&(n?this.setSouthWest(t).setNorthEast(n):4===t.length?this.setSouthWest([t[0],t[1]]).setNorthEast([t[2],t[3]]):this.setSouthWest(t[0]).setNorthEast(t[1]))};LngLatBounds.prototype.setNorthEast=function(t){return this._ne=t instanceof LngLat?new LngLat(t.lng,t.lat):LngLat.convert(t),this},LngLatBounds.prototype.setSouthWest=function(t){return this._sw=t instanceof LngLat?new LngLat(t.lng,t.lat):LngLat.convert(t),this},LngLatBounds.prototype.extend=function(t){var n,e,s=this._sw,o=this._ne;if(t instanceof LngLat)n=t,e=t;else{if(!(t instanceof LngLatBounds))return Array.isArray(t)?t.every(Array.isArray)?this.extend(LngLatBounds.convert(t)):this.extend(LngLat.convert(t)):this;if(n=t._sw,e=t._ne,!n||!e)return this}return s||o?(s.lng=Math.min(n.lng,s.lng),s.lat=Math.min(n.lat,s.lat),o.lng=Math.max(e.lng,o.lng),o.lat=Math.max(e.lat,o.lat)):(this._sw=new LngLat(n.lng,n.lat),this._ne=new LngLat(e.lng,e.lat)),this},LngLatBounds.prototype.getCenter=function(){return new LngLat((this._sw.lng+this._ne.lng)/2,(this._sw.lat+this._ne.lat)/2)},LngLatBounds.prototype.getSouthWest=function(){return this._sw},LngLatBounds.prototype.getNorthEast=function(){return this._ne},LngLatBounds.prototype.getNorthWest=function(){return new LngLat(this.getWest(),this.getNorth())},LngLatBounds.prototype.getSouthEast=function(){return new LngLat(this.getEast(),this.getSouth())},LngLatBounds.prototype.getWest=function(){return this._sw.lng},LngLatBounds.prototype.getSouth=function(){return this._sw.lat},LngLatBounds.prototype.getEast=function(){return this._ne.lng},LngLatBounds.prototype.getNorth=function(){return this._ne.lat},LngLatBounds.prototype.toArray=function(){return[this._sw.toArray(),this._ne.toArray()]},LngLatBounds.prototype.toString=function(){return"LngLatBounds("+this._sw.toString()+", "+this._ne.toString()+")"},LngLatBounds.convert=function(t){return!t||t instanceof LngLatBounds?t:new LngLatBounds(t)},module.exports=LngLatBounds;
},{"./lng_lat":58}],60:[function(_dereq_,module,exports){
"use strict";var LngLat=_dereq_("./lng_lat"),Point=_dereq_("@mapbox/point-geometry"),Coordinate=_dereq_("./coordinate"),util=_dereq_("../util/util"),interp=_dereq_("../style-spec/util/interpolate"),TileCoord=_dereq_("../source/tile_coord"),EXTENT=_dereq_("../data/extent"),glmatrix=_dereq_("@mapbox/gl-matrix"),vec4=glmatrix.vec4,mat4=glmatrix.mat4,mat2=glmatrix.mat2,Transform=function(t,o,i){this.tileSize=512,this._renderWorldCopies=void 0===i||i,this._minZoom=t||0,this._maxZoom=o||22,this.latRange=[-85.05113,85.05113],this.width=0,this.height=0,this._center=new LngLat(0,0),this.zoom=0,this.angle=0,this._fov=.6435011087932844,this._pitch=0,this._unmodified=!0},prototypeAccessors={minZoom:{},maxZoom:{},renderWorldCopies:{},worldSize:{},centerPoint:{},size:{},bearing:{},pitch:{},fov:{},zoom:{},center:{},unmodified:{},x:{},y:{},point:{}};prototypeAccessors.minZoom.get=function(){return this._minZoom},prototypeAccessors.minZoom.set=function(t){this._minZoom!==t&&(this._minZoom=t,this.zoom=Math.max(this.zoom,t))},prototypeAccessors.maxZoom.get=function(){return this._maxZoom},prototypeAccessors.maxZoom.set=function(t){this._maxZoom!==t&&(this._maxZoom=t,this.zoom=Math.min(this.zoom,t))},prototypeAccessors.renderWorldCopies.get=function(){return this._renderWorldCopies},prototypeAccessors.worldSize.get=function(){return this.tileSize*this.scale},prototypeAccessors.centerPoint.get=function(){return this.size._div(2)},prototypeAccessors.size.get=function(){return new Point(this.width,this.height)},prototypeAccessors.bearing.get=function(){return-this.angle/Math.PI*180},prototypeAccessors.bearing.set=function(t){var o=-util.wrap(t,-180,180)*Math.PI/180;this.angle!==o&&(this._unmodified=!1,this.angle=o,this._calcMatrices(),this.rotationMatrix=mat2.create(),mat2.rotate(this.rotationMatrix,this.rotationMatrix,this.angle))},prototypeAccessors.pitch.get=function(){return this._pitch/Math.PI*180},prototypeAccessors.pitch.set=function(t){var o=util.clamp(t,0,60)/180*Math.PI;this._pitch!==o&&(this._unmodified=!1,this._pitch=o,this._calcMatrices())},prototypeAccessors.fov.get=function(){return this._fov/Math.PI*180},prototypeAccessors.fov.set=function(t){t=Math.max(.01,Math.min(60,t)),this._fov!==t&&(this._unmodified=!1,this._fov=t/180*Math.PI,this._calcMatrices())},prototypeAccessors.zoom.get=function(){return this._zoom},prototypeAccessors.zoom.set=function(t){var o=Math.min(Math.max(t,this.minZoom),this.maxZoom);this._zoom!==o&&(this._unmodified=!1,this._zoom=o,this.scale=this.zoomScale(o),this.tileZoom=Math.floor(o),this.zoomFraction=o-this.tileZoom,this._constrain(),this._calcMatrices())},prototypeAccessors.center.get=function(){return this._center},prototypeAccessors.center.set=function(t){t.lat===this._center.lat&&t.lng===this._center.lng||(this._unmodified=!1,this._center=t,this._constrain(),this._calcMatrices())},Transform.prototype.coveringZoomLevel=function(t){return(t.roundZoom?Math.round:Math.floor)(this.zoom+this.scaleZoom(this.tileSize/t.tileSize))},Transform.prototype.getVisibleWrappedCoordinates=function(t){for(var o=this.pointCoordinate(new Point(0,0),0),i=this.pointCoordinate(new Point(this.width,0),0),e=Math.floor(o.column),r=Math.floor(i.column),n=[t],s=e;s<=r;s++)0!==s&&n.push(new TileCoord(t.z,t.x,t.y,s));return n},Transform.prototype.coveringTiles=function(t){var o=this.coveringZoomLevel(t),i=o;if(void 0!==t.minzoom&&o<t.minzoom)return[];void 0!==t.maxzoom&&o>t.maxzoom&&(o=t.maxzoom);var e=this.pointCoordinate(this.centerPoint,o),r=new Point(e.column-.5,e.row-.5),n=[this.pointCoordinate(new Point(0,0),o),this.pointCoordinate(new Point(this.width,0),o),this.pointCoordinate(new Point(this.width,this.height),o),this.pointCoordinate(new Point(0,this.height),o)];return TileCoord.cover(o,n,t.reparseOverscaled?i:o,this._renderWorldCopies).sort(function(t,o){return r.dist(t)-r.dist(o)})},Transform.prototype.resize=function(t,o){this.width=t,this.height=o,this.pixelsToGLUnits=[2/t,-2/o],this._constrain(),this._calcMatrices()},prototypeAccessors.unmodified.get=function(){return this._unmodified},Transform.prototype.zoomScale=function(t){return Math.pow(2,t)},Transform.prototype.scaleZoom=function(t){return Math.log(t)/Math.LN2},Transform.prototype.project=function(t){return new Point(this.lngX(t.lng),this.latY(t.lat))},Transform.prototype.unproject=function(t){return new LngLat(this.xLng(t.x),this.yLat(t.y))},prototypeAccessors.x.get=function(){return this.lngX(this.center.lng)},prototypeAccessors.y.get=function(){return this.latY(this.center.lat)},prototypeAccessors.point.get=function(){return new Point(this.x,this.y)},Transform.prototype.lngX=function(t){return(180+t)*this.worldSize/360},Transform.prototype.latY=function(t){return(180-180/Math.PI*Math.log(Math.tan(Math.PI/4+t*Math.PI/360)))*this.worldSize/360},Transform.prototype.xLng=function(t){return 360*t/this.worldSize-180},Transform.prototype.yLat=function(t){var o=180-360*t/this.worldSize;return 360/Math.PI*Math.atan(Math.exp(o*Math.PI/180))-90},Transform.prototype.setLocationAtPoint=function(t,o){var i=this.pointCoordinate(o)._sub(this.pointCoordinate(this.centerPoint));this.center=this.coordinateLocation(this.locationCoordinate(t)._sub(i)),this._renderWorldCopies&&(this.center=this.center.wrap())},Transform.prototype.locationPoint=function(t){return this.coordinatePoint(this.locationCoordinate(t))},Transform.prototype.pointLocation=function(t){return this.coordinateLocation(this.pointCoordinate(t))},Transform.prototype.locationCoordinate=function(t){return new Coordinate(this.lngX(t.lng)/this.tileSize,this.latY(t.lat)/this.tileSize,this.zoom).zoomTo(this.tileZoom)},Transform.prototype.coordinateLocation=function(t){var o=t.zoomTo(this.zoom);return new LngLat(this.xLng(o.column*this.tileSize),this.yLat(o.row*this.tileSize))},Transform.prototype.pointCoordinate=function(t,o){void 0===o&&(o=this.tileZoom);var i=[t.x,t.y,0,1],e=[t.x,t.y,1,1];vec4.transformMat4(i,i,this.pixelMatrixInverse),vec4.transformMat4(e,e,this.pixelMatrixInverse);var r=i[3],n=e[3],s=i[0]/r,a=e[0]/n,h=i[1]/r,c=e[1]/n,m=i[2]/r,p=e[2]/n,l=m===p?0:(0-m)/(p-m);return new Coordinate(interp(s,a,l)/this.tileSize,interp(h,c,l)/this.tileSize,this.zoom)._zoomTo(o)},Transform.prototype.coordinatePoint=function(t){var o=t.zoomTo(this.zoom),i=[o.column*this.tileSize,o.row*this.tileSize,0,1];return vec4.transformMat4(i,i,this.pixelMatrix),new Point(i[0]/i[3],i[1]/i[3])},Transform.prototype.calculatePosMatrix=function(t,o){var i=t.toCoordinate(o),e=this.worldSize/this.zoomScale(i.zoom),r=mat4.identity(new Float64Array(16));return mat4.translate(r,r,[i.column*e,i.row*e,0]),mat4.scale(r,r,[e/EXTENT,e/EXTENT,1]),mat4.multiply(r,this.projMatrix,r),new Float32Array(r)},Transform.prototype.cameraToTileDistance=function(t){var o=this.calculatePosMatrix(t.coord,t.sourceMaxZoom),i=[t.tileSize/2,t.tileSize/2,0,1];return vec4.transformMat4(i,i,o),i[3]},Transform.prototype._constrain=function(){if(this.center&&this.width&&this.height&&!this._constraining){this._constraining=!0;var t,o,i,e,r=-90,n=90,s=-180,a=180,h=this.size,c=this._unmodified;if(this.latRange){var m=this.latRange;r=this.latY(m[1]),n=this.latY(m[0]),t=n-r<h.y?h.y/(n-r):0}if(this.lngRange){var p=this.lngRange;s=this.lngX(p[0]),a=this.lngX(p[1]),o=a-s<h.x?h.x/(a-s):0}var l=Math.max(o||0,t||0);if(l)return this.center=this.unproject(new Point(o?(a+s)/2:this.x,t?(n+r)/2:this.y)),this.zoom+=this.scaleZoom(l),this._unmodified=c,void(this._constraining=!1);if(this.latRange){var u=this.y,f=h.y/2;u-f<r&&(e=r+f),u+f>n&&(e=n-f)}if(this.lngRange){var d=this.x,g=h.x/2;d-g<s&&(i=s+g),d+g>a&&(i=a-g)}void 0===i&&void 0===e||(this.center=this.unproject(new Point(void 0!==i?i:this.x,void 0!==e?e:this.y))),this._unmodified=c,this._constraining=!1}},Transform.prototype._calcMatrices=function(){if(this.height){this.cameraToCenterDistance=.5/Math.tan(this._fov/2)*this.height;var t=this._fov/2,o=Math.PI/2+this._pitch,i=Math.sin(t)*this.cameraToCenterDistance/Math.sin(Math.PI-o-t),e=Math.cos(Math.PI/2-this._pitch)*i+this.cameraToCenterDistance,r=1.01*e,n=new Float64Array(16);mat4.perspective(n,this._fov,this.width/this.height,1,r),mat4.scale(n,n,[1,-1,1]),mat4.translate(n,n,[0,0,-this.cameraToCenterDistance]),mat4.rotateX(n,n,this._pitch),mat4.rotateZ(n,n,this.angle),mat4.translate(n,n,[-this.x,-this.y,0]);var s=this.worldSize/(2*Math.PI*6378137*Math.abs(Math.cos(this.center.lat*(Math.PI/180))));if(mat4.scale(n,n,[1,1,s,1]),this.projMatrix=n,n=mat4.create(),mat4.scale(n,n,[this.width/2,-this.height/2,1]),mat4.translate(n,n,[1,-1,0]),this.pixelMatrix=mat4.multiply(new Float64Array(16),n,this.projMatrix),!(n=mat4.invert(new Float64Array(16),this.pixelMatrix)))throw new Error("failed to invert matrix");this.pixelMatrixInverse=n}},Object.defineProperties(Transform.prototype,prototypeAccessors),module.exports=Transform;
},{"../data/extent":48,"../source/tile_coord":101,"../style-spec/util/interpolate":127,"../util/util":223,"./coordinate":57,"./lng_lat":58,"@mapbox/gl-matrix":1,"@mapbox/point-geometry":2}],61:[function(_dereq_,module,exports){
"use strict";var IndexBuffer=function(e,r){this.gl=e,this.buffer=e.createBuffer(),void 0===e.extVertexArrayObject&&(e.extVertexArrayObject=e.getExtension("OES_vertex_array_object")),e.extVertexArrayObject&&e.extVertexArrayObject.bindVertexArrayOES(null),e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,this.buffer),e.bufferData(e.ELEMENT_ARRAY_BUFFER,r.arrayBuffer,e.STATIC_DRAW),delete r.arrayBuffer};IndexBuffer.prototype.bind=function(){this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER,this.buffer)},IndexBuffer.prototype.destroy=function(){this.buffer&&(this.gl.deleteBuffer(this.buffer),delete this.buffer)},module.exports=IndexBuffer;
},{}],62:[function(_dereq_,module,exports){
"use strict";var AttributeType={Int8:"BYTE",Uint8:"UNSIGNED_BYTE",Int16:"SHORT",Uint16:"UNSIGNED_SHORT",Int32:"INT",Uint32:"UNSIGNED_INT",Float32:"FLOAT"},VertexBuffer=function(t,e,r){this.length=e.length,this.attributes=e.members,this.itemSize=e.bytesPerElement,this.dynamicDraw=r,this.gl=t,this.buffer=t.createBuffer(),this.gl.bindBuffer(t.ARRAY_BUFFER,this.buffer),this.gl.bufferData(t.ARRAY_BUFFER,e.arrayBuffer,this.dynamicDraw?t.DYNAMIC_DRAW:t.STATIC_DRAW),this.dynamicDraw||delete e.arrayBuffer};VertexBuffer.prototype.bind=function(){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer)},VertexBuffer.prototype.updateData=function(t){this.bind(),this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,t.arrayBuffer)},VertexBuffer.prototype.enableAttributes=function(t,e){for(var r=this,i=0;i<this.attributes.length;i++){var f=r.attributes[i],s=e.attributes[f.name];void 0!==s&&t.enableVertexAttribArray(s)}},VertexBuffer.prototype.setVertexAttribPointers=function(t,e,r){for(var i=this,f=0;f<this.attributes.length;f++){var s=i.attributes[f],u=e.attributes[s.name];void 0!==u&&t.vertexAttribPointer(u,s.components,t[AttributeType[s.type]],!1,i.itemSize,s.offset+i.itemSize*(r||0))}},VertexBuffer.prototype.destroy=function(){this.buffer&&(this.gl.deleteBuffer(this.buffer),delete this.buffer)},module.exports=VertexBuffer;
},{}],63:[function(_dereq_,module,exports){
"use strict";var supported=_dereq_("mapbox-gl-supported"),browser=_dereq_("./util/browser"),version=_dereq_("../package.json").version,Map=_dereq_("./ui/map"),NavigationControl=_dereq_("./ui/control/navigation_control"),GeolocateControl=_dereq_("./ui/control/geolocate_control"),AttributionControl=_dereq_("./ui/control/attribution_control"),ScaleControl=_dereq_("./ui/control/scale_control"),FullscreenControl=_dereq_("./ui/control/fullscreen_control"),Popup=_dereq_("./ui/popup"),Marker=_dereq_("./ui/marker"),Style=_dereq_("./style/style"),LngLat=_dereq_("./geo/lng_lat"),LngLatBounds=_dereq_("./geo/lng_lat_bounds"),Point=_dereq_("@mapbox/point-geometry"),Evented=_dereq_("./util/evented"),config=_dereq_("./util/config"),rtlTextPlugin=_dereq_("./source/rtl_text_plugin");module.exports={version:version,supported:supported,workerCount:Math.max(Math.floor(browser.hardwareConcurrency/2),1),setRTLTextPlugin:rtlTextPlugin.setRTLTextPlugin,Map:Map,NavigationControl:NavigationControl,GeolocateControl:GeolocateControl,AttributionControl:AttributionControl,ScaleControl:ScaleControl,FullscreenControl:FullscreenControl,Popup:Popup,Marker:Marker,Style:Style,LngLat:LngLat,LngLatBounds:LngLatBounds,Point:Point,Evented:Evented,config:config,get accessToken(){return config.ACCESS_TOKEN},set accessToken(o){config.ACCESS_TOKEN=o}};
},{"../package.json":41,"./geo/lng_lat":58,"./geo/lng_lat_bounds":59,"./source/rtl_text_plugin":96,"./style/style":156,"./ui/control/attribution_control":182,"./ui/control/fullscreen_control":183,"./ui/control/geolocate_control":184,"./ui/control/navigation_control":186,"./ui/control/scale_control":187,"./ui/map":197,"./ui/marker":198,"./ui/popup":199,"./util/browser":202,"./util/config":206,"./util/evented":210,"@mapbox/point-geometry":2,"mapbox-gl-supported":28}],64:[function(_dereq_,module,exports){
"use strict";function drawBackground(r,t,e){var i=r.gl,a=r.transform,n=a.tileSize,o=e.paint["background-color"],l=e.paint["background-pattern"],u=e.paint["background-opacity"],f=l||1!==o[3]||1!==u?"translucent":"opaque";if(r.renderPass===f){i.disable(i.STENCIL_TEST),r.setDepthSublayer(0);var s;if(l){if(pattern.isPatternMissing(l,r))return;s=r.useProgram("fillPattern",r.basicFillProgramConfiguration),pattern.prepare(l,r,s),r.tileExtentPatternVAO.bind(i,s,r.tileExtentBuffer)}else s=r.useProgram("fill",r.basicFillProgramConfiguration),i.uniform4fv(s.uniforms.u_color,o),r.tileExtentVAO.bind(i,s,r.tileExtentBuffer);i.uniform1f(s.uniforms.u_opacity,u);for(var c=a.coveringTiles({tileSize:n}),g=0,p=c;g<p.length;g+=1){var d=p[g];l&&pattern.setTile({coord:d,tileSize:n},r,s),i.uniformMatrix4fv(s.uniforms.u_matrix,!1,r.transform.calculatePosMatrix(d)),i.drawArrays(i.TRIANGLE_STRIP,0,r.tileExtentBuffer.length)}}}var pattern=_dereq_("./pattern");module.exports=drawBackground;
},{"./pattern":80}],65:[function(_dereq_,module,exports){
"use strict";function drawCircles(r,i,e,t){if("translucent"===r.renderPass){var a=r.gl;r.setDepthSublayer(0),r.depthMask(!1),a.disable(a.STENCIL_TEST);for(var s=0;s<t.length;s++){var o=t[s],n=i.getTile(o),u=n.getBucket(e);if(u){var m=u.programConfigurations.get(e.id),f=r.useProgram("circle",m);if(m.setUniforms(a,f,e,{zoom:r.transform.zoom}),a.uniform1f(f.uniforms.u_camera_to_center_distance,r.transform.cameraToCenterDistance),a.uniform1i(f.uniforms.u_scale_with_map,"map"===e.paint["circle-pitch-scale"]?1:0),"map"===e.paint["circle-pitch-alignment"]){a.uniform1i(f.uniforms.u_pitch_with_map,1);var l=pixelsToTileUnits(n,1,r.transform.zoom);a.uniform2f(f.uniforms.u_extrude_scale,l,l)}else a.uniform1i(f.uniforms.u_pitch_with_map,0),a.uniform2fv(f.uniforms.u_extrude_scale,r.transform.pixelsToGLUnits);a.uniform1f(f.uniforms.u_devicepixelratio,browser.devicePixelRatio),a.uniformMatrix4fv(f.uniforms.u_matrix,!1,r.translatePosMatrix(o.posMatrix,n,e.paint["circle-translate"],e.paint["circle-translate-anchor"])),f.draw(a,a.TRIANGLES,e.id,u.layoutVertexBuffer,u.indexBuffer,u.segments,m)}}}}var browser=_dereq_("../util/browser"),pixelsToTileUnits=_dereq_("../source/pixels_to_tile_units");module.exports=drawCircles;
},{"../source/pixels_to_tile_units":93,"../util/browser":202}],66:[function(_dereq_,module,exports){
"use strict";function drawCollisionDebug(o,i,r,e){var n=o.gl;n.enable(n.STENCIL_TEST);var t=o.useProgram("collisionBox");n.activeTexture(n.TEXTURE1),o.frameHistory.bind(n),n.uniform1i(t.uniforms.u_fadetexture,1);for(var a=0;a<e.length;a++){var f=e[a],u=i.getTile(f),m=u.getBucket(r);if(m){n.uniformMatrix4fv(t.uniforms.u_matrix,!1,f.posMatrix),o.enableTileClippingMask(f),o.lineWidth(1),n.uniform1f(t.uniforms.u_scale,Math.pow(2,o.transform.zoom-u.coord.z)),n.uniform1f(t.uniforms.u_zoom,10*o.transform.zoom);var s=Math.max(0,Math.min(25,u.coord.z+Math.log(u.collisionTile.maxScale)/Math.LN2));n.uniform1f(t.uniforms.u_maxzoom,10*s),n.uniform1f(t.uniforms.u_collision_y_stretch,u.collisionTile.yStretch),n.uniform1f(t.uniforms.u_pitch,o.transform.pitch/360*2*Math.PI),n.uniform1f(t.uniforms.u_camera_to_center_distance,o.transform.cameraToCenterDistance),t.draw(n,n.LINES,r.id,m.collisionBox.layoutVertexBuffer,m.collisionBox.indexBuffer,m.collisionBox.segments)}}}module.exports=drawCollisionDebug;
},{}],67:[function(_dereq_,module,exports){
"use strict";function drawDebug(r,e,t){for(var a=0;a<t.length;a++)drawDebugTile(r,e,t[a])}function drawDebugTile(r,e,t){var a=r.gl;a.disable(a.STENCIL_TEST),r.lineWidth(1*browser.devicePixelRatio);var i=t.posMatrix,u=r.useProgram("debug");a.uniformMatrix4fv(u.uniforms.u_matrix,!1,i),a.uniform4f(u.uniforms.u_color,1,0,0,1),r.debugVAO.bind(a,u,r.debugBuffer),a.drawArrays(a.LINE_STRIP,0,r.debugBuffer.length);for(var o=createTextVerticies(t.toString(),50,200,5),n=new PosArray,f=0;f<o.length;f+=2)n.emplaceBack(o[f],o[f+1]);var l=new VertexBuffer(a,n);(new VertexArrayObject).bind(a,u,l),a.uniform4f(u.uniforms.u_color,1,1,1,1);for(var s=e.getTile(t).tileSize,m=EXTENT/(Math.pow(2,r.transform.zoom-t.z)*s),x=[[-1,-1],[-1,1],[1,-1],[1,1]],g=0;g<x.length;g++){var b=x[g];a.uniformMatrix4fv(u.uniforms.u_matrix,!1,mat4.translate([],i,[m*b[0],m*b[1],0])),a.drawArrays(a.LINES,0,l.length)}a.uniform4f(u.uniforms.u_color,0,0,0,1),a.uniformMatrix4fv(u.uniforms.u_matrix,!1,i),a.drawArrays(a.LINES,0,l.length)}function createTextVerticies(r,e,t,a){a=a||1;var i,u,o,n,f,l,s,m,x=[];for(i=0,u=r.length;i<u;i++)if(f=simplexFont[r[i]]){for(m=null,o=0,n=f[1].length;o<n;o+=2)-1===f[1][o]&&-1===f[1][o+1]?m=null:(l=e+f[1][o]*a,s=t-f[1][o+1]*a,m&&x.push(m.x,m.y,l,s),m={x:l,y:s});e+=f[0]*a}return x}var browser=_dereq_("../util/browser"),mat4=_dereq_("@mapbox/gl-matrix").mat4,EXTENT=_dereq_("../data/extent"),VertexBuffer=_dereq_("../gl/vertex_buffer"),VertexArrayObject=_dereq_("./vertex_array_object"),PosArray=_dereq_("../data/pos_array");module.exports=drawDebug;var simplexFont={" ":[16,[]],"!":[10,[5,21,5,7,-1,-1,5,2,4,1,5,0,6,1,5,2]],'"':[16,[4,21,4,14,-1,-1,12,21,12,14]],"#":[21,[11,25,4,-7,-1,-1,17,25,10,-7,-1,-1,4,12,18,12,-1,-1,3,6,17,6]],$:[20,[8,25,8,-4,-1,-1,12,25,12,-4,-1,-1,17,18,15,20,12,21,8,21,5,20,3,18,3,16,4,14,5,13,7,12,13,10,15,9,16,8,17,6,17,3,15,1,12,0,8,0,5,1,3,3]],"%":[24,[21,21,3,0,-1,-1,8,21,10,19,10,17,9,15,7,14,5,14,3,16,3,18,4,20,6,21,8,21,10,20,13,19,16,19,19,20,21,21,-1,-1,17,7,15,6,14,4,14,2,16,0,18,0,20,1,21,3,21,5,19,7,17,7]],"&":[26,[23,12,23,13,22,14,21,14,20,13,19,11,17,6,15,3,13,1,11,0,7,0,5,1,4,2,3,4,3,6,4,8,5,9,12,13,13,14,14,16,14,18,13,20,11,21,9,20,8,18,8,16,9,13,11,10,16,3,18,1,20,0,22,0,23,1,23,2]],"'":[10,[5,19,4,20,5,21,6,20,6,18,5,16,4,15]],"(":[14,[11,25,9,23,7,20,5,16,4,11,4,7,5,2,7,-2,9,-5,11,-7]],")":[14,[3,25,5,23,7,20,9,16,10,11,10,7,9,2,7,-2,5,-5,3,-7]],"*":[16,[8,21,8,9,-1,-1,3,18,13,12,-1,-1,13,18,3,12]],"+":[26,[13,18,13,0,-1,-1,4,9,22,9]],",":[10,[6,1,5,0,4,1,5,2,6,1,6,-1,5,-3,4,-4]],"-":[26,[4,9,22,9]],".":[10,[5,2,4,1,5,0,6,1,5,2]],"/":[22,[20,25,2,-7]],0:[20,[9,21,6,20,4,17,3,12,3,9,4,4,6,1,9,0,11,0,14,1,16,4,17,9,17,12,16,17,14,20,11,21,9,21]],1:[20,[6,17,8,18,11,21,11,0]],2:[20,[4,16,4,17,5,19,6,20,8,21,12,21,14,20,15,19,16,17,16,15,15,13,13,10,3,0,17,0]],3:[20,[5,21,16,21,10,13,13,13,15,12,16,11,17,8,17,6,16,3,14,1,11,0,8,0,5,1,4,2,3,4]],4:[20,[13,21,3,7,18,7,-1,-1,13,21,13,0]],5:[20,[15,21,5,21,4,12,5,13,8,14,11,14,14,13,16,11,17,8,17,6,16,3,14,1,11,0,8,0,5,1,4,2,3,4]],6:[20,[16,18,15,20,12,21,10,21,7,20,5,17,4,12,4,7,5,3,7,1,10,0,11,0,14,1,16,3,17,6,17,7,16,10,14,12,11,13,10,13,7,12,5,10,4,7]],7:[20,[17,21,7,0,-1,-1,3,21,17,21]],8:[20,[8,21,5,20,4,18,4,16,5,14,7,13,11,12,14,11,16,9,17,7,17,4,16,2,15,1,12,0,8,0,5,1,4,2,3,4,3,7,4,9,6,11,9,12,13,13,15,14,16,16,16,18,15,20,12,21,8,21]],9:[20,[16,14,15,11,13,9,10,8,9,8,6,9,4,11,3,14,3,15,4,18,6,20,9,21,10,21,13,20,15,18,16,14,16,9,15,4,13,1,10,0,8,0,5,1,4,3]],":":[10,[5,14,4,13,5,12,6,13,5,14,-1,-1,5,2,4,1,5,0,6,1,5,2]],";":[10,[5,14,4,13,5,12,6,13,5,14,-1,-1,6,1,5,0,4,1,5,2,6,1,6,-1,5,-3,4,-4]],"<":[24,[20,18,4,9,20,0]],"=":[26,[4,12,22,12,-1,-1,4,6,22,6]],">":[24,[4,18,20,9,4,0]],"?":[18,[3,16,3,17,4,19,5,20,7,21,11,21,13,20,14,19,15,17,15,15,14,13,13,12,9,10,9,7,-1,-1,9,2,8,1,9,0,10,1,9,2]],"@":[27,[18,13,17,15,15,16,12,16,10,15,9,14,8,11,8,8,9,6,11,5,14,5,16,6,17,8,-1,-1,12,16,10,14,9,11,9,8,10,6,11,5,-1,-1,18,16,17,8,17,6,19,5,21,5,23,7,24,10,24,12,23,15,22,17,20,19,18,20,15,21,12,21,9,20,7,19,5,17,4,15,3,12,3,9,4,6,5,4,7,2,9,1,12,0,15,0,18,1,20,2,21,3,-1,-1,19,16,18,8,18,6,19,5]],A:[18,[9,21,1,0,-1,-1,9,21,17,0,-1,-1,4,7,14,7]],B:[21,[4,21,4,0,-1,-1,4,21,13,21,16,20,17,19,18,17,18,15,17,13,16,12,13,11,-1,-1,4,11,13,11,16,10,17,9,18,7,18,4,17,2,16,1,13,0,4,0]],C:[21,[18,16,17,18,15,20,13,21,9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5]],D:[21,[4,21,4,0,-1,-1,4,21,11,21,14,20,16,18,17,16,18,13,18,8,17,5,16,3,14,1,11,0,4,0]],E:[19,[4,21,4,0,-1,-1,4,21,17,21,-1,-1,4,11,12,11,-1,-1,4,0,17,0]],F:[18,[4,21,4,0,-1,-1,4,21,17,21,-1,-1,4,11,12,11]],G:[21,[18,16,17,18,15,20,13,21,9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5,18,8,-1,-1,13,8,18,8]],H:[22,[4,21,4,0,-1,-1,18,21,18,0,-1,-1,4,11,18,11]],I:[8,[4,21,4,0]],J:[16,[12,21,12,5,11,2,10,1,8,0,6,0,4,1,3,2,2,5,2,7]],K:[21,[4,21,4,0,-1,-1,18,21,4,7,-1,-1,9,12,18,0]],L:[17,[4,21,4,0,-1,-1,4,0,16,0]],M:[24,[4,21,4,0,-1,-1,4,21,12,0,-1,-1,20,21,12,0,-1,-1,20,21,20,0]],N:[22,[4,21,4,0,-1,-1,4,21,18,0,-1,-1,18,21,18,0]],O:[22,[9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5,19,8,19,13,18,16,17,18,15,20,13,21,9,21]],P:[21,[4,21,4,0,-1,-1,4,21,13,21,16,20,17,19,18,17,18,14,17,12,16,11,13,10,4,10]],Q:[22,[9,21,7,20,5,18,4,16,3,13,3,8,4,5,5,3,7,1,9,0,13,0,15,1,17,3,18,5,19,8,19,13,18,16,17,18,15,20,13,21,9,21,-1,-1,12,4,18,-2]],R:[21,[4,21,4,0,-1,-1,4,21,13,21,16,20,17,19,18,17,18,15,17,13,16,12,13,11,4,11,-1,-1,11,11,18,0]],S:[20,[17,18,15,20,12,21,8,21,5,20,3,18,3,16,4,14,5,13,7,12,13,10,15,9,16,8,17,6,17,3,15,1,12,0,8,0,5,1,3,3]],T:[16,[8,21,8,0,-1,-1,1,21,15,21]],U:[22,[4,21,4,6,5,3,7,1,10,0,12,0,15,1,17,3,18,6,18,21]],V:[18,[1,21,9,0,-1,-1,17,21,9,0]],W:[24,[2,21,7,0,-1,-1,12,21,7,0,-1,-1,12,21,17,0,-1,-1,22,21,17,0]],X:[20,[3,21,17,0,-1,-1,17,21,3,0]],Y:[18,[1,21,9,11,9,0,-1,-1,17,21,9,11]],Z:[20,[17,21,3,0,-1,-1,3,21,17,21,-1,-1,3,0,17,0]],"[":[14,[4,25,4,-7,-1,-1,5,25,5,-7,-1,-1,4,25,11,25,-1,-1,4,-7,11,-7]],"\\":[14,[0,21,14,-3]],"]":[14,[9,25,9,-7,-1,-1,10,25,10,-7,-1,-1,3,25,10,25,-1,-1,3,-7,10,-7]],"^":[16,[6,15,8,18,10,15,-1,-1,3,12,8,17,13,12,-1,-1,8,17,8,0]],_:[16,[0,-2,16,-2]],"`":[10,[6,21,5,20,4,18,4,16,5,15,6,16,5,17]],a:[19,[15,14,15,0,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3]],b:[19,[4,21,4,0,-1,-1,4,11,6,13,8,14,11,14,13,13,15,11,16,8,16,6,15,3,13,1,11,0,8,0,6,1,4,3]],c:[18,[15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3]],d:[19,[15,21,15,0,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3]],e:[18,[3,8,15,8,15,10,14,12,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3]],f:[12,[10,21,8,21,6,20,5,17,5,0,-1,-1,2,14,9,14]],g:[19,[15,14,15,-2,14,-5,13,-6,11,-7,8,-7,6,-6,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3]],h:[19,[4,21,4,0,-1,-1,4,10,7,13,9,14,12,14,14,13,15,10,15,0]],i:[8,[3,21,4,20,5,21,4,22,3,21,-1,-1,4,14,4,0]],j:[10,[5,21,6,20,7,21,6,22,5,21,-1,-1,6,14,6,-3,5,-6,3,-7,1,-7]],k:[17,[4,21,4,0,-1,-1,14,14,4,4,-1,-1,8,8,15,0]],l:[8,[4,21,4,0]],m:[30,[4,14,4,0,-1,-1,4,10,7,13,9,14,12,14,14,13,15,10,15,0,-1,-1,15,10,18,13,20,14,23,14,25,13,26,10,26,0]],n:[19,[4,14,4,0,-1,-1,4,10,7,13,9,14,12,14,14,13,15,10,15,0]],o:[19,[8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3,16,6,16,8,15,11,13,13,11,14,8,14]],p:[19,[4,14,4,-7,-1,-1,4,11,6,13,8,14,11,14,13,13,15,11,16,8,16,6,15,3,13,1,11,0,8,0,6,1,4,3]],q:[19,[15,14,15,-7,-1,-1,15,11,13,13,11,14,8,14,6,13,4,11,3,8,3,6,4,3,6,1,8,0,11,0,13,1,15,3]],r:[13,[4,14,4,0,-1,-1,4,8,5,11,7,13,9,14,12,14]],s:[17,[14,11,13,13,10,14,7,14,4,13,3,11,4,9,6,8,11,7,13,6,14,4,14,3,13,1,10,0,7,0,4,1,3,3]],t:[12,[5,21,5,4,6,1,8,0,10,0,-1,-1,2,14,9,14]],u:[19,[4,14,4,4,5,1,7,0,10,0,12,1,15,4,-1,-1,15,14,15,0]],v:[16,[2,14,8,0,-1,-1,14,14,8,0]],w:[22,[3,14,7,0,-1,-1,11,14,7,0,-1,-1,11,14,15,0,-1,-1,19,14,15,0]],x:[17,[3,14,14,0,-1,-1,14,14,3,0]],y:[16,[2,14,8,0,-1,-1,14,14,8,0,6,-4,4,-6,2,-7,1,-7]],z:[17,[14,14,3,0,-1,-1,3,14,14,14,-1,-1,3,0,14,0]],"{":[14,[9,25,7,24,6,23,5,21,5,19,6,17,7,16,8,14,8,12,6,10,-1,-1,7,24,6,22,6,20,7,18,8,17,9,15,9,13,8,11,4,9,8,7,9,5,9,3,8,1,7,0,6,-2,6,-4,7,-6,-1,-1,6,8,8,6,8,4,7,2,6,1,5,-1,5,-3,6,-5,7,-6,9,-7]],"|":[8,[4,25,4,-7]],"}":[14,[5,25,7,24,8,23,9,21,9,19,8,17,7,16,6,14,6,12,8,10,-1,-1,7,24,8,22,8,20,7,18,6,17,5,15,5,13,6,11,10,9,6,7,5,5,5,3,6,1,7,0,8,-2,8,-4,7,-6,-1,-1,8,8,6,6,6,4,7,2,8,1,9,-1,9,-3,8,-5,7,-6,5,-7]],"~":[24,[3,6,3,8,4,11,6,12,8,12,10,11,14,8,16,7,18,7,20,8,21,10,-1,-1,3,8,4,10,6,11,8,11,10,10,14,7,16,6,18,6,20,7,21,10,21,12]]};
},{"../data/extent":48,"../data/pos_array":52,"../gl/vertex_buffer":62,"../util/browser":202,"./vertex_array_object":84,"@mapbox/gl-matrix":1}],68:[function(_dereq_,module,exports){
"use strict";function drawFill(r,t,e,a){var i=r.gl;i.enable(i.STENCIL_TEST);var l=!e.paint["fill-pattern"]&&e.isPaintValueFeatureConstant("fill-color")&&e.isPaintValueFeatureConstant("fill-opacity")&&1===e.paint["fill-color"][3]&&1===e.paint["fill-opacity"]?"opaque":"translucent";r.renderPass===l&&(r.setDepthSublayer(1),r.depthMask("opaque"===r.renderPass),drawFillTiles(r,t,e,a,drawFillTile)),"translucent"===r.renderPass&&e.paint["fill-antialias"]&&(r.lineWidth(2),r.depthMask(!1),r.setDepthSublayer(e.getPaintProperty("fill-outline-color")?2:0),drawFillTiles(r,t,e,a,drawStrokeTile))}function drawFillTiles(r,t,e,a,i){if(!pattern.isPatternMissing(e.paint["fill-pattern"],r))for(var l=!0,n=0,o=a;n<o.length;n+=1){var s=o[n],f=t.getTile(s),u=f.getBucket(e);u&&(r.enableTileClippingMask(s),i(r,t,e,f,s,u,l),l=!1)}}function drawFillTile(r,t,e,a,i,l,n){var o=r.gl,s=l.programConfigurations.get(e.id);setFillProgram("fill",e.paint["fill-pattern"],r,s,e,a,i,n).draw(o,o.TRIANGLES,e.id,l.layoutVertexBuffer,l.indexBuffer,l.segments,s)}function drawStrokeTile(r,t,e,a,i,l,n){var o=r.gl,s=l.programConfigurations.get(e.id),f=e.paint["fill-pattern"]&&!e.getPaintProperty("fill-outline-color"),u=setFillProgram("fillOutline",f,r,s,e,a,i,n);o.uniform2f(u.uniforms.u_world,o.drawingBufferWidth,o.drawingBufferHeight),u.draw(o,o.LINES,e.id,l.layoutVertexBuffer,l.indexBuffer2,l.segments2,s)}function setFillProgram(r,t,e,a,i,l,n,o){var s,f=e.currentProgram;return t?(s=e.useProgram(r+"Pattern",a),(o||s!==f)&&(a.setUniforms(e.gl,s,i,{zoom:e.transform.zoom}),pattern.prepare(i.paint["fill-pattern"],e,s)),pattern.setTile(l,e,s)):(s=e.useProgram(r,a),(o||s!==f)&&a.setUniforms(e.gl,s,i,{zoom:e.transform.zoom})),e.gl.uniformMatrix4fv(s.uniforms.u_matrix,!1,e.translatePosMatrix(n.posMatrix,l,i.paint["fill-translate"],i.paint["fill-translate-anchor"])),s}var pattern=_dereq_("./pattern");module.exports=drawFill;
},{"./pattern":80}],69:[function(_dereq_,module,exports){
"use strict";function draw(r,t,e,i){if("3d"===r.renderPass){var a=r.gl;a.disable(a.STENCIL_TEST),a.enable(a.DEPTH_TEST),r.clearColor(),r.depthMask(!0);for(var n=0;n<i.length;n++)drawExtrusion(r,t,e,i[n])}else"translucent"===r.renderPass&&drawExtrusionTexture(r,e)}function drawExtrusionTexture(r,t){var e=r.prerenderedFrames[t.id];if(e){var i=r.gl,a=r.useProgram("extrusionTexture");i.disable(i.STENCIL_TEST),i.disable(i.DEPTH_TEST),i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,e.texture),i.uniform1f(a.uniforms.u_opacity,t.paint["fill-extrusion-opacity"]),i.uniform1i(a.uniforms.u_image,0);var n=mat4.create();mat4.ortho(n,0,r.width,r.height,0,0,1),i.uniformMatrix4fv(a.uniforms.u_matrix,!1,n),i.uniform2f(a.uniforms.u_world,i.drawingBufferWidth,i.drawingBufferHeight),e.vao.bind(i,a,e.buffer),i.drawArrays(i.TRIANGLE_STRIP,0,4),r.viewportFrames.push(e),delete r.prerenderedFrames[t.id]}}function drawExtrusion(r,t,e,i){var a=t.getTile(i),n=a.getBucket(e);if(n){var o=r.gl,u=e.paint["fill-extrusion-pattern"],s=n.programConfigurations.get(e.id),f=r.useProgram(u?"fillExtrusionPattern":"fillExtrusion",s);if(s.setUniforms(o,f,e,{zoom:r.transform.zoom}),u){if(pattern.isPatternMissing(u,r))return;pattern.prepare(u,r,f),pattern.setTile(a,r,f),o.uniform1f(f.uniforms.u_height_factor,-Math.pow(2,i.z)/a.tileSize/8)}r.gl.uniformMatrix4fv(f.uniforms.u_matrix,!1,r.translatePosMatrix(i.posMatrix,a,e.paint["fill-extrusion-translate"],e.paint["fill-extrusion-translate-anchor"])),setLight(f,r),f.draw(o,o.TRIANGLES,e.id,n.layoutVertexBuffer,n.indexBuffer,n.segments,s)}}function setLight(r,t){var e=t.gl,i=t.style.light,a=i.calculated.position,n=[a.x,a.y,a.z],o=mat3.create();"viewport"===i.calculated.anchor&&mat3.fromRotation(o,-t.transform.angle),vec3.transformMat3(n,n,o),e.uniform3fv(r.uniforms.u_lightpos,n),e.uniform1f(r.uniforms.u_lightintensity,i.calculated.intensity),e.uniform3fv(r.uniforms.u_lightcolor,i.calculated.color.slice(0,3))}var glMatrix=_dereq_("@mapbox/gl-matrix"),pattern=_dereq_("./pattern"),mat3=glMatrix.mat3,mat4=glMatrix.mat4,vec3=glMatrix.vec3;module.exports=draw;
},{"./pattern":80,"@mapbox/gl-matrix":1}],70:[function(_dereq_,module,exports){
"use strict";function drawLineTile(i,r,e,t,n,a,o,u,f){var s,l,m,_,p=r.gl,g=n.paint["line-dasharray"],d=n.paint["line-pattern"];if(u||f){var x=1/pixelsToTileUnits(e,1,r.transform.tileZoom);if(g){s=r.lineAtlas.getDash(g.from,"round"===n.layout["line-cap"]),l=r.lineAtlas.getDash(g.to,"round"===n.layout["line-cap"]);var T=s.width*g.fromScale,c=l.width*g.toScale;p.uniform2f(i.uniforms.u_patternscale_a,x/T,-s.height/2),p.uniform2f(i.uniforms.u_patternscale_b,x/c,-l.height/2),p.uniform1f(i.uniforms.u_sdfgamma,r.lineAtlas.width/(256*Math.min(T,c)*browser.devicePixelRatio)/2)}else if(d){if(m=r.imageManager.getPattern(d.from),_=r.imageManager.getPattern(d.to),!m||!_)return;p.uniform2f(i.uniforms.u_pattern_size_a,m.displaySize[0]*d.fromScale/x,_.displaySize[1]),p.uniform2f(i.uniforms.u_pattern_size_b,_.displaySize[0]*d.toScale/x,_.displaySize[1]);var h=r.imageManager.getPixelSize(),v=h.width,b=h.height;p.uniform2fv(i.uniforms.u_texsize,[v,b])}p.uniform2f(i.uniforms.u_gl_units_to_pixels,1/r.transform.pixelsToGLUnits[0],1/r.transform.pixelsToGLUnits[1])}u&&(g?(p.uniform1i(i.uniforms.u_image,0),p.activeTexture(p.TEXTURE0),r.lineAtlas.bind(p),p.uniform1f(i.uniforms.u_tex_y_a,s.y),p.uniform1f(i.uniforms.u_tex_y_b,l.y),p.uniform1f(i.uniforms.u_mix,g.t)):d&&(p.uniform1i(i.uniforms.u_image,0),p.activeTexture(p.TEXTURE0),r.imageManager.bind(p),p.uniform2fv(i.uniforms.u_pattern_tl_a,m.tl),p.uniform2fv(i.uniforms.u_pattern_br_a,m.br),p.uniform2fv(i.uniforms.u_pattern_tl_b,_.tl),p.uniform2fv(i.uniforms.u_pattern_br_b,_.br),p.uniform1f(i.uniforms.u_fade,d.t))),r.enableTileClippingMask(a);var y=r.translatePosMatrix(a.posMatrix,e,n.paint["line-translate"],n.paint["line-translate-anchor"]);p.uniformMatrix4fv(i.uniforms.u_matrix,!1,y),p.uniform1f(i.uniforms.u_ratio,1/pixelsToTileUnits(e,1,r.transform.zoom)),i.draw(p,p.TRIANGLES,n.id,t.layoutVertexBuffer,t.indexBuffer,t.segments,o)}var browser=_dereq_("../util/browser"),pixelsToTileUnits=_dereq_("../source/pixels_to_tile_units");module.exports=function(i,r,e,t){if("translucent"===i.renderPass){i.setDepthSublayer(0),i.depthMask(!1);var n=i.gl;if(n.enable(n.STENCIL_TEST),!(e.paint["line-width"]<=0))for(var a,o=e.paint["line-dasharray"]?"lineSDF":e.paint["line-pattern"]?"linePattern":"line",u=!0,f=0,s=t;f<s.length;f+=1){var l=s[f],m=r.getTile(l),_=m.getBucket(e);if(_){var p=_.programConfigurations.get(e.id),g=i.currentProgram,d=i.useProgram(o,p),x=u||d!==g,T=a!==m.coord.z;x&&p.setUniforms(i.gl,d,e,{zoom:i.transform.zoom}),drawLineTile(d,i,m,_,e,l,p,x,T),a=m.coord.z,u=!1}}}};
},{"../source/pixels_to_tile_units":93,"../util/browser":202}],71:[function(_dereq_,module,exports){
"use strict";function drawRaster(r,t,e,a){if("translucent"===r.renderPass){var i=r.gl,o=t.getSource(),n=r.useProgram("raster");i.enable(i.DEPTH_TEST),r.depthMask(!0),i.depthFunc(i.LESS),i.disable(i.STENCIL_TEST),i.uniform1f(n.uniforms.u_brightness_low,e.paint["raster-brightness-min"]),i.uniform1f(n.uniforms.u_brightness_high,e.paint["raster-brightness-max"]),i.uniform1f(n.uniforms.u_saturation_factor,saturationFactor(e.paint["raster-saturation"])),i.uniform1f(n.uniforms.u_contrast_factor,contrastFactor(e.paint["raster-contrast"])),i.uniform3fv(n.uniforms.u_spin_weights,spinWeights(e.paint["raster-hue-rotate"])),i.uniform1f(n.uniforms.u_buffer_scale,1),i.uniform1i(n.uniforms.u_image0,0),i.uniform1i(n.uniforms.u_image1,1);for(var u=a.length&&a[0].z,s=0,f=a;s<f.length;s+=1){var m=f[s];r.setDepthSublayer(m.z-u);var d=t.getTile(m),c=r.transform.calculatePosMatrix(m,t.getSource().maxzoom);d.registerFadeDuration(r.style.animationLoop,e.paint["raster-fade-duration"]),i.uniformMatrix4fv(n.uniforms.u_matrix,!1,c);var p=t.findLoadedParent(m,0,{}),_=getFadeValues(d,p,t,e,r.transform),h=void 0,l=void 0;if(i.activeTexture(i.TEXTURE0),i.bindTexture(i.TEXTURE_2D,d.texture),i.activeTexture(i.TEXTURE1),p?(i.bindTexture(i.TEXTURE_2D,p.texture),h=Math.pow(2,p.coord.z-d.coord.z),l=[d.coord.x*h%1,d.coord.y*h%1]):i.bindTexture(i.TEXTURE_2D,d.texture),i.uniform2fv(n.uniforms.u_tl_parent,l||[0,0]),i.uniform1f(n.uniforms.u_scale_parent,h||1),i.uniform1f(n.uniforms.u_fade_t,_.mix),i.uniform1f(n.uniforms.u_opacity,_.opacity*e.paint["raster-opacity"]),o instanceof ImageSource){var g=o.boundsBuffer;o.boundsVAO.bind(i,n,g),i.drawArrays(i.TRIANGLE_STRIP,0,g.length)}else{var T=r.rasterBoundsBuffer;r.rasterBoundsVAO.bind(i,n,T),i.drawArrays(i.TRIANGLE_STRIP,0,T.length)}}i.depthFunc(i.LEQUAL)}}function spinWeights(r){r*=Math.PI/180;var t=Math.sin(r),e=Math.cos(r);return[(2*e+1)/3,(-Math.sqrt(3)*t-e+1)/3,(Math.sqrt(3)*t-e+1)/3]}function contrastFactor(r){return r>0?1/(1-r):1+r}function saturationFactor(r){return r>0?1-1/(1.001-r):-r}function getFadeValues(r,t,e,a,i){var o=a.paint["raster-fade-duration"];if(o>0){var n=Date.now(),u=(n-r.timeAdded)/o,s=t?(n-t.timeAdded)/o:-1,f=e.getSource(),m=i.coveringZoomLevel({tileSize:f.tileSize,roundZoom:f.roundZoom}),d=!t||Math.abs(t.coord.z-m)>Math.abs(r.coord.z-m),c=d&&r.refreshedUponExpiration?1:util.clamp(d?u:1-s,0,1);return r.refreshedUponExpiration&&u>=1&&(r.refreshedUponExpiration=!1),t?{opacity:1,mix:1-c}:{opacity:c,mix:0}}return{opacity:1,mix:0}}var util=_dereq_("../util/util"),ImageSource=_dereq_("../source/image_source");module.exports=drawRaster;
},{"../source/image_source":91,"../util/util":223}],72:[function(_dereq_,module,exports){
"use strict";function drawSymbols(t,i,o,e){if("translucent"===t.renderPass){var a=!(o.layout["text-allow-overlap"]||o.layout["icon-allow-overlap"]||o.layout["text-ignore-placement"]||o.layout["icon-ignore-placement"]),r=t.gl;a?r.disable(r.STENCIL_TEST):r.enable(r.STENCIL_TEST),t.setDepthSublayer(0),t.depthMask(!1),drawLayerSymbols(t,i,o,e,!1,o.paint["icon-translate"],o.paint["icon-translate-anchor"],o.layout["icon-rotation-alignment"],o.layout["icon-pitch-alignment"],o.layout["icon-keep-upright"]),drawLayerSymbols(t,i,o,e,!0,o.paint["text-translate"],o.paint["text-translate-anchor"],o.layout["text-rotation-alignment"],o.layout["text-pitch-alignment"],o.layout["text-keep-upright"]),i.map.showCollisionBoxes&&drawCollisionDebug(t,i,o,e)}}function drawLayerSymbols(t,i,o,e,a,r,n,s,u,l){var m=t.gl,f=t.transform,c="map"===s,_="map"===u,y=c&&"line"===o.layout["symbol-placement"],p=c&&!_&&!y,x=_;x?m.enable(m.DEPTH_TEST):m.disable(m.DEPTH_TEST);for(var b,d=0,T=e;d<T.length;d+=1){var g=T[d],S=i.getTile(g),h=S.getBucket(o);if(h){var z=a?h.text:h.icon;if(z&&z.segments.get().length){var v=z.programConfigurations.get(o.id),E=a||h.sdfIcons,w=a?h.textSizeData:h.iconSizeData;if(b||(b=t.useProgram(E?"symbolSDF":"symbolIcon",v),v.setUniforms(m,b,o,{zoom:t.transform.zoom}),setSymbolDrawState(b,t,o,a,p,_,w)),m.activeTexture(m.TEXTURE0),m.uniform1i(b.uniforms.u_texture,0),a)S.glyphAtlasTexture.bind(m.LINEAR,m.CLAMP_TO_EDGE),m.uniform2fv(b.uniforms.u_texsize,S.glyphAtlasTexture.size);else{var M=!o.isLayoutValueFeatureConstant("icon-size")||!o.isLayoutValueZoomConstant("icon-size")||1!==o.getLayoutValue("icon-size",{zoom:f.zoom})||h.iconsNeedLinear,C=_||0!==f.pitch;S.iconAtlasTexture.bind(E||t.options.rotating||t.options.zooming||M||C?m.LINEAR:m.NEAREST,m.CLAMP_TO_EDGE),m.uniform2fv(b.uniforms.u_texsize,S.iconAtlasTexture.size)}t.enableTileClippingMask(g),m.uniformMatrix4fv(b.uniforms.u_matrix,!1,t.translatePosMatrix(g.posMatrix,S,r,n));var L=pixelsToTileUnits(S,1,t.transform.zoom),P=symbolProjection.getLabelPlaneMatrix(g.posMatrix,_,c,t.transform,L),D=symbolProjection.getGlCoordMatrix(g.posMatrix,_,c,t.transform,L);m.uniformMatrix4fv(b.uniforms.u_gl_coord_matrix,!1,t.translatePosMatrix(D,S,r,n,!0)),y?(m.uniformMatrix4fv(b.uniforms.u_label_plane_matrix,!1,identityMat4),symbolProjection.updateLineLabels(h,g.posMatrix,t,a,P,D,_,l,L,o)):m.uniformMatrix4fv(b.uniforms.u_label_plane_matrix,!1,P),m.uniform1f(b.uniforms.u_collision_y_stretch,S.collisionTile.yStretch),drawTileSymbols(b,v,t,o,S,z,a,E,_)}}}x||m.enable(m.DEPTH_TEST)}function setSymbolDrawState(t,i,o,e,a,r,n){var s=i.gl,u=i.transform;s.uniform1i(t.uniforms.u_pitch_with_map,r?1:0),s.uniform1f(t.uniforms.u_is_text,e?1:0),s.activeTexture(s.TEXTURE1),i.frameHistory.bind(s),s.uniform1i(t.uniforms.u_fadetexture,1),s.uniform1f(t.uniforms.u_pitch,u.pitch/360*2*Math.PI),s.uniform1i(t.uniforms.u_is_size_zoom_constant,n.isZoomConstant?1:0),s.uniform1i(t.uniforms.u_is_size_feature_constant,n.isFeatureConstant?1:0),s.uniform1f(t.uniforms.u_camera_to_center_distance,u.cameraToCenterDistance);var l=symbolSize.evaluateSizeForZoom(n,u,o,e);void 0!==l.uSizeT&&s.uniform1f(t.uniforms.u_size_t,l.uSizeT),void 0!==l.uSize&&s.uniform1f(t.uniforms.u_size,l.uSize),s.uniform1f(t.uniforms.u_aspect_ratio,u.width/u.height),s.uniform1i(t.uniforms.u_rotate_symbol,a?1:0)}function drawTileSymbols(t,i,o,e,a,r,n,s,u){var l=o.gl,m=o.transform;if(s){var f=(n?"text":"icon")+"-halo-width",c=!e.isPaintValueFeatureConstant(f)||e.paint[f],_=u?Math.cos(m._pitch)*m.cameraToCenterDistance:1;l.uniform1f(t.uniforms.u_gamma_scale,_),c&&(l.uniform1f(t.uniforms.u_is_halo,1),drawSymbolElements(r,e,l,t)),l.uniform1f(t.uniforms.u_is_halo,0)}drawSymbolElements(r,e,l,t)}function drawSymbolElements(t,i,o,e){e.draw(o,o.TRIANGLES,i.id,t.layoutVertexBuffer,t.indexBuffer,t.segments,t.programConfigurations.get(i.id),t.dynamicLayoutVertexBuffer)}var drawCollisionDebug=_dereq_("./draw_collision_debug"),pixelsToTileUnits=_dereq_("../source/pixels_to_tile_units"),symbolProjection=_dereq_("../symbol/projection"),symbolSize=_dereq_("../symbol/symbol_size"),mat4=_dereq_("@mapbox/gl-matrix").mat4,identityMat4=mat4.identity(new Float32Array(16));module.exports=drawSymbols;
},{"../source/pixels_to_tile_units":93,"../symbol/projection":175,"../symbol/symbol_size":178,"./draw_collision_debug":66,"@mapbox/gl-matrix":1}],73:[function(_dereq_,module,exports){
"use strict";var FrameHistory=function(){this.changeTimes=new Float64Array(256),this.changeOpacities=new Uint8Array(256),this.opacities=new Uint8ClampedArray(256),this.array=new Uint8Array(this.opacities.buffer),this.previousZoom=0,this.firstFrame=!0};FrameHistory.prototype.record=function(e,t,i){var r=this;this.firstFrame&&(e=0,this.firstFrame=!1),t=Math.floor(10*t);var a;if(t<this.previousZoom)for(a=t+1;a<=this.previousZoom;a++)r.changeTimes[a]=e,r.changeOpacities[a]=r.opacities[a];else for(a=t;a>this.previousZoom;a--)r.changeTimes[a]=e,r.changeOpacities[a]=r.opacities[a];for(a=0;a<256;a++){var s=e-r.changeTimes[a],o=255*(i?s/i:1);r.opacities[a]=a<=t?r.changeOpacities[a]+o:r.changeOpacities[a]-o}this.changed=!0,this.previousZoom=t},FrameHistory.prototype.isVisible=function(e){return 0!==this.opacities[Math.floor(10*e)]},FrameHistory.prototype.bind=function(e){this.texture?(e.bindTexture(e.TEXTURE_2D,this.texture),this.changed&&(e.texSubImage2D(e.TEXTURE_2D,0,0,0,256,1,e.ALPHA,e.UNSIGNED_BYTE,this.array),this.changed=!1)):(this.texture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.texture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.NEAREST),e.texImage2D(e.TEXTURE_2D,0,e.ALPHA,256,1,0,e.ALPHA,e.UNSIGNED_BYTE,this.array))},module.exports=FrameHistory;
},{}],74:[function(_dereq_,module,exports){
"use strict";function makeGlyphAtlas(a){var e=AlphaImage.create({width:0,height:0}),i={},t=new ShelfPack(0,0,{autoResize:!0});for(var h in a){var p=a[h],r=i[h]={};for(var m in p){var g=p[+m];if(g&&0!==g.bitmap.width&&0!==g.bitmap.height){var l=t.packOne(g.bitmap.width+2*padding,g.bitmap.height+2*padding);AlphaImage.resize(e,{width:t.w,height:t.h}),AlphaImage.copy(g.bitmap,e,{x:0,y:0},{x:l.x+padding,y:l.y+padding},g.bitmap),r[m]={rect:l,metrics:g.metrics}}}}return t.shrink(),AlphaImage.resize(e,{width:t.w,height:t.h}),{image:e,positions:i}}var ShelfPack=_dereq_("@mapbox/shelf-pack"),ref=_dereq_("../util/image"),AlphaImage=ref.AlphaImage,padding=1;module.exports={makeGlyphAtlas:makeGlyphAtlas};
},{"../util/image":213,"@mapbox/shelf-pack":3}],75:[function(_dereq_,module,exports){
"use strict";var loadGlyphRange=_dereq_("../style/load_glyph_range"),TinySDF=_dereq_("@mapbox/tiny-sdf"),isChar=_dereq_("../util/is_char_in_unicode_block"),ref=_dereq_("../util/util"),asyncAll=ref.asyncAll,ref$1=_dereq_("../util/image"),AlphaImage=ref$1.AlphaImage,GlyphManager=function(r,e){this.requestTransform=r,this.localIdeographFontFamily=e,this.entries={}};GlyphManager.prototype.setURL=function(r){this.url=r},GlyphManager.prototype.getGlyphs=function(r,e){var t=this,i=[];for(var a in r)for(var l=0,n=r[a];l<n.length;l+=1){var s=n[l];i.push({stack:a,id:s})}asyncAll(i,function(r,e){var i=r.stack,a=r.id,l=t.entries[i];l||(l=t.entries[i]={glyphs:{},requests:{}});var n=l.glyphs[a];if(void 0!==n)return void e(null,{stack:i,id:a,glyph:n});if(n=t._tinySDF(l,i,a))return void e(null,{stack:i,id:a,glyph:n});var s=Math.floor(a/256);if(256*s>65535)return void e(new Error("glyphs > 65535 not supported"));var o=l.requests[s];o||(o=l.requests[s]=[],loadGlyphRange(i,s,t.url,t.requestTransform,function(r,e){if(e)for(var t in e)l.glyphs[+t]=e[+t];for(var i=0,a=o;i<a.length;i+=1){(0,a[i])(r,e)}delete l.requests[s]})),o.push(function(r,t){r?e(r):t&&e(null,{stack:i,id:a,glyph:t[a]||null})})},function(r,t){if(r)e(r);else if(t){for(var i={},a=0,l=t;a<l.length;a+=1){var n=l[a],s=n.stack,o=n.id,h=n.glyph;(i[s]||(i[s]={}))[o]=h}e(null,i)}})},GlyphManager.prototype._tinySDF=function(r,e,t){var i=this.localIdeographFontFamily;if(i&&(isChar["CJK Unified Ideographs"](t)||isChar["Hangul Syllables"](t))){var a=r.tinySDF;if(!a){var l="400";/bold/i.test(e)?l="900":/medium/i.test(e)?l="500":/light/i.test(e)&&(l="200"),a=r.tinySDF=new TinySDF(24,3,8,.25,i,l)}return{id:t,bitmap:AlphaImage.create({width:30,height:30},a.draw(String.fromCharCode(t))),metrics:{width:24,height:24,left:0,top:-8,advance:24}}}},module.exports=GlyphManager;
},{"../style/load_glyph_range":152,"../util/image":213,"../util/is_char_in_unicode_block":215,"../util/util":223,"@mapbox/tiny-sdf":4}],76:[function(_dereq_,module,exports){
"use strict";function imagePosition(a,e){var i=e.pixelRatio,t={x:a.x+padding,y:a.y+padding,w:a.w-2*padding,h:a.h-2*padding};return{pixelRatio:i,textureRect:t,tl:[t.x,t.y],br:[t.x+t.w,t.y+t.h],displaySize:[t.w/i,t.h/i]}}function makeImageAtlas(a){var e=RGBAImage.create({width:0,height:0}),i={},t=new ShelfPack(0,0,{autoResize:!0});for(var d in a){var g=a[d],n=t.packOne(g.data.width+2*padding,g.data.height+2*padding);RGBAImage.resize(e,{width:t.w,height:t.h}),RGBAImage.copy(g.data,e,{x:0,y:0},{x:n.x+padding,y:n.y+padding},g.data),i[d]=imagePosition(n,g)}return t.shrink(),RGBAImage.resize(e,{width:t.w,height:t.h}),{image:e,positions:i}}var ShelfPack=_dereq_("@mapbox/shelf-pack"),ref=_dereq_("../util/image"),RGBAImage=ref.RGBAImage,padding=1;module.exports={imagePosition:imagePosition,makeImageAtlas:makeImageAtlas};
},{"../util/image":213,"@mapbox/shelf-pack":3}],77:[function(_dereq_,module,exports){
"use strict";var ShelfPack=_dereq_("@mapbox/shelf-pack"),ref=_dereq_("../util/image"),RGBAImage=ref.RGBAImage,ref$1=_dereq_("./image_atlas"),imagePosition=ref$1.imagePosition,Texture=_dereq_("./texture"),padding=1,ImageManager=function(){this.images={},this.loaded=!1,this.requestors=[],this.shelfPack=new ShelfPack(64,64,{autoResize:!0}),this.patterns={},this.atlasImage=RGBAImage.create({width:64,height:64}),this.dirty=!0};ImageManager.prototype.isLoaded=function(){return this.loaded},ImageManager.prototype.setLoaded=function(e){var t=this;if(this.loaded!==e&&(this.loaded=e,e)){for(var a=0,i=t.requestors;a<i.length;a+=1){var r=i[a],s=r.ids,h=r.callback;t._notify(s,h)}this.requestors=[]}},ImageManager.prototype.getImage=function(e){return this.images[e]},ImageManager.prototype.addImage=function(e,t){this.images[e]=t},ImageManager.prototype.removeImage=function(e){delete this.images[e];var t=this.patterns[e];t&&(this.shelfPack.unref(t.bin),delete this.patterns[e])},ImageManager.prototype.getImages=function(e,t){var a=this,i=!0;if(!this.isLoaded())for(var r=0,s=e;r<s.length;r+=1){var h=s[r];a.images[h]||(i=!1)}this.isLoaded()||i?this._notify(e,t):this.requestors.push({ids:e,callback:t})},ImageManager.prototype._notify=function(e,t){for(var a=this,i={},r=0,s=e;r<s.length;r+=1){var h=s[r],g=a.images[h];g&&(i[h]=g)}t(null,i)},ImageManager.prototype.getPixelSize=function(){return{width:this.shelfPack.w,height:this.shelfPack.h}},ImageManager.prototype.getPattern=function(e){var t=this.patterns[e];if(t)return t.position;var a=this.getImage(e);if(!a)return null;var i=a.data.width+2*padding,r=a.data.height+2*padding,s=this.shelfPack.packOne(i,r);if(!s)return null;RGBAImage.resize(this.atlasImage,this.getPixelSize());var h=a.data,g=this.atlasImage,n=s.x+padding,o=s.y+padding,d=h.width,m=h.height;RGBAImage.copy(h,g,{x:0,y:0},{x:n,y:o},{width:d,height:m}),RGBAImage.copy(h,g,{x:0,y:m-1},{x:n,y:o-1},{width:d,height:1}),RGBAImage.copy(h,g,{x:0,y:0},{x:n,y:o+m},{width:d,height:1}),RGBAImage.copy(h,g,{x:d-1,y:0},{x:n-1,y:o},{width:1,height:m}),RGBAImage.copy(h,g,{x:0,y:0},{x:n+d,y:o},{width:1,height:m}),this.dirty=!0;var p=imagePosition(s,a);return this.patterns[e]={bin:s,position:p},p},ImageManager.prototype.bind=function(e){this.atlasTexture?this.dirty&&(this.atlasTexture.update(this.atlasImage),this.dirty=!1):this.atlasTexture=new Texture(e,this.atlasImage,e.RGBA),this.atlasTexture.bind(e.LINEAR,e.CLAMP_TO_EDGE)},module.exports=ImageManager;
},{"../util/image":213,"./image_atlas":76,"./texture":83,"@mapbox/shelf-pack":3}],78:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),LineAtlas=function(t,i){this.width=t,this.height=i,this.nextRow=0,this.bytes=4,this.data=new Uint8Array(this.width*this.height*this.bytes),this.positions={}};LineAtlas.prototype.getDash=function(t,i){var e=t.join(",")+String(i);return this.positions[e]||(this.positions[e]=this.addDash(t,i)),this.positions[e]},LineAtlas.prototype.addDash=function(t,i){var e=this,h=i?7:0,s=2*h+1;if(this.nextRow+s>this.height)return util.warnOnce("LineAtlas out of space"),null;for(var a=0,r=0;r<t.length;r++)a+=t[r];for(var n=this.width/a,E=n/2,T=t.length%2==1,o=-h;o<=h;o++)for(var R=e.nextRow+h+o,d=e.width*R,u=T?-t[t.length-1]:0,x=t[0],l=1,_=0;_<this.width;_++){for(;x<_/n;)u=x,x+=t[l],T&&l===t.length-1&&(x+=t[0]),l++;var A=Math.abs(_-u*n),g=Math.abs(_-x*n),w=Math.min(A,g),D=l%2==1,U=void 0;if(i){var f=h?o/h*(E+1):0;if(D){var p=E-Math.abs(f);U=Math.sqrt(w*w+p*p)}else U=E-Math.sqrt(w*w+f*f)}else U=(D?1:-1)*w;e.data[3+4*(d+_)]=Math.max(0,Math.min(255,U+128))}var X={y:(this.nextRow+h+.5)/this.height,height:2*h/this.height,width:a};return this.nextRow+=s,this.dirty=!0,X},LineAtlas.prototype.bind=function(t){this.texture?(t.bindTexture(t.TEXTURE_2D,this.texture),this.dirty&&(this.dirty=!1,t.texSubImage2D(t.TEXTURE_2D,0,0,0,this.width,this.height,t.RGBA,t.UNSIGNED_BYTE,this.data))):(this.texture=t.createTexture(),t.bindTexture(t.TEXTURE_2D,this.texture),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.REPEAT),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MAG_FILTER,t.LINEAR),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,this.width,this.height,0,t.RGBA,t.UNSIGNED_BYTE,this.data))},module.exports=LineAtlas;
},{"../util/util":223}],79:[function(_dereq_,module,exports){
"use strict";var browser=_dereq_("../util/browser"),mat4=_dereq_("@mapbox/gl-matrix").mat4,FrameHistory=_dereq_("./frame_history"),SourceCache=_dereq_("../source/source_cache"),EXTENT=_dereq_("../data/extent"),pixelsToTileUnits=_dereq_("../source/pixels_to_tile_units"),util=_dereq_("../util/util"),VertexBuffer=_dereq_("../gl/vertex_buffer"),VertexArrayObject=_dereq_("./vertex_array_object"),RasterBoundsArray=_dereq_("../data/raster_bounds_array"),PosArray=_dereq_("../data/pos_array"),ref=_dereq_("../data/program_configuration"),ProgramConfiguration=ref.ProgramConfiguration,shaders=_dereq_("../shaders"),Program=_dereq_("./program"),RenderTexture=_dereq_("./render_texture"),draw={symbol:_dereq_("./draw_symbol"),circle:_dereq_("./draw_circle"),line:_dereq_("./draw_line"),fill:_dereq_("./draw_fill"),"fill-extrusion":_dereq_("./draw_fill_extrusion"),raster:_dereq_("./draw_raster"),background:_dereq_("./draw_background"),debug:_dereq_("./draw_debug")},Painter=function(e,r){this.gl=e,this.transform=r,this._tileTextures={},this.prerenderedFrames={},this.viewportFrames=[],this.frameHistory=new FrameHistory,this.setup(),this.numSublayers=SourceCache.maxUnderzooming+SourceCache.maxOverzooming+1,this.depthEpsilon=1/Math.pow(2,16),this.lineWidthRange=e.getParameter(e.ALIASED_LINE_WIDTH_RANGE),this.basicFillProgramConfiguration=ProgramConfiguration.createBasicFill(),this.emptyProgramConfiguration=new ProgramConfiguration};Painter.prototype.resize=function(e,r){var t=this,i=this.gl;this.width=e*browser.devicePixelRatio,this.height=r*browser.devicePixelRatio,i.viewport(0,0,this.width,this.height);for(var a=0,s=t.viewportFrames;a<s.length;a+=1){var n=s[a];t.gl.deleteTexture(n.texture),t.gl.deleteFramebuffer(n.fbo)}this.viewportFrames=[],this.depthRbo&&(this.gl.deleteRenderbuffer(this.depthRbo),this.depthRbo=null)},Painter.prototype.setup=function(){var e=this.gl;e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.enable(e.STENCIL_TEST),e.enable(e.DEPTH_TEST),e.depthFunc(e.LEQUAL),this._depthMask=!1,e.depthMask(!1);var r=new PosArray;r.emplaceBack(0,0),r.emplaceBack(EXTENT,0),r.emplaceBack(0,EXTENT),r.emplaceBack(EXTENT,EXTENT),this.tileExtentBuffer=new VertexBuffer(e,r),this.tileExtentVAO=new VertexArrayObject,this.tileExtentPatternVAO=new VertexArrayObject;var t=new PosArray;t.emplaceBack(0,0),t.emplaceBack(EXTENT,0),t.emplaceBack(EXTENT,EXTENT),t.emplaceBack(0,EXTENT),t.emplaceBack(0,0),this.debugBuffer=new VertexBuffer(e,t),this.debugVAO=new VertexArrayObject;var i=new RasterBoundsArray;i.emplaceBack(0,0,0,0),i.emplaceBack(EXTENT,0,EXTENT,0),i.emplaceBack(0,EXTENT,0,EXTENT),i.emplaceBack(EXTENT,EXTENT,EXTENT,EXTENT),this.rasterBoundsBuffer=new VertexBuffer(e,i),this.rasterBoundsVAO=new VertexArrayObject,this.extTextureFilterAnisotropic=e.getExtension("EXT_texture_filter_anisotropic")||e.getExtension("MOZ_EXT_texture_filter_anisotropic")||e.getExtension("WEBKIT_EXT_texture_filter_anisotropic"),this.extTextureFilterAnisotropic&&(this.extTextureFilterAnisotropicMax=e.getParameter(this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT))},Painter.prototype.clearColor=function(){var e=this.gl;e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT)},Painter.prototype.clearStencil=function(){var e=this.gl;e.clearStencil(0),e.stencilMask(255),e.clear(e.STENCIL_BUFFER_BIT)},Painter.prototype.clearDepth=function(){var e=this.gl;e.clearDepth(1),this.depthMask(!0),e.clear(e.DEPTH_BUFFER_BIT)},Painter.prototype._renderTileClippingMasks=function(e){var r=this,t=this.gl;t.colorMask(!1,!1,!1,!1),this.depthMask(!1),t.disable(t.DEPTH_TEST),t.enable(t.STENCIL_TEST),t.stencilMask(255),t.stencilOp(t.KEEP,t.KEEP,t.REPLACE);var i=1;this._tileClippingMaskIDs={};for(var a=0,s=e;a<s.length;a+=1){var n=s[a],o=r._tileClippingMaskIDs[n.id]=i++;t.stencilFunc(t.ALWAYS,o,255);var l=r.useProgram("fill",r.basicFillProgramConfiguration);t.uniformMatrix4fv(l.uniforms.u_matrix,!1,n.posMatrix),r.tileExtentVAO.bind(t,l,r.tileExtentBuffer),t.drawArrays(t.TRIANGLE_STRIP,0,r.tileExtentBuffer.length)}t.stencilMask(0),t.colorMask(!0,!0,!0,!0),this.depthMask(!0),t.enable(t.DEPTH_TEST)},Painter.prototype.enableTileClippingMask=function(e){var r=this.gl;r.stencilFunc(r.EQUAL,this._tileClippingMaskIDs[e.id],255)},Painter.prototype.render=function(e,r){var t=this;this.style=e,this.options=r,this.lineAtlas=e.lineAtlas,this.imageManager=e.imageManager,this.glyphManager=e.glyphManager,this.frameHistory.record(Date.now(),this.transform.zoom,e.getTransition().duration);for(var i in t.style.sourceCaches){var a=t.style.sourceCaches[i];a.used&&a.prepare(t.gl)}var s=this.style._order;this.renderPass="3d";for(var n,o=!0,l=[],h=0;h<s.length;h++){var c=t.style._layers[s[h]];if(c.has3DPass()&&!c.isHidden(t.transform.zoom)&&(c.source!==(n&&n.id)&&(n=t.style.sourceCaches[c.source],l=[],n&&(t.clearStencil(),l=n.getVisibleCoordinates()),l.reverse()),l.length)){t._setup3DRenderbuffer();var u=t.viewportFrames.pop()||new RenderTexture(t);u.bindWithDepth(t.depthRbo),o&&(t.clearDepth(),o=!1),t.renderLayer(t,n,c,l),u.unbind(),t.prerenderedFrames[c.id]=u}}this.clearColor(),this.clearDepth(),this.showOverdrawInspector(r.showOverdrawInspector),this.depthRange=(e._order.length+2)*this.numSublayers*this.depthEpsilon,this.renderPass="opaque";var p,d=[];for(this.currentLayer=s.length-1,this._showOverdrawInspector||this.gl.disable(this.gl.BLEND),this.currentLayer;this.currentLayer>=0;this.currentLayer--){var g=t.style._layers[s[t.currentLayer]];g.source!==(p&&p.id)&&(p=t.style.sourceCaches[g.source],d=[],p&&(t.clearStencil(),d=p.getVisibleCoordinates(),p.getSource().isTileClipped&&t._renderTileClippingMasks(d))),t.renderLayer(t,p,g,d)}this.renderPass="translucent";var f,E=[];for(this.gl.enable(this.gl.BLEND),this.currentLayer=0,this.currentLayer;this.currentLayer<s.length;this.currentLayer++){var T=t.style._layers[s[t.currentLayer]];T.source!==(f&&f.id)&&(f=t.style.sourceCaches[T.source],E=[],f&&(t.clearStencil(),E=f.getVisibleCoordinates(),f.getSource().isTileClipped&&t._renderTileClippingMasks(E)),E.reverse()),t.renderLayer(t,f,T,E)}if(this.options.showTileBoundaries){var _=this.style.sourceCaches[Object.keys(this.style.sourceCaches)[0]];_&&draw.debug(this,_,_.getVisibleCoordinates())}},Painter.prototype._setup3DRenderbuffer=function(){if(!this.depthRbo){var e=this.gl;this.depthRbo=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,this.depthRbo),e.renderbufferStorage(e.RENDERBUFFER,e.DEPTH_COMPONENT16,this.width,this.height),e.bindRenderbuffer(e.RENDERBUFFER,null)}this.depthRboAttached=!0},Painter.prototype.depthMask=function(e){e!==this._depthMask&&(this._depthMask=e,this.gl.depthMask(e))},Painter.prototype.renderLayer=function(e,r,t,i){t.isHidden(this.transform.zoom)||("background"===t.type||i.length)&&(this.id=t.id,draw[t.type](e,r,t,i))},Painter.prototype.setDepthSublayer=function(e){var r=1-((1+this.currentLayer)*this.numSublayers+e)*this.depthEpsilon,t=r-1+this.depthRange;this.gl.depthRange(t,r)},Painter.prototype.translatePosMatrix=function(e,r,t,i,a){if(!t[0]&&!t[1])return e;var s=a?"map"===i?this.transform.angle:0:"viewport"===i?-this.transform.angle:0;if(s){var n=Math.sin(s),o=Math.cos(s);t=[t[0]*o-t[1]*n,t[0]*n+t[1]*o]}var l=[a?t[0]:pixelsToTileUnits(r,t[0],this.transform.zoom),a?t[1]:pixelsToTileUnits(r,t[1],this.transform.zoom),0],h=new Float32Array(16);return mat4.translate(h,e,l),h},Painter.prototype.saveTileTexture=function(e){var r=this._tileTextures[e.size];r?r.push(e):this._tileTextures[e.size]=[e]},Painter.prototype.getTileTexture=function(e){var r=this._tileTextures[e];return r&&r.length>0?r.pop():null},Painter.prototype.lineWidth=function(e){this.gl.lineWidth(util.clamp(e,this.lineWidthRange[0],this.lineWidthRange[1]))},Painter.prototype.showOverdrawInspector=function(e){if(e||this._showOverdrawInspector){this._showOverdrawInspector=e;var r=this.gl;if(e){r.blendFunc(r.CONSTANT_COLOR,r.ONE);r.blendColor(1/8,1/8,1/8,0),r.clearColor(0,0,0,1),r.clear(r.COLOR_BUFFER_BIT)}else r.blendFunc(r.ONE,r.ONE_MINUS_SRC_ALPHA)}},Painter.prototype._createProgramCached=function(e,r){this.cache=this.cache||{};var t=""+e+(r.cacheKey||"")+(this._showOverdrawInspector?"/overdraw":"");return this.cache[t]||(this.cache[t]=new Program(this.gl,shaders[e],r,this._showOverdrawInspector)),this.cache[t]},Painter.prototype.useProgram=function(e,r){var t=this.gl,i=this._createProgramCached(e,r||this.emptyProgramConfiguration);return this.currentProgram!==i&&(t.useProgram(i.program),this.currentProgram=i),i},module.exports=Painter;
},{"../data/extent":48,"../data/pos_array":52,"../data/program_configuration":53,"../data/raster_bounds_array":54,"../gl/vertex_buffer":62,"../shaders":86,"../source/pixels_to_tile_units":93,"../source/source_cache":98,"../util/browser":202,"../util/util":223,"./draw_background":64,"./draw_circle":65,"./draw_debug":67,"./draw_fill":68,"./draw_fill_extrusion":69,"./draw_line":70,"./draw_raster":71,"./draw_symbol":72,"./frame_history":73,"./program":81,"./render_texture":82,"./vertex_array_object":84,"@mapbox/gl-matrix":1}],80:[function(_dereq_,module,exports){
"use strict";var pixelsToTileUnits=_dereq_("../source/pixels_to_tile_units");exports.isPatternMissing=function(r,i){if(!r)return!1;var e=i.imageManager.getPattern(r.from),o=i.imageManager.getPattern(r.to);return!e||!o},exports.prepare=function(r,i,e){var o=i.gl,t=i.imageManager.getPattern(r.from),n=i.imageManager.getPattern(r.to);o.uniform1i(e.uniforms.u_image,0),o.uniform2fv(e.uniforms.u_pattern_tl_a,t.tl),o.uniform2fv(e.uniforms.u_pattern_br_a,t.br),o.uniform2fv(e.uniforms.u_pattern_tl_b,n.tl),o.uniform2fv(e.uniforms.u_pattern_br_b,n.br);var u=i.imageManager.getPixelSize(),a=u.width,f=u.height;o.uniform2fv(e.uniforms.u_texsize,[a,f]),o.uniform1f(e.uniforms.u_mix,r.t),o.uniform2fv(e.uniforms.u_pattern_size_a,t.displaySize),o.uniform2fv(e.uniforms.u_pattern_size_b,n.displaySize),o.uniform1f(e.uniforms.u_scale_a,r.fromScale),o.uniform1f(e.uniforms.u_scale_b,r.toScale),o.activeTexture(o.TEXTURE0),i.imageManager.bind(o)},exports.setTile=function(r,i,e){var o=i.gl;o.uniform1f(e.uniforms.u_tile_units_to_pixels,1/pixelsToTileUnits(r,1,i.transform.tileZoom));var t=Math.pow(2,r.coord.z),n=r.tileSize*Math.pow(2,i.transform.tileZoom)/t,u=n*(r.coord.x+r.coord.w*t),a=n*r.coord.y;o.uniform2f(e.uniforms.u_pixel_coord_upper,u>>16,a>>16),o.uniform2f(e.uniforms.u_pixel_coord_lower,65535&u,65535&a)};
},{"../source/pixels_to_tile_units":93}],81:[function(_dereq_,module,exports){
"use strict";var browser=_dereq_("../util/browser"),shaders=_dereq_("../shaders"),ref=_dereq_("../data/program_configuration"),ProgramConfiguration=ref.ProgramConfiguration,VertexArrayObject=_dereq_("./vertex_array_object"),Program=function(r,e,t,a){var o=this;this.gl=r,this.program=r.createProgram();var i=t.defines().concat("#define DEVICE_PIXEL_RATIO "+browser.devicePixelRatio.toFixed(1));a&&i.push("#define OVERDRAW_INSPECTOR;");var n=i.concat(shaders.prelude.fragmentSource,e.fragmentSource).join("\n"),s=i.concat(shaders.prelude.vertexSource,e.vertexSource).join("\n"),m=r.createShader(r.FRAGMENT_SHADER);r.shaderSource(m,n),r.compileShader(m),r.attachShader(this.program,m);var g=r.createShader(r.VERTEX_SHADER);r.shaderSource(g,s),r.compileShader(g),r.attachShader(this.program,g);for(var c=t.interface?t.interface.layoutAttributes:[],u=0;u<c.length;u++)r.bindAttribLocation(o.program,u,c[u].name);r.linkProgram(this.program),this.numAttributes=r.getProgramParameter(this.program,r.ACTIVE_ATTRIBUTES),this.attributes={},this.uniforms={};for(var h=0;h<this.numAttributes;h++){var f=r.getActiveAttrib(o.program,h);f&&(o.attributes[f.name]=r.getAttribLocation(o.program,f.name))}for(var d=r.getProgramParameter(this.program,r.ACTIVE_UNIFORMS),p=0;p<d;p++){var v=r.getActiveUniform(o.program,p);v&&(o.uniforms[v.name]=r.getUniformLocation(o.program,v.name))}};Program.prototype.draw=function(r,e,t,a,o,i,n,s){for(var m,g=this,c=(m={},m[r.LINES]=2,m[r.TRIANGLES]=3,m)[e],u=0,h=i.get();u<h.length;u+=1){var f=h[u],d=f.vaos||(f.vaos={});(d[t]||(d[t]=new VertexArrayObject)).bind(r,g,a,o,n&&n.paintVertexBuffer,f.vertexOffset,s),r.drawElements(e,f.primitiveLength*c,r.UNSIGNED_SHORT,f.primitiveOffset*c*2)}},module.exports=Program;
},{"../data/program_configuration":53,"../shaders":86,"../util/browser":202,"./vertex_array_object":84}],82:[function(_dereq_,module,exports){
"use strict";var VertexBuffer=_dereq_("../gl/vertex_buffer"),VertexArrayObject=_dereq_("./vertex_array_object"),PosArray=_dereq_("../data/pos_array"),RenderTexture=function(e){var r=this.gl=e.gl,t=this.texture=r.createTexture();r.bindTexture(r.TEXTURE_2D,t),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,r.CLAMP_TO_EDGE),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,r.LINEAR),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,r.LINEAR),r.texImage2D(r.TEXTURE_2D,0,r.RGBA,e.width,e.height,0,r.RGBA,r.UNSIGNED_BYTE,null),r.bindTexture(r.TEXTURE_2D,null);var E=this.fbo=r.createFramebuffer();r.bindFramebuffer(r.FRAMEBUFFER,E),r.framebufferTexture2D(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,t,0);var a=new PosArray;a.emplaceBack(0,0),a.emplaceBack(1,0),a.emplaceBack(0,1),a.emplaceBack(1,1),this.buffer=new VertexBuffer(r,a),this.vao=new VertexArrayObject};RenderTexture.prototype.bindWithDepth=function(e){var r=this.gl;r.bindFramebuffer(r.FRAMEBUFFER,this.fbo),this.attachedRbo!==e&&(r.framebufferRenderbuffer(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.RENDERBUFFER,e),this.attachedRbo=e)},RenderTexture.prototype.unbind=function(){var e=this.gl;e.bindFramebuffer(e.FRAMEBUFFER,null)},module.exports=RenderTexture;
},{"../data/pos_array":52,"../gl/vertex_buffer":62,"./vertex_array_object":84}],83:[function(_dereq_,module,exports){
"use strict";var Texture=function(t,e,i){this.gl=t;var r=e.width,T=e.height;this.size=[r,T],this.format=i,this.texture=t.createTexture(),this.update(e)};Texture.prototype.update=function(t){var e=t.width,i=t.height,r=t.data;this.size=[e,i];var T=this,E=T.gl;E.bindTexture(E.TEXTURE_2D,this.texture),E.pixelStorei(E.UNPACK_ALIGNMENT,1),this.format===E.RGBA&&E.pixelStorei(E.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),E.texImage2D(E.TEXTURE_2D,0,this.format,e,i,0,this.format,E.UNSIGNED_BYTE,r)},Texture.prototype.bind=function(t,e){var i=this,r=i.gl;r.bindTexture(r.TEXTURE_2D,this.texture),t!==this.filter&&(r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MAG_FILTER,t),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_MIN_FILTER,t),this.filter=t),e!==this.wrap&&(r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_S,e),r.texParameteri(r.TEXTURE_2D,r.TEXTURE_WRAP_T,e),this.wrap=e)},Texture.prototype.destroy=function(){this.gl.deleteTexture(this.texture),this.texture=null},module.exports=Texture;
},{}],84:[function(_dereq_,module,exports){
"use strict";var VertexArrayObject=function(){this.boundProgram=null,this.boundVertexBuffer=null,this.boundVertexBuffer2=null,this.boundIndexBuffer=null,this.boundVertexOffset=null,this.boundDynamicVertexBuffer=null,this.vao=null};VertexArrayObject.prototype.bind=function(e,t,r,i,n,s,u){void 0===e.extVertexArrayObject&&(e.extVertexArrayObject=e.getExtension("OES_vertex_array_object"));var b=!this.vao||this.boundProgram!==t||this.boundVertexBuffer!==r||this.boundVertexBuffer2!==n||this.boundIndexBuffer!==i||this.boundVertexOffset!==s||this.boundDynamicVertexBuffer!==u;!e.extVertexArrayObject||b?(this.freshBind(e,t,r,i,n,s,u),this.gl=e):(e.extVertexArrayObject.bindVertexArrayOES(this.vao),u&&u.bind())},VertexArrayObject.prototype.freshBind=function(e,t,r,i,n,s,u){var b,o=t.numAttributes;if(e.extVertexArrayObject)this.vao&&this.destroy(),this.vao=e.extVertexArrayObject.createVertexArrayOES(),e.extVertexArrayObject.bindVertexArrayOES(this.vao),b=0,this.boundProgram=t,this.boundVertexBuffer=r,this.boundVertexBuffer2=n,this.boundIndexBuffer=i,this.boundVertexOffset=s,this.boundDynamicVertexBuffer=u;else{b=e.currentNumAttributes||0;for(var x=o;x<b;x++)e.disableVertexAttribArray(x)}r.enableAttributes(e,t),n&&n.enableAttributes(e,t),u&&u.enableAttributes(e,t),r.bind(),r.setVertexAttribPointers(e,t,s),n&&(n.bind(),n.setVertexAttribPointers(e,t,s)),u&&(u.bind(),u.setVertexAttribPointers(e,t,s)),i&&i.bind(),e.currentNumAttributes=o},VertexArrayObject.prototype.destroy=function(){this.vao&&(this.gl.extVertexArrayObject.deleteVertexArrayOES(this.vao),this.vao=null)},module.exports=VertexArrayObject;
},{}],85:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util");exports.packUint8ToFloat=function(t,l){return t=util.clamp(Math.floor(t),0,255),l=util.clamp(Math.floor(l),0,255),256*t+l};
},{"../util/util":223}],86:[function(_dereq_,module,exports){
"use strict";var shaders={prelude:{fragmentSource:"#ifdef GL_ES\nprecision mediump float;\n#else\n\n#if !defined(lowp)\n#define lowp\n#endif\n\n#if !defined(mediump)\n#define mediump\n#endif\n\n#if !defined(highp)\n#define highp\n#endif\n\n#endif\n",vertexSource:"#ifdef GL_ES\nprecision highp float;\n#else\n\n#if !defined(lowp)\n#define lowp\n#endif\n\n#if !defined(mediump)\n#define mediump\n#endif\n\n#if !defined(highp)\n#define highp\n#endif\n\n#endif\n\n// Unpack a pair of values that have been packed into a single float.\n// The packed values are assumed to be 8-bit unsigned integers, and are\n// packed like so:\n// packedValue = floor(input[0]) * 256 + input[1],\nvec2 unpack_float(const float packedValue) {\n    int packedIntValue = int(packedValue);\n    int v0 = packedIntValue / 256;\n    return vec2(v0, packedIntValue - v0 * 256);\n}\n\n\n// To minimize the number of attributes needed, we encode a 4-component\n// color into a pair of floats (i.e. a vec2) as follows:\n// [ floor(color.r * 255) * 256 + color.g * 255,\n//   floor(color.b * 255) * 256 + color.g * 255 ]\nvec4 decode_color(const vec2 encodedColor) {\n    return vec4(\n        unpack_float(encodedColor[0]) / 255.0,\n        unpack_float(encodedColor[1]) / 255.0\n    );\n}\n\n// Unpack a pair of paint values and interpolate between them.\nfloat unpack_mix_vec2(const vec2 packedValue, const float t) {\n    return mix(packedValue[0], packedValue[1], t);\n}\n\n// Unpack a pair of paint values and interpolate between them.\nvec4 unpack_mix_vec4(const vec4 packedColors, const float t) {\n    vec4 minColor = decode_color(vec2(packedColors[0], packedColors[1]));\n    vec4 maxColor = decode_color(vec2(packedColors[2], packedColors[3]));\n    return mix(minColor, maxColor, t);\n}\n\n// The offset depends on how many pixels are between the world origin and the edge of the tile:\n// vec2 offset = mod(pixel_coord, size)\n//\n// At high zoom levels there are a ton of pixels between the world origin and the edge of the tile.\n// The glsl spec only guarantees 16 bits of precision for highp floats. We need more than that.\n//\n// The pixel_coord is passed in as two 16 bit values:\n// pixel_coord_upper = floor(pixel_coord / 2^16)\n// pixel_coord_lower = mod(pixel_coord, 2^16)\n//\n// The offset is calculated in a series of steps that should preserve this precision:\nvec2 get_pattern_pos(const vec2 pixel_coord_upper, const vec2 pixel_coord_lower,\n    const vec2 pattern_size, const float tile_units_to_pixels, const vec2 pos) {\n\n    vec2 offset = mod(mod(mod(pixel_coord_upper, pattern_size) * 256.0, pattern_size) * 256.0 + pixel_coord_lower, pattern_size);\n    return (tile_units_to_pixels * pos + offset) / pattern_size;\n}\n"},circle:{fragmentSource:"#pragma mapbox: define highp vec4 color\n#pragma mapbox: define mediump float radius\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define highp vec4 stroke_color\n#pragma mapbox: define mediump float stroke_width\n#pragma mapbox: define lowp float stroke_opacity\n\nvarying vec3 v_data;\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize mediump float radius\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize highp vec4 stroke_color\n    #pragma mapbox: initialize mediump float stroke_width\n    #pragma mapbox: initialize lowp float stroke_opacity\n\n    vec2 extrude = v_data.xy;\n    float extrude_length = length(extrude);\n\n    lowp float antialiasblur = v_data.z;\n    float antialiased_blur = -max(blur, antialiasblur);\n\n    float opacity_t = smoothstep(0.0, antialiased_blur, extrude_length - 1.0);\n\n    float color_t = stroke_width < 0.01 ? 0.0 : smoothstep(\n        antialiased_blur,\n        0.0,\n        extrude_length - radius / (radius + stroke_width)\n    );\n\n    gl_FragColor = opacity_t * mix(color * opacity, stroke_color * stroke_opacity, color_t);\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"uniform mat4 u_matrix;\nuniform bool u_scale_with_map;\nuniform bool u_pitch_with_map;\nuniform vec2 u_extrude_scale;\nuniform highp float u_camera_to_center_distance;\n\nattribute vec2 a_pos;\n\n#pragma mapbox: define highp vec4 color\n#pragma mapbox: define mediump float radius\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define highp vec4 stroke_color\n#pragma mapbox: define mediump float stroke_width\n#pragma mapbox: define lowp float stroke_opacity\n\nvarying vec3 v_data;\n\nvoid main(void) {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize mediump float radius\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize highp vec4 stroke_color\n    #pragma mapbox: initialize mediump float stroke_width\n    #pragma mapbox: initialize lowp float stroke_opacity\n\n    // unencode the extrusion vector that we snuck into the a_pos vector\n    vec2 extrude = vec2(mod(a_pos, 2.0) * 2.0 - 1.0);\n\n    // multiply a_pos by 0.5, since we had it * 2 in order to sneak\n    // in extrusion data\n    vec2 circle_center = floor(a_pos * 0.5);\n    if (u_pitch_with_map) {\n        vec2 corner_position = circle_center;\n        if (u_scale_with_map) {\n            corner_position += extrude * (radius + stroke_width) * u_extrude_scale;\n        } else {\n            // Pitching the circle with the map effectively scales it with the map\n            // To counteract the effect for pitch-scale: viewport, we rescale the\n            // whole circle based on the pitch scaling effect at its central point\n            vec4 projected_center = u_matrix * vec4(circle_center, 0, 1);\n            corner_position += extrude * (radius + stroke_width) * u_extrude_scale * (projected_center.w / u_camera_to_center_distance);\n        }\n\n        gl_Position = u_matrix * vec4(corner_position, 0, 1);\n    } else {\n        gl_Position = u_matrix * vec4(circle_center, 0, 1);\n\n        if (u_scale_with_map) {\n            gl_Position.xy += extrude * (radius + stroke_width) * u_extrude_scale * u_camera_to_center_distance;\n        } else {\n            gl_Position.xy += extrude * (radius + stroke_width) * u_extrude_scale * gl_Position.w;\n        }\n    }\n\n    // This is a minimum blur distance that serves as a faux-antialiasing for\n    // the circle. since blur is a ratio of the circle's size and the intent is\n    // to keep the blur at roughly 1px, the two are inversely related.\n    lowp float antialiasblur = 1.0 / DEVICE_PIXEL_RATIO / (radius + stroke_width);\n\n    v_data = vec3(extrude.x, extrude.y, antialiasblur);\n}\n"},collisionBox:{fragmentSource:"uniform float u_zoom;\n// u_maxzoom is derived from the maximum scale considered by the CollisionTile\n// Labels with placement zoom greater than this value will not be placed,\n// regardless of perspective effects.\nuniform float u_maxzoom;\nuniform sampler2D u_fadetexture;\n\n// v_max_zoom is a collision-box-specific value that controls when line-following\n// collision boxes are used.\nvarying float v_max_zoom;\nvarying float v_placement_zoom;\nvarying float v_perspective_zoom_adjust;\nvarying vec2 v_fade_tex;\n\nvoid main() {\n\n    float alpha = 0.5;\n\n    // Green = no collisions, label is showing\n    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0) * alpha;\n\n    // Red = collision, label hidden\n    if (texture2D(u_fadetexture, v_fade_tex).a < 1.0) {\n        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0) * alpha;\n    }\n\n    // Faded black = this collision box is not used at this zoom (for curved labels)\n    if (u_zoom >= v_max_zoom + v_perspective_zoom_adjust) {\n        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0) * alpha * 0.25;\n    }\n\n    // Faded blue = the placement scale for this label is beyond the CollisionTile\n    // max scale, so it's impossible for this label to show without collision detection\n    // being run again (the label's glyphs haven't even been added to the symbol bucket)\n    if (v_placement_zoom >= u_maxzoom) {\n        gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0) * alpha * 0.2;\n    }\n}\n",vertexSource:"attribute vec2 a_pos;\nattribute vec2 a_anchor_pos;\nattribute vec2 a_extrude;\nattribute vec2 a_data;\n\nuniform mat4 u_matrix;\nuniform float u_scale;\nuniform float u_pitch;\nuniform float u_collision_y_stretch;\nuniform float u_camera_to_center_distance;\n\nvarying float v_max_zoom;\nvarying float v_placement_zoom;\nvarying float v_perspective_zoom_adjust;\nvarying vec2 v_fade_tex;\n\nvoid main() {\n    vec4 projectedPoint = u_matrix * vec4(a_anchor_pos, 0, 1);\n    highp float camera_to_anchor_distance = projectedPoint.w;\n    highp float collision_perspective_ratio = 1.0 + 0.5 * ((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);\n\n    highp float incidence_stretch  = camera_to_anchor_distance / (u_camera_to_center_distance * cos(u_pitch));\n    highp float collision_adjustment = max(1.0, incidence_stretch / u_collision_y_stretch);\n\n    gl_Position = u_matrix * vec4(a_pos + a_extrude * collision_perspective_ratio * collision_adjustment / u_scale, 0.0, 1.0);\n\n    v_max_zoom = a_data.x;\n    v_placement_zoom = a_data.y;\n\n    v_perspective_zoom_adjust = floor(log2(collision_perspective_ratio * collision_adjustment) * 10.0);\n    v_fade_tex = vec2((v_placement_zoom + v_perspective_zoom_adjust) / 255.0, 0.0);\n}\n"},debug:{fragmentSource:"uniform highp vec4 u_color;\n\nvoid main() {\n    gl_FragColor = u_color;\n}\n",vertexSource:"attribute vec2 a_pos;\n\nuniform mat4 u_matrix;\n\nvoid main() {\n    // We are using Int16 for texture position coordinates to give us enough precision for\n    // fractional coordinates. We use 8192 to scale the texture coordinates in the buffer\n    // as an arbitrarily high number to preserve adequate precision when rendering.\n    // This is also the same value as the EXTENT we are using for our tile buffer pos coordinates,\n    // so math for modifying either is consistent.\n    gl_Position = u_matrix * vec4(a_pos, step(8192.0, a_pos.x), 1);\n}\n"},fill:{fragmentSource:"#pragma mapbox: define highp vec4 color\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize lowp float opacity\n\n    gl_FragColor = color * opacity;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"attribute vec2 a_pos;\n\nuniform mat4 u_matrix;\n\n#pragma mapbox: define highp vec4 color\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize lowp float opacity\n\n    gl_Position = u_matrix * vec4(a_pos, 0, 1);\n}\n"},fillOutline:{fragmentSource:"#pragma mapbox: define highp vec4 outline_color\n#pragma mapbox: define lowp float opacity\n\nvarying vec2 v_pos;\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 outline_color\n    #pragma mapbox: initialize lowp float opacity\n\n    float dist = length(v_pos - gl_FragCoord.xy);\n    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);\n    gl_FragColor = outline_color * (alpha * opacity);\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"attribute vec2 a_pos;\n\nuniform mat4 u_matrix;\nuniform vec2 u_world;\n\nvarying vec2 v_pos;\n\n#pragma mapbox: define highp vec4 outline_color\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 outline_color\n    #pragma mapbox: initialize lowp float opacity\n\n    gl_Position = u_matrix * vec4(a_pos, 0, 1);\n    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;\n}\n"},fillOutlinePattern:{fragmentSource:"uniform vec2 u_pattern_tl_a;\nuniform vec2 u_pattern_br_a;\nuniform vec2 u_pattern_tl_b;\nuniform vec2 u_pattern_br_b;\nuniform vec2 u_texsize;\nuniform float u_mix;\n\nuniform sampler2D u_image;\n\nvarying vec2 v_pos_a;\nvarying vec2 v_pos_b;\nvarying vec2 v_pos;\n\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize lowp float opacity\n\n    vec2 imagecoord = mod(v_pos_a, 1.0);\n    vec2 pos = mix(u_pattern_tl_a / u_texsize, u_pattern_br_a / u_texsize, imagecoord);\n    vec4 color1 = texture2D(u_image, pos);\n\n    vec2 imagecoord_b = mod(v_pos_b, 1.0);\n    vec2 pos2 = mix(u_pattern_tl_b / u_texsize, u_pattern_br_b / u_texsize, imagecoord_b);\n    vec4 color2 = texture2D(u_image, pos2);\n\n    // find distance to outline for alpha interpolation\n\n    float dist = length(v_pos - gl_FragCoord.xy);\n    float alpha = 1.0 - smoothstep(0.0, 1.0, dist);\n\n\n    gl_FragColor = mix(color1, color2, u_mix) * alpha * opacity;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"uniform mat4 u_matrix;\nuniform vec2 u_world;\nuniform vec2 u_pattern_size_a;\nuniform vec2 u_pattern_size_b;\nuniform vec2 u_pixel_coord_upper;\nuniform vec2 u_pixel_coord_lower;\nuniform float u_scale_a;\nuniform float u_scale_b;\nuniform float u_tile_units_to_pixels;\n\nattribute vec2 a_pos;\n\nvarying vec2 v_pos_a;\nvarying vec2 v_pos_b;\nvarying vec2 v_pos;\n\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize lowp float opacity\n\n    gl_Position = u_matrix * vec4(a_pos, 0, 1);\n\n    v_pos_a = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_a * u_pattern_size_a, u_tile_units_to_pixels, a_pos);\n    v_pos_b = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_b * u_pattern_size_b, u_tile_units_to_pixels, a_pos);\n\n    v_pos = (gl_Position.xy / gl_Position.w + 1.0) / 2.0 * u_world;\n}\n"},fillPattern:{fragmentSource:"uniform vec2 u_pattern_tl_a;\nuniform vec2 u_pattern_br_a;\nuniform vec2 u_pattern_tl_b;\nuniform vec2 u_pattern_br_b;\nuniform vec2 u_texsize;\nuniform float u_mix;\n\nuniform sampler2D u_image;\n\nvarying vec2 v_pos_a;\nvarying vec2 v_pos_b;\n\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize lowp float opacity\n\n    vec2 imagecoord = mod(v_pos_a, 1.0);\n    vec2 pos = mix(u_pattern_tl_a / u_texsize, u_pattern_br_a / u_texsize, imagecoord);\n    vec4 color1 = texture2D(u_image, pos);\n\n    vec2 imagecoord_b = mod(v_pos_b, 1.0);\n    vec2 pos2 = mix(u_pattern_tl_b / u_texsize, u_pattern_br_b / u_texsize, imagecoord_b);\n    vec4 color2 = texture2D(u_image, pos2);\n\n    gl_FragColor = mix(color1, color2, u_mix) * opacity;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"uniform mat4 u_matrix;\nuniform vec2 u_pattern_size_a;\nuniform vec2 u_pattern_size_b;\nuniform vec2 u_pixel_coord_upper;\nuniform vec2 u_pixel_coord_lower;\nuniform float u_scale_a;\nuniform float u_scale_b;\nuniform float u_tile_units_to_pixels;\n\nattribute vec2 a_pos;\n\nvarying vec2 v_pos_a;\nvarying vec2 v_pos_b;\n\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize lowp float opacity\n\n    gl_Position = u_matrix * vec4(a_pos, 0, 1);\n\n    v_pos_a = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_a * u_pattern_size_a, u_tile_units_to_pixels, a_pos);\n    v_pos_b = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_b * u_pattern_size_b, u_tile_units_to_pixels, a_pos);\n}\n"},fillExtrusion:{fragmentSource:"varying vec4 v_color;\n#pragma mapbox: define lowp float base\n#pragma mapbox: define lowp float height\n#pragma mapbox: define highp vec4 color\n\nvoid main() {\n    #pragma mapbox: initialize lowp float base\n    #pragma mapbox: initialize lowp float height\n    #pragma mapbox: initialize highp vec4 color\n\n    gl_FragColor = v_color;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"uniform mat4 u_matrix;\nuniform vec3 u_lightcolor;\nuniform lowp vec3 u_lightpos;\nuniform lowp float u_lightintensity;\n\nattribute vec2 a_pos;\nattribute vec3 a_normal;\nattribute float a_edgedistance;\n\nvarying vec4 v_color;\n\n#pragma mapbox: define lowp float base\n#pragma mapbox: define lowp float height\n\n#pragma mapbox: define highp vec4 color\n\nvoid main() {\n    #pragma mapbox: initialize lowp float base\n    #pragma mapbox: initialize lowp float height\n    #pragma mapbox: initialize highp vec4 color\n\n    base = max(0.0, base);\n    height = max(0.0, height);\n\n    float ed = a_edgedistance; // use each attrib in order to not trip a VAO assert\n    float t = mod(a_normal.x, 2.0);\n\n    gl_Position = u_matrix * vec4(a_pos, t > 0.0 ? height : base, 1);\n\n    // Relative luminance (how dark/bright is the surface color?)\n    float colorvalue = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;\n\n    v_color = vec4(0.0, 0.0, 0.0, 1.0);\n\n    // Add slight ambient lighting so no extrusions are totally black\n    vec4 ambientlight = vec4(0.03, 0.03, 0.03, 1.0);\n    color += ambientlight;\n\n    // Calculate cos(theta), where theta is the angle between surface normal and diffuse light ray\n    float directional = clamp(dot(a_normal / 16384.0, u_lightpos), 0.0, 1.0);\n\n    // Adjust directional so that\n    // the range of values for highlight/shading is narrower\n    // with lower light intensity\n    // and with lighter/brighter surface colors\n    directional = mix((1.0 - u_lightintensity), max((1.0 - colorvalue + u_lightintensity), 1.0), directional);\n\n    // Add gradient along z axis of side surfaces\n    if (a_normal.y != 0.0) {\n        directional *= clamp((t + base) * pow(height / 150.0, 0.5), mix(0.7, 0.98, 1.0 - u_lightintensity), 1.0);\n    }\n\n    // Assign final color based on surface + ambient light color, diffuse light directional, and light color\n    // with lower bounds adjusted to hue of light\n    // so that shading is tinted with the complementary (opposite) color to the light color\n    v_color.r += clamp(color.r * directional * u_lightcolor.r, mix(0.0, 0.3, 1.0 - u_lightcolor.r), 1.0);\n    v_color.g += clamp(color.g * directional * u_lightcolor.g, mix(0.0, 0.3, 1.0 - u_lightcolor.g), 1.0);\n    v_color.b += clamp(color.b * directional * u_lightcolor.b, mix(0.0, 0.3, 1.0 - u_lightcolor.b), 1.0);\n}\n"},fillExtrusionPattern:{fragmentSource:"uniform vec2 u_pattern_tl_a;\nuniform vec2 u_pattern_br_a;\nuniform vec2 u_pattern_tl_b;\nuniform vec2 u_pattern_br_b;\nuniform vec2 u_texsize;\nuniform float u_mix;\n\nuniform sampler2D u_image;\n\nvarying vec2 v_pos_a;\nvarying vec2 v_pos_b;\nvarying vec4 v_lighting;\n\n#pragma mapbox: define lowp float base\n#pragma mapbox: define lowp float height\n\nvoid main() {\n    #pragma mapbox: initialize lowp float base\n    #pragma mapbox: initialize lowp float height\n\n    vec2 imagecoord = mod(v_pos_a, 1.0);\n    vec2 pos = mix(u_pattern_tl_a / u_texsize, u_pattern_br_a / u_texsize, imagecoord);\n    vec4 color1 = texture2D(u_image, pos);\n\n    vec2 imagecoord_b = mod(v_pos_b, 1.0);\n    vec2 pos2 = mix(u_pattern_tl_b / u_texsize, u_pattern_br_b / u_texsize, imagecoord_b);\n    vec4 color2 = texture2D(u_image, pos2);\n\n    vec4 mixedColor = mix(color1, color2, u_mix);\n\n    gl_FragColor = mixedColor * v_lighting;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"uniform mat4 u_matrix;\nuniform vec2 u_pattern_size_a;\nuniform vec2 u_pattern_size_b;\nuniform vec2 u_pixel_coord_upper;\nuniform vec2 u_pixel_coord_lower;\nuniform float u_scale_a;\nuniform float u_scale_b;\nuniform float u_tile_units_to_pixels;\nuniform float u_height_factor;\n\nuniform vec3 u_lightcolor;\nuniform lowp vec3 u_lightpos;\nuniform lowp float u_lightintensity;\n\nattribute vec2 a_pos;\nattribute vec3 a_normal;\nattribute float a_edgedistance;\n\nvarying vec2 v_pos_a;\nvarying vec2 v_pos_b;\nvarying vec4 v_lighting;\nvarying float v_directional;\n\n#pragma mapbox: define lowp float base\n#pragma mapbox: define lowp float height\n\nvoid main() {\n    #pragma mapbox: initialize lowp float base\n    #pragma mapbox: initialize lowp float height\n\n    base = max(0.0, base);\n    height = max(0.0, height);\n\n    float t = mod(a_normal.x, 2.0);\n    float z = t > 0.0 ? height : base;\n\n    gl_Position = u_matrix * vec4(a_pos, z, 1);\n\n    vec2 pos = a_normal.x == 1.0 && a_normal.y == 0.0 && a_normal.z == 16384.0\n        ? a_pos // extrusion top\n        : vec2(a_edgedistance, z * u_height_factor); // extrusion side\n\n    v_pos_a = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_a * u_pattern_size_a, u_tile_units_to_pixels, pos);\n    v_pos_b = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, u_scale_b * u_pattern_size_b, u_tile_units_to_pixels, pos);\n\n    v_lighting = vec4(0.0, 0.0, 0.0, 1.0);\n    float directional = clamp(dot(a_normal / 16383.0, u_lightpos), 0.0, 1.0);\n    directional = mix((1.0 - u_lightintensity), max((0.5 + u_lightintensity), 1.0), directional);\n\n    if (a_normal.y != 0.0) {\n        directional *= clamp((t + base) * pow(height / 150.0, 0.5), mix(0.7, 0.98, 1.0 - u_lightintensity), 1.0);\n    }\n\n    v_lighting.rgb += clamp(directional * u_lightcolor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightcolor), vec3(1.0));\n}\n"},extrusionTexture:{fragmentSource:"uniform sampler2D u_image;\nuniform float u_opacity;\nvarying vec2 v_pos;\n\nvoid main() {\n    gl_FragColor = texture2D(u_image, v_pos) * u_opacity;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(0.0);\n#endif\n}\n",vertexSource:"uniform mat4 u_matrix;\nuniform vec2 u_world;\nattribute vec2 a_pos;\nvarying vec2 v_pos;\n\nvoid main() {\n    gl_Position = u_matrix * vec4(a_pos * u_world, 0, 1);\n\n    v_pos.x = a_pos.x;\n    v_pos.y = 1.0 - a_pos.y;\n}\n"},line:{fragmentSource:"#pragma mapbox: define highp vec4 color\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n\nvarying vec2 v_width2;\nvarying vec2 v_normal;\nvarying float v_gamma_scale;\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n\n    // Calculate the distance of the pixel from the line in pixels.\n    float dist = length(v_normal) * v_width2.s;\n\n    // Calculate the antialiasing fade factor. This is either when fading in\n    // the line in case of an offset line (v_width2.t) or when fading out\n    // (v_width2.s)\n    float blur2 = (blur + 1.0 / DEVICE_PIXEL_RATIO) * v_gamma_scale;\n    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);\n\n    gl_FragColor = color * (alpha * opacity);\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"\n\n// the distance over which the line edge fades out.\n// Retina devices need a smaller distance to avoid aliasing.\n#define ANTIALIASING 1.0 / DEVICE_PIXEL_RATIO / 2.0\n\n// floor(127 / 2) == 63.0\n// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is\n// stored in a byte (-128..127). we scale regular normals up to length 63, but\n// there are also \"special\" normals that have a bigger length (of up to 126 in\n// this case).\n// #define scale 63.0\n#define scale 0.015873016\n\nattribute vec4 a_pos_normal;\nattribute vec4 a_data;\n\nuniform mat4 u_matrix;\nuniform mediump float u_ratio;\nuniform vec2 u_gl_units_to_pixels;\n\nvarying vec2 v_normal;\nvarying vec2 v_width2;\nvarying float v_gamma_scale;\n\n#pragma mapbox: define highp vec4 color\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define mediump float gapwidth\n#pragma mapbox: define lowp float offset\n#pragma mapbox: define mediump float width\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize mediump float gapwidth\n    #pragma mapbox: initialize lowp float offset\n    #pragma mapbox: initialize mediump float width\n\n    vec2 a_extrude = a_data.xy - 128.0;\n    float a_direction = mod(a_data.z, 4.0) - 1.0;\n\n    vec2 pos = a_pos_normal.xy;\n\n    // x is 1 if it's a round cap, 0 otherwise\n    // y is 1 if the normal points up, and -1 if it points down\n    mediump vec2 normal = a_pos_normal.zw;\n    v_normal = normal;\n\n    // these transformations used to be applied in the JS and native code bases.\n    // moved them into the shader for clarity and simplicity.\n    gapwidth = gapwidth / 2.0;\n    float halfwidth = width / 2.0;\n    offset = -1.0 * offset;\n\n    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);\n    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + ANTIALIASING;\n\n    // Scale the extrusion vector down to a normal and then up by the line width\n    // of this vertex.\n    mediump vec2 dist = outset * a_extrude * scale;\n\n    // Calculate the offset when drawing a line that is to the side of the actual line.\n    // We do this by creating a vector that points towards the extrude, but rotate\n    // it when we're drawing round end points (a_direction = -1 or 1) since their\n    // extrude vector points in another direction.\n    mediump float u = 0.5 * a_direction;\n    mediump float t = 1.0 - abs(u);\n    mediump vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);\n\n    vec4 projected_extrude = u_matrix * vec4(dist / u_ratio, 0.0, 0.0);\n    gl_Position = u_matrix * vec4(pos + offset2 / u_ratio, 0.0, 1.0) + projected_extrude;\n\n    // calculate how much the perspective view squishes or stretches the extrude\n    float extrude_length_without_perspective = length(dist);\n    float extrude_length_with_perspective = length(projected_extrude.xy / gl_Position.w * u_gl_units_to_pixels);\n    v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;\n\n    v_width2 = vec2(outset, inset);\n}\n"},linePattern:{fragmentSource:"uniform vec2 u_pattern_size_a;\nuniform vec2 u_pattern_size_b;\nuniform vec2 u_pattern_tl_a;\nuniform vec2 u_pattern_br_a;\nuniform vec2 u_pattern_tl_b;\nuniform vec2 u_pattern_br_b;\nuniform vec2 u_texsize;\nuniform float u_fade;\n\nuniform sampler2D u_image;\n\nvarying vec2 v_normal;\nvarying vec2 v_width2;\nvarying float v_linesofar;\nvarying float v_gamma_scale;\n\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n\nvoid main() {\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n\n    // Calculate the distance of the pixel from the line in pixels.\n    float dist = length(v_normal) * v_width2.s;\n\n    // Calculate the antialiasing fade factor. This is either when fading in\n    // the line in case of an offset line (v_width2.t) or when fading out\n    // (v_width2.s)\n    float blur2 = (blur + 1.0 / DEVICE_PIXEL_RATIO) * v_gamma_scale;\n    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);\n\n    float x_a = mod(v_linesofar / u_pattern_size_a.x, 1.0);\n    float x_b = mod(v_linesofar / u_pattern_size_b.x, 1.0);\n    float y_a = 0.5 + (v_normal.y * v_width2.s / u_pattern_size_a.y);\n    float y_b = 0.5 + (v_normal.y * v_width2.s / u_pattern_size_b.y);\n    vec2 pos_a = mix(u_pattern_tl_a / u_texsize, u_pattern_br_a / u_texsize, vec2(x_a, y_a));\n    vec2 pos_b = mix(u_pattern_tl_b / u_texsize, u_pattern_br_b / u_texsize, vec2(x_b, y_b));\n\n    vec4 color = mix(texture2D(u_image, pos_a), texture2D(u_image, pos_b), u_fade);\n\n    gl_FragColor = color * alpha * opacity;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"// floor(127 / 2) == 63.0\n// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is\n// stored in a byte (-128..127). we scale regular normals up to length 63, but\n// there are also \"special\" normals that have a bigger length (of up to 126 in\n// this case).\n// #define scale 63.0\n#define scale 0.015873016\n\n// We scale the distance before adding it to the buffers so that we can store\n// long distances for long segments. Use this value to unscale the distance.\n#define LINE_DISTANCE_SCALE 2.0\n\n// the distance over which the line edge fades out.\n// Retina devices need a smaller distance to avoid aliasing.\n#define ANTIALIASING 1.0 / DEVICE_PIXEL_RATIO / 2.0\n\nattribute vec4 a_pos_normal;\nattribute vec4 a_data;\n\nuniform mat4 u_matrix;\nuniform mediump float u_ratio;\nuniform vec2 u_gl_units_to_pixels;\n\nvarying vec2 v_normal;\nvarying vec2 v_width2;\nvarying float v_linesofar;\nvarying float v_gamma_scale;\n\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define lowp float offset\n#pragma mapbox: define mediump float gapwidth\n#pragma mapbox: define mediump float width\n\nvoid main() {\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize lowp float offset\n    #pragma mapbox: initialize mediump float gapwidth\n    #pragma mapbox: initialize mediump float width\n\n    vec2 a_extrude = a_data.xy - 128.0;\n    float a_direction = mod(a_data.z, 4.0) - 1.0;\n    float a_linesofar = (floor(a_data.z / 4.0) + a_data.w * 64.0) * LINE_DISTANCE_SCALE;\n\n    vec2 pos = a_pos_normal.xy;\n\n    // x is 1 if it's a round cap, 0 otherwise\n    // y is 1 if the normal points up, and -1 if it points down\n    mediump vec2 normal = a_pos_normal.zw;\n    v_normal = normal;\n\n    // these transformations used to be applied in the JS and native code bases.\n    // moved them into the shader for clarity and simplicity.\n    gapwidth = gapwidth / 2.0;\n    float halfwidth = width / 2.0;\n    offset = -1.0 * offset;\n\n    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);\n    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + ANTIALIASING;\n\n    // Scale the extrusion vector down to a normal and then up by the line width\n    // of this vertex.\n    mediump vec2 dist = outset * a_extrude * scale;\n\n    // Calculate the offset when drawing a line that is to the side of the actual line.\n    // We do this by creating a vector that points towards the extrude, but rotate\n    // it when we're drawing round end points (a_direction = -1 or 1) since their\n    // extrude vector points in another direction.\n    mediump float u = 0.5 * a_direction;\n    mediump float t = 1.0 - abs(u);\n    mediump vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);\n\n    vec4 projected_extrude = u_matrix * vec4(dist / u_ratio, 0.0, 0.0);\n    gl_Position = u_matrix * vec4(pos + offset2 / u_ratio, 0.0, 1.0) + projected_extrude;\n\n    // calculate how much the perspective view squishes or stretches the extrude\n    float extrude_length_without_perspective = length(dist);\n    float extrude_length_with_perspective = length(projected_extrude.xy / gl_Position.w * u_gl_units_to_pixels);\n    v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;\n\n    v_linesofar = a_linesofar;\n    v_width2 = vec2(outset, inset);\n}\n"},lineSDF:{
fragmentSource:"\nuniform sampler2D u_image;\nuniform float u_sdfgamma;\nuniform float u_mix;\n\nvarying vec2 v_normal;\nvarying vec2 v_width2;\nvarying vec2 v_tex_a;\nvarying vec2 v_tex_b;\nvarying float v_gamma_scale;\n\n#pragma mapbox: define highp vec4 color\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define mediump float width\n#pragma mapbox: define lowp float floorwidth\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize mediump float width\n    #pragma mapbox: initialize lowp float floorwidth\n\n    // Calculate the distance of the pixel from the line in pixels.\n    float dist = length(v_normal) * v_width2.s;\n\n    // Calculate the antialiasing fade factor. This is either when fading in\n    // the line in case of an offset line (v_width2.t) or when fading out\n    // (v_width2.s)\n    float blur2 = (blur + 1.0 / DEVICE_PIXEL_RATIO) * v_gamma_scale;\n    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);\n\n    float sdfdist_a = texture2D(u_image, v_tex_a).a;\n    float sdfdist_b = texture2D(u_image, v_tex_b).a;\n    float sdfdist = mix(sdfdist_a, sdfdist_b, u_mix);\n    alpha *= smoothstep(0.5 - u_sdfgamma / floorwidth, 0.5 + u_sdfgamma / floorwidth, sdfdist);\n\n    gl_FragColor = color * (alpha * opacity);\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"// floor(127 / 2) == 63.0\n// the maximum allowed miter limit is 2.0 at the moment. the extrude normal is\n// stored in a byte (-128..127). we scale regular normals up to length 63, but\n// there are also \"special\" normals that have a bigger length (of up to 126 in\n// this case).\n// #define scale 63.0\n#define scale 0.015873016\n\n// We scale the distance before adding it to the buffers so that we can store\n// long distances for long segments. Use this value to unscale the distance.\n#define LINE_DISTANCE_SCALE 2.0\n\n// the distance over which the line edge fades out.\n// Retina devices need a smaller distance to avoid aliasing.\n#define ANTIALIASING 1.0 / DEVICE_PIXEL_RATIO / 2.0\n\nattribute vec4 a_pos_normal;\nattribute vec4 a_data;\n\nuniform mat4 u_matrix;\nuniform mediump float u_ratio;\nuniform vec2 u_patternscale_a;\nuniform float u_tex_y_a;\nuniform vec2 u_patternscale_b;\nuniform float u_tex_y_b;\nuniform vec2 u_gl_units_to_pixels;\n\nvarying vec2 v_normal;\nvarying vec2 v_width2;\nvarying vec2 v_tex_a;\nvarying vec2 v_tex_b;\nvarying float v_gamma_scale;\n\n#pragma mapbox: define highp vec4 color\n#pragma mapbox: define lowp float blur\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define mediump float gapwidth\n#pragma mapbox: define lowp float offset\n#pragma mapbox: define mediump float width\n#pragma mapbox: define lowp float floorwidth\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 color\n    #pragma mapbox: initialize lowp float blur\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize mediump float gapwidth\n    #pragma mapbox: initialize lowp float offset\n    #pragma mapbox: initialize mediump float width\n    #pragma mapbox: initialize lowp float floorwidth\n\n    vec2 a_extrude = a_data.xy - 128.0;\n    float a_direction = mod(a_data.z, 4.0) - 1.0;\n    float a_linesofar = (floor(a_data.z / 4.0) + a_data.w * 64.0) * LINE_DISTANCE_SCALE;\n\n    vec2 pos = a_pos_normal.xy;\n\n    // x is 1 if it's a round cap, 0 otherwise\n    // y is 1 if the normal points up, and -1 if it points down\n    mediump vec2 normal = a_pos_normal.zw;\n    v_normal = normal;\n\n    // these transformations used to be applied in the JS and native code bases.\n    // moved them into the shader for clarity and simplicity.\n    gapwidth = gapwidth / 2.0;\n    float halfwidth = width / 2.0;\n    offset = -1.0 * offset;\n\n    float inset = gapwidth + (gapwidth > 0.0 ? ANTIALIASING : 0.0);\n    float outset = gapwidth + halfwidth * (gapwidth > 0.0 ? 2.0 : 1.0) + ANTIALIASING;\n\n    // Scale the extrusion vector down to a normal and then up by the line width\n    // of this vertex.\n    mediump vec2 dist =outset * a_extrude * scale;\n\n    // Calculate the offset when drawing a line that is to the side of the actual line.\n    // We do this by creating a vector that points towards the extrude, but rotate\n    // it when we're drawing round end points (a_direction = -1 or 1) since their\n    // extrude vector points in another direction.\n    mediump float u = 0.5 * a_direction;\n    mediump float t = 1.0 - abs(u);\n    mediump vec2 offset2 = offset * a_extrude * scale * normal.y * mat2(t, -u, u, t);\n\n    vec4 projected_extrude = u_matrix * vec4(dist / u_ratio, 0.0, 0.0);\n    gl_Position = u_matrix * vec4(pos + offset2 / u_ratio, 0.0, 1.0) + projected_extrude;\n\n    // calculate how much the perspective view squishes or stretches the extrude\n    float extrude_length_without_perspective = length(dist);\n    float extrude_length_with_perspective = length(projected_extrude.xy / gl_Position.w * u_gl_units_to_pixels);\n    v_gamma_scale = extrude_length_without_perspective / extrude_length_with_perspective;\n\n    v_tex_a = vec2(a_linesofar * u_patternscale_a.x / floorwidth, normal.y * u_patternscale_a.y + u_tex_y_a);\n    v_tex_b = vec2(a_linesofar * u_patternscale_b.x / floorwidth, normal.y * u_patternscale_b.y + u_tex_y_b);\n\n    v_width2 = vec2(outset, inset);\n}\n"},raster:{fragmentSource:"uniform float u_fade_t;\nuniform float u_opacity;\nuniform sampler2D u_image0;\nuniform sampler2D u_image1;\nvarying vec2 v_pos0;\nvarying vec2 v_pos1;\n\nuniform float u_brightness_low;\nuniform float u_brightness_high;\n\nuniform float u_saturation_factor;\nuniform float u_contrast_factor;\nuniform vec3 u_spin_weights;\n\nvoid main() {\n\n    // read and cross-fade colors from the main and parent tiles\n    vec4 color0 = texture2D(u_image0, v_pos0);\n    vec4 color1 = texture2D(u_image1, v_pos1);\n    if (color0.a > 0.0) {\n        color0.rgb = color0.rgb / color0.a;\n    }\n    if (color1.a > 0.0) {\n        color1.rgb = color1.rgb / color1.a;\n    }\n    vec4 color = mix(color0, color1, u_fade_t);\n    color.a *= u_opacity;\n    vec3 rgb = color.rgb;\n\n    // spin\n    rgb = vec3(\n        dot(rgb, u_spin_weights.xyz),\n        dot(rgb, u_spin_weights.zxy),\n        dot(rgb, u_spin_weights.yzx));\n\n    // saturation\n    float average = (color.r + color.g + color.b) / 3.0;\n    rgb += (average - rgb) * u_saturation_factor;\n\n    // contrast\n    rgb = (rgb - 0.5) * u_contrast_factor + 0.5;\n\n    // brightness\n    vec3 u_high_vec = vec3(u_brightness_low, u_brightness_low, u_brightness_low);\n    vec3 u_low_vec = vec3(u_brightness_high, u_brightness_high, u_brightness_high);\n\n    gl_FragColor = vec4(mix(u_high_vec, u_low_vec, rgb) * color.a, color.a);\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"uniform mat4 u_matrix;\nuniform vec2 u_tl_parent;\nuniform float u_scale_parent;\nuniform float u_buffer_scale;\n\nattribute vec2 a_pos;\nattribute vec2 a_texture_pos;\n\nvarying vec2 v_pos0;\nvarying vec2 v_pos1;\n\nvoid main() {\n    gl_Position = u_matrix * vec4(a_pos, 0, 1);\n    // We are using Int16 for texture position coordinates to give us enough precision for\n    // fractional coordinates. We use 8192 to scale the texture coordinates in the buffer\n    // as an arbitrarily high number to preserve adequate precision when rendering.\n    // This is also the same value as the EXTENT we are using for our tile buffer pos coordinates,\n    // so math for modifying either is consistent.\n    v_pos0 = (((a_texture_pos / 8192.0) - 0.5) / u_buffer_scale ) + 0.5;\n    v_pos1 = (v_pos0 * u_scale_parent) + u_tl_parent;\n}\n"},symbolIcon:{fragmentSource:"uniform sampler2D u_texture;\nuniform sampler2D u_fadetexture;\n\n#pragma mapbox: define lowp float opacity\n\nvarying vec2 v_tex;\nvarying vec2 v_fade_tex;\n\nvoid main() {\n    #pragma mapbox: initialize lowp float opacity\n\n    lowp float alpha = texture2D(u_fadetexture, v_fade_tex).a * opacity;\n    gl_FragColor = texture2D(u_texture, v_tex) * alpha;\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"const float PI = 3.141592653589793;\n\nattribute vec4 a_pos_offset;\nattribute vec4 a_data;\nattribute vec3 a_projected_pos;\n\nuniform bool u_is_size_zoom_constant;\nuniform bool u_is_size_feature_constant;\nuniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function\nuniform highp float u_size; // used when size is both zoom and feature constant\nuniform highp float u_camera_to_center_distance;\nuniform highp float u_pitch;\nuniform bool u_rotate_symbol;\nuniform highp float u_aspect_ratio;\nuniform highp float u_collision_y_stretch;\n\n#pragma mapbox: define lowp float opacity\n\nuniform mat4 u_matrix;\nuniform mat4 u_label_plane_matrix;\nuniform mat4 u_gl_coord_matrix;\n\nuniform bool u_is_text;\nuniform bool u_pitch_with_map;\n\nuniform vec2 u_texsize;\n\nvarying vec2 v_tex;\nvarying vec2 v_fade_tex;\n\nvoid main() {\n    #pragma mapbox: initialize lowp float opacity\n\n    vec2 a_pos = a_pos_offset.xy;\n    vec2 a_offset = a_pos_offset.zw;\n\n    vec2 a_tex = a_data.xy;\n    vec2 a_size = a_data.zw;\n\n    highp vec2 angle_labelminzoom = unpack_float(a_projected_pos[2]);\n    highp float segment_angle = -angle_labelminzoom[0] / 255.0 * 2.0 * PI;\n    mediump float a_labelminzoom = angle_labelminzoom[1];\n\n    float size;\n    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {\n        size = mix(a_size[0], a_size[1], u_size_t) / 10.0;\n    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {\n        size = a_size[0] / 10.0;\n    } else if (!u_is_size_zoom_constant && u_is_size_feature_constant) {\n        size = u_size;\n    } else {\n        size = u_size;\n    }\n\n    vec4 projectedPoint = u_matrix * vec4(a_pos, 0, 1);\n    highp float camera_to_anchor_distance = projectedPoint.w;\n    // See comments in symbol_sdf.vertex\n    highp float distance_ratio = u_pitch_with_map ?\n        camera_to_anchor_distance / u_camera_to_center_distance :\n        u_camera_to_center_distance / camera_to_anchor_distance;\n    highp float perspective_ratio = 0.5 + 0.5 * distance_ratio;\n\n    size *= perspective_ratio;\n\n    float fontScale = u_is_text ? size / 24.0 : size;\n\n    highp float symbol_rotation = 0.0;\n    if (u_rotate_symbol) {\n        // See comments in symbol_sdf.vertex\n        vec4 offsetProjectedPoint = u_matrix * vec4(a_pos + vec2(1, 0), 0, 1);\n\n        vec2 a = projectedPoint.xy / projectedPoint.w;\n        vec2 b = offsetProjectedPoint.xy / offsetProjectedPoint.w;\n\n        symbol_rotation = atan((b.y - a.y) / u_aspect_ratio, b.x - a.x);\n    }\n\n    highp float angle_sin = sin(segment_angle + symbol_rotation);\n    highp float angle_cos = cos(segment_angle + symbol_rotation);\n    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);\n\n    vec4 projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xy, 0.0, 1.0);\n    gl_Position = u_gl_coord_matrix * vec4(projected_pos.xy / projected_pos.w + rotation_matrix * (a_offset / 64.0 * fontScale), 0.0, 1.0);\n\n    v_tex = a_tex / u_texsize;\n    // See comments in symbol_sdf.vertex\n    highp float incidence_stretch  = camera_to_anchor_distance / (u_camera_to_center_distance * cos(u_pitch));\n    highp float collision_adjustment = max(1.0, incidence_stretch / u_collision_y_stretch);\n\n    highp float collision_perspective_ratio = 1.0 + 0.5*((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);\n    highp float perspective_zoom_adjust = floor(log2(collision_perspective_ratio * collision_adjustment) * 10.0);\n    v_fade_tex = vec2((a_labelminzoom + perspective_zoom_adjust) / 255.0, 0.0);\n}\n"},symbolSDF:{fragmentSource:"#define SDF_PX 8.0\n#define EDGE_GAMMA 0.105/DEVICE_PIXEL_RATIO\n\nuniform bool u_is_halo;\n#pragma mapbox: define highp vec4 fill_color\n#pragma mapbox: define highp vec4 halo_color\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define lowp float halo_width\n#pragma mapbox: define lowp float halo_blur\n\nuniform sampler2D u_texture;\nuniform sampler2D u_fadetexture;\nuniform highp float u_gamma_scale;\nuniform bool u_is_text;\n\nvarying vec4 v_data0;\nvarying vec2 v_data1;\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 fill_color\n    #pragma mapbox: initialize highp vec4 halo_color\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize lowp float halo_width\n    #pragma mapbox: initialize lowp float halo_blur\n\n    vec2 tex = v_data0.xy;\n    vec2 fade_tex = v_data0.zw;\n    float gamma_scale = v_data1.x;\n    float size = v_data1.y;\n\n    float fontScale = u_is_text ? size / 24.0 : size;\n\n    lowp vec4 color = fill_color;\n    highp float gamma = EDGE_GAMMA / (fontScale * u_gamma_scale);\n    lowp float buff = (256.0 - 64.0) / 256.0;\n    if (u_is_halo) {\n        color = halo_color;\n        gamma = (halo_blur * 1.19 / SDF_PX + EDGE_GAMMA) / (fontScale * u_gamma_scale);\n        buff = (6.0 - halo_width / fontScale) / SDF_PX;\n    }\n\n    lowp float dist = texture2D(u_texture, tex).a;\n    lowp float fade_alpha = texture2D(u_fadetexture, fade_tex).a;\n    highp float gamma_scaled = gamma * gamma_scale;\n    highp float alpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist) * fade_alpha;\n\n    gl_FragColor = color * (alpha * opacity);\n\n#ifdef OVERDRAW_INSPECTOR\n    gl_FragColor = vec4(1.0);\n#endif\n}\n",vertexSource:"const float PI = 3.141592653589793;\n\nattribute vec4 a_pos_offset;\nattribute vec4 a_data;\nattribute vec3 a_projected_pos;\n\n// contents of a_size vary based on the type of property value\n// used for {text,icon}-size.\n// For constants, a_size is disabled.\n// For source functions, we bind only one value per vertex: the value of {text,icon}-size evaluated for the current feature.\n// For composite functions:\n// [ text-size(lowerZoomStop, feature),\n//   text-size(upperZoomStop, feature) ]\nuniform bool u_is_size_zoom_constant;\nuniform bool u_is_size_feature_constant;\nuniform highp float u_size_t; // used to interpolate between zoom stops when size is a composite function\nuniform highp float u_size; // used when size is both zoom and feature constant\n\n#pragma mapbox: define highp vec4 fill_color\n#pragma mapbox: define highp vec4 halo_color\n#pragma mapbox: define lowp float opacity\n#pragma mapbox: define lowp float halo_width\n#pragma mapbox: define lowp float halo_blur\n\nuniform mat4 u_matrix;\nuniform mat4 u_label_plane_matrix;\nuniform mat4 u_gl_coord_matrix;\n\nuniform bool u_is_text;\nuniform bool u_pitch_with_map;\nuniform highp float u_pitch;\nuniform bool u_rotate_symbol;\nuniform highp float u_aspect_ratio;\nuniform highp float u_camera_to_center_distance;\nuniform highp float u_collision_y_stretch;\n\nuniform vec2 u_texsize;\n\nvarying vec4 v_data0;\nvarying vec2 v_data1;\n\nvoid main() {\n    #pragma mapbox: initialize highp vec4 fill_color\n    #pragma mapbox: initialize highp vec4 halo_color\n    #pragma mapbox: initialize lowp float opacity\n    #pragma mapbox: initialize lowp float halo_width\n    #pragma mapbox: initialize lowp float halo_blur\n\n    vec2 a_pos = a_pos_offset.xy;\n    vec2 a_offset = a_pos_offset.zw;\n\n    vec2 a_tex = a_data.xy;\n    vec2 a_size = a_data.zw;\n\n    highp vec2 angle_labelminzoom = unpack_float(a_projected_pos[2]);\n    highp float segment_angle = -angle_labelminzoom[0] / 255.0 * 2.0 * PI;\n    mediump float a_labelminzoom = angle_labelminzoom[1];\n    float size;\n\n    if (!u_is_size_zoom_constant && !u_is_size_feature_constant) {\n        size = mix(a_size[0], a_size[1], u_size_t) / 10.0;\n    } else if (u_is_size_zoom_constant && !u_is_size_feature_constant) {\n        size = a_size[0] / 10.0;\n    } else if (!u_is_size_zoom_constant && u_is_size_feature_constant) {\n        size = u_size;\n    } else {\n        size = u_size;\n    }\n\n    vec4 projectedPoint = u_matrix * vec4(a_pos, 0, 1);\n    highp float camera_to_anchor_distance = projectedPoint.w;\n    // If the label is pitched with the map, layout is done in pitched space,\n    // which makes labels in the distance smaller relative to viewport space.\n    // We counteract part of that effect by multiplying by the perspective ratio.\n    // If the label isn't pitched with the map, we do layout in viewport space,\n    // which makes labels in the distance larger relative to the features around\n    // them. We counteract part of that effect by dividing by the perspective ratio.\n    highp float distance_ratio = u_pitch_with_map ?\n        camera_to_anchor_distance / u_camera_to_center_distance :\n        u_camera_to_center_distance / camera_to_anchor_distance;\n    highp float perspective_ratio = 0.5 + 0.5 * distance_ratio;\n\n    size *= perspective_ratio;\n\n    float fontScale = u_is_text ? size / 24.0 : size;\n\n    highp float symbol_rotation = 0.0;\n    if (u_rotate_symbol) {\n        // Point labels with 'rotation-alignment: map' are horizontal with respect to tile units\n        // To figure out that angle in projected space, we draw a short horizontal line in tile\n        // space, project it, and measure its angle in projected space.\n        vec4 offsetProjectedPoint = u_matrix * vec4(a_pos + vec2(1, 0), 0, 1);\n\n        vec2 a = projectedPoint.xy / projectedPoint.w;\n        vec2 b = offsetProjectedPoint.xy / offsetProjectedPoint.w;\n\n        symbol_rotation = atan((b.y - a.y) / u_aspect_ratio, b.x - a.x);\n    }\n\n    highp float angle_sin = sin(segment_angle + symbol_rotation);\n    highp float angle_cos = cos(segment_angle + symbol_rotation);\n    mat2 rotation_matrix = mat2(angle_cos, -1.0 * angle_sin, angle_sin, angle_cos);\n\n    vec4 projected_pos = u_label_plane_matrix * vec4(a_projected_pos.xy, 0.0, 1.0);\n    gl_Position = u_gl_coord_matrix * vec4(projected_pos.xy / projected_pos.w + rotation_matrix * (a_offset / 64.0 * fontScale), 0.0, 1.0);\n    float gamma_scale = gl_Position.w;\n\n    vec2 tex = a_tex / u_texsize;\n    // incidence_stretch is the ratio of how much y space a label takes up on a tile while drawn perpendicular to the viewport vs\n    //  how much space it would take up if it were drawn flat on the tile\n    // Using law of sines, camera_to_anchor/sin(ground_angle) = camera_to_center/sin(incidence_angle)\n    // sin(incidence_angle) = 1/incidence_stretch\n    // Incidence angle 90 -> head on, sin(incidence_angle) = 1, no incidence stretch\n    // Incidence angle 1 -> very oblique, sin(incidence_angle) =~ 0, lots of incidence stretch\n    // ground_angle = u_pitch + PI/2 -> sin(ground_angle) = cos(u_pitch)\n    // This 2D calculation is only exactly correct when gl_Position.x is in the center of the viewport,\n    //  but it's a close enough approximation for our purposes\n    highp float incidence_stretch  = camera_to_anchor_distance / (u_camera_to_center_distance * cos(u_pitch));\n    // incidence_stretch only applies to the y-axis, but without re-calculating the collision tile, we can't\n    // adjust the size of only one axis. So, we do a crude approximation at placement time to get the aspect ratio\n    // about right, and then do the rest of the adjustment here: there will be some extra padding on the x-axis,\n    // but hopefully not too much.\n    // Never make the adjustment less than 1.0: instead of allowing collisions on the x-axis, be conservative on\n    // the y-axis.\n    highp float collision_adjustment = max(1.0, incidence_stretch / u_collision_y_stretch);\n\n    // Floor to 1/10th zoom to dodge precision issues that can cause partially hidden labels\n    highp float collision_perspective_ratio = 1.0 + 0.5*((camera_to_anchor_distance / u_camera_to_center_distance) - 1.0);\n    highp float perspective_zoom_adjust = floor(log2(collision_perspective_ratio * collision_adjustment) * 10.0);\n    vec2 fade_tex = vec2((a_labelminzoom + perspective_zoom_adjust) / 255.0, 0.0);\n\n    v_data0 = vec4(tex.x, tex.y, fade_tex.x, fade_tex.y);\n    v_data1 = vec2(gamma_scale, size);\n}\n"}},re=/#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g,loop=function(e){var n=shaders[e],a={};n.fragmentSource=n.fragmentSource.replace(re,function(e,n,o,t,i){return a[i]=!0,"define"===n?"\n#ifndef HAS_UNIFORM_u_"+i+"\nvarying "+o+" "+t+" "+i+";\n#else\nuniform "+o+" "+t+" u_"+i+";\n#endif\n":"\n#ifdef HAS_UNIFORM_u_"+i+"\n    "+o+" "+t+" "+i+" = u_"+i+";\n#endif\n"}),n.vertexSource=n.vertexSource.replace(re,function(e,n,o,t,i){var r="float"===t?"vec2":"vec4";return a[i]?"define"===n?"\n#ifndef HAS_UNIFORM_u_"+i+"\nuniform lowp float a_"+i+"_t;\nattribute "+o+" "+r+" a_"+i+";\nvarying "+o+" "+t+" "+i+";\n#else\nuniform "+o+" "+t+" u_"+i+";\n#endif\n":"\n#ifndef HAS_UNIFORM_u_"+i+"\n    "+i+" = unpack_mix_"+r+"(a_"+i+", a_"+i+"_t);\n#else\n    "+o+" "+t+" "+i+" = u_"+i+";\n#endif\n":"define"===n?"\n#ifndef HAS_UNIFORM_u_"+i+"\nuniform lowp float a_"+i+"_t;\nattribute "+o+" "+r+" a_"+i+";\n#else\nuniform "+o+" "+t+" u_"+i+";\n#endif\n":"\n#ifndef HAS_UNIFORM_u_"+i+"\n    "+o+" "+t+" "+i+" = unpack_mix_"+r+"(a_"+i+", a_"+i+"_t);\n#else\n    "+o+" "+t+" "+i+" = u_"+i+";\n#endif\n"})};for(var programName in shaders)loop(programName);module.exports=shaders;
},{}],87:[function(_dereq_,module,exports){
"use strict";var ImageSource=_dereq_("./image_source"),window=_dereq_("../util/window"),CanvasSource=function(t){function i(i,a,e,s){t.call(this,i,a,e,s),this.options=a,this.animate=void 0===a.animate||a.animate}return t&&(i.__proto__=t),i.prototype=Object.create(t&&t.prototype),i.prototype.constructor=i,i.prototype.load=function(){this.canvas=this.canvas||window.document.getElementById(this.options.canvas);var t=this.canvas.getContext(this.options.contextType);if(!t)return this.fire("error",new Error("Canvas context not found."));if(this.context=t,this.width=this.canvas.width,this.height=this.canvas.height,this._hasInvalidDimensions())return this.fire("error",new Error("Canvas dimensions cannot be less than or equal to zero."));var i;this.play=function(){void 0===i&&(i=this.map.style.animationLoop.set(1/0),this.map._rerender())},this.pause=function(){void 0!==i&&(i=this.map.style.animationLoop.cancel(i))},this._finishLoading()},i.prototype.getCanvas=function(){return this.canvas},i.prototype.onAdd=function(t){this.map=t,this.load(),this.canvas&&this.animate&&this.play()},i.prototype.onRemove=function(){this.pause()},i.prototype.readCanvas=function(t){var i=this;if(this.context instanceof CanvasRenderingContext2D)this.canvasData=this.context.getImageData(0,0,this.width,this.height);else if(this.context instanceof WebGLRenderingContext){var a=this.context,e=new Uint8Array(this.width*this.height*4);a.readPixels(0,0,this.width,this.height,a.RGBA,a.UNSIGNED_BYTE,e),this.secondaryContext||(this.secondaryContext=window.document.createElement("canvas").getContext("2d")),this.canvasData&&!t||(this.canvasData=this.secondaryContext.createImageData(this.width,this.height));for(var s=this.height-1,n=0;s>=0;s--,n++)i.canvasData.data.set(e.subarray(s*i.width*4,(s+1)*i.width*4),n*i.width*4)}},i.prototype.prepare=function(){var t=!1;if(this.canvas.width!==this.width&&(this.width=this.canvas.width,t=!0),this.canvas.height!==this.height&&(this.height=this.canvas.height,t=!0),!this._hasInvalidDimensions()&&0!==Object.keys(this.tiles).length){if((this.animate||!this.canvasData||t)&&this.readCanvas(t),!this.canvasData)return void this.fire("error",new Error("Could not read canvas data."));this._prepareImage(this.map.painter.gl,this.canvasData,t)}},i.prototype.serialize=function(){return{type:"canvas",canvas:this.canvas,coordinates:this.coordinates}},i.prototype._hasInvalidDimensions=function(){for(var t=this,i=0,a=[t.canvas.width,t.canvas.height];i<a.length;i+=1){var e=a[i];if(isNaN(e)||e<=0)return!0}return!1},i}(ImageSource);module.exports=CanvasSource;
},{"../util/window":204,"./image_source":91}],88:[function(_dereq_,module,exports){
"use strict";function resolveURL(t){var e=window.document.createElement("a");return e.href=t,e.href}var Evented=_dereq_("../util/evented"),util=_dereq_("../util/util"),window=_dereq_("../util/window"),EXTENT=_dereq_("../data/extent"),ResourceType=_dereq_("../util/ajax").ResourceType,browser=_dereq_("../util/browser"),GeoJSONSource=function(t){function e(e,o,r,i){t.call(this),this.id=e,this.type="geojson",this.minzoom=0,this.maxzoom=18,this.tileSize=512,this.isTileClipped=!0,this.reparseOverscaled=!0,this.dispatcher=r,this.setEventedParent(i),this._data=o.data,this._options=util.extend({},o),void 0!==o.maxzoom&&(this.maxzoom=o.maxzoom),o.type&&(this.type=o.type);var a=EXTENT/this.tileSize;this.workerOptions=util.extend({source:this.id,cluster:o.cluster||!1,geojsonVtOptions:{buffer:(void 0!==o.buffer?o.buffer:128)*a,tolerance:(void 0!==o.tolerance?o.tolerance:.375)*a,extent:EXTENT,maxZoom:this.maxzoom},superclusterOptions:{maxZoom:void 0!==o.clusterMaxZoom?Math.min(o.clusterMaxZoom,this.maxzoom-1):this.maxzoom-1,extent:EXTENT,radius:(o.clusterRadius||50)*a,log:!1}},o.workerOptions)}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.load=function(){var t=this;this.fire("dataloading",{dataType:"source"}),this._updateWorkerData(function(e){if(e)return void t.fire("error",{error:e});t.fire("data",{dataType:"source",sourceDataType:"metadata"})})},e.prototype.onAdd=function(t){this.map=t,this.load()},e.prototype.setData=function(t){var e=this;return this._data=t,this.fire("dataloading",{dataType:"source"}),this._updateWorkerData(function(t){if(t)return e.fire("error",{error:t});e.fire("data",{dataType:"source",sourceDataType:"content"})}),this},e.prototype._updateWorkerData=function(t){var e=this,o=util.extend({},this.workerOptions),r=this._data;"string"==typeof r?o.request=this.map._transformRequest(resolveURL(r),ResourceType.Source):o.data=JSON.stringify(r),this.workerID=this.dispatcher.send(this.type+".loadData",o,function(o){e._loaded=!0,t(o)},this.workerID)},e.prototype.loadTile=function(t,e){var o=this,r=t.workerID&&"expired"!==t.state?"reloadTile":"loadTile",i={type:this.type,uid:t.uid,coord:t.coord,zoom:t.coord.z,maxZoom:this.maxzoom,tileSize:this.tileSize,source:this.id,pixelRatio:browser.devicePixelRatio,overscaling:t.coord.z>this.maxzoom?Math.pow(2,t.coord.z-this.maxzoom):1,angle:this.map.transform.angle,pitch:this.map.transform.pitch,cameraToCenterDistance:this.map.transform.cameraToCenterDistance,cameraToTileDistance:this.map.transform.cameraToTileDistance(t),showCollisionBoxes:this.map.showCollisionBoxes};t.workerID=this.dispatcher.send(r,i,function(r,i){if(t.unloadVectorData(),!t.aborted)return r?e(r):(t.loadVectorData(i,o.map.painter),t.redoWhenDone&&(t.redoWhenDone=!1,t.redoPlacement(o)),e(null))},this.workerID)},e.prototype.abortTile=function(t){t.aborted=!0},e.prototype.unloadTile=function(t){t.unloadVectorData(),this.dispatcher.send("removeTile",{uid:t.uid,type:this.type,source:this.id},function(){},t.workerID)},e.prototype.onRemove=function(){this.dispatcher.broadcast("removeSource",{type:this.type,source:this.id},function(){})},e.prototype.serialize=function(){return util.extend({},this._options,{type:this.type,data:this._data})},e}(Evented);module.exports=GeoJSONSource;
},{"../data/extent":48,"../util/ajax":201,"../util/browser":202,"../util/evented":210,"../util/util":223,"../util/window":204}],89:[function(_dereq_,module,exports){
"use strict";function loadGeoJSONTile(e,r){var t=e.source,o=e.coord;if(!this._geoJSONIndexes[t])return r(null,null);var n=this._geoJSONIndexes[t].getTile(Math.min(o.z,e.maxZoom),o.x,o.y);if(!n)return r(null,null);var u=new GeoJSONWrapper(n.features),i=vtpbf(u);0===i.byteOffset&&i.byteLength===i.buffer.byteLength||(i=new Uint8Array(i)),r(null,{vectorTile:u,rawData:i.buffer})}var ajax=_dereq_("../util/ajax"),rewind=_dereq_("geojson-rewind"),GeoJSONWrapper=_dereq_("./geojson_wrapper"),vtpbf=_dereq_("vt-pbf"),supercluster=_dereq_("supercluster"),geojsonvt=_dereq_("geojson-vt"),VectorTileWorkerSource=_dereq_("./vector_tile_worker_source"),GeoJSONWorkerSource=function(e){function r(r,t,o){e.call(this,r,t,loadGeoJSONTile),o&&(this.loadGeoJSON=o),this._geoJSONIndexes={}}return e&&(r.__proto__=e),r.prototype=Object.create(e&&e.prototype),r.prototype.constructor=r,r.prototype.loadData=function(e,r){var t=this;this.loadGeoJSON(e,function(o,n){if(o||!n)return r(o);if("object"!=typeof n)return r(new Error("Input data is not a valid GeoJSON object."));rewind(n,!0);try{t._geoJSONIndexes[e.source]=e.cluster?supercluster(e.superclusterOptions).load(n.features):geojsonvt(n,e.geojsonVtOptions)}catch(o){return r(o)}t.loaded[e.source]={},r(null)})},r.prototype.reloadTile=function(r,t){var o=this.loaded[r.source],n=r.uid;return o&&o[n]?e.prototype.reloadTile.call(this,r,t):this.loadTile(r,t)},r.prototype.loadGeoJSON=function(e,r){if(e.request)ajax.getJSON(e.request,r);else{if("string"!=typeof e.data)return r(new Error("Input data is not a valid GeoJSON object."));try{return r(null,JSON.parse(e.data))}catch(e){return r(new Error("Input data is not a valid GeoJSON object."))}}},r.prototype.removeSource=function(e){this._geoJSONIndexes[e.source]&&delete this._geoJSONIndexes[e.source]},r}(VectorTileWorkerSource);module.exports=GeoJSONWorkerSource;
},{"../util/ajax":201,"./geojson_wrapper":90,"./vector_tile_worker_source":103,"geojson-rewind":13,"geojson-vt":17,"supercluster":32,"vt-pbf":37}],90:[function(_dereq_,module,exports){
"use strict";var Point=_dereq_("@mapbox/point-geometry"),toGeoJSON=_dereq_("@mapbox/vector-tile").VectorTileFeature.prototype.toGeoJSON,EXTENT=_dereq_("../data/extent"),FeatureWrapper=function(e){this._feature=e,this.extent=EXTENT,this.type=e.type,this.properties=e.tags,"id"in e&&!isNaN(e.id)&&(this.id=parseInt(e.id,10))};FeatureWrapper.prototype.loadGeometry=function(){var e=this;if(1===this._feature.type){for(var t=[],r=0,o=e._feature.geometry;r<o.length;r+=1){var a=o[r];t.push([new Point(a[0],a[1])])}return t}for(var i=[],p=0,n=e._feature.geometry;p<n.length;p+=1){for(var s=n[p],u=[],h=0,f=s;h<f.length;h+=1){var l=f[h];u.push(new Point(l[0],l[1]))}i.push(u)}return i},FeatureWrapper.prototype.toGeoJSON=function(e,t,r){return toGeoJSON.call(this,e,t,r)};var GeoJSONWrapper=function(e){this.layers={_geojsonTileLayer:this},this.name="_geojsonTileLayer",this.extent=EXTENT,this.length=e.length,this._features=e};GeoJSONWrapper.prototype.feature=function(e){return new FeatureWrapper(this._features[e])},module.exports=GeoJSONWrapper;
},{"../data/extent":48,"@mapbox/point-geometry":2,"@mapbox/vector-tile":6}],91:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),window=_dereq_("../util/window"),TileCoord=_dereq_("./tile_coord"),LngLat=_dereq_("../geo/lng_lat"),Point=_dereq_("@mapbox/point-geometry"),Evented=_dereq_("../util/evented"),ajax=_dereq_("../util/ajax"),browser=_dereq_("../util/browser"),EXTENT=_dereq_("../data/extent"),RasterBoundsArray=_dereq_("../data/raster_bounds_array"),VertexBuffer=_dereq_("../gl/vertex_buffer"),VertexArrayObject=_dereq_("../render/vertex_array_object"),ImageSource=function(e){function t(t,r,o,i){e.call(this),this.id=t,this.dispatcher=o,this.coordinates=r.coordinates,this.type="image",this.minzoom=0,this.maxzoom=22,this.tileSize=512,this.tiles={},this.setEventedParent(i),this.options=r,this.textureLoaded=!1}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.load=function(){var e=this;this.fire("dataloading",{dataType:"source"}),this.url=this.options.url,ajax.getImage(this.map._transformRequest(this.url,ajax.ResourceType.Image),function(t,r){t?e.fire("error",{error:t}):r&&(e.image=browser.getImageData(r),e._finishLoading())})},t.prototype._finishLoading=function(){this.map&&(this.setCoordinates(this.coordinates),this.fire("data",{dataType:"source",sourceDataType:"metadata"}))},t.prototype.onAdd=function(e){this.map=e,this.load()},t.prototype.setCoordinates=function(e){this.coordinates=e;var t=this.map,r=e.map(function(e){return t.transform.locationCoordinate(LngLat.convert(e)).zoomTo(0)}),o=this.centerCoord=util.getCoordinatesCenter(r);o.column=Math.floor(o.column),o.row=Math.floor(o.row),this.coord=new TileCoord(o.zoom,o.column,o.row),this.minzoom=this.maxzoom=o.zoom;var i=r.map(function(e){var t=e.zoomTo(o.zoom);return new Point(Math.round((t.column-o.column)*EXTENT),Math.round((t.row-o.row)*EXTENT))});return this._boundsArray=new RasterBoundsArray,this._boundsArray.emplaceBack(i[0].x,i[0].y,0,0),this._boundsArray.emplaceBack(i[1].x,i[1].y,EXTENT,0),this._boundsArray.emplaceBack(i[3].x,i[3].y,0,EXTENT),this._boundsArray.emplaceBack(i[2].x,i[2].y,EXTENT,EXTENT),this.boundsBuffer&&(this.boundsBuffer.destroy(),delete this.boundsBuffer),this.fire("data",{dataType:"source",sourceDataType:"content"}),this},t.prototype.prepare=function(){0!==Object.keys(this.tiles).length&&this.image&&this._prepareImage(this.map.painter.gl,this.image)},t.prototype._prepareImage=function(e,t,r){var o=this;this.boundsBuffer||(this.boundsBuffer=new VertexBuffer(e,this._boundsArray)),this.boundsVAO||(this.boundsVAO=new VertexArrayObject),this.textureLoaded?r?e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t):(t instanceof window.HTMLVideoElement||t instanceof window.ImageData)&&(e.bindTexture(e.TEXTURE_2D,this.texture),e.texSubImage2D(e.TEXTURE_2D,0,0,0,e.RGBA,e.UNSIGNED_BYTE,t)):(this.textureLoaded=!0,this.texture=e.createTexture(),e.bindTexture(e.TEXTURE_2D,this.texture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t));for(var i in o.tiles){var a=o.tiles[i];"loaded"!==a.state&&(a.state="loaded",a.texture=o.texture)}},t.prototype.loadTile=function(e,t){this.coord&&this.coord.toString()===e.coord.toString()?(this.tiles[String(e.coord.w)]=e,e.buckets={},t(null)):(e.state="errored",t(null))},t.prototype.serialize=function(){return{type:"image",url:this.options.url,coordinates:this.coordinates}},t}(Evented);module.exports=ImageSource;
},{"../data/extent":48,"../data/raster_bounds_array":54,"../geo/lng_lat":58,"../gl/vertex_buffer":62,"../render/vertex_array_object":84,"../util/ajax":201,"../util/browser":202,"../util/evented":210,"../util/util":223,"../util/window":204,"./tile_coord":101,"@mapbox/point-geometry":2}],92:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),ajax=_dereq_("../util/ajax"),browser=_dereq_("../util/browser"),normalizeURL=_dereq_("../util/mapbox").normalizeSourceURL;module.exports=function(r,e,o){var u=function(r,e){if(r)return o(r);if(e){var u=util.pick(e,["tiles","minzoom","maxzoom","attribution","mapbox_logo","bounds"]);e.vector_layers&&(u.vectorLayers=e.vector_layers,u.vectorLayerIds=u.vectorLayers.map(function(r){return r.id})),o(null,u)}};r.url?ajax.getJSON(e(normalizeURL(r.url),ajax.ResourceType.Source),u):browser.frame(function(){return u(null,r)})};
},{"../util/ajax":201,"../util/browser":202,"../util/mapbox":217,"../util/util":223}],93:[function(_dereq_,module,exports){
"use strict";var EXTENT=_dereq_("../data/extent");module.exports=function(e,t,r){return t*(EXTENT/(e.tileSize*Math.pow(2,r-e.coord.z)))};
},{"../data/extent":48}],94:[function(_dereq_,module,exports){
"use strict";function sortTilesIn(e,r){var o=e.coord,t=r.coord;return o.z-t.z||o.y-t.y||o.w-t.w||o.x-t.x}function mergeRenderedFeatureLayers(e){for(var r={},o={},t=0,n=e;t<n.length;t+=1){var u=n[t],a=u.queryResults,d=u.wrappedTileID,s=o[d]=o[d]||{};for(var i in a)for(var l=a[i],c=s[i]=s[i]||{},f=r[i]=r[i]||[],v=0,y=l;v<y.length;v+=1){var p=y[v];c[p.featureIndex]||(c[p.featureIndex]=!0,f.push(p.feature))}}return r}var TileCoord=_dereq_("./tile_coord");exports.rendered=function(e,r,o,t,n,u){var a=e.tilesIn(o);a.sort(sortTilesIn);for(var d=[],s=0,i=a;s<i.length;s+=1){var l=i[s];d.push({wrappedTileID:l.coord.wrapped().id,queryResults:l.tile.queryRenderedFeatures(r,l.queryGeometry,l.scale,t,u)})}return mergeRenderedFeatureLayers(d)},exports.source=function(e,r){for(var o=e.getRenderableIds().map(function(r){return e.getTileByID(r)}),t=[],n={},u=0;u<o.length;u++){var a=o[u],d=new TileCoord(Math.min(a.sourceMaxZoom,a.coord.z),a.coord.x,a.coord.y,0).id;n[d]||(n[d]=!0,a.querySourceFeatures(t,r))}return t};
},{"./tile_coord":101}],95:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),ajax=_dereq_("../util/ajax"),Evented=_dereq_("../util/evented"),loadTileJSON=_dereq_("./load_tilejson"),normalizeURL=_dereq_("../util/mapbox").normalizeTileURL,TileBounds=_dereq_("./tile_bounds"),RasterTileSource=function(e){function t(t,i,r,o){e.call(this),this.id=t,this.dispatcher=r,this.setEventedParent(o),this.type="raster",this.minzoom=0,this.maxzoom=22,this.roundZoom=!0,this.scheme="xyz",this.tileSize=512,this._loaded=!1,this._options=util.extend({},i),util.extend(this,util.pick(i,["url","scheme","tileSize"]))}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.load=function(){var e=this;this.fire("dataloading",{dataType:"source"}),loadTileJSON(this._options,this.map._transformRequest,function(t,i){t?e.fire("error",t):i&&(util.extend(e,i),i.bounds&&(e.tileBounds=new TileBounds(i.bounds,e.minzoom,e.maxzoom)),e.fire("data",{dataType:"source",sourceDataType:"metadata"}),e.fire("data",{dataType:"source",sourceDataType:"content"}))})},t.prototype.onAdd=function(e){this.map=e,this.load()},t.prototype.serialize=function(){return util.extend({},this._options)},t.prototype.hasTile=function(e){return!this.tileBounds||this.tileBounds.contains(e,this.maxzoom)},t.prototype.loadTile=function(e,t){var i=this,r=normalizeURL(e.coord.url(this.tiles,null,this.scheme),this.url,this.tileSize);e.request=ajax.getImage(this.map._transformRequest(r,ajax.ResourceType.Tile),function(r,o){if(delete e.request,e.aborted)i.state="unloaded",t(null);else if(r)i.state="errored",t(r);else if(o){i.map._refreshExpiredTiles&&e.setExpiryData(o),delete o.cacheControl,delete o.expires;var a=i.map.painter.gl;e.texture=i.map.painter.getTileTexture(o.width),e.texture?(a.bindTexture(a.TEXTURE_2D,e.texture),a.texSubImage2D(a.TEXTURE_2D,0,0,0,a.RGBA,a.UNSIGNED_BYTE,o)):(e.texture=a.createTexture(),a.bindTexture(a.TEXTURE_2D,e.texture),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.LINEAR_MIPMAP_NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.LINEAR),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),a.pixelStorei(a.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!0),i.map.painter.extTextureFilterAnisotropic&&a.texParameterf(a.TEXTURE_2D,i.map.painter.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT,i.map.painter.extTextureFilterAnisotropicMax),a.texImage2D(a.TEXTURE_2D,0,a.RGBA,a.RGBA,a.UNSIGNED_BYTE,o),e.texture.size=o.width),a.generateMipmap(a.TEXTURE_2D),e.state="loaded",t(null)}})},t.prototype.abortTile=function(e){e.request&&(e.request.abort(),delete e.request)},t.prototype.unloadTile=function(e){e.texture&&this.map.painter.saveTileTexture(e.texture)},t}(Evented);module.exports=RasterTileSource;
},{"../util/ajax":201,"../util/evented":210,"../util/mapbox":217,"../util/util":223,"./load_tilejson":92,"./tile_bounds":100}],96:[function(_dereq_,module,exports){
"use strict";var ajax=_dereq_("../util/ajax"),Evented=_dereq_("../util/evented"),window=_dereq_("../util/window"),pluginRequested=!1,pluginBlobURL=null;module.exports.evented=new Evented,module.exports.registerForPluginAvailability=function(e){return pluginBlobURL?e({pluginBlobURL:pluginBlobURL,errorCallback:module.exports.errorCallback}):module.exports.evented.once("pluginAvailable",e),e},module.exports.createBlobURL=function(e){return window.URL.createObjectURL(new window.Blob([e.data],{type:"text/javascript"}))},module.exports.clearRTLTextPlugin=function(){pluginRequested=!1,pluginBlobURL=null},module.exports.setRTLTextPlugin=function(e,l){if(pluginRequested)throw new Error("setRTLTextPlugin cannot be called multiple times.");pluginRequested=!0,module.exports.errorCallback=l,ajax.getArrayBuffer({url:e},function(e,t){e?l(e):t&&(pluginBlobURL=module.exports.createBlobURL(t),module.exports.evented.fire("pluginAvailable",{pluginBlobURL:pluginBlobURL,errorCallback:l}))})},module.exports.applyArabicShaping=null,module.exports.processBidirectionalText=null;
},{"../util/ajax":201,"../util/evented":210,"../util/window":204}],97:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),sourceTypes={vector:_dereq_("../source/vector_tile_source"),raster:_dereq_("../source/raster_tile_source"),geojson:_dereq_("../source/geojson_source"),video:_dereq_("../source/video_source"),image:_dereq_("../source/image_source"),canvas:_dereq_("../source/canvas_source")};exports.create=function(e,r,o,u){var s=new sourceTypes[r.type](e,r,o,u);if(s.id!==e)throw new Error("Expected Source id to be "+e+" instead of "+s.id);return util.bindAll(["load","abort","unload","serialize","prepare"],s),s},exports.getType=function(e){return sourceTypes[e]},exports.setType=function(e,r){sourceTypes[e]=r};
},{"../source/canvas_source":87,"../source/geojson_source":88,"../source/image_source":91,"../source/raster_tile_source":95,"../source/vector_tile_source":102,"../source/video_source":104,"../util/util":223}],98:[function(_dereq_,module,exports){
"use strict";function coordinateToTilePoint(e,t,o){var i=o.zoomTo(Math.min(e.z,t));return new Point((i.column-(e.x+e.w*Math.pow(2,e.z)))*EXTENT,(i.row-e.y)*EXTENT)}function compareKeyZoom(e,t){return e%32-t%32}function isRasterType(e){return"raster"===e||"image"===e||"video"===e}var createSource=_dereq_("./source").create,Tile=_dereq_("./tile"),Evented=_dereq_("../util/evented"),TileCoord=_dereq_("./tile_coord"),Cache=_dereq_("../util/lru_cache"),Coordinate=_dereq_("../geo/coordinate"),util=_dereq_("../util/util"),EXTENT=_dereq_("../data/extent"),Point=_dereq_("@mapbox/point-geometry"),SourceCache=function(e){function t(t,o,i){var r=this;e.call(this),this.id=t,this.dispatcher=i,this.on("data",function(e){"source"===e.dataType&&"metadata"===e.sourceDataType&&(r._sourceLoaded=!0),r._sourceLoaded&&!r._paused&&"source"===e.dataType&&"content"===e.sourceDataType&&(r.reload(),r.transform&&r.update(r.transform))}),this.on("error",function(){r._sourceErrored=!0}),this._source=createSource(t,o,i,this),this._tiles={},this._cache=new Cache(0,this._unloadTile.bind(this)),this._timers={},this._cacheTimers={},this._maxTileCacheSize=null,this._isIdRenderable=this._isIdRenderable.bind(this)}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.onAdd=function(e){this.map=e,this._maxTileCacheSize=e?e._maxTileCacheSize:null,this._source&&this._source.onAdd&&this._source.onAdd(e)},t.prototype.onRemove=function(e){this._source&&this._source.onRemove&&this._source.onRemove(e)},t.prototype.loaded=function(){var e=this;if(this._sourceErrored)return!0;if(!this._sourceLoaded)return!1;for(var t in e._tiles){var o=e._tiles[t];if("loaded"!==o.state&&"errored"!==o.state)return!1}return!0},t.prototype.getSource=function(){return this._source},t.prototype.pause=function(){this._paused=!0},t.prototype.resume=function(){if(this._paused){var e=this._shouldReloadOnResume;this._paused=!1,this._shouldReloadOnResume=!1,e&&this.reload(),this.transform&&this.update(this.transform)}},t.prototype._loadTile=function(e,t){return this._source.loadTile(e,t)},t.prototype._unloadTile=function(e){if(this._source.unloadTile)return this._source.unloadTile(e)},t.prototype._abortTile=function(e){if(this._source.abortTile)return this._source.abortTile(e)},t.prototype.serialize=function(){return this._source.serialize()},t.prototype.prepare=function(e){var t=this;this._source.prepare&&this._source.prepare();for(var o in t._tiles)t._tiles[o].upload(e)},t.prototype.getIds=function(){return Object.keys(this._tiles).map(Number).sort(compareKeyZoom)},t.prototype.getRenderableIds=function(){return this.getIds().filter(this._isIdRenderable)},t.prototype._isIdRenderable=function(e){return this._tiles[e].hasData()&&!this._coveredTiles[e]},t.prototype.reload=function(){var e=this;if(this._paused)return void(this._shouldReloadOnResume=!0);this._cache.reset();for(var t in e._tiles)e._reloadTile(t,"reloading")},t.prototype._reloadTile=function(e,t){var o=this._tiles[e];o&&("loading"!==o.state&&(o.state=t),this._loadTile(o,this._tileLoaded.bind(this,o,e,t)))},t.prototype._tileLoaded=function(e,t,o,i){if(i)return e.state="errored",void(404!==i.status?this._source.fire("error",{tile:e,error:i}):this.update(this.transform));e.timeAdded=(new Date).getTime(),"expired"===o&&(e.refreshedUponExpiration=!0),this._setTileReloadTimer(t,e),this._source.fire("data",{dataType:"source",tile:e,coord:e.coord}),this.map&&(this.map.painter.tileExtentVAO.vao=null)},t.prototype.getTile=function(e){return this.getTileByID(e.id)},t.prototype.getTileByID=function(e){return this._tiles[e]},t.prototype.getZoom=function(e){return e.zoom+e.scaleZoom(e.tileSize/this._source.tileSize)},t.prototype._findLoadedChildren=function(e,t,o){var i=this,r=!1;for(var s in i._tiles){var a=i._tiles[s];if(!(o[s]||!a.hasData()||a.coord.z<=e.z||a.coord.z>t)){var n=Math.pow(2,Math.min(a.coord.z,i._source.maxzoom)-Math.min(e.z,i._source.maxzoom));if(Math.floor(a.coord.x/n)===e.x&&Math.floor(a.coord.y/n)===e.y)for(o[s]=!0,r=!0;a&&a.coord.z-1>e.z;){var d=a.coord.parent(i._source.maxzoom);if(!d)break;a=i._tiles[d.id],a&&a.hasData()&&(delete o[s],o[d.id]=!0)}}}return r},t.prototype.findLoadedParent=function(e,t,o){for(var i=this,r=e.z-1;r>=t;r--){var s=e.parent(i._source.maxzoom);if(!s)return;e=s;var a=String(e.id),n=i._tiles[a];if(n&&n.hasData())return o[a]=!0,n;if(i._cache.has(a))return o[a]=!0,i._cache.getWithoutRemoving(a)}},t.prototype.updateCacheSize=function(e){var t=Math.ceil(e.width/e.tileSize)+1,o=Math.ceil(e.height/e.tileSize)+1,i=t*o,r=Math.floor(5*i),s="number"==typeof this._maxTileCacheSize?Math.min(this._maxTileCacheSize,r):r;this._cache.setMaxSize(s)},t.prototype.update=function(e){var o=this;if(this.transform=e,this._sourceLoaded&&!this._paused){this.updateCacheSize(e),this._coveredTiles={};var i;this.used?this._source.coord?i=e.getVisibleWrappedCoordinates(this._source.coord):(i=e.coveringTiles({tileSize:this._source.tileSize,minzoom:this._source.minzoom,maxzoom:this._source.maxzoom,roundZoom:this._source.roundZoom,reparseOverscaled:this._source.reparseOverscaled}),this._source.hasTile&&(i=i.filter(function(e){return o._source.hasTile(e)}))):i=[];var r=(this._source.roundZoom?Math.round:Math.floor)(this.getZoom(e)),s=Math.max(r-t.maxOverzooming,this._source.minzoom),a=Math.max(r+t.maxUnderzooming,this._source.minzoom),n=this._updateRetainedTiles(i,r),d={};if(isRasterType(this._source.type))for(var h=Object.keys(n),u=0;u<h.length;u++){var c=h[u],l=TileCoord.fromID(+c),_=o._tiles[c];if(_&&(void 0===_.fadeEndTime||_.fadeEndTime>=Date.now())){o._findLoadedChildren(l,a,n)&&(n[c]=!0);var m=o.findLoadedParent(l,s,d);m&&o._addTile(m.coord)}}var p;for(p in d)n[p]||(o._coveredTiles[p]=!0);for(p in d)n[p]=!0;for(var f=util.keysDifference(this._tiles,n),T=0;T<f.length;T++)o._removeTile(f[T])}},t.prototype._updateRetainedTiles=function(e,o){var i,r,s,a,n=this,d={},h={},u=Math.max(o-t.maxOverzooming,this._source.minzoom);for(i=0;i<e.length;i++){r=e[i],s=n._addTile(r);var c=!1;if(s.hasData())d[r.id]=!0;else{c=s.wasRequested(),d[r.id]=!0,a=!0;if(o+1>n._source.maxzoom){var l=r.children(n._source.maxzoom)[0],_=n.getTile(l);_&&_.hasData()?d[l.id]=!0:a=!1}else for(var m=r.children(n._source.maxzoom),p=0;p<m.length;p++){var f=m[p],T=f?n.getTile(f):null;T&&T.hasData()?d[f.id]=!0:a=!1}if(!a)for(var v=o-1;v>=u;--v){var y=r.scaledTo(v,n._source.maxzoom);if(h[y.id])break;if(h[y.id]=!0,s=n.getTile(y),!s&&c&&(s=n._addTile(y)),s&&(d[y.id]=!0,c=s.wasRequested(),s.hasData()))break}}}return d},t.prototype._addTile=function(e){var t=this._tiles[e.id];if(t)return t;(t=this._cache.get(e.id))&&(t.redoPlacement(this._source),this._cacheTimers[e.id]&&(clearTimeout(this._cacheTimers[e.id]),delete this._cacheTimers[e.id],this._setTileReloadTimer(e.id,t)));var o=Boolean(t);if(!o){var i=e.z,r=i>this._source.maxzoom?Math.pow(2,i-this._source.maxzoom):1;t=new Tile(e,this._source.tileSize*r,this._source.maxzoom),this._loadTile(t,this._tileLoaded.bind(this,t,e.id,t.state))}return t?(t.uses++,this._tiles[e.id]=t,o||this._source.fire("dataloading",{tile:t,coord:t.coord,dataType:"source"}),t):null},t.prototype._setTileReloadTimer=function(e,t){var o=this,i=t.getExpiryTimeout();i&&(this._timers[e]=setTimeout(function(){o._reloadTile(e,"expired"),delete o._timers[e]},i))},t.prototype._setCacheInvalidationTimer=function(e,t){var o=this,i=t.getExpiryTimeout();i&&(this._cacheTimers[e]=setTimeout(function(){o._cache.remove(e),delete o._cacheTimers[e]},i))},t.prototype._removeTile=function(e){var t=this._tiles[e];if(t&&(t.uses--,delete this._tiles[e],this._timers[e]&&(clearTimeout(this._timers[e]),delete this._timers[e]),!(t.uses>0)))if(t.stopPlacementThrottler(),t.hasData()){var o=t.coord.wrapped().id;this._cache.add(o,t),this._setCacheInvalidationTimer(o,t)}else t.aborted=!0,this._abortTile(t),this._unloadTile(t)},t.prototype.clearTiles=function(){var e=this;this._shouldReloadOnResume=!1,this._paused=!1;for(var t in e._tiles)e._removeTile(t);this._cache.reset()},t.prototype.tilesIn=function(e){for(var t=this,o=[],i=this.getIds(),r=1/0,s=1/0,a=-1/0,n=-1/0,d=e[0].zoom,h=0;h<e.length;h++){var u=e[h];r=Math.min(r,u.column),s=Math.min(s,u.row),a=Math.max(a,u.column),n=Math.max(n,u.row)}for(var c=0;c<i.length;c++){var l=t._tiles[i[c]],_=TileCoord.fromID(i[c]),m=[coordinateToTilePoint(_,l.sourceMaxZoom,new Coordinate(r,s,d)),coordinateToTilePoint(_,l.sourceMaxZoom,new Coordinate(a,n,d))];if(m[0].x<EXTENT&&m[0].y<EXTENT&&m[1].x>=0&&m[1].y>=0){for(var p=[],f=0;f<e.length;f++)p.push(coordinateToTilePoint(_,l.sourceMaxZoom,e[f]));o.push({tile:l,coord:_,queryGeometry:[p],scale:Math.pow(2,t.transform.zoom-l.coord.z)})}}return o},t.prototype.redoPlacement=function(){for(var e=this,t=this.getIds(),o=0;o<t.length;o++){e.getTileByID(t[o]).redoPlacement(e._source)}},t.prototype.getVisibleCoordinates=function(){for(var e=this,t=this.getRenderableIds().map(TileCoord.fromID),o=0,i=t;o<i.length;o+=1){var r=i[o];r.posMatrix=e.transform.calculatePosMatrix(r,e._source.maxzoom)}return t},t}(Evented);SourceCache.maxOverzooming=10,SourceCache.maxUnderzooming=3,module.exports=SourceCache;
},{"../data/extent":48,"../geo/coordinate":57,"../util/evented":210,"../util/lru_cache":216,"../util/util":223,"./source":97,"./tile":99,"./tile_coord":101,"@mapbox/point-geometry":2}],99:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),deserializeBucket=_dereq_("../data/bucket").deserialize,SymbolBucket=_dereq_("../data/bucket/symbol_bucket"),FeatureIndex=_dereq_("../data/feature_index"),vt=_dereq_("@mapbox/vector-tile"),Protobuf=_dereq_("pbf"),GeoJSONFeature=_dereq_("../util/vectortile_to_geojson"),featureFilter=_dereq_("../style-spec/feature_filter"),CollisionTile=_dereq_("../symbol/collision_tile"),CollisionBoxArray=_dereq_("../symbol/collision_box"),Throttler=_dereq_("../util/throttler"),Texture=_dereq_("../render/texture"),CLOCK_SKEW_RETRY_TIMEOUT=3e4,Tile=function(e,t,i){this.coord=e,this.uid=util.uniqueId(),this.uses=0,this.tileSize=t,this.sourceMaxZoom=i,this.buckets={},this.expirationTime=null,this.expiredRequestCount=0,this.state="loading",this.placementThrottler=new Throttler(300,this._immediateRedoPlacement.bind(this))};Tile.prototype.registerFadeDuration=function(e,t){var i=t+this.timeAdded;i<Date.now()||this.fadeEndTime&&i<this.fadeEndTime||(this.fadeEndTime=i,e.set(this.fadeEndTime-Date.now()))},Tile.prototype.wasRequested=function(){return"errored"===this.state||"loaded"===this.state||"reloading"===this.state},Tile.prototype.loadVectorData=function(e,t){this.hasData()&&this.unloadVectorData(),this.state="loaded",e&&(e.rawTileData&&(this.rawTileData=e.rawTileData),this.collisionBoxArray=new CollisionBoxArray(e.collisionBoxArray),this.collisionTile=CollisionTile.deserialize(e.collisionTile,this.collisionBoxArray),this.featureIndex=FeatureIndex.deserialize(e.featureIndex,this.rawTileData,this.collisionTile),this.buckets=deserializeBucket(e.buckets,t.style),e.iconAtlasImage&&(this.iconAtlasImage=e.iconAtlasImage),e.glyphAtlasImage&&(this.glyphAtlasImage=e.glyphAtlasImage))},Tile.prototype.reloadSymbolData=function(e,t){var i=this;if("unloaded"!==this.state){this.collisionTile=CollisionTile.deserialize(e.collisionTile,this.collisionBoxArray),this.featureIndex&&this.featureIndex.setCollisionTile(this.collisionTile);for(var a in i.buckets){var s=i.buckets[a];s instanceof SymbolBucket&&(s.destroy(),delete i.buckets[a])}util.extend(this.buckets,deserializeBucket(e.buckets,t)),e.iconAtlasImage&&(this.iconAtlasImage=e.iconAtlasImage),e.glyphAtlasImage&&(this.glyphAtlasImage=e.glyphAtlasImage)}},Tile.prototype.unloadVectorData=function(){var e=this;for(var t in e.buckets)e.buckets[t].destroy();this.buckets={},this.iconAtlasTexture&&this.iconAtlasTexture.destroy(),this.glyphAtlasTexture&&this.glyphAtlasTexture.destroy(),this.collisionBoxArray=null,this.collisionTile=null,this.featureIndex=null,this.state="unloaded"},Tile.prototype.redoPlacement=function(e){if("vector"===e.type||"geojson"===e.type){if("loaded"!==this.state)return void(this.redoWhenDone=!0);if(this.collisionTile){var t=e.map.transform.cameraToTileDistance(this);if(this.angle===e.map.transform.angle&&this.pitch===e.map.transform.pitch&&this.showCollisionBoxes===e.map.showCollisionBoxes){if(this.cameraToTileDistance===t&&this.cameraToCenterDistance===e.map.transform.cameraToCenterDistance)return;if(this.pitch<25)return this.cameraToTileDistance=t,void(this.cameraToCenterDistance=e.map.transform.cameraToCenterDistance)}this.angle=e.map.transform.angle,this.pitch=e.map.transform.pitch,this.cameraToCenterDistance=e.map.transform.cameraToCenterDistance,this.cameraToTileDistance=t,this.showCollisionBoxes=e.map.showCollisionBoxes,this.placementSource=e,this.state="reloading",this.placementThrottler.invoke()}}},Tile.prototype._immediateRedoPlacement=function(){var e=this;this.placementSource.dispatcher.send("redoPlacement",{type:this.placementSource.type,uid:this.uid,source:this.placementSource.id,angle:this.angle,pitch:this.pitch,cameraToCenterDistance:this.cameraToCenterDistance,cameraToTileDistance:this.cameraToTileDistance,showCollisionBoxes:this.showCollisionBoxes},function(t,i){"reloading"===e.state&&(e.state="loaded",e.reloadSymbolData(i,e.placementSource.map.style),e.placementSource.fire("data",{tile:e,coord:e.coord,dataType:"source"}),e.placementSource.map&&(e.placementSource.map.painter.tileExtentVAO.vao=null),e.redoWhenDone&&(e.state="reloading",e.redoWhenDone=!1,e._immediateRedoPlacement()))},this.workerID)},Tile.prototype.getBucket=function(e){return this.buckets[e.id]},Tile.prototype.upload=function(e){var t=this;for(var i in t.buckets){var a=t.buckets[i];a.uploaded||(a.upload(e),a.uploaded=!0)}this.iconAtlasImage&&(this.iconAtlasTexture=new Texture(e,this.iconAtlasImage,e.RGBA),this.iconAtlasImage=null),this.glyphAtlasImage&&(this.glyphAtlasTexture=new Texture(e,this.glyphAtlasImage,e.ALPHA),this.glyphAtlasImage=null)},Tile.prototype.queryRenderedFeatures=function(e,t,i,a,s){var o=this;if(!this.featureIndex)return{};var r=0;for(var l in e){var n=o.getBucket(e[l]);n&&(r=Math.max(r,e[l].queryRadius(n)))}return this.featureIndex.query({queryGeometry:t,bearing:s,params:a,scale:i,additionalRadius:r,tileSize:this.tileSize},e)},Tile.prototype.querySourceFeatures=function(e,t){var i=this;if(this.rawTileData){this.vtLayers||(this.vtLayers=new vt.VectorTile(new Protobuf(this.rawTileData)).layers);var a=t?t.sourceLayer:"",s=this.vtLayers._geojsonTileLayer||this.vtLayers[a];if(s)for(var o=featureFilter(t&&t.filter),r={z:this.coord.z,x:this.coord.x,y:this.coord.y},l=0;l<s.length;l++){var n=s.feature(l);if(o(n)){var h=new GeoJSONFeature(n,i.coord.z,i.coord.x,i.coord.y);h.tile=r,e.push(h)}}}},Tile.prototype.hasData=function(){return"loaded"===this.state||"reloading"===this.state||"expired"===this.state},Tile.prototype.setExpiryData=function(e){var t=this.expirationTime;if(e.cacheControl){var i=util.parseCacheControl(e.cacheControl);i["max-age"]&&(this.expirationTime=Date.now()+1e3*i["max-age"])}else e.expires&&(this.expirationTime=new Date(e.expires).getTime());if(this.expirationTime){var a=Date.now(),s=!1;if(this.expirationTime>a)s=!1;else if(t)if(this.expirationTime<t)s=!0;else{var o=this.expirationTime-t;o?this.expirationTime=a+Math.max(o,CLOCK_SKEW_RETRY_TIMEOUT):s=!0}else s=!0;s?(this.expiredRequestCount++,this.state="expired"):this.expiredRequestCount=0}},Tile.prototype.getExpiryTimeout=function(){if(this.expirationTime)return this.expiredRequestCount?1e3*(1<<Math.min(this.expiredRequestCount-1,31)):Math.min(this.expirationTime-(new Date).getTime(),Math.pow(2,31)-1)},Tile.prototype.stopPlacementThrottler=function(){this.placementThrottler.stop(),"reloading"===this.state&&(this.state="loaded")},module.exports=Tile;
},{"../data/bucket":42,"../data/bucket/symbol_bucket":47,"../data/feature_index":49,"../render/texture":83,"../style-spec/feature_filter":110,"../symbol/collision_box":170,"../symbol/collision_tile":172,"../util/throttler":221,"../util/util":223,"../util/vectortile_to_geojson":224,"@mapbox/vector-tile":6,"pbf":29}],100:[function(_dereq_,module,exports){
"use strict";var LngLatBounds=_dereq_("../geo/lng_lat_bounds"),clamp=_dereq_("../util/util").clamp,TileBounds=function(t,n,o){this.bounds=LngLatBounds.convert(this.validateBounds(t)),this.minzoom=n||0,this.maxzoom=o||24};TileBounds.prototype.validateBounds=function(t){return Array.isArray(t)&&4===t.length?[Math.max(-180,t[0]),Math.max(-90,t[1]),Math.min(180,t[2]),Math.min(90,t[3])]:[-180,-90,180,90]},TileBounds.prototype.contains=function(t,n){var o=n?Math.min(t.z,n):t.z,a={minX:Math.floor(this.lngX(this.bounds.getWest(),o)),minY:Math.floor(this.latY(this.bounds.getNorth(),o)),maxX:Math.ceil(this.lngX(this.bounds.getEast(),o)),maxY:Math.ceil(this.latY(this.bounds.getSouth(),o))};return t.x>=a.minX&&t.x<a.maxX&&t.y>=a.minY&&t.y<a.maxY},TileBounds.prototype.lngX=function(t,n){return(t+180)*(Math.pow(2,n)/360)},TileBounds.prototype.latY=function(t,n){var o=clamp(Math.sin(Math.PI/180*t),-.9999,.9999),a=Math.pow(2,n)/(2*Math.PI);return Math.pow(2,n-1)+.5*Math.log((1+o)/(1-o))*-a},module.exports=TileBounds;
},{"../geo/lng_lat_bounds":59,"../util/util":223}],101:[function(_dereq_,module,exports){
"use strict";function edge(t,i){if(t.row>i.row){var o=t;t=i,i=o}return{x0:t.column,y0:t.row,x1:i.column,y1:i.row,dx:i.column-t.column,dy:i.row-t.row}}function scanSpans(t,i,o,r,e){var h=Math.max(o,Math.floor(i.y0)),n=Math.min(r,Math.ceil(i.y1));if(t.x0===i.x0&&t.y0===i.y0?t.x0+i.dy/t.dy*t.dx<i.x1:t.x1-i.dy/t.dy*t.dx<i.x0){var s=t;t=i,i=s}for(var a=t.dx/t.dy,d=i.dx/i.dy,l=t.dx>0,y=i.dx<0,x=h;x<n;x++){var u=a*Math.max(0,Math.min(t.dy,x+l-t.y0))+t.x0,c=d*Math.max(0,Math.min(i.dy,x+y-i.y0))+i.x0;e(Math.floor(c),Math.ceil(u),x)}}function scanTriangle(t,i,o,r,e,h){var n,s=edge(t,i),a=edge(i,o),d=edge(o,t);s.dy>a.dy&&(n=s,s=a,a=n),s.dy>d.dy&&(n=s,s=d,d=n),a.dy>d.dy&&(n=a,a=d,d=n),s.dy&&scanSpans(d,s,r,e,h),a.dy&&scanSpans(d,a,r,e,h)}function getQuadkey(t,i,o){for(var r,e="",h=t;h>0;h--)r=1<<h-1,e+=(i&r?1:0)+(o&r?2:0);return e}var WhooTS=_dereq_("@mapbox/whoots-js"),Coordinate=_dereq_("../geo/coordinate"),TileCoord=function(t,i,o,r){(void 0===r||isNaN(r))&&(r=0),this.z=+t,this.x=+i,this.y=+o,this.w=+r,(r*=2)<0&&(r=-1*r-1);var e=1<<this.z;this.id=32*(e*e*r+e*this.y+this.x)+this.z,this.posMatrix=null};TileCoord.prototype.toString=function(){return this.z+"/"+this.x+"/"+this.y},TileCoord.prototype.toCoordinate=function(t){var i=Math.min(this.z,void 0===t?this.z:t),o=Math.pow(2,i),r=this.y,e=this.x+o*this.w;return new Coordinate(e,r,i)},TileCoord.prototype.url=function(t,i,o){var r=WhooTS.getTileBBox(this.x,this.y,this.z),e=getQuadkey(this.z,this.x,this.y);return t[(this.x+this.y)%t.length].replace("{prefix}",(this.x%16).toString(16)+(this.y%16).toString(16)).replace("{z}",String(Math.min(this.z,i||this.z))).replace("{x}",String(this.x)).replace("{y}",String("tms"===o?Math.pow(2,this.z)-this.y-1:this.y)).replace("{quadkey}",e).replace("{bbox-epsg-3857}",r)},TileCoord.prototype.parent=function(t){return 0===this.z?null:this.z>t?new TileCoord(this.z-1,this.x,this.y,this.w):new TileCoord(this.z-1,Math.floor(this.x/2),Math.floor(this.y/2),this.w)},TileCoord.prototype.wrapped=function(){return new TileCoord(this.z,this.x,this.y,0)},TileCoord.prototype.children=function(t){if(this.z>=t)return[new TileCoord(this.z+1,this.x,this.y,this.w)];var i=this.z+1,o=2*this.x,r=2*this.y;return[new TileCoord(i,o,r,this.w),new TileCoord(i,o+1,r,this.w),new TileCoord(i,o,r+1,this.w),new TileCoord(i,o+1,r+1,this.w)]},TileCoord.prototype.scaledTo=function(t,i){return this.z>i?new TileCoord(t,this.x,this.y,this.w):t<=this.z?new TileCoord(t,this.x>>this.z-t,this.y>>this.z-t,this.w):new TileCoord(t,this.x<<t-this.z,this.y<<t-this.z,this.w)},TileCoord.cover=function(t,i,o,r){function e(t,i,e){var s,a,d,l;if(e>=0&&e<=h)for(s=t;s<i;s++)a=Math.floor(s/h),d=(s%h+h)%h,0!==a&&!0!==r||(l=new TileCoord(o,d,e,a),n[l.id]=l)}void 0===r&&(r=!0);var h=1<<t,n={};return scanTriangle(i[0],i[1],i[2],0,h,e),scanTriangle(i[2],i[3],i[0],0,h,e),Object.keys(n).map(function(t){return n[t]})},TileCoord.fromID=function(t){var i=t%32,o=1<<i,r=(t-i)/32,e=r%o,h=(r-e)/o%o,n=Math.floor(r/(o*o));return n%2!=0&&(n=-1*n-1),n/=2,new TileCoord(i,e,h,n)},module.exports=TileCoord;
},{"../geo/coordinate":57,"@mapbox/whoots-js":10}],102:[function(_dereq_,module,exports){
"use strict";var Evented=_dereq_("../util/evented"),util=_dereq_("../util/util"),loadTileJSON=_dereq_("./load_tilejson"),normalizeURL=_dereq_("../util/mapbox").normalizeTileURL,TileBounds=_dereq_("./tile_bounds"),ResourceType=_dereq_("../util/ajax").ResourceType,browser=_dereq_("../util/browser"),VectorTileSource=function(e){function t(t,i,o,r){if(e.call(this),this.id=t,this.dispatcher=o,this.type="vector",this.minzoom=0,this.maxzoom=22,this.scheme="xyz",this.tileSize=512,this.reparseOverscaled=!0,this.isTileClipped=!0,util.extend(this,util.pick(i,["url","scheme","tileSize"])),this._options=util.extend({type:"vector"},i),512!==this.tileSize)throw new Error("vector tile sources must have a tileSize of 512");this.setEventedParent(r)}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.load=function(){var e=this;this.fire("dataloading",{dataType:"source"}),loadTileJSON(this._options,this.map._transformRequest,function(t,i){t?e.fire("error",t):i&&(util.extend(e,i),i.bounds&&(e.tileBounds=new TileBounds(i.bounds,e.minzoom,e.maxzoom)),e.fire("data",{dataType:"source",sourceDataType:"metadata"}),e.fire("data",{dataType:"source",sourceDataType:"content"}))})},t.prototype.hasTile=function(e){return!this.tileBounds||this.tileBounds.contains(e,this.maxzoom)},t.prototype.onAdd=function(e){this.map=e,this.load()},t.prototype.serialize=function(){return util.extend({},this._options)},t.prototype.loadTile=function(e,t){function i(i,o){if(!e.aborted){if(i)return t(i);this.map._refreshExpiredTiles&&e.setExpiryData(o),e.loadVectorData(o,this.map.painter),e.redoWhenDone&&(e.redoWhenDone=!1,e.redoPlacement(this)),t(null),e.reloadCallback&&(this.loadTile(e,e.reloadCallback),e.reloadCallback=null)}}var o=e.coord.z>this.maxzoom?Math.pow(2,e.coord.z-this.maxzoom):1,r=normalizeURL(e.coord.url(this.tiles,this.maxzoom,this.scheme),this.url),s={request:this.map._transformRequest(r,ResourceType.Tile),uid:e.uid,coord:e.coord,zoom:e.coord.z,tileSize:this.tileSize*o,type:this.type,source:this.id,pixelRatio:browser.devicePixelRatio,overscaling:o,angle:this.map.transform.angle,pitch:this.map.transform.pitch,cameraToCenterDistance:this.map.transform.cameraToCenterDistance,cameraToTileDistance:this.map.transform.cameraToTileDistance(e),showCollisionBoxes:this.map.showCollisionBoxes};e.workerID&&"expired"!==e.state?"loading"===e.state?e.reloadCallback=t:this.dispatcher.send("reloadTile",s,i.bind(this),e.workerID):e.workerID=this.dispatcher.send("loadTile",s,i.bind(this))},t.prototype.abortTile=function(e){this.dispatcher.send("abortTile",{uid:e.uid,type:this.type,source:this.id},void 0,e.workerID)},t.prototype.unloadTile=function(e){e.unloadVectorData(),this.dispatcher.send("removeTile",{uid:e.uid,type:this.type,source:this.id},void 0,e.workerID)},t}(Evented);module.exports=VectorTileSource;
},{"../util/ajax":201,"../util/browser":202,"../util/evented":210,"../util/mapbox":217,"../util/util":223,"./load_tilejson":92,"./tile_bounds":100}],103:[function(_dereq_,module,exports){
"use strict";function loadVectorTile(e,r){var o=ajax.getArrayBuffer(e.request,function(e,o){e?r(e):o&&r(null,{vectorTile:new vt.VectorTile(new Protobuf(o.data)),rawData:o.data,cacheControl:o.cacheControl,expires:o.expires})});return function(){o.abort()}}var ajax=_dereq_("../util/ajax"),vt=_dereq_("@mapbox/vector-tile"),Protobuf=_dereq_("pbf"),WorkerTile=_dereq_("./worker_tile"),util=_dereq_("../util/util"),VectorTileWorkerSource=function(e,r,o){this.actor=e,this.layerIndex=r,this.loadVectorData=o||loadVectorTile,this.loading={},this.loaded={}};VectorTileWorkerSource.prototype.loadTile=function(e,r){var o=this,t=e.source,a=e.uid;this.loading[t]||(this.loading[t]={});var i=this.loading[t][a]=new WorkerTile(e);i.abort=this.loadVectorData(e,function(e,l){if(delete o.loading[t][a],e||!l)return r(e);var c=l.rawData,n={};l.expires&&(n.expires=l.expires),l.cacheControl&&(n.cacheControl=l.cacheControl),i.vectorTile=l.vectorTile,i.parse(l.vectorTile,o.layerIndex,o.actor,function(e,o,t){if(e||!o)return r(e);r(null,util.extend({rawTileData:c},o,n),t)}),o.loaded[t]=o.loaded[t]||{},o.loaded[t][a]=i})},VectorTileWorkerSource.prototype.reloadTile=function(e,r){function o(e,o){if(this.reloadCallback){var t=this.reloadCallback;delete this.reloadCallback,this.parse(this.vectorTile,i.layerIndex,i.actor,t)}r(e,o)}var t=this.loaded[e.source],a=e.uid,i=this;if(t&&t[a]){var l=t[a];"parsing"===l.status?l.reloadCallback=r:"done"===l.status&&l.parse(l.vectorTile,this.layerIndex,this.actor,o.bind(l))}},VectorTileWorkerSource.prototype.abortTile=function(e){var r=this.loading[e.source],o=e.uid;r&&r[o]&&r[o].abort&&(r[o].abort(),delete r[o])},VectorTileWorkerSource.prototype.removeTile=function(e){var r=this.loaded[e.source],o=e.uid;r&&r[o]&&delete r[o]},VectorTileWorkerSource.prototype.redoPlacement=function(e,r){var o=this.loaded[e.source],t=this.loading[e.source],a=e.uid;if(o&&o[a]){var i=o[a],l=i.redoPlacement(e.angle,e.pitch,e.cameraToCenterDistance,e.cameraToTileDistance,e.showCollisionBoxes);l.result&&r(null,l.result,l.transferables)}else t&&t[a]&&(t[a].angle=e.angle)},module.exports=VectorTileWorkerSource;
},{"../util/ajax":201,"../util/util":223,"./worker_tile":106,"@mapbox/vector-tile":6,"pbf":29}],104:[function(_dereq_,module,exports){
"use strict";var ajax=_dereq_("../util/ajax"),ImageSource=_dereq_("./image_source"),VideoSource=function(e){function t(t,o,i,r){e.call(this,t,o,i,r),this.roundZoom=!0,this.type="video",this.options=o}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.load=function(){var e=this,t=this.options;this.urls=t.urls,ajax.getVideo(t.urls,function(t,o){if(t)e.fire("error",{error:t});else if(o){e.video=o,e.video.loop=!0;var i;e.video.addEventListener("playing",function(){i=e.map.style.animationLoop.set(1/0),e.map._rerender()}),e.video.addEventListener("pause",function(){e.map.style.animationLoop.cancel(i)}),e.map&&e.video.play(),e._finishLoading()}})},t.prototype.getVideo=function(){return this.video},t.prototype.onAdd=function(e){this.map||(this.map=e,this.load(),this.video&&(this.video.play(),this.setCoordinates(this.coordinates)))},t.prototype.prepare=function(){0===Object.keys(this.tiles).length||this.video.readyState<2||this._prepareImage(this.map.painter.gl,this.video)},t.prototype.serialize=function(){return{type:"video",urls:this.urls,coordinates:this.coordinates}},t}(ImageSource);module.exports=VideoSource;
},{"../util/ajax":201,"./image_source":91}],105:[function(_dereq_,module,exports){
"use strict";var Actor=_dereq_("../util/actor"),StyleLayerIndex=_dereq_("../style/style_layer_index"),VectorTileWorkerSource=_dereq_("./vector_tile_worker_source"),GeoJSONWorkerSource=_dereq_("./geojson_worker_source"),globalRTLTextPlugin=_dereq_("./rtl_text_plugin"),Worker=function(e){var r=this;this.self=e,this.actor=new Actor(e,this),this.layerIndexes={},this.workerSourceTypes={vector:VectorTileWorkerSource,geojson:GeoJSONWorkerSource},this.workerSources={},this.self.registerWorkerSource=function(e,o){if(r.workerSourceTypes[e])throw new Error('Worker source with name "'+e+'" already registered.');r.workerSourceTypes[e]=o},this.self.registerRTLTextPlugin=function(e){if(globalRTLTextPlugin.applyArabicShaping||globalRTLTextPlugin.processBidirectionalText)throw new Error("RTL text plugin already registered.");globalRTLTextPlugin.applyArabicShaping=e.applyArabicShaping,globalRTLTextPlugin.processBidirectionalText=e.processBidirectionalText}};Worker.prototype.setLayers=function(e,r){this.getLayerIndex(e).replace(r)},Worker.prototype.updateLayers=function(e,r){this.getLayerIndex(e).update(r.layers,r.removedIds,r.symbolOrder)},Worker.prototype.loadTile=function(e,r,o){this.getWorkerSource(e,r.type).loadTile(r,o)},Worker.prototype.reloadTile=function(e,r,o){this.getWorkerSource(e,r.type).reloadTile(r,o)},Worker.prototype.abortTile=function(e,r){this.getWorkerSource(e,r.type).abortTile(r)},Worker.prototype.removeTile=function(e,r){this.getWorkerSource(e,r.type).removeTile(r)},Worker.prototype.removeSource=function(e,r){var o=this.getWorkerSource(e,r.type);void 0!==o.removeSource&&o.removeSource(r)},Worker.prototype.redoPlacement=function(e,r,o){this.getWorkerSource(e,r.type).redoPlacement(r,o)},Worker.prototype.loadWorkerSource=function(e,r,o){try{this.self.importScripts(r.url),o()}catch(e){o(e)}},Worker.prototype.loadRTLTextPlugin=function(e,r,o){try{globalRTLTextPlugin.applyArabicShaping||globalRTLTextPlugin.processBidirectionalText||(this.self.importScripts(r),globalRTLTextPlugin.applyArabicShaping&&globalRTLTextPlugin.processBidirectionalText||o(new Error("RTL Text Plugin failed to import scripts from "+r)))}catch(e){o(e)}},Worker.prototype.getLayerIndex=function(e){var r=this.layerIndexes[e];return r||(r=this.layerIndexes[e]=new StyleLayerIndex),r},Worker.prototype.getWorkerSource=function(e,r){var o=this;if(this.workerSources[e]||(this.workerSources[e]={}),!this.workerSources[e][r]){var t={send:function(r,t,i,n){o.actor.send(r,t,i,n,e)}};this.workerSources[e][r]=new this.workerSourceTypes[r](t,this.getLayerIndex(e))}return this.workerSources[e][r]},module.exports=function(e){return new Worker(e)};
},{"../style/style_layer_index":164,"../util/actor":200,"./geojson_worker_source":89,"./rtl_text_plugin":96,"./vector_tile_worker_source":103}],106:[function(_dereq_,module,exports){
"use strict";function recalculateLayers(e,i){for(var r=0,t=e.layers;r<t.length;r+=1){t[r].recalculate(i)}}function serializeBuckets(e,i){return e.filter(function(e){return!e.isEmpty()}).map(function(e){return e.serialize(i)})}var FeatureIndex=_dereq_("../data/feature_index"),CollisionTile=_dereq_("../symbol/collision_tile"),CollisionBoxArray=_dereq_("../symbol/collision_box"),DictionaryCoder=_dereq_("../util/dictionary_coder"),SymbolBucket=_dereq_("../data/bucket/symbol_bucket"),util=_dereq_("../util/util"),ref=_dereq_("../render/image_atlas"),makeImageAtlas=ref.makeImageAtlas,ref$1=_dereq_("../render/glyph_atlas"),makeGlyphAtlas=ref$1.makeGlyphAtlas,WorkerTile=function(e){this.coord=e.coord,this.uid=e.uid,this.zoom=e.zoom,this.pixelRatio=e.pixelRatio,this.tileSize=e.tileSize,this.source=e.source,this.overscaling=e.overscaling,this.angle=e.angle,this.pitch=e.pitch,this.cameraToCenterDistance=e.cameraToCenterDistance,this.cameraToTileDistance=e.cameraToTileDistance,this.showCollisionBoxes=e.showCollisionBoxes};WorkerTile.prototype.parse=function(e,i,r,t){function a(){var e=this;if(D)return t(D);if(A&&C){for(var i=new CollisionTile(this.angle,this.pitch,this.cameraToCenterDistance,this.cameraToTileDistance,this.collisionBoxArray),r=makeGlyphAtlas(A),a=makeImageAtlas(C),o=0,s=e.symbolBuckets;o<s.length;o+=1){var c=s[o];recalculateLayers(c,e.zoom),c.prepare(A,r.positions,C,a.positions),c.place(i,e.showCollisionBoxes)}this.status="done";var u=[r.image.data.buffer,a.image.data.buffer];t(null,{buckets:serializeBuckets(util.values(n),u),featureIndex:l.serialize(u),collisionTile:i.serialize(u),collisionBoxArray:this.collisionBoxArray.serialize(),glyphAtlasImage:r.image,iconAtlasImage:a.image},u)}}var o=this;this.status="parsing",this.data=e,this.collisionBoxArray=new CollisionBoxArray;var s=new DictionaryCoder(Object.keys(e.layers).sort()),l=new FeatureIndex(this.coord,this.overscaling);l.bucketLayerIDs=[];var n={},c={featureIndex:l,iconDependencies:{},glyphDependencies:{}},u=i.familiesBySource[this.source];for(var h in u){var m=e.layers[h];if(m){1===m.version&&util.warnOnce('Vector tile source "'+o.source+'" layer "'+h+'" does not use vector tile spec v2 and therefore may have some rendering errors.');for(var y=s.encode(h),p=[],d=0;d<m.length;d++){var f=m.feature(d);p.push({feature:f,index:d,sourceLayerIndex:y})}for(var g=0,v=u[h];g<v.length;g+=1){var k=v[g],b=k[0];if(!(b.minzoom&&o.zoom<Math.floor(b.minzoom))&&!(b.maxzoom&&o.zoom>=b.maxzoom||b.layout&&"none"===b.layout.visibility)){for(var x=0,T=k;x<T.length;x+=1){T[x].recalculate(o.zoom)}(n[b.id]=b.createBucket({index:l.bucketLayerIDs.length,layers:k,zoom:o.zoom,pixelRatio:o.pixelRatio,overscaling:o.overscaling,collisionBoxArray:o.collisionBoxArray})).populate(p,c),l.bucketLayerIDs.push(k.map(function(e){return e.id}))}}}}this.symbolBuckets=[];for(var z=i.symbolOrder.length-1;z>=0;z--){var B=n[i.symbolOrder[z]];B&&o.symbolBuckets.push(B)}var D,A,C,I=util.mapObject(c.glyphDependencies,function(e){return Object.keys(e).map(Number)});Object.keys(I).length?r.send("getGlyphs",{uid:this.uid,stacks:I},function(e,i){D||(D=e,A=i,a.call(o))}):A={};var w=Object.keys(c.iconDependencies);w.length?r.send("getImages",{icons:w},function(e,i){D||(D=e,C=i,a.call(o))}):C={},a.call(this)},WorkerTile.prototype.redoPlacement=function(e,i,r,t,a){var o=this;if(this.angle=e,this.pitch=i,this.cameraToCenterDistance=r,this.cameraToTileDistance=t,"done"!==this.status)return{};for(var s=new CollisionTile(this.angle,this.pitch,this.cameraToCenterDistance,this.cameraToTileDistance,this.collisionBoxArray),l=0,n=o.symbolBuckets;l<n.length;l+=1){var c=n[l];recalculateLayers(c,o.zoom),c.place(s,a)}var u=[];return{result:{buckets:serializeBuckets(this.symbolBuckets,u),collisionTile:s.serialize(u)},transferables:u}},module.exports=WorkerTile;
},{"../data/bucket/symbol_bucket":47,"../data/feature_index":49,"../render/glyph_atlas":74,"../render/image_atlas":76,"../symbol/collision_box":170,"../symbol/collision_tile":172,"../util/dictionary_coder":207,"../util/util":223}],107:[function(_dereq_,module,exports){
"use strict";function deref(r,e){var f={};for(var t in r)"ref"!==t&&(f[t]=r[t]);return refProperties.forEach(function(r){r in e&&(f[r]=e[r])}),f}function derefLayers(r){r=r.slice();for(var e=Object.create(null),f=0;f<r.length;f++)e[r[f].id]=r[f];for(var t=0;t<r.length;t++)"ref"in r[t]&&(r[t]=deref(r[t],e[r[t].ref]));return r}var refProperties=_dereq_("./util/ref_properties");module.exports=derefLayers;
},{"./util/ref_properties":129}],108:[function(_dereq_,module,exports){
"use strict";function diffSources(e,r,o,a){e=e||{},r=r||{};var s;for(s in e)e.hasOwnProperty(s)&&(r.hasOwnProperty(s)||(o.push({command:operations.removeSource,args:[s]}),a[s]=!0));for(s in r)r.hasOwnProperty(s)&&(e.hasOwnProperty(s)?isEqual(e[s],r[s])||(o.push({command:operations.removeSource,args:[s]}),o.push({command:operations.addSource,args:[s,r[s]]}),a[s]=!0):o.push({command:operations.addSource,args:[s,r[s]]}))}function diffLayerPropertyChanges(e,r,o,a,s,t){e=e||{},r=r||{};var n;for(n in e)e.hasOwnProperty(n)&&(isEqual(e[n],r[n])||o.push({command:t,args:[a,n,r[n],s]}));for(n in r)r.hasOwnProperty(n)&&!e.hasOwnProperty(n)&&(isEqual(e[n],r[n])||o.push({command:t,args:[a,n,r[n],s]}))}function pluckId(e){return e.id}function indexById(e,r){return e[r.id]=r,e}function diffLayers(e,r,o){e=e||[],r=r||[];var a,s,t,n,i,p,m,u=e.map(pluckId),l=r.map(pluckId),y=e.reduce(indexById,{}),c=r.reduce(indexById,{}),d=u.slice(),h=Object.create(null);for(a=0,s=0;a<u.length;a++)t=u[a],c.hasOwnProperty(t)?s++:(o.push({command:operations.removeLayer,args:[t]}),d.splice(d.indexOf(t,s),1));for(a=0,s=0;a<l.length;a++)t=l[l.length-1-a],d[d.length-1-a]!==t&&(y.hasOwnProperty(t)?(o.push({command:operations.removeLayer,args:[t]}),d.splice(d.lastIndexOf(t,d.length-s),1)):s++,p=d[d.length-a],o.push({command:operations.addLayer,args:[c[t],p]}),d.splice(d.length-a,0,t),h[t]=!0);for(a=0;a<l.length;a++)if(t=l[a],n=y[t],i=c[t],!h[t]&&!isEqual(n,i))if(isEqual(n.source,i.source)&&isEqual(n["source-layer"],i["source-layer"])&&isEqual(n.type,i.type)){diffLayerPropertyChanges(n.layout,i.layout,o,t,null,operations.setLayoutProperty),diffLayerPropertyChanges(n.paint,i.paint,o,t,null,operations.setPaintProperty),isEqual(n.filter,i.filter)||o.push({command:operations.setFilter,args:[t,i.filter]}),isEqual(n.minzoom,i.minzoom)&&isEqual(n.maxzoom,i.maxzoom)||o.push({command:operations.setLayerZoomRange,args:[t,i.minzoom,i.maxzoom]});for(m in n)n.hasOwnProperty(m)&&"layout"!==m&&"paint"!==m&&"filter"!==m&&"metadata"!==m&&"minzoom"!==m&&"maxzoom"!==m&&(0===m.indexOf("paint.")?diffLayerPropertyChanges(n[m],i[m],o,t,m.slice(6),operations.setPaintProperty):isEqual(n[m],i[m])||o.push({command:operations.setLayerProperty,args:[t,m,i[m]]}));for(m in i)i.hasOwnProperty(m)&&!n.hasOwnProperty(m)&&"layout"!==m&&"paint"!==m&&"filter"!==m&&"metadata"!==m&&"minzoom"!==m&&"maxzoom"!==m&&(0===m.indexOf("paint.")?diffLayerPropertyChanges(n[m],i[m],o,t,m.slice(6),operations.setPaintProperty):isEqual(n[m],i[m])||o.push({command:operations.setLayerProperty,args:[t,m,i[m]]}))}else o.push({command:operations.removeLayer,args:[t]}),p=d[d.lastIndexOf(t)+1],o.push({command:operations.addLayer,args:[i,p]})}function diffStyles(e,r){if(!e)return[{command:operations.setStyle,args:[r]}];var o=[];try{if(!isEqual(e.version,r.version))return[{command:operations.setStyle,args:[r]}];isEqual(e.center,r.center)||o.push({command:operations.setCenter,args:[r.center]}),isEqual(e.zoom,r.zoom)||o.push({command:operations.setZoom,args:[r.zoom]}),isEqual(e.bearing,r.bearing)||o.push({command:operations.setBearing,args:[r.bearing]}),isEqual(e.pitch,r.pitch)||o.push({command:operations.setPitch,args:[r.pitch]}),isEqual(e.sprite,r.sprite)||o.push({command:operations.setSprite,args:[r.sprite]}),isEqual(e.glyphs,r.glyphs)||o.push({command:operations.setGlyphs,args:[r.glyphs]}),isEqual(e.transition,r.transition)||o.push({command:operations.setTransition,args:[r.transition]}),isEqual(e.light,r.light)||o.push({command:operations.setLight,args:[r.light]});var a={},s=[];diffSources(e.sources,r.sources,s,a);var t=[];e.layers&&e.layers.forEach(function(e){a[e.source]?o.push({command:operations.removeLayer,args:[e.id]}):t.push(e)}),o=o.concat(s),diffLayers(t,r.layers,o)}catch(e){console.warn("Unable to compute style diff:",e),o=[{command:operations.setStyle,args:[r]}]}return o}var isEqual=_dereq_("lodash.isequal"),operations={setStyle:"setStyle",addLayer:"addLayer",removeLayer:"removeLayer",setPaintProperty:"setPaintProperty",setLayoutProperty:"setLayoutProperty",setFilter:"setFilter",addSource:"addSource",removeSource:"removeSource",setLayerZoomRange:"setLayerZoomRange",setLayerProperty:"setLayerProperty",setCenter:"setCenter",setZoom:"setZoom",setBearing:"setBearing",setPitch:"setPitch",setSprite:"setSprite",setGlyphs:"setGlyphs",setTransition:"setTransition",setLight:"setLight"};module.exports=diffStyles,module.exports.operations=operations;
},{"lodash.isequal":120}],109:[function(_dereq_,module,exports){
"use strict";function ValidationError(r,i){for(var t=[],o=arguments.length-2;o-- >0;)t[o]=arguments[o+2];this.message=(r?r+": ":"")+format.apply(format,t),null!==i&&void 0!==i&&i.__line__&&(this.line=i.__line__)}var format=_dereq_("util").format;module.exports=ValidationError;
},{"util":36}],110:[function(_dereq_,module,exports){
"use strict";function createFilter(e){return new Function("f","var p = (f && f.properties || {}); return "+compile(e))}function compile(e){if(!e)return"true";var i=e[0];return e.length<=1?"any"===i?"false":"true":"("+("=="===i?compileComparisonOp(e[1],e[2],"===",!1):"!="===i?compileComparisonOp(e[1],e[2],"!==",!1):"<"===i||">"===i||"<="===i||">="===i?compileComparisonOp(e[1],e[2],i,!0):"any"===i?compileLogicalOp(e.slice(1),"||"):"all"===i?compileLogicalOp(e.slice(1),"&&"):"none"===i?compileNegation(compileLogicalOp(e.slice(1),"||")):"in"===i?compileInOp(e[1],e.slice(2)):"!in"===i?compileNegation(compileInOp(e[1],e.slice(2))):"has"===i?compileHasOp(e[1]):"!has"===i?compileNegation(compileHasOp(e[1])):"true")+")"}function compilePropertyReference(e){return"$type"===e?"f.type":"$id"===e?"f.id":"p["+JSON.stringify(e)+"]"}function compileComparisonOp(e,i,n,o){var r=compilePropertyReference(e),p="$type"===e?types.indexOf(i):JSON.stringify(i);return(o?"typeof "+r+"=== typeof "+p+"&&":"")+r+n+p}function compileLogicalOp(e,i){return e.map(compile).join(i)}function compileInOp(e,i){"$type"===e&&(i=i.map(function(e){return types.indexOf(e)}));var n=JSON.stringify(i.sort(compare)),o=compilePropertyReference(e);return i.length<=200?n+".indexOf("+o+") !== -1":"function(v, a, i, j) {while (i <= j) { var m = (i + j) >> 1;    if (a[m] === v) return true; if (a[m] > v) j = m - 1; else i = m + 1;}return false; }("+o+", "+n+",0,"+(i.length-1)+")"}function compileHasOp(e){return"$id"===e?'"id" in f':JSON.stringify(e)+" in p"}function compileNegation(e){return"!("+e+")"}function compare(e,i){return e<i?-1:e>i?1:0}module.exports=createFilter;var types=["Unknown","Point","LineString","Polygon"];
},{}],111:[function(_dereq_,module,exports){
"use strict";function xyz2lab(r){return r>t3?Math.pow(r,1/3):r/t2+t0}function lab2xyz(r){return r>t1?r*r*r:t2*(r-t0)}function xyz2rgb(r){return 255*(r<=.0031308?12.92*r:1.055*Math.pow(r,1/2.4)-.055)}function rgb2xyz(r){return r/=255,r<=.04045?r/12.92:Math.pow((r+.055)/1.055,2.4)}function rgbToLab(r){var t=rgb2xyz(r[0]),a=rgb2xyz(r[1]),n=rgb2xyz(r[2]),b=xyz2lab((.4124564*t+.3575761*a+.1804375*n)/Xn),o=xyz2lab((.2126729*t+.7151522*a+.072175*n)/Yn);return[116*o-16,500*(b-o),200*(o-xyz2lab((.0193339*t+.119192*a+.9503041*n)/Zn)),r[3]]}function labToRgb(r){var t=(r[0]+16)/116,a=isNaN(r[1])?t:t+r[1]/500,n=isNaN(r[2])?t:t-r[2]/200;return t=Yn*lab2xyz(t),a=Xn*lab2xyz(a),n=Zn*lab2xyz(n),[xyz2rgb(3.2404542*a-1.5371385*t-.4985314*n),xyz2rgb(-.969266*a+1.8760108*t+.041556*n),xyz2rgb(.0556434*a-.2040259*t+1.0572252*n),r[3]]}function rgbToHcl(r){var t=rgbToLab(r),a=t[0],n=t[1],b=t[2],o=Math.atan2(b,n)*rad2deg;return[o<0?o+360:o,Math.sqrt(n*n+b*b),a,r[3]]}function hclToRgb(r){var t=r[0]*deg2rad,a=r[1];return labToRgb([r[2],Math.cos(t)*a,Math.sin(t)*a,r[3]])}var Xn=.95047,Yn=1,Zn=1.08883,t0=4/29,t1=6/29,t2=3*t1*t1,t3=t1*t1*t1,deg2rad=Math.PI/180,rad2deg=180/Math.PI;module.exports={lab:{forward:rgbToLab,reverse:labToRgb},hcl:{forward:rgbToHcl,reverse:hclToRgb}};
},{}],112:[function(_dereq_,module,exports){
"use strict";function identityFunction(t){return t}function createFunction(t,e){var o,n="color"===e.type;if(isFunctionDefinition(t)){var r=t.stops&&"object"==typeof t.stops[0][0],a=r||void 0!==t.property,i=r||!a,s=t.type||("interpolated"===e.function?"exponential":"interval");n&&(t=extend({},t),t.stops&&(t.stops=t.stops.map(function(t){return[t[0],parseColor(t[1])]})),t.default?t.default=parseColor(t.default):t.default=parseColor(e.default));var u,p,l;if("exponential"===s)u=evaluateExponentialFunction;else if("interval"===s)u=evaluateIntervalFunction;else if("categorical"===s){u=evaluateCategoricalFunction,p=Object.create(null);for(var c=0,f=t.stops;c<f.length;c+=1){var v=f[c];p[v[0]]=v[1]}l=typeof t.stops[0][0]}else{if("identity"!==s)throw new Error('Unknown function type "'+s+'"');u=evaluateIdentityFunction}var d;if(t.colorSpace&&"rgb"!==t.colorSpace){if(!colorSpaces[t.colorSpace])throw new Error("Unknown color space: "+t.colorSpace);var y=colorSpaces[t.colorSpace];t=JSON.parse(JSON.stringify(t));for(var F=0;F<t.stops.length;F++)t.stops[F]=[t.stops[F][0],y.forward(t.stops[F][1])];d=y.reverse}else d=identityFunction;if(r){for(var h={},g=[],m=0;m<t.stops.length;m++){var C=t.stops[m],S=C[0].zoom;void 0===h[S]&&(h[S]={zoom:S,type:t.type,property:t.property,default:t.default,stops:[]},g.push(S)),h[S].stops.push([C[0].value,C[1]])}for(var T=[],x=0,b=g;x<b.length;x+=1){var q=b[x];T.push([h[q].zoom,createFunction(h[q],e)])}o=function(o,n){return d(evaluateExponentialFunction({stops:T,base:t.base},e,o)(o,n))},o.isFeatureConstant=!1,o.isZoomConstant=!1}else i?(o=function(o){return d(u(t,e,o,p,l))},o.isFeatureConstant=!0,o.isZoomConstant=!1):(o=function(o,n){var r=n[t.property];return void 0===r?coalesce(t.default,e.default):d(u(t,e,r,p,l))},o.isFeatureConstant=!1,o.isZoomConstant=!0)}else n&&t&&(t=parseColor(t)),o=function(){return t},o.isFeatureConstant=!0,o.isZoomConstant=!0;return o}function coalesce(t,e,o){return void 0!==t?t:void 0!==e?e:void 0!==o?o:void 0}function evaluateCategoricalFunction(t,e,o,n,r){return coalesce(typeof o===r?n[o]:void 0,t.default,e.default)}function evaluateIntervalFunction(t,e,o){if("number"!==getType(o))return coalesce(t.default,e.default);var n=t.stops.length;if(1===n)return t.stops[0][1];if(o<=t.stops[0][0])return t.stops[0][1];if(o>=t.stops[n-1][0])return t.stops[n-1][1];var r=findStopLessThanOrEqualTo(t.stops,o);return t.stops[r][1]}function evaluateExponentialFunction(t,e,o){var n=void 0!==t.base?t.base:1;if("number"!==getType(o))return coalesce(t.default,e.default);var r=t.stops.length;if(1===r)return t.stops[0][1];if(o<=t.stops[0][0])return t.stops[0][1];if(o>=t.stops[r-1][0])return t.stops[r-1][1];var a=findStopLessThanOrEqualTo(t.stops,o),i=interpolationFactor(o,n,t.stops[a][0],t.stops[a+1][0]),s=t.stops[a][1],u=t.stops[a+1][1],p=interpolate[e.type]||identityFunction;return"function"==typeof s?function(){for(var t=[],e=arguments.length;e--;)t[e]=arguments[e];var o=s.apply(void 0,t),n=u.apply(void 0,t);if(void 0!==o&&void 0!==n)return p(o,n,i)}:p(s,u,i)}function evaluateIdentityFunction(t,e,o){return"color"===e.type?o=parseColor(o):getType(o)===e.type||"enum"===e.type&&e.values[o]||(o=void 0),coalesce(o,t.default,e.default)}function findStopLessThanOrEqualTo(t,e){for(var o,n,r=t.length,a=0,i=r-1,s=0;a<=i;){if(s=Math.floor((a+i)/2),o=t[s][0],n=t[s+1][0],e===o||e>o&&e<n)return s;o<e?a=s+1:o>e&&(i=s-1)}return Math.max(s-1,0)}function isFunctionDefinition(t){return"object"==typeof t&&(t.stops||"identity"===t.type)}function interpolationFactor(t,e,o,n){var r=n-o,a=t-o;return 0===r?0:1===e?a/r:(Math.pow(e,a)-1)/(Math.pow(e,r)-1)}var colorSpaces=_dereq_("./color_spaces"),parseColor=_dereq_("../util/parse_color"),extend=_dereq_("../util/extend"),getType=_dereq_("../util/get_type"),interpolate=_dereq_("../util/interpolate");module.exports=createFunction,module.exports.isFunctionDefinition=isFunctionDefinition,module.exports.interpolationFactor=interpolationFactor,module.exports.findStopLessThanOrEqualTo=findStopLessThanOrEqualTo;
},{"../util/extend":125,"../util/get_type":126,"../util/interpolate":127,"../util/parse_color":128,"./color_spaces":111}],113:[function(_dereq_,module,exports){
"use strict";function stringify(r){var t=typeof r;if("number"===t||"boolean"===t||"string"===t||void 0===r||null===r)return JSON.stringify(r);if(Array.isArray(r)){for(var e="[",i=0,n=r;i<n.length;i+=1){e+=stringify(n[i])+","}return e+"]"}for(var o=Object.keys(r).sort(),f="{",u=0;u<o.length;u++)f+=JSON.stringify(o[u])+":"+stringify(r[o[u]])+",";return f+"}"}function getKey(r){for(var t="",e=0,i=refProperties;e<i.length;e+=1){t+="/"+stringify(r[i[e]])}return t}function groupByLayout(r){for(var t={},e=0;e<r.length;e++){var i=getKey(r[e]),n=t[i];n||(n=t[i]=[]),n.push(r[e])}var o=[];for(var f in t)o.push(t[f]);return o}var refProperties=_dereq_("./util/ref_properties");module.exports=groupByLayout;
},{"./util/ref_properties":129}],114:[function(_dereq_,module,exports){
function clamp_css_byte(e){return e=Math.round(e),e<0?0:e>255?255:e}function clamp_css_float(e){return e<0?0:e>1?1:e}function parse_css_int(e){return clamp_css_byte("%"===e[e.length-1]?parseFloat(e)/100*255:parseInt(e))}function parse_css_float(e){return clamp_css_float("%"===e[e.length-1]?parseFloat(e)/100:parseFloat(e))}function css_hue_to_rgb(e,r,l){return l<0?l+=1:l>1&&(l-=1),6*l<1?e+(r-e)*l*6:2*l<1?r:3*l<2?e+(r-e)*(2/3-l)*6:e}function parseCSSColor(e){var r=e.replace(/ /g,"").toLowerCase();if(r in kCSSColorTable)return kCSSColorTable[r].slice();if("#"===r[0]){if(4===r.length){var l=parseInt(r.substr(1),16);return l>=0&&l<=4095?[(3840&l)>>4|(3840&l)>>8,240&l|(240&l)>>4,15&l|(15&l)<<4,1]:null}if(7===r.length){var l=parseInt(r.substr(1),16);return l>=0&&l<=16777215?[(16711680&l)>>16,(65280&l)>>8,255&l,1]:null}return null}var a=r.indexOf("("),t=r.indexOf(")");if(-1!==a&&t+1===r.length){var n=r.substr(0,a),s=r.substr(a+1,t-(a+1)).split(","),o=1;switch(n){case"rgba":if(4!==s.length)return null;o=parse_css_float(s.pop());case"rgb":return 3!==s.length?null:[parse_css_int(s[0]),parse_css_int(s[1]),parse_css_int(s[2]),o];case"hsla":if(4!==s.length)return null;o=parse_css_float(s.pop());case"hsl":if(3!==s.length)return null;var i=(parseFloat(s[0])%360+360)%360/360,u=parse_css_float(s[1]),g=parse_css_float(s[2]),d=g<=.5?g*(u+1):g+u-g*u,c=2*g-d;return[clamp_css_byte(255*css_hue_to_rgb(c,d,i+1/3)),clamp_css_byte(255*css_hue_to_rgb(c,d,i)),clamp_css_byte(255*css_hue_to_rgb(c,d,i-1/3)),o];default:return null}}return null}var kCSSColorTable={transparent:[0,0,0,0],aliceblue:[240,248,255,1],antiquewhite:[250,235,215,1],aqua:[0,255,255,1],aquamarine:[127,255,212,1],azure:[240,255,255,1],beige:[245,245,220,1],bisque:[255,228,196,1],black:[0,0,0,1],blanchedalmond:[255,235,205,1],blue:[0,0,255,1],blueviolet:[138,43,226,1],brown:[165,42,42,1],burlywood:[222,184,135,1],cadetblue:[95,158,160,1],chartreuse:[127,255,0,1],chocolate:[210,105,30,1],coral:[255,127,80,1],cornflowerblue:[100,149,237,1],cornsilk:[255,248,220,1],crimson:[220,20,60,1],cyan:[0,255,255,1],darkblue:[0,0,139,1],darkcyan:[0,139,139,1],darkgoldenrod:[184,134,11,1],darkgray:[169,169,169,1],darkgreen:[0,100,0,1],darkgrey:[169,169,169,1],darkkhaki:[189,183,107,1],darkmagenta:[139,0,139,1],darkolivegreen:[85,107,47,1],darkorange:[255,140,0,1],darkorchid:[153,50,204,1],darkred:[139,0,0,1],darksalmon:[233,150,122,1],darkseagreen:[143,188,143,1],darkslateblue:[72,61,139,1],darkslategray:[47,79,79,1],darkslategrey:[47,79,79,1],darkturquoise:[0,206,209,1],darkviolet:[148,0,211,1],deeppink:[255,20,147,1],deepskyblue:[0,191,255,1],dimgray:[105,105,105,1],dimgrey:[105,105,105,1],dodgerblue:[30,144,255,1],firebrick:[178,34,34,1],floralwhite:[255,250,240,1],forestgreen:[34,139,34,1],fuchsia:[255,0,255,1],gainsboro:[220,220,220,1],ghostwhite:[248,248,255,1],gold:[255,215,0,1],goldenrod:[218,165,32,1],gray:[128,128,128,1],green:[0,128,0,1],greenyellow:[173,255,47,1],grey:[128,128,128,1],honeydew:[240,255,240,1],hotpink:[255,105,180,1],indianred:[205,92,92,1],indigo:[75,0,130,1],ivory:[255,255,240,1],khaki:[240,230,140,1],lavender:[230,230,250,1],lavenderblush:[255,240,245,1],lawngreen:[124,252,0,1],lemonchiffon:[255,250,205,1],lightblue:[173,216,230,1],lightcoral:[240,128,128,1],lightcyan:[224,255,255,1],lightgoldenrodyellow:[250,250,210,1],lightgray:[211,211,211,1],lightgreen:[144,238,144,1],lightgrey:[211,211,211,1],lightpink:[255,182,193,1],lightsalmon:[255,160,122,1],lightseagreen:[32,178,170,1],lightskyblue:[135,206,250,1],lightslategray:[119,136,153,1],lightslategrey:[119,136,153,1],lightsteelblue:[176,196,222,1],lightyellow:[255,255,224,1],lime:[0,255,0,1],limegreen:[50,205,50,1],linen:[250,240,230,1],magenta:[255,0,255,1],maroon:[128,0,0,1],mediumaquamarine:[102,205,170,1],mediumblue:[0,0,205,1],mediumorchid:[186,85,211,1],mediumpurple:[147,112,219,1],mediumseagreen:[60,179,113,1],mediumslateblue:[123,104,238,1],mediumspringgreen:[0,250,154,1],mediumturquoise:[72,209,204,1],mediumvioletred:[199,21,133,1],midnightblue:[25,25,112,1],mintcream:[245,255,250,1],mistyrose:[255,228,225,1],moccasin:[255,228,181,1],navajowhite:[255,222,173,1],navy:[0,0,128,1],oldlace:[253,245,230,1],olive:[128,128,0,1],olivedrab:[107,142,35,1],orange:[255,165,0,1],orangered:[255,69,0,1],orchid:[218,112,214,1],palegoldenrod:[238,232,170,1],palegreen:[152,251,152,1],paleturquoise:[175,238,238,1],palevioletred:[219,112,147,1],papayawhip:[255,239,213,1],peachpuff:[255,218,185,1],peru:[205,133,63,1],pink:[255,192,203,1],plum:[221,160,221,1],powderblue:[176,224,230,1],purple:[128,0,128,1],rebeccapurple:[102,51,153,1],red:[255,0,0,1],rosybrown:[188,143,143,1],royalblue:[65,105,225,1],saddlebrown:[139,69,19,1],salmon:[250,128,114,1],sandybrown:[244,164,96,1],seagreen:[46,139,87,1],seashell:[255,245,238,1],sienna:[160,82,45,1],silver:[192,192,192,1],skyblue:[135,206,235,1],slateblue:[106,90,205,1],slategray:[112,128,144,1],slategrey:[112,128,144,1],snow:[255,250,250,1],springgreen:[0,255,127,1],steelblue:[70,130,180,1],tan:[210,180,140,1],teal:[0,128,128,1],thistle:[216,191,216,1],tomato:[255,99,71,1],turquoise:[64,224,208,1],violet:[238,130,238,1],wheat:[245,222,179,1],white:[255,255,255,1],whitesmoke:[245,245,245,1],yellow:[255,255,0,1],yellowgreen:[154,205,50,1]};try{exports.parseCSSColor=parseCSSColor}catch(e){}
},{}],115:[function(_dereq_,module,exports){
function isObjectLike(r){return!!r&&"object"==typeof r}function arraySome(r,e){for(var a=-1,t=r.length;++a<t;)if(e(r[a],a,r))return!0;return!1}function baseIsEqual(r,e,a,t,o,n){return r===e||(null==r||null==e||!isObject(r)&&!isObjectLike(e)?r!==r&&e!==e:baseIsEqualDeep(r,e,baseIsEqual,a,t,o,n))}function baseIsEqualDeep(r,e,a,t,o,n,u){var c=isArray(r),s=isArray(e),i=arrayTag,g=arrayTag;c||(i=objToString.call(r),i==argsTag?i=objectTag:i!=objectTag&&(c=isTypedArray(r))),s||(g=objToString.call(e),g==argsTag?g=objectTag:g!=objectTag&&(s=isTypedArray(e)));var b=i==objectTag,l=g==objectTag,f=i==g;if(f&&!c&&!b)return equalByTag(r,e,i);if(!o){var y=b&&hasOwnProperty.call(r,"__wrapped__"),T=l&&hasOwnProperty.call(e,"__wrapped__");if(y||T)return a(y?r.value():r,T?e.value():e,t,o,n,u)}if(!f)return!1;n||(n=[]),u||(u=[]);for(var j=n.length;j--;)if(n[j]==r)return u[j]==e;n.push(r),u.push(e);var p=(c?equalArrays:equalObjects)(r,e,a,t,o,n,u);return n.pop(),u.pop(),p}function equalArrays(r,e,a,t,o,n,u){var c=-1,s=r.length,i=e.length;if(s!=i&&!(o&&i>s))return!1;for(;++c<s;){var g=r[c],b=e[c],l=t?t(o?b:g,o?g:b,c):void 0;if(void 0!==l){if(l)continue;return!1}if(o){if(!arraySome(e,function(r){return g===r||a(g,r,t,o,n,u)}))return!1}else if(g!==b&&!a(g,b,t,o,n,u))return!1}return!0}function equalByTag(r,e,a){switch(a){case boolTag:case dateTag:return+r==+e;case errorTag:return r.name==e.name&&r.message==e.message;case numberTag:return r!=+r?e!=+e:r==+e;case regexpTag:case stringTag:return r==e+""}return!1}function equalObjects(r,e,a,t,o,n,u){var c=keys(r),s=c.length;if(s!=keys(e).length&&!o)return!1;for(var i=s;i--;){var g=c[i];if(!(o?g in e:hasOwnProperty.call(e,g)))return!1}for(var b=o;++i<s;){g=c[i];var l=r[g],f=e[g],y=t?t(o?f:l,o?l:f,g):void 0;if(!(void 0===y?a(l,f,t,o,n,u):y))return!1;b||(b="constructor"==g)}if(!b){var T=r.constructor,j=e.constructor;if(T!=j&&"constructor"in r&&"constructor"in e&&!("function"==typeof T&&T instanceof T&&"function"==typeof j&&j instanceof j))return!1}return!0}function isObject(r){var e=typeof r;return!!r&&("object"==e||"function"==e)}var isArray=_dereq_("lodash.isarray"),isTypedArray=_dereq_("lodash.istypedarray"),keys=_dereq_("lodash.keys"),argsTag="[object Arguments]",arrayTag="[object Array]",boolTag="[object Boolean]",dateTag="[object Date]",errorTag="[object Error]",numberTag="[object Number]",objectTag="[object Object]",regexpTag="[object RegExp]",stringTag="[object String]",objectProto=Object.prototype,hasOwnProperty=objectProto.hasOwnProperty,objToString=objectProto.toString;module.exports=baseIsEqual;
},{"lodash.isarray":119,"lodash.istypedarray":121,"lodash.keys":122}],116:[function(_dereq_,module,exports){
function bindCallback(n,t,r){if("function"!=typeof n)return identity;if(void 0===t)return n;switch(r){case 1:return function(r){return n.call(t,r)};case 3:return function(r,e,u){return n.call(t,r,e,u)};case 4:return function(r,e,u,c){return n.call(t,r,e,u,c)};case 5:return function(r,e,u,c,i){return n.call(t,r,e,u,c,i)}}return function(){return n.apply(t,arguments)}}function identity(n){return n}module.exports=bindCallback;
},{}],117:[function(_dereq_,module,exports){
function isObjectLike(t){return!!t&&"object"==typeof t}function getNative(t,o){var e=null==t?void 0:t[o];return isNative(e)?e:void 0}function isFunction(t){return isObject(t)&&objToString.call(t)==funcTag}function isObject(t){var o=typeof t;return!!t&&("object"==o||"function"==o)}function isNative(t){return null!=t&&(isFunction(t)?reIsNative.test(fnToString.call(t)):isObjectLike(t)&&reIsHostCtor.test(t))}var funcTag="[object Function]",reIsHostCtor=/^\[object .+?Constructor\]$/,objectProto=Object.prototype,fnToString=Function.prototype.toString,hasOwnProperty=objectProto.hasOwnProperty,objToString=objectProto.toString,reIsNative=RegExp("^"+fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");module.exports=getNative;
},{}],118:[function(_dereq_,module,exports){
function isArguments(t){return isArrayLikeObject(t)&&hasOwnProperty.call(t,"callee")&&(!propertyIsEnumerable.call(t,"callee")||objectToString.call(t)==argsTag)}function isArrayLike(t){return null!=t&&isLength(t.length)&&!isFunction(t)}function isArrayLikeObject(t){return isObjectLike(t)&&isArrayLike(t)}function isFunction(t){var e=isObject(t)?objectToString.call(t):"";return e==funcTag||e==genTag}function isLength(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=MAX_SAFE_INTEGER}function isObject(t){var e=typeof t;return!!t&&("object"==e||"function"==e)}function isObjectLike(t){return!!t&&"object"==typeof t}var MAX_SAFE_INTEGER=9007199254740991,argsTag="[object Arguments]",funcTag="[object Function]",genTag="[object GeneratorFunction]",objectProto=Object.prototype,hasOwnProperty=objectProto.hasOwnProperty,objectToString=objectProto.toString,propertyIsEnumerable=objectProto.propertyIsEnumerable;module.exports=isArguments;
},{}],119:[function(_dereq_,module,exports){
function isObjectLike(t){return!!t&&"object"==typeof t}function getNative(t,r){var e=null==t?void 0:t[r];return isNative(e)?e:void 0}function isLength(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=MAX_SAFE_INTEGER}function isFunction(t){return isObject(t)&&objToString.call(t)==funcTag}function isObject(t){var r=typeof t;return!!t&&("object"==r||"function"==r)}function isNative(t){return null!=t&&(isFunction(t)?reIsNative.test(fnToString.call(t)):isObjectLike(t)&&reIsHostCtor.test(t))}var arrayTag="[object Array]",funcTag="[object Function]",reIsHostCtor=/^\[object .+?Constructor\]$/,objectProto=Object.prototype,fnToString=Function.prototype.toString,hasOwnProperty=objectProto.hasOwnProperty,objToString=objectProto.toString,reIsNative=RegExp("^"+fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$"),nativeIsArray=getNative(Array,"isArray"),MAX_SAFE_INTEGER=9007199254740991,isArray=nativeIsArray||function(t){return isObjectLike(t)&&isLength(t.length)&&objToString.call(t)==arrayTag};module.exports=isArray;
},{}],120:[function(_dereq_,module,exports){
function isEqual(a,l,i,e){i="function"==typeof i?bindCallback(i,e,3):void 0;var s=i?i(a,l):void 0;return void 0===s?baseIsEqual(a,l,i):!!s}var baseIsEqual=_dereq_("lodash._baseisequal"),bindCallback=_dereq_("lodash._bindcallback");module.exports=isEqual;
},{"lodash._baseisequal":115,"lodash._bindcallback":116}],121:[function(_dereq_,module,exports){
function isLength(a){return"number"==typeof a&&a>-1&&a%1==0&&a<=MAX_SAFE_INTEGER}function isObjectLike(a){return!!a&&"object"==typeof a}function isTypedArray(a){return isObjectLike(a)&&isLength(a.length)&&!!typedArrayTags[objectToString.call(a)]}var MAX_SAFE_INTEGER=9007199254740991,argsTag="[object Arguments]",arrayTag="[object Array]",boolTag="[object Boolean]",dateTag="[object Date]",errorTag="[object Error]",funcTag="[object Function]",mapTag="[object Map]",numberTag="[object Number]",objectTag="[object Object]",regexpTag="[object RegExp]",setTag="[object Set]",stringTag="[object String]",weakMapTag="[object WeakMap]",arrayBufferTag="[object ArrayBuffer]",dataViewTag="[object DataView]",float32Tag="[object Float32Array]",float64Tag="[object Float64Array]",int8Tag="[object Int8Array]",int16Tag="[object Int16Array]",int32Tag="[object Int32Array]",uint8Tag="[object Uint8Array]",uint8ClampedTag="[object Uint8ClampedArray]",uint16Tag="[object Uint16Array]",uint32Tag="[object Uint32Array]",typedArrayTags={};typedArrayTags[float32Tag]=typedArrayTags[float64Tag]=typedArrayTags[int8Tag]=typedArrayTags[int16Tag]=typedArrayTags[int32Tag]=typedArrayTags[uint8Tag]=typedArrayTags[uint8ClampedTag]=typedArrayTags[uint16Tag]=typedArrayTags[uint32Tag]=!0,typedArrayTags[argsTag]=typedArrayTags[arrayTag]=typedArrayTags[arrayBufferTag]=typedArrayTags[boolTag]=typedArrayTags[dataViewTag]=typedArrayTags[dateTag]=typedArrayTags[errorTag]=typedArrayTags[funcTag]=typedArrayTags[mapTag]=typedArrayTags[numberTag]=typedArrayTags[objectTag]=typedArrayTags[regexpTag]=typedArrayTags[setTag]=typedArrayTags[stringTag]=typedArrayTags[weakMapTag]=!1;var objectProto=Object.prototype,objectToString=objectProto.toString;module.exports=isTypedArray;
},{}],122:[function(_dereq_,module,exports){
function baseProperty(e){return function(t){return null==t?void 0:t[e]}}function isArrayLike(e){return null!=e&&isLength(getLength(e))}function isIndex(e,t){return e="number"==typeof e||reIsUint.test(e)?+e:-1,t=null==t?MAX_SAFE_INTEGER:t,e>-1&&e%1==0&&e<t}function isLength(e){return"number"==typeof e&&e>-1&&e%1==0&&e<=MAX_SAFE_INTEGER}function shimKeys(e){for(var t=keysIn(e),r=t.length,n=r&&e.length,s=!!n&&isLength(n)&&(isArray(e)||isArguments(e)),o=-1,i=[];++o<r;){var u=t[o];(s&&isIndex(u,n)||hasOwnProperty.call(e,u))&&i.push(u)}return i}function isObject(e){var t=typeof e;return!!e&&("object"==t||"function"==t)}function keysIn(e){if(null==e)return[];isObject(e)||(e=Object(e));var t=e.length;t=t&&isLength(t)&&(isArray(e)||isArguments(e))&&t||0;for(var r=e.constructor,n=-1,s="function"==typeof r&&r.prototype===e,o=Array(t),i=t>0;++n<t;)o[n]=n+"";for(var u in e)i&&isIndex(u,t)||"constructor"==u&&(s||!hasOwnProperty.call(e,u))||o.push(u);return o}var getNative=_dereq_("lodash._getnative"),isArguments=_dereq_("lodash.isarguments"),isArray=_dereq_("lodash.isarray"),reIsUint=/^\d+$/,objectProto=Object.prototype,hasOwnProperty=objectProto.hasOwnProperty,nativeKeys=getNative(Object,"keys"),MAX_SAFE_INTEGER=9007199254740991,getLength=baseProperty("length"),keys=nativeKeys?function(e){var t=null==e?void 0:e.constructor;return"function"==typeof t&&t.prototype===e||"function"!=typeof e&&isArrayLike(e)?shimKeys(e):isObject(e)?nativeKeys(e):[]}:shimKeys;module.exports=keys;
},{"lodash._getnative":117,"lodash.isarguments":118,"lodash.isarray":119}],123:[function(_dereq_,module,exports){
"use strict";module.exports=_dereq_("./v8.json");
},{"./v8.json":124}],124:[function(_dereq_,module,exports){
module.exports={"$version":8,"$root":{"version":{"required":true,"type":"enum","values":[8]},"name":{"type":"string"},"metadata":{"type":"*"},"center":{"type":"array","value":"number"},"zoom":{"type":"number"},"bearing":{"type":"number","default":0,"period":360,"units":"degrees"},"pitch":{"type":"number","default":0,"units":"degrees"},"light":{"type":"light"},"sources":{"required":true,"type":"sources"},"sprite":{"type":"string"},"glyphs":{"type":"string"},"transition":{"type":"transition"},"layers":{"required":true,"type":"array","value":"layer"}},"sources":{"*":{"type":"source"}},"source":["source_tile","source_geojson","source_video","source_image","source_canvas"],"source_tile":{"type":{"required":true,"type":"enum","values":{"vector":{},"raster":{}}},"url":{"type":"string"},"tiles":{"type":"array","value":"string"},"bounds":{"type":"array","value":"number","length":4,"default":[-180,-85.0511,180,85.0511]},"minzoom":{"type":"number","default":0},"maxzoom":{"type":"number","default":22},"tileSize":{"type":"number","default":512,"units":"pixels"},"*":{"type":"*"}},"source_geojson":{"type":{"required":true,"type":"enum","values":{"geojson":{}}},"data":{"type":"*"},"maxzoom":{"type":"number","default":18},"buffer":{"type":"number","default":128,"maximum":512,"minimum":0},"tolerance":{"type":"number","default":0.375},"cluster":{"type":"boolean","default":false},"clusterRadius":{"type":"number","default":50,"minimum":0},"clusterMaxZoom":{"type":"number"}},"source_video":{"type":{"required":true,"type":"enum","values":{"video":{}}},"urls":{"required":true,"type":"array","value":"string"},"coordinates":{"required":true,"type":"array","length":4,"value":{"type":"array","length":2,"value":"number"}}},"source_image":{"type":{"required":true,"type":"enum","values":{"image":{}}},"url":{"required":true,"type":"string"},"coordinates":{"required":true,"type":"array","length":4,"value":{"type":"array","length":2,"value":"number"}}},"source_canvas":{"type":{"required":true,"type":"enum","values":{"canvas":{}}},"coordinates":{"required":true,"type":"array","length":4,"value":{"type":"array","length":2,"value":"number"}},"animate":{"type":"boolean","default":"true"},"canvas":{"type":"string","required":true},"contextType":{"required":true,"type":"enum","values":{"2d":{},"webgl":{},"experimental-webgl":{},"webgl2":{}}}},"layer":{"id":{"type":"string","required":true},"type":{"type":"enum","values":{"fill":{},"line":{},"symbol":{},"circle":{},"fill-extrusion":{},"raster":{},"background":{}}},"metadata":{"type":"*"},"ref":{"type":"string"},"source":{"type":"string"},"source-layer":{"type":"string"},"minzoom":{"type":"number","minimum":0,"maximum":24},"maxzoom":{"type":"number","minimum":0,"maximum":24},"filter":{"type":"filter"},"layout":{"type":"layout"},"paint":{"type":"paint"},"paint.*":{"type":"paint"}},"layout":["layout_fill","layout_line","layout_circle","layout_fill-extrusion","layout_symbol","layout_raster","layout_background"],"layout_background":{"visibility":{"type":"enum","values":{"visible":{},"none":{}},"default":"visible"}},"layout_fill":{"visibility":{"type":"enum","values":{"visible":{},"none":{}},"default":"visible"}},"layout_circle":{"visibility":{"type":"enum","values":{"visible":{},"none":{}},"default":"visible"}},"layout_fill-extrusion":{"visibility":{"type":"enum","values":{"visible":{},"none":{}},"default":"visible"}},"layout_line":{"line-cap":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"butt":{},"round":{},"square":{}},"default":"butt"},"line-join":{"type":"enum","function":"piecewise-constant","zoom-function":true,"property-function":true,"values":{"bevel":{},"round":{},"miter":{}},"default":"miter"},"line-miter-limit":{"type":"number","default":2,"function":"interpolated","zoom-function":true,"requires":[{"line-join":"miter"}]},"line-round-limit":{"type":"number","default":1.05,"function":"interpolated","zoom-function":true,"requires":[{"line-join":"round"}]},"visibility":{"type":"enum","values":{"visible":{},"none":{}},"default":"visible"}},"layout_symbol":{"symbol-placement":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"point":{},"line":{}},"default":"point"},"symbol-spacing":{"type":"number","default":250,"minimum":1,"function":"interpolated","zoom-function":true,"units":"pixels","requires":[{"symbol-placement":"line"}]},"symbol-avoid-edges":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false},"icon-allow-overlap":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false,"requires":["icon-image"]},"icon-ignore-placement":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false,"requires":["icon-image"]},"icon-optional":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false,"requires":["icon-image","text-field"]},"icon-rotation-alignment":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{},"auto":{}},"default":"auto","requires":["icon-image"]},"icon-size":{"type":"number","default":1,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"units":"factor of the original icon size","requires":["icon-image"]},"icon-text-fit":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"none":{},"width":{},"height":{},"both":{}},"default":"none","requires":["icon-image","text-field"]},"icon-text-fit-padding":{"type":"array","value":"number","length":4,"default":[0,0,0,0],"units":"pixels","function":"interpolated","zoom-function":true,"requires":["icon-image","text-field",{"icon-text-fit":["both","width","height"]}]},"icon-image":{"type":"string","function":"piecewise-constant","zoom-function":true,"property-function":true,"tokens":true},"icon-rotate":{"type":"number","default":0,"period":360,"function":"interpolated","zoom-function":true,"property-function":true,"units":"degrees","requires":["icon-image"]},"icon-padding":{"type":"number","default":2,"minimum":0,"function":"interpolated","zoom-function":true,"units":"pixels","requires":["icon-image"]},"icon-keep-upright":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false,"requires":["icon-image",{"icon-rotation-alignment":"map"},{"symbol-placement":"line"}]},"icon-offset":{"type":"array","value":"number","length":2,"default":[0,0],"function":"interpolated","zoom-function":true,"property-function":true,"requires":["icon-image"]},"icon-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"property-function":true,"values":{"center":{},"left":{},"right":{},"top":{},"bottom":{},"top-left":{},"top-right":{},"bottom-left":{},"bottom-right":{}},"default":"center","requires":["icon-image"]},"icon-pitch-alignment":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{},"auto":{}},"default":"auto","requires":["icon-image"]},"text-pitch-alignment":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{},"auto":{}},"default":"auto","requires":["text-field"]},"text-rotation-alignment":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{},"auto":{}},"default":"auto","requires":["text-field"]},"text-field":{"type":"string","function":"piecewise-constant","zoom-function":true,"property-function":true,"default":"","tokens":true},"text-font":{"type":"array","value":"string","function":"piecewise-constant","zoom-function":true,"default":["Open Sans Regular","Arial Unicode MS Regular"],"requires":["text-field"]},"text-size":{"type":"number","default":16,"minimum":0,"units":"pixels","function":"interpolated","zoom-function":true,"property-function":true,"requires":["text-field"]},"text-max-width":{"type":"number","default":10,"minimum":0,"units":"ems","function":"interpolated","zoom-function":true,"property-function":true,"requires":["text-field"]},"text-line-height":{"type":"number","default":1.2,"units":"ems","function":"interpolated","zoom-function":true,"requires":["text-field"]},"text-letter-spacing":{"type":"number","default":0,"units":"ems","function":"interpolated","zoom-function":true,"property-function":true,"requires":["text-field"]},"text-justify":{"type":"enum","function":"piecewise-constant","zoom-function":true,"property-function":true,"values":{"left":{},"center":{},"right":{}},"default":"center","requires":["text-field"]},"text-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"property-function":true,"values":{"center":{},"left":{},"right":{},"top":{},"bottom":{},"top-left":{},"top-right":{},"bottom-left":{},"bottom-right":{}},"default":"center","requires":["text-field"]},"text-max-angle":{"type":"number","default":45,"units":"degrees","function":"interpolated","zoom-function":true,"requires":["text-field",{"symbol-placement":"line"}]},"text-rotate":{"type":"number","default":0,"period":360,"units":"degrees","function":"interpolated","zoom-function":true,"property-function":true,"requires":["text-field"]},"text-padding":{"type":"number","default":2,"minimum":0,"units":"pixels","function":"interpolated","zoom-function":true,"requires":["text-field"]},"text-keep-upright":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":true,"requires":["text-field",{"text-rotation-alignment":"map"},{"symbol-placement":"line"}]},"text-transform":{"type":"enum","function":"piecewise-constant","zoom-function":true,"property-function":true,"values":{"none":{},"uppercase":{},"lowercase":{}},"default":"none","requires":["text-field"]},"text-offset":{"type":"array","value":"number","units":"ems","function":"interpolated","zoom-function":true,"property-function":true,"length":2,"default":[0,0],"requires":["text-field"]},"text-allow-overlap":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false,"requires":["text-field"]},"text-ignore-placement":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false,"requires":["text-field"]},"text-optional":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":false,"requires":["text-field","icon-image"]},"visibility":{"type":"enum","values":{"visible":{},"none":{}},"default":"visible"}},"layout_raster":{"visibility":{"type":"enum","values":{"visible":{},"none":{}},"default":"visible"}},"filter":{"type":"array","value":"*"},"filter_operator":{"type":"enum","values":{"==":{},"!=":{},">":{},">=":{},"<":{},"<=":{},"in":{},"!in":{},"all":{},"any":{},"none":{},"has":{},"!has":{}}},"geometry_type":{"type":"enum","values":{"Point":{},"LineString":{},"Polygon":{}}},"function":{"stops":{"type":"array","value":"function_stop"},"base":{"type":"number","default":1,"minimum":0},"property":{"type":"string","default":"$zoom"},"type":{"type":"enum","values":{"identity":{},"exponential":{},"interval":{},"categorical":{}},"default":"exponential"},"colorSpace":{"type":"enum","values":{"rgb":{},"lab":{},"hcl":{}},"default":"rgb"},"default":{"type":"*","required":false}},"function_stop":{"type":"array","minimum":0,"maximum":22,"value":["number","color"],"length":2},"light":{"anchor":{"type":"enum","default":"viewport","values":{"map":{},"viewport":{}},"transition":false,"zoom-function":true,"property-function":false,"function":"piecewise-constant"},"position":{"type":"array","default":[1.15,210,30],"length":3,"value":"number","transition":true,"function":"interpolated","zoom-function":true,"property-function":false},"color":{"type":"color","default":"#ffffff","function":"interpolated","zoom-function":true,"property-function":false,"transition":true},"intensity":{"type":"number","default":0.5,"minimum":0,"maximum":1,"function":"interpolated","zoom-function":true,"property-function":false,"transition":true}},"paint":["paint_fill","paint_line","paint_circle","paint_fill-extrusion","paint_symbol","paint_raster","paint_background"],"paint_fill":{"fill-antialias":{"type":"boolean","function":"piecewise-constant","zoom-function":true,"default":true},"fill-opacity":{"type":"number","function":"interpolated","zoom-function":true,"property-function":true,"default":1,"minimum":0,"maximum":1,"transition":true},"fill-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":[{"!":"fill-pattern"}]},"fill-outline-color":{"type":"color","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":[{"!":"fill-pattern"},{"fill-antialias":true}]},"fill-translate":{"type":"array","value":"number","length":2,"default":[0,0],"function":"interpolated","zoom-function":true,"transition":true,"units":"pixels"},"fill-translate-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"map","requires":["fill-translate"]},"fill-pattern":{"type":"string","function":"piecewise-constant","zoom-function":true,"transition":true}},"paint_fill-extrusion":{"fill-extrusion-opacity":{"type":"number","function":"interpolated","zoom-function":true,"property-function":false,"default":1,"minimum":0,"maximum":1,"transition":true},"fill-extrusion-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":[{"!":"fill-extrusion-pattern"}]},"fill-extrusion-translate":{"type":"array","value":"number","length":2,"default":[0,0],"function":"interpolated","zoom-function":true,"transition":true,"units":"pixels"},"fill-extrusion-translate-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"map","requires":["fill-extrusion-translate"]},"fill-extrusion-pattern":{"type":"string","function":"piecewise-constant","zoom-function":true,"transition":true},"fill-extrusion-height":{"type":"number","function":"interpolated","zoom-function":true,"property-function":true,"default":0,"minimum":0,"units":"meters","transition":true},"fill-extrusion-base":{"type":"number","function":"interpolated","zoom-function":true,"property-function":true,"default":0,"minimum":0,"maximum":65535,"units":"meters","transition":true,"requires":["fill-extrusion-height"]}},"paint_line":{"line-opacity":{"type":"number","function":"interpolated","zoom-function":true,"property-function":true,"default":1,"minimum":0,"maximum":1,"transition":true},"line-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":[{"!":"line-pattern"}]},"line-translate":{"type":"array","value":"number","length":2,"default":[0,0],"function":"interpolated","zoom-function":true,"transition":true,"units":"pixels"},"line-translate-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"map","requires":["line-translate"]},"line-width":{"type":"number","default":1,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels"},"line-gap-width":{"type":"number","default":0,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels"},"line-offset":{"type":"number","default":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels"},"line-blur":{"type":"number","default":0,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels"},"line-dasharray":{"type":"array","value":"number","function":"piecewise-constant","zoom-function":true,"minimum":0,"transition":true,"units":"line widths","requires":[{"!":"line-pattern"}]},"line-pattern":{"type":"string","function":"piecewise-constant","zoom-function":true,"transition":true}},"paint_circle":{"circle-radius":{"type":"number","default":5,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels"},"circle-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"property-function":true,"transition":true},"circle-blur":{"type":"number","default":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true},"circle-opacity":{"type":"number","default":1,"minimum":0,"maximum":1,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true},"circle-translate":{"type":"array","value":"number","length":2,"default":[0,0],"function":"interpolated","zoom-function":true,"transition":true,"units":"pixels"},"circle-translate-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"map","requires":["circle-translate"]},"circle-pitch-scale":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"map"},"circle-pitch-alignment":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"viewport"},"circle-stroke-width":{"type":"number","default":0,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels"},"circle-stroke-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"property-function":true,"transition":true},"circle-stroke-opacity":{"type":"number","default":1,"minimum":0,"maximum":1,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true}},"paint_symbol":{"icon-opacity":{"type":"number","default":1,"minimum":0,"maximum":1,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":["icon-image"]},"icon-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":["icon-image"]},"icon-halo-color":{"type":"color","default":"rgba(0, 0, 0, 0)","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":["icon-image"]},"icon-halo-width":{"type":"number","default":0,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels","requires":["icon-image"]},"icon-halo-blur":{"type":"number","default":0,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels","requires":["icon-image"]},"icon-translate":{"type":"array","value":"number","length":2,"default":[0,0],"function":"interpolated","zoom-function":true,"transition":true,"units":"pixels","requires":["icon-image"]},"icon-translate-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"map","requires":["icon-image","icon-translate"]},"text-opacity":{"type":"number","default":1,"minimum":0,"maximum":1,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":["text-field"]},"text-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":["text-field"]},"text-halo-color":{"type":"color","default":"rgba(0, 0, 0, 0)","function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"requires":["text-field"]},"text-halo-width":{"type":"number","default":0,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels","requires":["text-field"]},"text-halo-blur":{"type":"number","default":0,"minimum":0,"function":"interpolated","zoom-function":true,"property-function":true,"transition":true,"units":"pixels","requires":["text-field"]},"text-translate":{"type":"array","value":"number","length":2,"default":[0,0],"function":"interpolated","zoom-function":true,"transition":true,"units":"pixels","requires":["text-field"]},"text-translate-anchor":{"type":"enum","function":"piecewise-constant","zoom-function":true,"values":{"map":{},"viewport":{}},"default":"map","requires":["text-field","text-translate"]}},"paint_raster":{"raster-opacity":{"type":"number","default":1,"minimum":0,"maximum":1,"function":"interpolated","zoom-function":true,"transition":true},"raster-hue-rotate":{"type":"number","default":0,"period":360,"function":"interpolated","zoom-function":true,"transition":true,"units":"degrees"},"raster-brightness-min":{"type":"number","function":"interpolated","zoom-function":true,"default":0,"minimum":0,"maximum":1,"transition":true},"raster-brightness-max":{"type":"number","function":"interpolated","zoom-function":true,"default":1,"minimum":0,"maximum":1,"transition":true},"raster-saturation":{"type":"number","default":0,"minimum":-1,"maximum":1,"function":"interpolated","zoom-function":true,"transition":true},"raster-contrast":{"type":"number","default":0,"minimum":-1,"maximum":1,"function":"interpolated","zoom-function":true,"transition":true},"raster-fade-duration":{"type":"number","default":300,"minimum":0,"function":"interpolated","zoom-function":true,"transition":true,"units":"milliseconds"}},"paint_background":{"background-color":{"type":"color","default":"#000000","function":"interpolated","zoom-function":true,"transition":true,"requires":[{"!":"background-pattern"}]},"background-pattern":{"type":"string","function":"piecewise-constant","zoom-function":true,"transition":true},"background-opacity":{"type":"number","default":1,"minimum":0,"maximum":1,"function":"interpolated","zoom-function":true,"transition":true}},"transition":{"duration":{"type":"number","default":300,"minimum":0,"units":"milliseconds"},"delay":{"type":"number","default":0,"minimum":0,"units":"milliseconds"}}}
},{}],125:[function(_dereq_,module,exports){
"use strict";module.exports=function(r){for(var t=[],e=arguments.length-1;e-- >0;)t[e]=arguments[e+1];for(var n=0,o=t;n<o.length;n+=1){var a=o[n];for(var f in a)r[f]=a[f]}return r};
},{}],126:[function(_dereq_,module,exports){
"use strict";module.exports=function(n){return n instanceof Number?"number":n instanceof String?"string":n instanceof Boolean?"boolean":Array.isArray(n)?"array":null===n?"null":typeof n};
},{}],127:[function(_dereq_,module,exports){
"use strict";function interpolate(t,e,n){return t*(1-n)+e*n}module.exports=interpolate,interpolate.number=interpolate,interpolate.vec2=function(t,e,n){return[interpolate(t[0],e[0],n),interpolate(t[1],e[1],n)]},interpolate.color=function(t,e,n){return[interpolate(t[0],e[0],n),interpolate(t[1],e[1],n),interpolate(t[2],e[2],n),interpolate(t[3],e[3],n)]},interpolate.array=function(t,e,n){return t.map(function(t,r){return interpolate(t,e[r],n)})};
},{}],128:[function(_dereq_,module,exports){
"use strict";var parseColorString=_dereq_("csscolorparser").parseCSSColor;module.exports=function(r){if("string"==typeof r){var e=parseColorString(r);if(!e)return;return[e[0]/255*e[3],e[1]/255*e[3],e[2]/255*e[3],e[3]]}return Array.isArray(r)?r:void 0};
},{"csscolorparser":114}],129:[function(_dereq_,module,exports){
"use strict";module.exports=["type","source","source-layer","minzoom","maxzoom","filter","layout"];
},{}],130:[function(_dereq_,module,exports){
"use strict";module.exports=function(n){return n instanceof Number||n instanceof String||n instanceof Boolean?n.valueOf():n};
},{}],131:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),getType=_dereq_("../util/get_type"),extend=_dereq_("../util/extend");module.exports=function(e){var r=_dereq_("./validate_function"),t=_dereq_("./validate_object"),i={"*":function(){return[]},array:_dereq_("./validate_array"),boolean:_dereq_("./validate_boolean"),number:_dereq_("./validate_number"),color:_dereq_("./validate_color"),constants:_dereq_("./validate_constants"),enum:_dereq_("./validate_enum"),filter:_dereq_("./validate_filter"),function:_dereq_("./validate_function"),layer:_dereq_("./validate_layer"),object:_dereq_("./validate_object"),source:_dereq_("./validate_source"),light:_dereq_("./validate_light"),string:_dereq_("./validate_string")},a=e.value,n=e.valueSpec,u=e.key,o=e.styleSpec,l=e.style;if("string"===getType(a)&&"@"===a[0]){if(o.$version>7)return[new ValidationError(u,a,"constants have been deprecated as of v8")];if(!(a in l.constants))return[new ValidationError(u,a,'constant "%s" not found',a)];e=extend({},e,{value:l.constants[a]})}return n.function&&"object"===getType(a)?r(e):n.type&&i[n.type]?i[n.type](e):t(extend({},e,{valueSpec:n.type?o[n.type]:n}))};
},{"../error/validation_error":109,"../util/extend":125,"../util/get_type":126,"./validate_array":132,"./validate_boolean":133,"./validate_color":134,"./validate_constants":135,"./validate_enum":136,"./validate_filter":137,"./validate_function":138,"./validate_layer":140,"./validate_light":142,"./validate_number":143,"./validate_object":144,"./validate_source":147,"./validate_string":148}],132:[function(_dereq_,module,exports){
"use strict";var getType=_dereq_("../util/get_type"),validate=_dereq_("./validate"),ValidationError=_dereq_("../error/validation_error");module.exports=function(e){var r=e.value,t=e.valueSpec,a=e.style,n=e.styleSpec,l=e.key,i=e.arrayElementValidator||validate;if("array"!==getType(r))return[new ValidationError(l,r,"array expected, %s found",getType(r))];if(t.length&&r.length!==t.length)return[new ValidationError(l,r,"array length %d expected, length %d found",t.length,r.length)];if(t["min-length"]&&r.length<t["min-length"])return[new ValidationError(l,r,"array length at least %d expected, length %d found",t["min-length"],r.length)];var o={type:t.value};n.$version<7&&(o.function=t.function),"object"===getType(t.value)&&(o=t.value);for(var u=[],d=0;d<r.length;d++)u=u.concat(i({array:r,arrayIndex:d,value:r[d],valueSpec:o,style:a,styleSpec:n,key:l+"["+d+"]"}));return u};
},{"../error/validation_error":109,"../util/get_type":126,"./validate":131}],133:[function(_dereq_,module,exports){
"use strict";var getType=_dereq_("../util/get_type"),ValidationError=_dereq_("../error/validation_error");module.exports=function(e){var r=e.value,o=e.key,t=getType(r);return"boolean"!==t?[new ValidationError(o,r,"boolean expected, %s found",t)]:[]};
},{"../error/validation_error":109,"../util/get_type":126}],134:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),getType=_dereq_("../util/get_type"),parseCSSColor=_dereq_("csscolorparser").parseCSSColor;module.exports=function(r){var e=r.key,o=r.value,t=getType(o);return"string"!==t?[new ValidationError(e,o,"color expected, %s found",t)]:null===parseCSSColor(o)?[new ValidationError(e,o,'color expected, "%s" found',o)]:[]};
},{"../error/validation_error":109,"../util/get_type":126,"csscolorparser":114}],135:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),getType=_dereq_("../util/get_type");module.exports=function(r){var e=r.key,t=r.value;if(r.styleSpec.$version>7)return t?[new ValidationError(e,t,"constants have been deprecated as of v8")]:[];var a=getType(t);if("object"!==a)return[new ValidationError(e,t,"object expected, %s found",a)];var o=[];for(var n in t)"@"!==n[0]&&o.push(new ValidationError(e+"."+n,t[n],'constants must start with "@"'));return o};
},{"../error/validation_error":109,"../util/get_type":126}],136:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),unbundle=_dereq_("../util/unbundle_jsonlint");module.exports=function(e){var r=e.key,n=e.value,u=e.valueSpec,o=[];return Array.isArray(u.values)?-1===u.values.indexOf(unbundle(n))&&o.push(new ValidationError(r,n,"expected one of [%s], %s found",u.values.join(", "),n)):-1===Object.keys(u.values).indexOf(unbundle(n))&&o.push(new ValidationError(r,n,"expected one of [%s], %s found",Object.keys(u.values).join(", "),n)),o};
},{"../error/validation_error":109,"../util/unbundle_jsonlint":130}],137:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),validateEnum=_dereq_("./validate_enum"),getType=_dereq_("../util/get_type"),unbundle=_dereq_("../util/unbundle_jsonlint");module.exports=function e(r){var t,a=r.value,n=r.key,l=r.styleSpec,s=[];if("array"!==getType(a))return[new ValidationError(n,a,"array expected, %s found",getType(a))];if(a.length<1)return[new ValidationError(n,a,"filter array must have at least 1 element")];switch(s=s.concat(validateEnum({key:n+"[0]",value:a[0],valueSpec:l.filter_operator,style:r.style,styleSpec:r.styleSpec})),unbundle(a[0])){case"<":case"<=":case">":case">=":a.length>=2&&"$type"===unbundle(a[1])&&s.push(new ValidationError(n,a,'"$type" cannot be use with operator "%s"',a[0]));case"==":case"!=":3!==a.length&&s.push(new ValidationError(n,a,'filter array for operator "%s" must have 3 elements',a[0]));case"in":case"!in":a.length>=2&&"string"!==(t=getType(a[1]))&&s.push(new ValidationError(n+"[1]",a[1],"string expected, %s found",t));for(var o=2;o<a.length;o++)t=getType(a[o]),"$type"===unbundle(a[1])?s=s.concat(validateEnum({key:n+"["+o+"]",value:a[o],valueSpec:l.geometry_type,style:r.style,styleSpec:r.styleSpec})):"string"!==t&&"number"!==t&&"boolean"!==t&&s.push(new ValidationError(n+"["+o+"]",a[o],"string, number, or boolean expected, %s found",t));break;case"any":case"all":case"none":for(var i=1;i<a.length;i++)s=s.concat(e({key:n+"["+i+"]",value:a[i],style:r.style,styleSpec:r.styleSpec}));break;case"has":case"!has":t=getType(a[1]),2!==a.length?s.push(new ValidationError(n,a,'filter array for "%s" operator must have 2 elements',a[0])):"string"!==t&&s.push(new ValidationError(n+"[1]",a[1],"string expected, %s found",t))}return s};
},{"../error/validation_error":109,"../util/get_type":126,"../util/unbundle_jsonlint":130,"./validate_enum":136}],138:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),getType=_dereq_("../util/get_type"),validate=_dereq_("./validate"),validateObject=_dereq_("./validate_object"),validateArray=_dereq_("./validate_array"),validateNumber=_dereq_("./validate_number"),unbundle=_dereq_("../util/unbundle_jsonlint");module.exports=function(e){function t(e){if("identity"===p)return[new ValidationError(e.key,e.value,'identity function may not have a "stops" property')];var t=[],a=e.value;return t=t.concat(validateArray({key:e.key,value:a,valueSpec:e.valueSpec,style:e.style,styleSpec:e.styleSpec,arrayElementValidator:r})),"array"===getType(a)&&0===a.length&&t.push(new ValidationError(e.key,a,"array must have at least one stop")),t}function r(e){var t=[],r=e.value,o=e.key;if("array"!==getType(r))return[new ValidationError(o,r,"array expected, %s found",getType(r))];if(2!==r.length)return[new ValidationError(o,r,"array length %d expected, length %d found",2,r.length)];if(c){if("object"!==getType(r[0]))return[new ValidationError(o,r,"object expected, %s found",getType(r[0]))];if(void 0===r[0].zoom)return[new ValidationError(o,r,"object stop key must have zoom")];if(void 0===r[0].value)return[new ValidationError(o,r,"object stop key must have value")];if(l&&l>unbundle(r[0].zoom))return[new ValidationError(o,r[0].zoom,"stop zoom values must appear in ascending order")];unbundle(r[0].zoom)!==l&&(l=unbundle(r[0].zoom),i=void 0,s={}),t=t.concat(validateObject({key:o+"[0]",value:r[0],valueSpec:{zoom:{}},style:e.style,styleSpec:e.styleSpec,objectElementValidators:{zoom:validateNumber,value:a}}))}else t=t.concat(a({key:o+"[0]",value:r[0],valueSpec:{},style:e.style,styleSpec:e.styleSpec}));return t.concat(validate({key:o+"[1]",value:r[1],valueSpec:u,style:e.style,styleSpec:e.styleSpec}))}function a(e){var t=getType(e.value),r=unbundle(e.value);if(n){if(t!==n)return[new ValidationError(e.key,e.value,"%s stop domain type must match previous stop domain type %s",t,n)]}else n=t;if("number"!==t&&"string"!==t&&"boolean"!==t)return[new ValidationError(e.key,e.value,"stop domain value must be a number, string, or boolean")];if("number"!==t&&"categorical"!==p){var a="number expected, %s found";return u["property-function"]&&void 0===p&&(a+='\nIf you intended to use a categorical function, specify `"type": "categorical"`.'),[new ValidationError(e.key,e.value,a,t)]}return"categorical"!==p||"number"!==t||isFinite(r)&&Math.floor(r)===r?"categorical"!==p&&"number"===t&&void 0!==i&&r<i?[new ValidationError(e.key,e.value,"stop domain values must appear in ascending order")]:(i=r,"categorical"===p&&r in s?[new ValidationError(e.key,e.value,"stop domain values must be unique")]:(s[r]=!0,[])):[new ValidationError(e.key,e.value,"integer expected, found %s",r)]}function o(e){return validate({key:e.key,value:e.value,valueSpec:u,style:e.style,styleSpec:e.styleSpec})}var n,i,l,u=e.valueSpec,p=unbundle(e.value.type),s={},y="categorical"!==p&&void 0===e.value.property,d=!y,c="array"===getType(e.value.stops)&&"array"===getType(e.value.stops[0])&&"object"===getType(e.value.stops[0][0]),v=validateObject({key:e.key,value:e.value,valueSpec:e.styleSpec.function,style:e.style,styleSpec:e.styleSpec,objectElementValidators:{stops:t,default:o}});return"identity"===p&&y&&v.push(new ValidationError(e.key,e.value,'missing required property "property"')),"identity"===p||e.value.stops||v.push(new ValidationError(e.key,e.value,'missing required property "stops"')),"exponential"===p&&"piecewise-constant"===e.valueSpec.function&&v.push(new ValidationError(e.key,e.value,"exponential functions not supported")),e.styleSpec.$version>=8&&(d&&!e.valueSpec["property-function"]?v.push(new ValidationError(e.key,e.value,"property functions not supported")):y&&!e.valueSpec["zoom-function"]&&v.push(new ValidationError(e.key,e.value,"zoom functions not supported"))),"categorical"!==p&&!c||void 0!==e.value.property||v.push(new ValidationError(e.key,e.value,'"property" property is required')),v};
},{"../error/validation_error":109,"../util/get_type":126,"../util/unbundle_jsonlint":130,"./validate":131,"./validate_array":132,"./validate_number":143,"./validate_object":144}],139:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),validateString=_dereq_("./validate_string");module.exports=function(r){var e=r.value,t=r.key,a=validateString(r);return a.length?a:(-1===e.indexOf("{fontstack}")&&a.push(new ValidationError(t,e,'"glyphs" url must include a "{fontstack}" token')),-1===e.indexOf("{range}")&&a.push(new ValidationError(t,e,'"glyphs" url must include a "{range}" token')),a)};
},{"../error/validation_error":109,"./validate_string":148}],140:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),unbundle=_dereq_("../util/unbundle_jsonlint"),validateObject=_dereq_("./validate_object"),validateFilter=_dereq_("./validate_filter"),validatePaintProperty=_dereq_("./validate_paint_property"),validateLayoutProperty=_dereq_("./validate_layout_property"),extend=_dereq_("../util/extend");module.exports=function(e){var r=[],t=e.value,a=e.key,i=e.style,l=e.styleSpec;t.type||t.ref||r.push(new ValidationError(a,t,'either "type" or "ref" is required'));var u=unbundle(t.type),n=unbundle(t.ref);if(t.id)for(var o=unbundle(t.id),s=0;s<e.arrayIndex;s++){var d=i.layers[s];unbundle(d.id)===o&&r.push(new ValidationError(a,t.id,'duplicate layer id "%s", previously used at line %d',t.id,d.id.__line__))}if("ref"in t){["type","source","source-layer","filter","layout"].forEach(function(e){e in t&&r.push(new ValidationError(a,t[e],'"%s" is prohibited for ref layers',e))});var y;i.layers.forEach(function(e){unbundle(e.id)===n&&(y=e)}),y?y.ref?r.push(new ValidationError(a,t.ref,"ref cannot reference another ref layer")):u=unbundle(y.type):r.push(new ValidationError(a,t.ref,'ref layer "%s" not found',n))}else if("background"!==u)if(t.source){var c=i.sources&&i.sources[t.source],p=c&&unbundle(c.type);c?"vector"===p&&"raster"===u?r.push(new ValidationError(a,t.source,'layer "%s" requires a raster source',t.id)):"raster"===p&&"raster"!==u?r.push(new ValidationError(a,t.source,'layer "%s" requires a vector source',t.id)):"vector"!==p||t["source-layer"]||r.push(new ValidationError(a,t,'layer "%s" must specify a "source-layer"',t.id)):r.push(new ValidationError(a,t.source,'source "%s" not found',t.source))}else r.push(new ValidationError(a,t,'missing required property "source"'));return r=r.concat(validateObject({key:a,value:t,valueSpec:l.layer,style:e.style,styleSpec:e.styleSpec,objectElementValidators:{"*":function(){return[]},filter:validateFilter,layout:function(e){return validateObject({layer:t,key:e.key,value:e.value,style:e.style,styleSpec:e.styleSpec,objectElementValidators:{"*":function(e){return validateLayoutProperty(extend({layerType:u},e))}}})},paint:function(e){return validateObject({layer:t,key:e.key,value:e.value,style:e.style,styleSpec:e.styleSpec,objectElementValidators:{"*":function(e){return validatePaintProperty(extend({layerType:u},e))}}})}}}))};
},{"../error/validation_error":109,"../util/extend":125,"../util/unbundle_jsonlint":130,"./validate_filter":137,"./validate_layout_property":141,"./validate_object":144,"./validate_paint_property":145}],141:[function(_dereq_,module,exports){
"use strict";var validateProperty=_dereq_("./validate_property");module.exports=function(r){return validateProperty(r,"layout")};
},{"./validate_property":146}],142:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),getType=_dereq_("../util/get_type"),validate=_dereq_("./validate");module.exports=function(e){var t=e.value,r=e.styleSpec,a=r.light,i=e.style,n=[],o=getType(t);if(void 0===t)return n;if("object"!==o)return n=n.concat([new ValidationError("light",t,"object expected, %s found",o)]);for(var l in t){var c=l.match(/^(.*)-transition$/);n=c&&a[c[1]]&&a[c[1]].transition?n.concat(validate({key:l,value:t[l],valueSpec:r.transition,style:i,styleSpec:r})):a[l]?n.concat(validate({key:l,value:t[l],valueSpec:a[l],style:i,styleSpec:r})):n.concat([new ValidationError(l,t[l],'unknown property "%s"',l)])}return n};
},{"../error/validation_error":109,"../util/get_type":126,"./validate":131}],143:[function(_dereq_,module,exports){
"use strict";var getType=_dereq_("../util/get_type"),ValidationError=_dereq_("../error/validation_error");module.exports=function(e){var r=e.key,i=e.value,m=e.valueSpec,a=getType(i);return"number"!==a?[new ValidationError(r,i,"number expected, %s found",a)]:"minimum"in m&&i<m.minimum?[new ValidationError(r,i,"%s is less than the minimum value %s",i,m.minimum)]:"maximum"in m&&i>m.maximum?[new ValidationError(r,i,"%s is greater than the maximum value %s",i,m.maximum)]:[]};
},{"../error/validation_error":109,"../util/get_type":126}],144:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),getType=_dereq_("../util/get_type"),validateSpec=_dereq_("./validate");module.exports=function(e){var r=e.key,t=e.value,i=e.valueSpec||{},a=e.objectElementValidators||{},o=e.style,l=e.styleSpec,n=[],u=getType(t);if("object"!==u)return[new ValidationError(r,t,"object expected, %s found",u)];for(var d in t){var p=d.split(".")[0],s=i[p]||i["*"],c=void 0;if(a[p])c=a[p];else if(i[p])c=validateSpec;else if(a["*"])c=a["*"];else{if(!i["*"]){n.push(new ValidationError(r,t[d],'unknown property "%s"',d));continue}c=validateSpec}n=n.concat(c({key:(r?r+".":r)+d,value:t[d],valueSpec:s,style:o,styleSpec:l,object:t,objectKey:d}))}for(var v in i)i[v].required&&void 0===i[v].default&&void 0===t[v]&&n.push(new ValidationError(r,t,'missing required property "%s"',v));return n};
},{"../error/validation_error":109,"../util/get_type":126,"./validate":131}],145:[function(_dereq_,module,exports){
"use strict";var validateProperty=_dereq_("./validate_property");module.exports=function(r){return validateProperty(r,"paint")};
},{"./validate_property":146}],146:[function(_dereq_,module,exports){
"use strict";var validate=_dereq_("./validate"),ValidationError=_dereq_("../error/validation_error"),getType=_dereq_("../util/get_type");module.exports=function(e,t){var r=e.key,i=e.style,a=e.styleSpec,n=e.value,o=e.objectKey,l=a[t+"_"+e.layerType];if(!l)return[];var y=o.match(/^(.*)-transition$/);if("paint"===t&&y&&l[y[1]]&&l[y[1]].transition)return validate({key:r,value:n,valueSpec:a.transition,style:i,styleSpec:a});var p=e.valueSpec||l[o];if(!p)return[new ValidationError(r,n,'unknown property "%s"',o)];var s;if("string"===getType(n)&&p["property-function"]&&!p.tokens&&(s=/^{([^}]+)}$/.exec(n)))return[new ValidationError(r,n,'"%s" does not support interpolation syntax\nUse an identity property function instead: `{ "type": "identity", "property": %s` }`.',o,JSON.stringify(s[1]))];var u=[];return"symbol"===e.layerType&&"text-field"===o&&i&&!i.glyphs&&u.push(new ValidationError(r,n,'use of "text-field" requires a style "glyphs" property')),u.concat(validate({key:e.key,value:n,valueSpec:p,style:i,styleSpec:a}))};
},{"../error/validation_error":109,"../util/get_type":126,"./validate":131}],147:[function(_dereq_,module,exports){
"use strict";var ValidationError=_dereq_("../error/validation_error"),unbundle=_dereq_("../util/unbundle_jsonlint"),validateObject=_dereq_("./validate_object"),validateEnum=_dereq_("./validate_enum");module.exports=function(e){var a=e.value,t=e.key,r=e.styleSpec,l=e.style;if(!a.type)return[new ValidationError(t,a,'"type" is required')];var u=unbundle(a.type),i=[];switch(u){case"vector":case"raster":if(i=i.concat(validateObject({key:t,value:a,valueSpec:r.source_tile,style:e.style,styleSpec:r})),"url"in a)for(var s in a)["type","url","tileSize"].indexOf(s)<0&&i.push(new ValidationError(t+"."+s,a[s],'a source with a "url" property may not include a "%s" property',s));return i;case"geojson":return validateObject({key:t,value:a,valueSpec:r.source_geojson,style:l,styleSpec:r});case"video":return validateObject({key:t,value:a,valueSpec:r.source_video,style:l,styleSpec:r});case"image":return validateObject({key:t,value:a,valueSpec:r.source_image,style:l,styleSpec:r});case"canvas":return validateObject({key:t,value:a,valueSpec:r.source_canvas,style:l,styleSpec:r});default:return validateEnum({key:t+".type",value:a.type,valueSpec:{values:["vector","raster","geojson","video","image","canvas"]},style:l,styleSpec:r})}};
},{"../error/validation_error":109,"../util/unbundle_jsonlint":130,"./validate_enum":136,"./validate_object":144}],148:[function(_dereq_,module,exports){
"use strict";var getType=_dereq_("../util/get_type"),ValidationError=_dereq_("../error/validation_error");module.exports=function(r){var e=r.value,t=r.key,i=getType(e);return"string"!==i?[new ValidationError(t,e,"string expected, %s found",i)]:[]};
},{"../error/validation_error":109,"../util/get_type":126}],149:[function(_dereq_,module,exports){
"use strict";function validateStyleMin(e,a){a=a||latestStyleSpec;var t=[];return t=t.concat(validate({key:"",value:e,valueSpec:a.$root,styleSpec:a,style:e,objectElementValidators:{glyphs:validateGlyphsURL,"*":function(){return[]}}})),a.$version>7&&e.constants&&(t=t.concat(validateConstants({key:"constants",value:e.constants,style:e,styleSpec:a}))),sortErrors(t)}function sortErrors(e){return[].concat(e).sort(function(e,a){return e.line-a.line})}function wrapCleanErrors(e){return function(){return sortErrors(e.apply(this,arguments))}}var validateConstants=_dereq_("./validate/validate_constants"),validate=_dereq_("./validate/validate"),latestStyleSpec=_dereq_("./reference/latest"),validateGlyphsURL=_dereq_("./validate/validate_glyphs_url");validateStyleMin.source=wrapCleanErrors(_dereq_("./validate/validate_source")),validateStyleMin.light=wrapCleanErrors(_dereq_("./validate/validate_light")),validateStyleMin.layer=wrapCleanErrors(_dereq_("./validate/validate_layer")),validateStyleMin.filter=wrapCleanErrors(_dereq_("./validate/validate_filter")),validateStyleMin.paintProperty=wrapCleanErrors(_dereq_("./validate/validate_paint_property")),validateStyleMin.layoutProperty=wrapCleanErrors(_dereq_("./validate/validate_layout_property")),module.exports=validateStyleMin;
},{"./reference/latest":123,"./validate/validate":131,"./validate/validate_constants":135,"./validate/validate_filter":137,"./validate/validate_glyphs_url":139,"./validate/validate_layer":140,"./validate/validate_layout_property":141,"./validate/validate_light":142,"./validate/validate_paint_property":145,"./validate/validate_source":147}],150:[function(_dereq_,module,exports){
"use strict";var AnimationLoop=function(){this.n=0,this.times=[]};AnimationLoop.prototype.stopped=function(){return this.times=this.times.filter(function(t){return t.time>=(new Date).getTime()}),!this.times.length},AnimationLoop.prototype.set=function(t){return this.times.push({id:this.n,time:t+(new Date).getTime()}),this.n++},AnimationLoop.prototype.cancel=function(t){this.times=this.times.filter(function(i){return i.id!==t})},module.exports=AnimationLoop;
},{}],151:[function(_dereq_,module,exports){
"use strict";var styleSpec=_dereq_("../style-spec/reference/latest"),util=_dereq_("../util/util"),Evented=_dereq_("../util/evented"),validateStyle=_dereq_("./validate_style"),StyleDeclaration=_dereq_("./style_declaration"),StyleTransition=_dereq_("./style_transition"),TRANSITION_SUFFIX="-transition",properties=["anchor","color","position","intensity"],specifications=styleSpec.light,Light=function(t){function i(i){t.call(this),this.set(i)}return t&&(i.__proto__=t),i.prototype=Object.create(t&&t.prototype),i.prototype.constructor=i,i.prototype.set=function(t){var i=this;if(!this._validate(validateStyle.light,t)){this._declarations={},this._transitions={},this._transitionOptions={},this.calculated={},t=util.extend({anchor:specifications.anchor.default,color:specifications.color.default,position:specifications.position.default,intensity:specifications.intensity.default},t);for(var e=0,o=properties;e<o.length;e+=1){var n=o[e];i._declarations[n]=new StyleDeclaration(specifications[n],t[n])}return this}},i.prototype.getLight=function(){return{anchor:this.getLightProperty("anchor"),color:this.getLightProperty("color"),position:this.getLightProperty("position"),intensity:this.getLightProperty("intensity")}},i.prototype.getLightProperty=function(t){return util.endsWith(t,TRANSITION_SUFFIX)?this._transitionOptions[t]:this._declarations[t]&&this._declarations[t].value},i.prototype.getLightValue=function(t,i){if("position"===t){var e=this._transitions[t].calculate(i),o=util.sphericalToCartesian(e);return{x:o[0],y:o[1],z:o[2]}}return this._transitions[t].calculate(i)},i.prototype.setLight=function(t){var i=this;if(!this._validate(validateStyle.light,t))for(var e in t){var o=t[e];util.endsWith(e,TRANSITION_SUFFIX)?i._transitionOptions[e]=o:null===o||void 0===o?delete i._declarations[e]:i._declarations[e]=new StyleDeclaration(specifications[e],o)}},i.prototype.recalculate=function(t){var i=this;for(var e in i._declarations)i.calculated[e]=i.getLightValue(e,{zoom:t})},i.prototype._applyLightDeclaration=function(t,i,e,o,n){var r=e.transition?this._transitions[t]:void 0,a=specifications[t];if(null!==i&&void 0!==i||(i=new StyleDeclaration(a,a.default)),!r||r.declaration.json!==i.json){var s=util.extend({duration:300,delay:0},o,this.getLightProperty(t+TRANSITION_SUFFIX)),l=this._transitions[t]=new StyleTransition(a,i,r,s);l.instant()||(l.loopID=n.set(l.endTime-Date.now())),r&&n.cancel(r.loopID)}},i.prototype.updateLightTransitions=function(t,i,e){var o,n=this;for(o in n._declarations)n._applyLightDeclaration(o,n._declarations[o],t,i,e)},i.prototype._validate=function(t,i){return validateStyle.emitErrors(this,t.call(validateStyle,util.extend({value:i,style:{glyphs:!0,sprite:!0},styleSpec:styleSpec})))},i}(Evented);module.exports=Light;
},{"../style-spec/reference/latest":123,"../util/evented":210,"../util/util":223,"./style_declaration":157,"./style_transition":165,"./validate_style":166}],152:[function(_dereq_,module,exports){
"use strict";var ref=_dereq_("../util/mapbox"),normalizeGlyphsURL=ref.normalizeGlyphsURL,ajax=_dereq_("../util/ajax"),parseGlyphPBF=_dereq_("./parse_glyph_pbf");module.exports=function(e,r,a,l,p){var i=256*r,s=i+255,t=l(normalizeGlyphsURL(a).replace("{fontstack}",e).replace("{range}",i+"-"+s),ajax.ResourceType.Glyphs);ajax.getArrayBuffer(t,function(e,r){if(e)p(e);else if(r){for(var a={},l=0,i=parseGlyphPBF(r.data);l<i.length;l+=1){var s=i[l];a[s.id]=s}p(null,a)}})};
},{"../util/ajax":201,"../util/mapbox":217,"./parse_glyph_pbf":154}],153:[function(_dereq_,module,exports){
"use strict";var ajax=_dereq_("../util/ajax"),browser=_dereq_("../util/browser"),ref=_dereq_("../util/mapbox"),normalizeSpriteURL=ref.normalizeSpriteURL,ref$1=_dereq_("../util/image"),RGBAImage=ref$1.RGBAImage;module.exports=function(e,r,i){function a(){if(u)i(u);else if(t&&o){var e=browser.getImageData(o),r={};for(var a in t){var n=t[a],l=n.width,g=n.height,x=n.x,f=n.y,m=n.sdf,p=n.pixelRatio,s=RGBAImage.create({width:l,height:g});RGBAImage.copy(e,s,{x:x,y:f},{x:0,y:0},{width:l,height:g}),r[a]={data:s,pixelRatio:p,sdf:m}}i(null,r)}}if(!e)return void i(null,{});var t,o,u,n=browser.devicePixelRatio>1?"@2x":"";ajax.getJSON(r(normalizeSpriteURL(e,n,".json"),ajax.ResourceType.SpriteJSON),function(e,r){u||(u=e,t=r,a())}),ajax.getImage(r(normalizeSpriteURL(e,n,".png"),ajax.ResourceType.SpriteImage),function(e,r){u||(u=e,o=r,a())})};
},{"../util/ajax":201,"../util/browser":202,"../util/image":213,"../util/mapbox":217}],154:[function(_dereq_,module,exports){
"use strict";function readFontstacks(e,a,r){1===e&&r.readMessage(readFontstack,a)}function readFontstack(e,a,r){if(3===e){var t=r.readMessage(readGlyph,{}),d=t.id,i=t.bitmap,n=t.width,o=t.height,h=t.left,s=t.top,p=t.advance;a.push({id:d,bitmap:AlphaImage.create({width:n+2*border,height:o+2*border},i),metrics:{width:n,height:o,left:h,top:s,advance:p}})}}function readGlyph(e,a,r){1===e?a.id=r.readVarint():2===e?a.bitmap=r.readBytes():3===e?a.width=r.readVarint():4===e?a.height=r.readVarint():5===e?a.left=r.readSVarint():6===e?a.top=r.readSVarint():7===e&&(a.advance=r.readVarint())}var ref=_dereq_("../util/image"),AlphaImage=ref.AlphaImage,Protobuf=_dereq_("pbf"),border=3;module.exports=function(e){return new Protobuf(e).readFields(readFontstacks,[])},module.exports.GLYPH_PBF_BORDER=border;
},{"../util/image":213,"pbf":29}],155:[function(_dereq_,module,exports){
"use strict";function getMaximumPaintValue(t,a,e){return a.isPaintValueFeatureConstant(t)?a.paint[t]:e.programConfigurations.get(a.id).paintPropertyStatistics[t].max}function translateDistance(t){return Math.sqrt(t[0]*t[0]+t[1]*t[1])}function translate(t,a,e,n,r){if(!a[0]&&!a[1])return t;var i=Point.convert(a);"viewport"===e&&i._rotate(-n);for(var u=[],s=0;s<t.length;s++){for(var o=t[s],l=[],m=0;m<o.length;m++)l.push(o[m].sub(i._mult(r)));u.push(l)}return u}var Point=_dereq_("@mapbox/point-geometry");module.exports={getMaximumPaintValue:getMaximumPaintValue,translateDistance:translateDistance,translate:translate};
},{"@mapbox/point-geometry":2}],156:[function(_dereq_,module,exports){
"use strict";var Evented=_dereq_("../util/evented"),StyleLayer=_dereq_("./style_layer"),loadSprite=_dereq_("./load_sprite"),ImageManager=_dereq_("../render/image_manager"),GlyphManager=_dereq_("../render/glyph_manager"),Light=_dereq_("./light"),LineAtlas=_dereq_("../render/line_atlas"),util=_dereq_("../util/util"),ajax=_dereq_("../util/ajax"),mapbox=_dereq_("../util/mapbox"),browser=_dereq_("../util/browser"),Dispatcher=_dereq_("../util/dispatcher"),AnimationLoop=_dereq_("./animation_loop"),validateStyle=_dereq_("./validate_style"),getSourceType=_dereq_("../source/source").getType,setSourceType=_dereq_("../source/source").setType,QueryFeatures=_dereq_("../source/query_features"),SourceCache=_dereq_("../source/source_cache"),styleSpec=_dereq_("../style-spec/reference/latest"),MapboxGLFunction=_dereq_("../style-spec/function"),getWorkerPool=_dereq_("../util/global_worker_pool"),deref=_dereq_("../style-spec/deref"),diff=_dereq_("../style-spec/diff"),rtlTextPlugin=_dereq_("../source/rtl_text_plugin"),supportedDiffOperations=util.pick(diff.operations,["addLayer","removeLayer","setPaintProperty","setLayoutProperty","setFilter","addSource","removeSource","setLayerZoomRange","setLight","setTransition"]),ignoredDiffOperations=util.pick(diff.operations,["setCenter","setZoom","setBearing","setPitch"]),Style=function(e){function t(t,r,a){var i=this;e.call(this),a=util.extend({validate:"string"!=typeof t||!mapbox.isMapboxURL(t)},a);var o=function(e,t){return i.map?i.map._transformRequest(e,t):{url:e}};this.map=r,this.animationLoop=r&&r.animationLoop||new AnimationLoop,this.dispatcher=new Dispatcher(getWorkerPool(),this),this.imageManager=new ImageManager,this.glyphManager=new GlyphManager(o,a.localIdeographFontFamily),this.lineAtlas=new LineAtlas(256,512),this._layers={},this._order=[],this.sourceCaches={},this.zoomHistory={},this._loaded=!1,util.bindAll(["_redoPlacement"],this),this._resetUpdates(),this.setEventedParent(r),this.fire("dataloading",{dataType:"style"});var s=this;this._rtlTextPluginCallback=rtlTextPlugin.registerForPluginAvailability(function(e){s.dispatcher.broadcast("loadRTLTextPlugin",e.pluginBlobURL,e.errorCallback);for(var t in s.sourceCaches)s.sourceCaches[t].reload()});var n=function(e,t){if(e)i.fire("error",{error:e});else if(t){if(a.validate&&validateStyle.emitErrors(i,validateStyle(t)))return;i._loaded=!0,i.stylesheet=t,i.updateClasses();for(var r in t.sources)i.addSource(r,t.sources[r],a);loadSprite(t.sprite,o,function(e,t){if(e)i.fire("error",e);else if(t)for(var r in t)i.imageManager.addImage(r,t[r]);i.imageManager.setLoaded(!0)}),i.glyphManager.setURL(t.glyphs),i._resolve(),i.fire("data",{dataType:"style"}),i.fire("style.load")}};"string"==typeof t?ajax.getJSON(o(mapbox.normalizeStyleURL(t),ajax.ResourceType.Style),n):browser.frame(function(){return n(null,t)}),this.on("data",function(e){if("source"===e.dataType&&"metadata"===e.sourceDataType){var t=i.sourceCaches[e.sourceId];if(t){var r=t.getSource();if(r&&r.vectorLayerIds)for(var a in i._layers){var o=i._layers[a];o.source===r.id&&i._validateLayer(o)}}}})}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype._validateLayer=function(e){var t=this.sourceCaches[e.source];if(t){var r=e.sourceLayer;if(r){var a=t.getSource();("geojson"===a.type||a.vectorLayerIds&&-1===a.vectorLayerIds.indexOf(r))&&this.fire("error",{error:new Error('Source layer "'+r+'" does not exist on source "'+a.id+'" as specified by style layer "'+e.id+'"')})}}},t.prototype.loaded=function(){var e=this;if(!this._loaded)return!1;if(Object.keys(this._updatedSources).length)return!1;for(var t in e.sourceCaches)if(!e.sourceCaches[t].loaded())return!1;return!!this.imageManager.isLoaded()},t.prototype._resolve=function(){var e=this,t=deref(this.stylesheet.layers);this._order=t.map(function(e){return e.id}),this._layers={};for(var r=0,a=t;r<a.length;r+=1){var i=a[r];i=StyleLayer.create(i),i.setEventedParent(e,{layer:{id:i.id}}),e._layers[i.id]=i}this.dispatcher.broadcast("setLayers",this._serializeLayers(this._order)),this.light=new Light(this.stylesheet.light)},t.prototype._serializeLayers=function(e){var t=this;return e.map(function(e){return t._layers[e].serialize()})},t.prototype._applyClasses=function(e,t){var r=this;if(this._loaded){e=e||[],t=t||{transition:!0};var a=this.stylesheet.transition||{},i=this._updatedAllPaintProps?this._layers:this._updatedPaintProps;for(var o in i){var s=r._layers[o],n=r._updatedPaintProps[o];if(r._updatedAllPaintProps||n.all)s.updatePaintTransitions(e,t,a,r.animationLoop,r.zoomHistory);else for(var l in n)r._layers[o].updatePaintTransition(l,e,t,a,r.animationLoop,r.zoomHistory)}this.light.updateLightTransitions(t,a,this.animationLoop)}},t.prototype._recalculate=function(e){var t=this;if(this._loaded){for(var r in t.sourceCaches)t.sourceCaches[r].used=!1;this._updateZoomHistory(e);for(var a=0,i=t._order;a<i.length;a+=1){var o=i[a],s=t._layers[o];s.recalculate(e),!s.isHidden(e)&&s.source&&(t.sourceCaches[s.source].used=!0)}this.light.recalculate(e);Math.floor(this.z)!==Math.floor(e)&&this.animationLoop.set(300),this.z=e}},t.prototype._updateZoomHistory=function(e){var t=this.zoomHistory;void 0===t.lastIntegerZoom&&(t.lastIntegerZoom=Math.floor(e),t.lastIntegerZoomTime=0,t.lastZoom=e),Math.floor(t.lastZoom)<Math.floor(e)?(t.lastIntegerZoom=Math.floor(e),t.lastIntegerZoomTime=Date.now()):Math.floor(t.lastZoom)>Math.floor(e)&&(t.lastIntegerZoom=Math.floor(e+1),t.lastIntegerZoomTime=Date.now()),t.lastZoom=e},t.prototype._checkLoaded=function(){if(!this._loaded)throw new Error("Style is not done loading")},t.prototype.update=function(e,t){var r=this;if(this._changed){var a=Object.keys(this._updatedLayers),i=Object.keys(this._removedLayers);(a.length||i.length||this._updatedSymbolOrder)&&this._updateWorkerLayers(a,i);for(var o in r._updatedSources){var s=r._updatedSources[o];"reload"===s?r._reloadSource(o):"clear"===s&&r._clearSource(o)}this._applyClasses(e,t),this._resetUpdates(),this.fire("data",{dataType:"style"})}},t.prototype._updateWorkerLayers=function(e,t){var r=this,a=this._updatedSymbolOrder?this._order.filter(function(e){return"symbol"===r._layers[e].type}):null;this.dispatcher.broadcast("updateLayers",{layers:this._serializeLayers(e),removedIds:t,symbolOrder:a})},t.prototype._resetUpdates=function(){this._changed=!1,this._updatedLayers={},this._removedLayers={},this._updatedSymbolOrder=!1,this._updatedSources={},this._updatedPaintProps={},this._updatedAllPaintProps=!1},t.prototype.setState=function(e){var t=this;if(this._checkLoaded(),validateStyle.emitErrors(this,validateStyle(e)))return!1;e=util.clone(e),e.layers=deref(e.layers);var r=diff(this.serialize(),e).filter(function(e){return!(e.command in ignoredDiffOperations)});if(0===r.length)return!1;var a=r.filter(function(e){return!(e.command in supportedDiffOperations)});if(a.length>0)throw new Error("Unimplemented: "+a.map(function(e){return e.command}).join(", ")+".");return r.forEach(function(e){"setTransition"!==e.command&&t[e.command].apply(t,e.args)}),this.stylesheet=e,!0},t.prototype.addImage=function(e,t){if(this.imageManager.getImage(e))return this.fire("error",{error:new Error("An image with this name already exists.")});this.imageManager.addImage(e,t),this.fire("data",{dataType:"style"})},t.prototype.removeImage=function(e){if(!this.imageManager.getImage(e))return this.fire("error",{error:new Error("No image with this name exists.")});this.imageManager.removeImage(e),this.fire("data",{dataType:"style"})},t.prototype.addSource=function(e,t,r){var a=this;if(this._checkLoaded(),void 0!==this.sourceCaches[e])throw new Error("There is already a source with this ID");if(!t.type)throw new Error("The type property must be defined, but the only the following properties were given: "+Object.keys(t).join(", ")+".");if(!(["vector","raster","geojson","video","image","canvas"].indexOf(t.type)>=0&&this._validate(validateStyle.source,"sources."+e,t,null,r))){var i=this.sourceCaches[e]=new SourceCache(e,t,this.dispatcher);i.style=this,i.setEventedParent(this,function(){return{isSourceLoaded:a.loaded(),source:i.serialize(),sourceId:e}}),i.onAdd(this.map),this._changed=!0}},t.prototype.removeSource=function(e){if(this._checkLoaded(),void 0===this.sourceCaches[e])throw new Error("There is no source with this ID");var t=this.sourceCaches[e];delete this.sourceCaches[e],delete this._updatedSources[e],t.fire("data",{sourceDataType:"metadata",dataType:"source",sourceId:e}),t.setEventedParent(null),t.clearTiles(),t.onRemove&&t.onRemove(this.map),this._changed=!0},t.prototype.getSource=function(e){return this.sourceCaches[e]&&this.sourceCaches[e].getSource()},t.prototype.addLayer=function(e,t,r){this._checkLoaded();var a=e.id;if("object"==typeof e.source&&(this.addSource(a,e.source),e=util.clone(e),e=util.extend(e,{source:a})),!this._validate(validateStyle.layer,"layers."+a,e,{arrayIndex:-1},r)){var i=StyleLayer.create(e);this._validateLayer(i),i.setEventedParent(this,{layer:{id:a}});var o=t?this._order.indexOf(t):this._order.length;if(this._order.splice(o,0,a),this._layers[a]=i,this._removedLayers[a]&&i.source){var s=this._removedLayers[a];delete this._removedLayers[a],s.type!==i.type?this._updatedSources[i.source]="clear":(this._updatedSources[i.source]="reload",this.sourceCaches[i.source].pause())}this._updateLayer(i),"symbol"===i.type&&(this._updatedSymbolOrder=!0),this.updateClasses(a)}},t.prototype.moveLayer=function(e,t){this._checkLoaded(),this._changed=!0;var r=this._layers[e];if(!r)return void this.fire("error",{error:new Error("The layer '"+e+"' does not exist in the map's style and cannot be moved.")});var a=this._order.indexOf(e);this._order.splice(a,1);var i=t?this._order.indexOf(t):this._order.length;this._order.splice(i,0,e),"symbol"===r.type&&(this._updatedSymbolOrder=!0,r.source&&!this._updatedSources[r.source]&&(this._updatedSources[r.source]="reload",this.sourceCaches[r.source].pause()))},t.prototype.removeLayer=function(e){this._checkLoaded();var t=this._layers[e];if(!t)return void this.fire("error",{error:new Error("The layer '"+e+"' does not exist in the map's style and cannot be removed.")});t.setEventedParent(null);var r=this._order.indexOf(e);this._order.splice(r,1),"symbol"===t.type&&(this._updatedSymbolOrder=!0),this._changed=!0,this._removedLayers[e]=t,delete this._layers[e],delete this._updatedLayers[e],delete this._updatedPaintProps[e]},t.prototype.getLayer=function(e){return this._layers[e]},t.prototype.setLayerZoomRange=function(e,t,r){this._checkLoaded();var a=this.getLayer(e);if(!a)return void this.fire("error",{error:new Error("The layer '"+e+"' does not exist in the map's style and cannot have zoom extent.")});a.minzoom===t&&a.maxzoom===r||(null!=t&&(a.minzoom=t),null!=r&&(a.maxzoom=r),this._updateLayer(a))},t.prototype.setFilter=function(e,t){this._checkLoaded();var r=this.getLayer(e);if(!r)return void this.fire("error",{error:new Error("The layer '"+e+"' does not exist in the map's style and cannot be filtered.")});null!==t&&void 0!==t&&this._validate(validateStyle.filter,"layers."+r.id+".filter",t)||util.deepEqual(r.filter,t)||(r.filter=util.clone(t),this._updateLayer(r))},t.prototype.getFilter=function(e){return util.clone(this.getLayer(e).filter)},t.prototype.setLayoutProperty=function(e,t,r){this._checkLoaded();var a=this.getLayer(e);if(!a)return void this.fire("error",{error:new Error("The layer '"+e+"' does not exist in the map's style and cannot be styled.")});util.deepEqual(a.getLayoutProperty(t),r)||(a.setLayoutProperty(t,r),this._updateLayer(a))},t.prototype.getLayoutProperty=function(e,t){return this.getLayer(e).getLayoutProperty(t)},t.prototype.setPaintProperty=function(e,t,r,a){this._checkLoaded();var i=this.getLayer(e);if(!i)return void this.fire("error",{error:new Error("The layer '"+e+"' does not exist in the map's style and cannot be styled.")});if(!util.deepEqual(i.getPaintProperty(t,a),r)){var o=i.isPaintValueFeatureConstant(t);i.setPaintProperty(t,r,a);!(r&&MapboxGLFunction.isFunctionDefinition(r)&&"$zoom"!==r.property&&void 0!==r.property)&&o||this._updateLayer(i),this.updateClasses(e,t)}},t.prototype.getPaintProperty=function(e,t,r){return this.getLayer(e).getPaintProperty(t,r)},t.prototype.getTransition=function(){return util.extend({duration:300,delay:0},this.stylesheet&&this.stylesheet.transition)},t.prototype.updateClasses=function(e,t){if(this._changed=!0,e){var r=this._updatedPaintProps;r[e]||(r[e]={}),r[e][t||"all"]=!0}else this._updatedAllPaintProps=!0},t.prototype.serialize=function(){var e=this;return util.filterObject({version:this.stylesheet.version,name:this.stylesheet.name,metadata:this.stylesheet.metadata,light:this.stylesheet.light,center:this.stylesheet.center,zoom:this.stylesheet.zoom,bearing:this.stylesheet.bearing,pitch:this.stylesheet.pitch,sprite:this.stylesheet.sprite,glyphs:this.stylesheet.glyphs,transition:this.stylesheet.transition,sources:util.mapObject(this.sourceCaches,function(e){return e.serialize()}),layers:this._order.map(function(t){return e._layers[t].serialize()})},function(e){return void 0!==e})},t.prototype._updateLayer=function(e){this._updatedLayers[e.id]=!0,e.source&&!this._updatedSources[e.source]&&(this._updatedSources[e.source]="reload",this.sourceCaches[e.source].pause()),this._changed=!0},t.prototype._flattenRenderedFeatures=function(e){for(var t=this,r=[],a=this._order.length-1;a>=0;a--)for(var i=t._order[a],o=0,s=e;o<s.length;o+=1){var n=s[o],l=n[i];if(l)for(var u=0,d=l;u<d.length;u+=1){var h=d[u];r.push(h)}}return r},t.prototype.queryRenderedFeatures=function(e,t,r,a){var i=this;t&&t.filter&&this._validate(validateStyle.filter,"queryRenderedFeatures.filter",t.filter);var o={};if(t&&t.layers){if(!Array.isArray(t.layers))return this.fire("error",{error:"parameters.layers must be an Array."}),[];for(var s=0,n=t.layers;s<n.length;s+=1){var l=n[s],u=i._layers[l];if(!u)return i.fire("error",{error:"The layer '"+l+"' does not exist in the map's style and cannot be queried for features."}),[];o[u.source]=!0}}var d=[];for(var h in i.sourceCaches)if(!t.layers||o[h]){var c=QueryFeatures.rendered(i.sourceCaches[h],i._layers,e,t,r,a);d.push(c)}return this._flattenRenderedFeatures(d)},t.prototype.querySourceFeatures=function(e,t){t&&t.filter&&this._validate(validateStyle.filter,"querySourceFeatures.filter",t.filter);var r=this.sourceCaches[e];return r?QueryFeatures.source(r,t):[]},t.prototype.addSourceType=function(e,t,r){return getSourceType(e)?r(new Error('A source type called "'+e+'" already exists.')):(setSourceType(e,t),t.workerSourceURL?void this.dispatcher.broadcast("loadWorkerSource",{name:e,url:t.workerSourceURL},r):r(null,null))},t.prototype.getLight=function(){return this.light.getLight()},t.prototype.setLight=function(e,t){this._checkLoaded();var r=this.light.getLight(),a=!1;for(var i in e)if(!util.deepEqual(e[i],r[i])){a=!0;break}if(a){var o=this.stylesheet.transition||{};this.light.setLight(e),this.light.updateLightTransitions(t||{transition:!0},o,this.animationLoop)}},t.prototype._validate=function(e,t,r,a,i){return(!i||!1!==i.validate)&&validateStyle.emitErrors(this,e.call(validateStyle,util.extend({key:t,style:this.serialize(),value:r,styleSpec:styleSpec},a)))},t.prototype._remove=function(){var e=this;rtlTextPlugin.evented.off("pluginAvailable",this._rtlTextPluginCallback);for(var t in e.sourceCaches)e.sourceCaches[t].clearTiles();this.dispatcher.remove()},t.prototype._clearSource=function(e){this.sourceCaches[e].clearTiles()},t.prototype._reloadSource=function(e){this.sourceCaches[e].resume(),this.sourceCaches[e].reload()},t.prototype._updateSources=function(e){var t=this;for(var r in t.sourceCaches)t.sourceCaches[r].update(e)},t.prototype._redoPlacement=function(){var e=this;for(var t in e.sourceCaches)e.sourceCaches[t].redoPlacement()},t.prototype.getImages=function(e,t,r){this.imageManager.getImages(t.icons,r)},t.prototype.getGlyphs=function(e,t,r){this.glyphManager.getGlyphs(t.stacks,r)},t}(Evented);module.exports=Style;
},{"../render/glyph_manager":75,"../render/image_manager":77,"../render/line_atlas":78,"../source/query_features":94,"../source/rtl_text_plugin":96,"../source/source":97,"../source/source_cache":98,"../style-spec/deref":107,"../style-spec/diff":108,"../style-spec/function":112,"../style-spec/reference/latest":123,"../util/ajax":201,"../util/browser":202,"../util/dispatcher":208,"../util/evented":210,"../util/global_worker_pool":212,"../util/mapbox":217,"../util/util":223,"./animation_loop":150,"./light":151,"./load_sprite":153,"./style_layer":158,"./validate_style":166}],157:[function(_dereq_,module,exports){
"use strict";var createFunction=_dereq_("../style-spec/function"),util=_dereq_("../util/util"),StyleDeclaration=function(t,i){var o=this;if(this.value=util.clone(i),this.isFunction=createFunction.isFunctionDefinition(i),this.json=JSON.stringify(this.value),this.minimum=t.minimum,this.function=createFunction(this.value,t),this.isFeatureConstant=this.function.isFeatureConstant,this.isZoomConstant=this.function.isZoomConstant,this.isFeatureConstant||this.isZoomConstant){if(!this.isZoomConstant){this.stopZoomLevels=[];for(var n=0,s=o.value.stops;n<s.length;n+=1){var e=s[n];o.stopZoomLevels.indexOf(e[0])<0&&o.stopZoomLevels.push(e[0])}}}else{this.stopZoomLevels=[];for(var a=[],u=0,l=o.value.stops;u<l.length;u+=1){var r=l[u],c=r[0].zoom;o.stopZoomLevels.indexOf(c)<0&&(o.stopZoomLevels.push(c),a.push([c,a.length]))}this._functionInterpolationT=createFunction({type:"exponential",stops:a,base:i.base},{type:"number"})}};StyleDeclaration.prototype.calculate=function(t,i){var o=this.function(t&&t.zoom,i||{});return void 0!==this.minimum&&o<this.minimum?this.minimum:o},StyleDeclaration.prototype.calculateInterpolationT=function(t){return this.isFeatureConstant||this.isZoomConstant?0:this._functionInterpolationT(t&&t.zoom,{})},module.exports=StyleDeclaration;
},{"../style-spec/function":112,"../util/util":223}],158:[function(_dereq_,module,exports){
"use strict";function getDeclarationValue(t){return t.value}var util=_dereq_("../util/util"),StyleTransition=_dereq_("./style_transition"),StyleDeclaration=_dereq_("./style_declaration"),styleSpec=_dereq_("../style-spec/reference/latest"),validateStyle=_dereq_("./validate_style"),parseColor=_dereq_("./../style-spec/util/parse_color"),Evented=_dereq_("../util/evented"),TRANSITION_SUFFIX="-transition",StyleLayer=function(t){function i(i){var e=this;t.call(this),this.id=i.id,this.metadata=i.metadata,this.type=i.type,this.minzoom=i.minzoom,this.maxzoom=i.maxzoom,"background"!==i.type&&(this.source=i.source,this.sourceLayer=i["source-layer"],this.filter=i.filter),this.paint={},this.layout={},this._paintSpecifications=styleSpec["paint_"+this.type],this._layoutSpecifications=styleSpec["layout_"+this.type],this._paintTransitions={},this._paintTransitionOptions={},this._paintDeclarations={},this._layoutDeclarations={},this._layoutFunctions={};var a,o,n={validate:!1};for(var r in i){var s=r.match(/^paint(?:\.(.*))?$/);if(s){var l=s[1]||"";for(a in i[r])e.setPaintProperty(a,i[r][a],l,n)}}for(o in i.layout)e.setLayoutProperty(o,i.layout[o],n);for(a in e._paintSpecifications)e.paint[a]=e.getPaintValue(a);for(o in e._layoutSpecifications)e._updateLayoutValue(o)}return t&&(i.__proto__=t),i.prototype=Object.create(t&&t.prototype),i.prototype.constructor=i,i.prototype.setLayoutProperty=function(t,i,e){if(null==i)delete this._layoutDeclarations[t];else{var a="layers."+this.id+".layout."+t;if(this._validate(validateStyle.layoutProperty,a,t,i,e))return;this._layoutDeclarations[t]=new StyleDeclaration(this._layoutSpecifications[t],i)}this._updateLayoutValue(t)},i.prototype.getLayoutProperty=function(t){return this._layoutDeclarations[t]&&this._layoutDeclarations[t].value},i.prototype.getLayoutValue=function(t,i,e){var a=this._layoutSpecifications[t],o=this._layoutDeclarations[t];return o?o.calculate(i,e):a.default},i.prototype.setPaintProperty=function(t,i,e,a){var o="layers."+this.id+(e?'["paint.'+e+'"].':".paint.")+t;if(util.endsWith(t,TRANSITION_SUFFIX))if(this._paintTransitionOptions[e||""]||(this._paintTransitionOptions[e||""]={}),null===i||void 0===i)delete this._paintTransitionOptions[e||""][t];else{if(this._validate(validateStyle.paintProperty,o,t,i,a))return;this._paintTransitionOptions[e||""][t]=i}else if(this._paintDeclarations[e||""]||(this._paintDeclarations[e||""]={}),null===i||void 0===i)delete this._paintDeclarations[e||""][t];else{if(this._validate(validateStyle.paintProperty,o,t,i,a))return;this._paintDeclarations[e||""][t]=new StyleDeclaration(this._paintSpecifications[t],i)}},i.prototype.getPaintProperty=function(t,i){return i=i||"",util.endsWith(t,TRANSITION_SUFFIX)?this._paintTransitionOptions[i]&&this._paintTransitionOptions[i][t]:this._paintDeclarations[i]&&this._paintDeclarations[i][t]&&this._paintDeclarations[i][t].value},i.prototype.getPaintValue=function(t,i,e){var a=this._paintSpecifications[t],o=this._paintTransitions[t];return o?o.calculate(i,e):"color"===a.type&&a.default?parseColor(a.default):a.default},i.prototype.getPaintValueStopZoomLevels=function(t){var i=this._paintTransitions[t];return i?i.declaration.stopZoomLevels:[]},i.prototype.getLayoutValueStopZoomLevels=function(t){var i=this._layoutDeclarations[t];return i?i.stopZoomLevels:[]},i.prototype.getPaintInterpolationT=function(t,i){return this._paintTransitions[t].declaration.calculateInterpolationT(i)},i.prototype.getLayoutInterpolationT=function(t,i){return this._layoutDeclarations[t].calculateInterpolationT(i)},i.prototype.isPaintValueFeatureConstant=function(t){var i=this._paintTransitions[t];return!i||i.declaration.isFeatureConstant},i.prototype.isLayoutValueFeatureConstant=function(t){var i=this._layoutDeclarations[t];return!i||i.isFeatureConstant},i.prototype.isPaintValueZoomConstant=function(t){var i=this._paintTransitions[t];return!i||i.declaration.isZoomConstant},i.prototype.isLayoutValueZoomConstant=function(t){var i=this._layoutDeclarations[t];return!i||i.isZoomConstant},i.prototype.isHidden=function(t){return!!(this.minzoom&&t<this.minzoom)||(!!(this.maxzoom&&t>=this.maxzoom)||"none"===this.layout.visibility)},i.prototype.updatePaintTransitions=function(t,i,e,a,o){for(var n=this,r=util.extend({},this._paintDeclarations[""]),s=0;s<t.length;s++)util.extend(r,n._paintDeclarations[t[s]]);var l;for(l in r)n._applyPaintDeclaration(l,r[l],i,e,a,o);for(l in n._paintTransitions)l in r||n._applyPaintDeclaration(l,null,i,e,a,o)},i.prototype.updatePaintTransition=function(t,i,e,a,o,n){for(var r=this,s=this._paintDeclarations[""][t],l=0;l<i.length;l++){var u=r._paintDeclarations[i[l]];u&&u[t]&&(s=u[t])}this._applyPaintDeclaration(t,s,e,a,o,n)},i.prototype.recalculate=function(t){var i=this;for(var e in i._paintTransitions)i.paint[e]=i.getPaintValue(e,{zoom:t});for(var a in i._layoutFunctions)i.layout[a]=i.getLayoutValue(a,{zoom:t})},i.prototype.serialize=function(){var t=this,i={id:this.id,type:this.type,source:this.source,"source-layer":this.sourceLayer,metadata:this.metadata,minzoom:this.minzoom,maxzoom:this.maxzoom,filter:this.filter,layout:util.mapObject(this._layoutDeclarations,getDeclarationValue)};for(var e in t._paintDeclarations){i[""===e?"paint":"paint."+e]=util.mapObject(t._paintDeclarations[e],getDeclarationValue)}return util.filterObject(i,function(t,i){return void 0!==t&&!("layout"===i&&!Object.keys(t).length)})},i.prototype._applyPaintDeclaration=function(t,i,e,a,o,n){var r=e.transition?this._paintTransitions[t]:void 0,s=this._paintSpecifications[t];if(null!==i&&void 0!==i||(i=new StyleDeclaration(s,s.default)),!r||r.declaration.json!==i.json){var l=util.extend({duration:300,delay:0},a,this.getPaintProperty(t+TRANSITION_SUFFIX)),u=this._paintTransitions[t]=new StyleTransition(s,i,r,l,n);u.instant()||(u.loopID=o.set(u.endTime-Date.now())),r&&o.cancel(r.loopID)}},i.prototype._updateLayoutValue=function(t){var i=this._layoutDeclarations[t];i&&i.isFunction?this._layoutFunctions[t]=!0:(delete this._layoutFunctions[t],this.layout[t]=this.getLayoutValue(t))},i.prototype._validate=function(t,i,e,a,o){return(!o||!1!==o.validate)&&validateStyle.emitErrors(this,t.call(validateStyle,{key:i,layerType:this.type,objectKey:e,value:a,styleSpec:styleSpec,style:{glyphs:!0,sprite:!0}}))},i.prototype.has3DPass=function(){return!1},i}(Evented);module.exports=StyleLayer;var subclasses={circle:_dereq_("./style_layer/circle_style_layer"),fill:_dereq_("./style_layer/fill_style_layer"),"fill-extrusion":_dereq_("./style_layer/fill_extrusion_style_layer"),line:_dereq_("./style_layer/line_style_layer"),symbol:_dereq_("./style_layer/symbol_style_layer"),background:StyleLayer,raster:StyleLayer};StyleLayer.create=function(t){return new subclasses[t.type](t)};
},{"../style-spec/reference/latest":123,"../util/evented":210,"../util/util":223,"./../style-spec/util/parse_color":128,"./style_declaration":157,"./style_layer/circle_style_layer":159,"./style_layer/fill_extrusion_style_layer":160,"./style_layer/fill_style_layer":161,"./style_layer/line_style_layer":162,"./style_layer/symbol_style_layer":163,"./style_transition":165,"./validate_style":166}],159:[function(_dereq_,module,exports){
"use strict";var StyleLayer=_dereq_("../style_layer"),CircleBucket=_dereq_("../../data/bucket/circle_bucket"),ref=_dereq_("../../util/intersection_tests"),multiPolygonIntersectsBufferedMultiPoint=ref.multiPolygonIntersectsBufferedMultiPoint,ref$1=_dereq_("../query_utils"),getMaximumPaintValue=ref$1.getMaximumPaintValue,translateDistance=ref$1.translateDistance,translate=ref$1.translate,CircleStyleLayer=function(e){function t(){e.apply(this,arguments)}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.createBucket=function(e){return new CircleBucket(e)},t.prototype.queryRadius=function(e){return getMaximumPaintValue("circle-radius",this,e)+translateDistance(this.paint["circle-translate"])},t.prototype.queryIntersectsFeature=function(e,t,r,i,a,n){var u=translate(e,this.getPaintValue("circle-translate",{zoom:i},t.properties),this.getPaintValue("circle-translate-anchor",{zoom:i},t.properties),a,n),l=this.getPaintValue("circle-radius",{zoom:i},t.properties)*n;return multiPolygonIntersectsBufferedMultiPoint(u,r,l)},t}(StyleLayer);module.exports=CircleStyleLayer;
},{"../../data/bucket/circle_bucket":43,"../../util/intersection_tests":214,"../query_utils":155,"../style_layer":158}],160:[function(_dereq_,module,exports){
"use strict";var StyleLayer=_dereq_("../style_layer"),FillExtrusionBucket=_dereq_("../../data/bucket/fill_extrusion_bucket"),ref=_dereq_("../../util/intersection_tests"),multiPolygonIntersectsMultiPolygon=ref.multiPolygonIntersectsMultiPolygon,ref$1=_dereq_("../query_utils"),translateDistance=ref$1.translateDistance,translate=ref$1.translate,FillExtrusionStyleLayer=function(t){function e(){t.apply(this,arguments)}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.getPaintValue=function(e,r,i){var o=t.prototype.getPaintValue.call(this,e,r,i);return"fill-extrusion-color"===e&&o&&(o[3]=1),o},e.prototype.createBucket=function(t){return new FillExtrusionBucket(t)},e.prototype.queryRadius=function(){return translateDistance(this.paint["fill-extrusion-translate"])},e.prototype.queryIntersectsFeature=function(t,e,r,i,o,n){var l=translate(t,this.getPaintValue("fill-extrusion-translate",{zoom:i},e.properties),this.getPaintValue("fill-extrusion-translate-anchor",{zoom:i},e.properties),o,n);return multiPolygonIntersectsMultiPolygon(l,r)},e.prototype.has3DPass=function(){return 0!==this.paint["fill-extrusion-opacity"]&&"none"!==this.layout.visibility},e}(StyleLayer);module.exports=FillExtrusionStyleLayer;
},{"../../data/bucket/fill_extrusion_bucket":45,"../../util/intersection_tests":214,"../query_utils":155,"../style_layer":158}],161:[function(_dereq_,module,exports){
"use strict";var StyleLayer=_dereq_("../style_layer"),FillBucket=_dereq_("../../data/bucket/fill_bucket"),ref=_dereq_("../../util/intersection_tests"),multiPolygonIntersectsMultiPolygon=ref.multiPolygonIntersectsMultiPolygon,ref$1=_dereq_("../query_utils"),translateDistance=ref$1.translateDistance,translate=ref$1.translate,FillStyleLayer=function(t){function e(){t.apply(this,arguments)}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.getPaintValue=function(e,o,l){var i=this;if("fill-outline-color"===e){if(void 0===this.getPaintProperty("fill-outline-color"))return t.prototype.getPaintValue.call(this,"fill-color",o,l);for(var r=this._paintTransitions["fill-outline-color"];r;){if(!(r&&r.declaration&&r.declaration.value))return t.prototype.getPaintValue.call(i,"fill-color",o,l);r=r.oldTransition}}return t.prototype.getPaintValue.call(this,e,o,l)},e.prototype.getPaintValueStopZoomLevels=function(e){return"fill-outline-color"===e&&void 0===this.getPaintProperty("fill-outline-color")?t.prototype.getPaintValueStopZoomLevels.call(this,"fill-color"):t.prototype.getPaintValueStopZoomLevels.call(this,e)},e.prototype.getPaintInterpolationT=function(e,o){return"fill-outline-color"===e&&void 0===this.getPaintProperty("fill-outline-color")?t.prototype.getPaintInterpolationT.call(this,"fill-color",o):t.prototype.getPaintInterpolationT.call(this,e,o)},e.prototype.isPaintValueFeatureConstant=function(e){return"fill-outline-color"===e&&void 0===this.getPaintProperty("fill-outline-color")?t.prototype.isPaintValueFeatureConstant.call(this,"fill-color"):t.prototype.isPaintValueFeatureConstant.call(this,e)},e.prototype.isPaintValueZoomConstant=function(e){return"fill-outline-color"===e&&void 0===this.getPaintProperty("fill-outline-color")?t.prototype.isPaintValueZoomConstant.call(this,"fill-color"):t.prototype.isPaintValueZoomConstant.call(this,e)},e.prototype.createBucket=function(t){return new FillBucket(t)},e.prototype.queryRadius=function(){return translateDistance(this.paint["fill-translate"])},e.prototype.queryIntersectsFeature=function(t,e,o,l,i,r){var n=translate(t,this.getPaintValue("fill-translate",{zoom:l},e.properties),this.getPaintValue("fill-translate-anchor",{zoom:l},e.properties),i,r);return multiPolygonIntersectsMultiPolygon(n,o)},e}(StyleLayer);module.exports=FillStyleLayer;
},{"../../data/bucket/fill_bucket":44,"../../util/intersection_tests":214,"../query_utils":155,"../style_layer":158}],162:[function(_dereq_,module,exports){
"use strict";function getLineWidth(e,t){return t>0?t+2*e:e}function offsetLine(e,t){for(var i=[],r=new Point(0,0),n=0;n<e.length;n++){for(var a=e[n],u=[],o=0;o<a.length;o++){var s=a[o-1],l=a[o],p=a[o+1],f=0===o?r:l.sub(s)._unit()._perp(),c=o===a.length-1?r:p.sub(l)._unit()._perp(),y=f._add(c)._unit(),h=y.x*c.x+y.y*c.y;y._mult(1/h),u.push(y._mult(t)._add(l))}i.push(u)}return i}var Point=_dereq_("@mapbox/point-geometry"),StyleLayer=_dereq_("../style_layer"),LineBucket=_dereq_("../../data/bucket/line_bucket"),ref=_dereq_("../../util/intersection_tests"),multiPolygonIntersectsBufferedMultiLine=ref.multiPolygonIntersectsBufferedMultiLine,ref$1=_dereq_("../query_utils"),getMaximumPaintValue=ref$1.getMaximumPaintValue,translateDistance=ref$1.translateDistance,translate=ref$1.translate,LineStyleLayer=function(e){function t(){e.apply(this,arguments)}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t.prototype.createBucket=function(e){return new LineBucket(e)},t.prototype.queryRadius=function(e){var t=e,i=getLineWidth(getMaximumPaintValue("line-width",this,t),getMaximumPaintValue("line-gap-width",this,t)),r=getMaximumPaintValue("line-offset",this,t);return i/2+Math.abs(r)+translateDistance(this.paint["line-translate"])},t.prototype.queryIntersectsFeature=function(e,t,i,r,n,a){var u=translate(e,this.getPaintValue("line-translate",{zoom:r},t.properties),this.getPaintValue("line-translate-anchor",{zoom:r},t.properties),n,a),o=a/2*getLineWidth(this.getPaintValue("line-width",{zoom:r},t.properties),this.getPaintValue("line-gap-width",{zoom:r},t.properties)),s=this.getPaintValue("line-offset",{zoom:r},t.properties);return s&&(i=offsetLine(i,s*a)),multiPolygonIntersectsBufferedMultiLine(u,i,o)},t}(StyleLayer);module.exports=LineStyleLayer;
},{"../../data/bucket/line_bucket":46,"../../util/intersection_tests":214,"../query_utils":155,"../style_layer":158,"@mapbox/point-geometry":2}],163:[function(_dereq_,module,exports){
"use strict";var StyleLayer=_dereq_("../style_layer"),SymbolBucket=_dereq_("../../data/bucket/symbol_bucket"),SymbolStyleLayer=function(t){function e(){t.apply(this,arguments)}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.getLayoutValue=function(e,r,o){var n=t.prototype.getLayoutValue.call(this,e,r,o);if("auto"!==n)return n;switch(e){case"text-rotation-alignment":case"icon-rotation-alignment":return"line"===this.getLayoutValue("symbol-placement",r,o)?"map":"viewport";case"text-pitch-alignment":return this.getLayoutValue("text-rotation-alignment",r,o);case"icon-pitch-alignment":return this.getLayoutValue("icon-rotation-alignment",r,o);default:return n}},e.prototype.createBucket=function(t){return new SymbolBucket(t)},e.prototype.queryRadius=function(){return 0},e.prototype.queryIntersectsFeature=function(){return!1},e}(StyleLayer);module.exports=SymbolStyleLayer;
},{"../../data/bucket/symbol_bucket":47,"../style_layer":158}],164:[function(_dereq_,module,exports){
"use strict";var StyleLayer=_dereq_("./style_layer"),util=_dereq_("../util/util"),featureFilter=_dereq_("../style-spec/feature_filter"),groupByLayout=_dereq_("../style-spec/group_by_layout"),StyleLayerIndex=function(e){e&&this.replace(e)};StyleLayerIndex.prototype.replace=function(e){var r=this;this.symbolOrder=[];for(var t=0,i=e;t<i.length;t+=1){var a=i[t];"symbol"===a.type&&r.symbolOrder.push(a.id)}this._layerConfigs={},this._layers={},this.update(e,[])},StyleLayerIndex.prototype.update=function(e,r,t){for(var i=this,a=0,l=e;a<l.length;a+=1){var y=l[a];i._layerConfigs[y.id]=y;var s=i._layers[y.id]=StyleLayer.create(y);s.updatePaintTransitions({},{transition:!1}),s.filter=featureFilter(s.filter)}for(var o=0,u=r;o<u.length;o+=1){var n=u[o];delete i._layerConfigs[n],delete i._layers[n]}t&&(this.symbolOrder=t),this.familiesBySource={};for(var f=groupByLayout(util.values(this._layerConfigs)),p=0,d=f;p<d.length;p+=1){var h=d[p],c=h.map(function(e){return i._layers[e.id]}),v=c[0];if(!v.layout||"none"!==v.layout.visibility){var _=v.source||"",g=i.familiesBySource[_];g||(g=i.familiesBySource[_]={});var L=v.sourceLayer||"_geojsonTileLayer",m=g[L];m||(m=g[L]=[]),m.push(c)}}},module.exports=StyleLayerIndex;
},{"../style-spec/feature_filter":110,"../style-spec/group_by_layout":113,"../util/util":223,"./style_layer":158}],165:[function(_dereq_,module,exports){
"use strict";function interpZoomTransitioned(t,i,e){if(void 0!==t&&void 0!==i)return{from:t.to,fromScale:t.toScale,to:i.to,toScale:i.toScale,t:e}}var util=_dereq_("../util/util"),interpolate=_dereq_("../style-spec/util/interpolate"),fakeZoomHistory={lastIntegerZoom:0,lastIntegerZoomTime:0,lastZoom:0},StyleTransition=function(t,i,e,o,a){this.declaration=i,this.startTime=this.endTime=(new Date).getTime(),this.oldTransition=e,this.duration=o.duration||0,this.delay=o.delay||0,this.zoomTransitioned="piecewise-constant"===t.function&&t.transition,this.interp=this.zoomTransitioned?interpZoomTransitioned:interpolate[t.type],this.zoomHistory=a||fakeZoomHistory,this.instant()||(this.endTime=this.startTime+this.duration+this.delay),e&&e.endTime<=this.startTime&&delete e.oldTransition};StyleTransition.prototype.instant=function(){return!this.oldTransition||!this.interp||0===this.duration&&0===this.delay},StyleTransition.prototype.calculate=function(t,i,e){var o=this._calculateTargetValue(t,i);if(this.instant())return o;if((e=e||Date.now())>=this.endTime)return o;var a=this.oldTransition.calculate(t,i,this.startTime),n=util.easeCubicInOut((e-this.startTime-this.delay)/this.duration);return this.interp(a,o,n)},StyleTransition.prototype._calculateTargetValue=function(t,i){if(!this.zoomTransitioned)return this.declaration.calculate(t,i);var e=t.zoom,o=this.zoomHistory.lastIntegerZoom,a=e>o?2:.5,n=this.declaration.calculate({zoom:e>o?e-1:e+1},i),r=this.declaration.calculate({zoom:e},i),s=Math.min((Date.now()-this.zoomHistory.lastIntegerZoomTime)/this.duration,1),l=Math.abs(e-o),u=interpolate(s,1,l);return void 0!==n&&void 0!==r?{from:n,fromScale:a,to:r,toScale:1,t:u}:void 0},module.exports=StyleTransition;
},{"../style-spec/util/interpolate":127,"../util/util":223}],166:[function(_dereq_,module,exports){
"use strict";module.exports=_dereq_("../style-spec/validate_style.min"),module.exports.emitErrors=function(r,e){if(e&&e.length){for(var t=0,o=e;t<o.length;t+=1){var s=o[t],i=s.message;r.fire("error",{error:new Error(i)})}return!0}return!1};
},{"../style-spec/validate_style.min":149}],167:[function(_dereq_,module,exports){
"use strict";var Point=_dereq_("@mapbox/point-geometry"),Anchor=function(t){function o(o,e,n,r){t.call(this,o,e),this.angle=n,void 0!==r&&(this.segment=r)}return t&&(o.__proto__=t),o.prototype=Object.create(t&&t.prototype),o.prototype.constructor=o,o.prototype.clone=function(){return new o(this.x,this.y,this.angle,this.segment)},o}(Point);module.exports=Anchor;
},{"@mapbox/point-geometry":2}],168:[function(_dereq_,module,exports){
"use strict";function checkMaxAngle(e,t,a,r,n){if(void 0===t.segment)return!0;for(var i=t,s=t.segment+1,f=0;f>-a/2;){if(--s<0)return!1;f-=e[s].dist(i),i=e[s]}f+=e[s].dist(e[s+1]),s++;for(var l=[],o=0;f<a/2;){var u=e[s-1],c=e[s],g=e[s+1];if(!g)return!1;var h=u.angleTo(c)-c.angleTo(g);for(h=Math.abs((h+3*Math.PI)%(2*Math.PI)-Math.PI),l.push({distance:f,angleDelta:h}),o+=h;f-l[0].distance>r;)o-=l.shift().angleDelta;if(o>n)return!1;s++,f+=c.dist(g)}return!0}module.exports=checkMaxAngle;
},{}],169:[function(_dereq_,module,exports){
"use strict";function clipLine(n,x,y,o,e){for(var r=[],t=0;t<n.length;t++)for(var i=n[t],u=void 0,d=0;d<i.length-1;d++){var P=i[d],w=i[d+1];P.x<x&&w.x<x||(P.x<x?P=new Point(x,P.y+(w.y-P.y)*((x-P.x)/(w.x-P.x)))._round():w.x<x&&(w=new Point(x,P.y+(w.y-P.y)*((x-P.x)/(w.x-P.x)))._round()),P.y<y&&w.y<y||(P.y<y?P=new Point(P.x+(w.x-P.x)*((y-P.y)/(w.y-P.y)),y)._round():w.y<y&&(w=new Point(P.x+(w.x-P.x)*((y-P.y)/(w.y-P.y)),y)._round()),P.x>=o&&w.x>=o||(P.x>=o?P=new Point(o,P.y+(w.y-P.y)*((o-P.x)/(w.x-P.x)))._round():w.x>=o&&(w=new Point(o,P.y+(w.y-P.y)*((o-P.x)/(w.x-P.x)))._round()),P.y>=e&&w.y>=e||(P.y>=e?P=new Point(P.x+(w.x-P.x)*((e-P.y)/(w.y-P.y)),e)._round():w.y>=e&&(w=new Point(P.x+(w.x-P.x)*((e-P.y)/(w.y-P.y)),e)._round()),u&&P.equals(u[u.length-1])||(u=[P],r.push(u)),u.push(w)))))}return r}var Point=_dereq_("@mapbox/point-geometry");module.exports=clipLine;
},{"@mapbox/point-geometry":2}],170:[function(_dereq_,module,exports){
"use strict";var createStructArrayType=_dereq_("../util/struct_array"),Point=_dereq_("@mapbox/point-geometry"),CollisionBoxArray=createStructArrayType({members:[{type:"Int16",name:"anchorPointX"},{type:"Int16",name:"anchorPointY"},{type:"Int16",name:"offsetX"},{type:"Int16",name:"offsetY"},{type:"Int16",name:"x1"},{type:"Int16",name:"y1"},{type:"Int16",name:"x2"},{type:"Int16",name:"y2"},{type:"Float32",name:"unadjustedMaxScale"},{type:"Float32",name:"maxScale"},{type:"Uint32",name:"featureIndex"},{type:"Uint16",name:"sourceLayerIndex"},{type:"Uint16",name:"bucketIndex"},{type:"Int16",name:"bbox0"},{type:"Int16",name:"bbox1"},{type:"Int16",name:"bbox2"},{type:"Int16",name:"bbox3"},{type:"Float32",name:"placementScale"}]});Object.defineProperty(CollisionBoxArray.prototype.StructType.prototype,"anchorPoint",{get:function(){return new Point(this.anchorPointX,this.anchorPointY)}}),module.exports=CollisionBoxArray;
},{"../util/struct_array":220,"@mapbox/point-geometry":2}],171:[function(_dereq_,module,exports){
"use strict";var CollisionFeature=function(t,e,i,o,a,n,s,l,r,d,u){var h=s.top*l-r,f=s.bottom*l+r,x=s.left*l-r,m=s.right*l+r;if(this.boxStartIndex=t.length,d){var _=f-h,b=m-x;if(_>0)if(_=Math.max(10*l,_),u){var v=e[i.segment+1].sub(e[i.segment])._unit()._mult(b),c=[i.sub(v),i.add(v)];this._addLineCollisionBoxes(t,c,i,0,b,_,o,a,n)}else this._addLineCollisionBoxes(t,e,i,i.segment,b,_,o,a,n)}else t.emplaceBack(i.x,i.y,0,0,x,h,m,f,1/0,1/0,o,a,n,0,0,0,0,0);this.boxEndIndex=t.length};CollisionFeature.prototype._addLineCollisionBoxes=function(t,e,i,o,a,n,s,l,r){var d=n/2,u=Math.floor(a/d),h=Math.floor(u/2),f=-n/2,x=i,m=o+1,_=f,b=-a/2,v=b-a/8;do{if(--m<0){if(_>b)return;m=0;break}_-=e[m].dist(x),x=e[m]}while(_>v);for(var c=e[m].dist(e[m+1]),g=-h;g<u+h;g++){var p=g*d,C=b+p;if(p<0&&(C+=p),p>a&&(C+=p-a),!(C<_)){for(;_+c<C;){if(_+=c,++m+1>=e.length)return;c=e[m].dist(e[m+1])}var M=C-_,y=e[m],B=e[m+1],k=B.sub(y)._unit()._mult(M)._add(y)._round(),F=Math.max(Math.abs(C-f)-d/2,0),L=a/2/F;(g<0||g>=u)&&(L=Math.min(L,.99)),t.emplaceBack(k.x,k.y,k.x-i.x,k.y-i.y,-n/2,-n/2,n/2,n/2,L,L,s,l,r,0,0,0,0,0)}}},module.exports=CollisionFeature;
},{}],172:[function(_dereq_,module,exports){
"use strict";var Point=_dereq_("@mapbox/point-geometry"),EXTENT=_dereq_("../data/extent"),Grid=_dereq_("grid-index"),intersectionTests=_dereq_("../util/intersection_tests"),CollisionTile=function(e,t,i,a,r,o,n){void 0===o&&(o=new Grid(EXTENT,12,6)),void 0===n&&(n=new Grid(EXTENT,12,0)),this.angle=e,this.pitch=t,this.cameraToCenterDistance=i,this.cameraToTileDistance=a,this.grid=o,this.ignoredGrid=n,this.perspectiveRatio=1+.5*(a/i-1),this.minScale=.5/this.perspectiveRatio,this.maxScale=2/this.perspectiveRatio;var s=Math.sin(this.angle),l=Math.cos(this.angle);this.rotationMatrix=[l,-s,s,l],this.reverseRotationMatrix=[l,s,-s,l],this.yStretch=Math.max(1,a/(i*Math.cos(t/180*Math.PI))),this.collisionBoxArray=r,0===r.length&&(r.emplaceBack(),r.emplaceBack(0,0,0,0,0,-EXTENT,0,EXTENT,1/0,1/0,0,0,0,0,0,0,0,0,0),r.emplaceBack(EXTENT,0,0,0,0,-EXTENT,0,EXTENT,1/0,1/0,0,0,0,0,0,0,0,0,0),r.emplaceBack(0,0,0,0,-EXTENT,0,EXTENT,0,1/0,1/0,0,0,0,0,0,0,0,0,0),r.emplaceBack(0,EXTENT,0,0,-EXTENT,0,EXTENT,0,1/0,1/0,0,0,0,0,0,0,0,0,0)),this.tempCollisionBox=r.get(0),this.edges=[r.get(1),r.get(2),r.get(3),r.get(4)]};CollisionTile.deserialize=function(e,t){return new CollisionTile(e.angle,e.pitch,e.cameraToCenterDistance,e.cameraToTileDistance,t,new Grid(e.grid),new Grid(e.ignoredGrid))},CollisionTile.prototype.serialize=function(e){var t=this.grid.toArrayBuffer(),i=this.ignoredGrid.toArrayBuffer();return e&&(e.push(t),e.push(i)),{angle:this.angle,pitch:this.pitch,cameraToCenterDistance:this.cameraToCenterDistance,cameraToTileDistance:this.cameraToTileDistance,grid:t,ignoredGrid:i}},CollisionTile.prototype.placeCollisionFeature=function(e,t,i){for(var a=this,r=this.collisionBoxArray,o=this.minScale,n=this.rotationMatrix,s=this.yStretch,l=e.boxStartIndex;l<e.boxEndIndex;l++){var c=r.get(l),h=c.anchorPoint._matMult(n),x=h.x,m=h.y,p=x+c.x1*a.perspectiveRatio,y=m+c.y1*s*a.perspectiveRatio,g=x+c.x2*a.perspectiveRatio,d=m+c.y2*s*a.perspectiveRatio;c.bbox0=p,c.bbox1=y,c.bbox2=g,c.bbox3=d;var T=new Point(c.offsetX,c.offsetY)._matMult(n),u=T.x*T.x,v=T.y*T.y,M=v*s*s,f=Math.sqrt((u+M)/(u+v))||1;if(c.maxScale=c.unadjustedMaxScale*f,!t)for(var E=a.grid.query(p,y,g,d),S=0;S<E.length;S++){var P=r.get(E[S]),b=P.anchorPoint._matMult(n);if((o=a.getPlacementScale(o,h,c,b,P))>=a.maxScale)return o}if(i){var N=void 0;if(a.angle){var C=a.reverseRotationMatrix,w=new Point(c.x1,c.y1).matMult(C),X=new Point(c.x2,c.y1).matMult(C),B=new Point(c.x1,c.y2).matMult(C),G=new Point(c.x2,c.y2).matMult(C);N=a.tempCollisionBox,N.anchorPointX=c.anchorPoint.x,N.anchorPointY=c.anchorPoint.y,N.x1=Math.min(w.x,X.x,B.x,G.x),N.y1=Math.min(w.y,X.x,B.x,G.x),N.x2=Math.max(w.x,X.x,B.x,G.x),N.y2=Math.max(w.y,X.x,B.x,G.x),N.maxScale=c.maxScale}else N=c;for(var R=0;R<this.edges.length;R++){var q=a.edges[R];if((o=a.getPlacementScale(o,c.anchorPoint,N,q.anchorPoint,q))>=a.maxScale)return o}}}return o},CollisionTile.prototype.queryRenderedSymbols=function(e,t){var i={},a=[];if(0===e.length||0===this.grid.keys.length&&0===this.ignoredGrid.keys.length)return a;for(var r=this.collisionBoxArray,o=this.rotationMatrix,n=this.yStretch,s=[],l=1/0,c=1/0,h=-1/0,x=-1/0,m=0;m<e.length;m++)for(var p=e[m],y=0;y<p.length;y++){var g=p[y].matMult(o);l=Math.min(l,g.x),c=Math.min(c,g.y),h=Math.max(h,g.x),x=Math.max(x,g.y),s.push(g)}for(var d=this.grid.query(l,c,h,x),T=this.ignoredGrid.query(l,c,h,x),u=0;u<T.length;u++)d.push(T[u]);for(var v=t/this.perspectiveRatio,M=Math.pow(2,Math.ceil(Math.log(v)/Math.LN2*10)/10),f=0;f<d.length;f++){var E=r.get(d[f]),S=E.sourceLayerIndex,P=E.featureIndex;if(void 0===i[S]&&(i[S]={}),!i[S][P]&&!(M<E.placementScale||M>E.maxScale)){var b=E.anchorPoint.matMult(o),N=b.x+E.x1/v,C=b.y+E.y1/v*n,w=b.x+E.x2/v,X=b.y+E.y2/v*n,B=[new Point(N,C),new Point(w,C),new Point(w,X),new Point(N,X)];intersectionTests.polygonIntersectsPolygon(s,B)&&(i[S][P]=!0,a.push(d[f]))}}return a},CollisionTile.prototype.getPlacementScale=function(e,t,i,a,r){var o=t.x-a.x,n=t.y-a.y,s=(r.x1-i.x2)/o,l=(r.x2-i.x1)/o,c=(r.y1-i.y2)*this.yStretch/n,h=(r.y2-i.y1)*this.yStretch/n;(isNaN(s)||isNaN(l))&&(s=l=1),(isNaN(c)||isNaN(h))&&(c=h=1);var x=Math.min(Math.max(s,l),Math.max(c,h)),m=r.maxScale,p=i.maxScale;return x>m&&(x=m),x>p&&(x=p),x>e&&x>=r.placementScale&&(e=x),e},CollisionTile.prototype.insertCollisionFeature=function(e,t,i){for(var a=this,r=i?this.ignoredGrid:this.grid,o=this.collisionBoxArray,n=e.boxStartIndex;n<e.boxEndIndex;n++){var s=o.get(n);s.placementScale=t,t<a.maxScale&&(1===a.perspectiveRatio||s.maxScale>=1)&&r.insert(n,s.bbox0,s.bbox1,s.bbox2,s.bbox3)}},module.exports=CollisionTile;
},{"../data/extent":48,"../util/intersection_tests":214,"@mapbox/point-geometry":2,"grid-index":22}],173:[function(_dereq_,module,exports){
"use strict";function getAnchors(e,r,t,n,a,l,o,i,c){var h=n?.6*l*o:0,s=Math.max(n?n.right-n.left:0,a?a.right-a.left:0),u=0===e[0].x||e[0].x===c||0===e[0].y||e[0].y===c;r-s*o<r/4&&(r=s*o+r/4);var g=2*l;return resample(e,u?r/2*i%r:(s/2+g)*o*i%r,r,h,t,s*o,u,!1,c)}function resample(e,r,t,n,a,l,o,i,c){for(var h=l/2,s=0,u=0;u<e.length-1;u++)s+=e[u].dist(e[u+1]);for(var g=0,p=r-t,x=[],f=0;f<e.length-1;f++){for(var v=e[f],m=e[f+1],y=v.dist(m),A=m.angleTo(v);p+t<g+y;){p+=t;var d=(p-g)/y,k=interpolate(v.x,m.x,d),q=interpolate(v.y,m.y,d);if(k>=0&&k<c&&q>=0&&q<c&&p-h>=0&&p+h<=s){var M=new Anchor(k,q,A,f);M._round(),n&&!checkMaxAngle(e,M,l,n,a)||x.push(M)}}g+=y}return i||x.length||o||(x=resample(e,g/2,t,n,a,l,o,!0,c)),x}var interpolate=_dereq_("../style-spec/util/interpolate"),Anchor=_dereq_("../symbol/anchor"),checkMaxAngle=_dereq_("./check_max_angle");module.exports=getAnchors;
},{"../style-spec/util/interpolate":127,"../symbol/anchor":167,"./check_max_angle":168}],174:[function(_dereq_,module,exports){
"use strict";module.exports=function(e){function t(t){g.push(e[t]),l++}function r(e,t,r){var n=u[e];return delete u[e],u[t]=n,g[n].geometry[0].pop(),g[n].geometry[0]=g[n].geometry[0].concat(r[0]),n}function n(e,t,r){var n=i[t];return delete i[t],i[e]=n,g[n].geometry[0].shift(),g[n].geometry[0]=r[0].concat(g[n].geometry[0]),n}function o(e,t,r){var n=r?t[0][t[0].length-1]:t[0][0];return e+":"+n.x+":"+n.y}for(var i={},u={},g=[],l=0,m=0;m<e.length;m++){var y=e[m],c=y.geometry,f=y.text;if(f){var a=o(f,c),s=o(f,c,!0);if(a in u&&s in i&&u[a]!==i[s]){var v=n(a,s,c),d=r(a,s,g[v].geometry);delete i[a],delete u[s],u[o(f,g[d].geometry,!0)]=d,g[v].geometry=null}else a in u?r(a,s,c):s in i?n(a,s,c):(t(m),i[a]=l-1,u[s]=l-1)}else t(m)}return g.filter(function(e){return e.geometry})};
},{}],175:[function(_dereq_,module,exports){
"use strict";function getLabelPlaneMatrix(e,t,a,n,r){var i=mat4.identity(new Float32Array(16));return t?(mat4.identity(i),mat4.scale(i,i,[1/r,1/r,1]),a||mat4.rotateZ(i,i,n.angle)):(mat4.scale(i,i,[n.width/2,-n.height/2,1]),mat4.translate(i,i,[1,-1,0]),mat4.multiply(i,i,e)),i}function getGlCoordMatrix(e,t,a,n,r){var i=mat4.identity(new Float32Array(16));return t?(mat4.multiply(i,i,e),mat4.scale(i,i,[r,r,1]),a||mat4.rotateZ(i,i,-n.angle)):(mat4.scale(i,i,[1,-1,1]),mat4.translate(i,i,[-1,-1,0]),mat4.scale(i,i,[2/n.width,2/n.height,1])),i}function project(e,t){var a=[e.x,e.y,0,1];vec4.transformMat4(a,a,t);var n=a[3];return{point:new Point(a[0]/n,a[1]/n),signedDistanceFromCamera:n}}function isVisible(e,t,a,n){var r=e[0]/e[3],i=e[1]/e[3];return r>=-a[0]&&r<=a[0]&&i>=-a[1]&&i<=a[1]&&n.frameHistory.isVisible(t)}function updateLineLabels(e,t,a,n,r,i,o,l,s,p){var m=n?e.textSizeData:e.iconSizeData,c=symbolSize.evaluateSizeForZoom(m,a.transform,p,n),u=[256/a.width*2+1,256/a.height*2+1],y=n?e.text.dynamicLayoutVertexArray:e.icon.dynamicLayoutVertexArray;y.clear();for(var g=e.lineVertexArray,d=n?e.placedGlyphArray:e.placedIconArray,f=0;f<d.length;f++){var h=d.get(f),x=[h.anchorX,h.anchorY,0,1];if(vec4.transformMat4(x,x,t),isVisible(x,h.placementZoom,u,a)){var v=x[3],b=1+.5*(v/a.transform.cameraToCenterDistance-1),L=symbolSize.evaluateSizeForFeature(m,c,h),A=o?L*b:L/b,G=new Point(h.anchorX,h.anchorY),S=project(G,r).point,P={},D=placeGlyphsAlongLine(h,A,!1,l,t,r,i,e.glyphOffsetArray,g,y,S,G,P);(D.notEnoughRoom||D.needsFlipping&&placeGlyphsAlongLine(h,A,!0,l,t,r,i,e.glyphOffsetArray,g,y,S,G,P).notEnoughRoom)&&hideGlyphs(h.numGlyphs,y)}else hideGlyphs(h.numGlyphs,y)}n?e.text.dynamicLayoutVertexBuffer.updateData(y.serialize()):e.icon.dynamicLayoutVertexBuffer.updateData(y.serialize())}function placeGlyphsAlongLine(e,t,a,n,r,i,o,l,s,p,m,c,u){var y,g=t/24,d=e.lineOffsetX*t,f=e.lineOffsetY*t;if(e.numGlyphs>1){var h=e.glyphStartIndex+e.numGlyphs,x=l.get(e.glyphStartIndex).offsetX,v=l.get(h-1).offsetX,b=e.lineStartIndex,L=e.lineStartIndex+e.lineLength,A=placeGlyphAlongLine(g*x,d,f,a,m,c,e.segment,b,L,s,i,u);if(!A)return{notEnoughRoom:!0};var G=placeGlyphAlongLine(g*v,d,f,a,m,c,e.segment,b,L,s,i,u);if(!G)return{notEnoughRoom:!0};var S=project(A.point,o).point,P=project(G.point,o).point;if(n&&!a&&(e.vertical?S.y<P.y:S.x>P.x))return{needsFlipping:!0};y=[A];for(var D=e.glyphStartIndex+1;D<h-1;D++){var I=l.get(D);y.push(placeGlyphAlongLine(g*I.offsetX,d,f,a,m,c,e.segment,b,L,s,i,u))}y.push(G)}else{if(n&&!a){var M=project(c,r).point,j=s.get(e.lineStartIndex+e.segment+1),w=project(j,r),F=w.signedDistanceFromCamera>0?w.point:projectTruncatedLineSegment(c,new Point(j.x,j.y),M,1,r);if(e.vertical?F.y>M.y:F.x<M.x)return{needsFlipping:!0}}var z=l.get(e.glyphStartIndex),_=placeGlyphAlongLine(g*z.offsetX,d,f,a,m,c,e.segment,e.lineStartIndex,e.lineStartIndex+e.lineLength,s,i,u);if(!_)return{notEnoughRoom:!0};y=[_]}for(var V=e.placementZoom,C=0,X=y;C<X.length;C+=1){var E=X[C];addDynamicAttributes(p,E.point,E.angle,V)}return{}}function projectTruncatedLineSegment(e,t,a,n,r){var i=project(e.add(e.sub(t)._unit()),r).point,o=a.sub(i);return a.add(o._mult(n/o.mag()))}function placeGlyphAlongLine(e,t,a,n,r,i,o,l,s,p,m,c){var u=n?e-t:e+t,y=u>0?1:-1,g=0;n&&(y*=-1,g=Math.PI),y<0&&(g+=Math.PI);for(var d=y>0?l+o:l+o+1,f=r,h=r,x=0,v=0,b=Math.abs(u);x+v<=b;){if((d+=y)<l||d>=s)return null;if(h=f,void 0===(f=c[d])){var L=project(p.get(d),m);if(L.signedDistanceFromCamera>0)f=c[d]=L.point;else{f=projectTruncatedLineSegment(0===x?i:new Point(p.get(d-y).x,p.get(d-y).y),new Point(p.get(d).x,p.get(d).y),h,b-x+1,m)}}x+=v,v=h.dist(f)}var A=(b-x)/v,G=f.sub(h),S=G.mult(A)._add(h);return S._add(G._unit()._perp()._mult(a*y)),{point:S,angle:g+Math.atan2(f.y-h.y,f.x-h.x)}}function hideGlyphs(e,t){for(var a=0;a<e;a++)addDynamicAttributes(t,offscreenPoint,0,25)}var Point=_dereq_("@mapbox/point-geometry"),ref=_dereq_("@mapbox/gl-matrix"),mat4=ref.mat4,vec4=ref.vec4,symbolSize=_dereq_("./symbol_size"),ref$1=_dereq_("../data/bucket/symbol_bucket"),addDynamicAttributes=ref$1.addDynamicAttributes;module.exports={updateLineLabels:updateLineLabels,getLabelPlaneMatrix:getLabelPlaneMatrix,getGlCoordMatrix:getGlCoordMatrix};var offscreenPoint=new Point(-1/0,-1/0);
},{"../data/bucket/symbol_bucket":47,"./symbol_size":178,"@mapbox/gl-matrix":1,"@mapbox/point-geometry":2}],176:[function(_dereq_,module,exports){
"use strict";function getIconQuads(t,e,i,o,n,a,r){var u,l,d,f,c=e.image,h=i.layout,x=e.top-1/c.pixelRatio,g=e.left-1/c.pixelRatio,p=e.bottom+1/c.pixelRatio,s=e.right+1/c.pixelRatio;if("none"!==h["icon-text-fit"]&&n){var P=s-g,_=p-x,w=h["text-size"]/24,m=n.left*w,y=n.right*w,M=n.top*w,v=n.bottom*w,R=y-m,b=v-M,G=h["icon-text-fit-padding"][0],B=h["icon-text-fit-padding"][1],I=h["icon-text-fit-padding"][2],L=h["icon-text-fit-padding"][3],Q="width"===h["icon-text-fit"]?.5*(b-_):0,O="height"===h["icon-text-fit"]?.5*(R-P):0,A="width"===h["icon-text-fit"]||"both"===h["icon-text-fit"]?R:P,D="height"===h["icon-text-fit"]||"both"===h["icon-text-fit"]?b:_;u=new Point(m+O-L,M+Q-G),l=new Point(m+O+B+A,M+Q-G),d=new Point(m+O+B+A,M+Q+I+D),f=new Point(m+O-L,M+Q+I+D)}else u=new Point(g,x),l=new Point(s,x),d=new Point(s,p),f=new Point(g,p);var E=i.getLayoutValue("icon-rotate",a,r)*Math.PI/180;if(E){var F=Math.sin(E),H=Math.cos(E),V=[H,-F,F,H];u._matMult(V),l._matMult(V),f._matMult(V),d._matMult(V)}return[{tl:u,tr:l,bl:f,br:d,tex:{x:c.textureRect.x-1,y:c.textureRect.y-1,w:c.textureRect.w+2,h:c.textureRect.h+2},writingMode:void 0,glyphOffset:[0,0]}]}function getGlyphQuads(t,e,i,o,n,a,r){for(var u=i.getLayoutValue("text-rotate",n,a)*Math.PI/180,l=i.getLayoutValue("text-offset",n,a).map(function(t){return 24*t}),d=e.positionedGlyphs,f=[],c=0;c<d.length;c++){var h=d[c],x=r[h.glyph];if(x){var g=x.rect;if(g){var p=GLYPH_PBF_BORDER+1,s=x.metrics.advance/2,P=o?[h.x+s,h.y]:[0,0],_=o?[0,0]:[h.x+s+l[0],h.y+l[1]],w=x.metrics.left-p-s+_[0],m=-x.metrics.top-p+_[1],y=w+g.w,M=m+g.h,v=new Point(w,m),R=new Point(y,m),b=new Point(w,M),G=new Point(y,M);if(o&&h.vertical){var B=new Point(-s,s),I=-Math.PI/2,L=new Point(5,0);v._rotateAround(I,B)._add(L),R._rotateAround(I,B)._add(L),b._rotateAround(I,B)._add(L),G._rotateAround(I,B)._add(L)}if(u){var Q=Math.sin(u),O=Math.cos(u),A=[O,-Q,Q,O];v._matMult(A),R._matMult(A),b._matMult(A),G._matMult(A)}f.push({tl:v,tr:R,bl:b,br:G,tex:g,writingMode:e.writingMode,glyphOffset:P})}}}return f}var Point=_dereq_("@mapbox/point-geometry"),ref=_dereq_("../style/parse_glyph_pbf"),GLYPH_PBF_BORDER=ref.GLYPH_PBF_BORDER;module.exports={getIconQuads:getIconQuads,getGlyphQuads:getGlyphQuads};
},{"../style/parse_glyph_pbf":154,"@mapbox/point-geometry":2}],177:[function(_dereq_,module,exports){
"use strict";function breakLines(e,t){for(var a=[],r=0,i=0,n=t;i<n.length;i+=1){var l=n[i];a.push(e.substring(r,l)),r=l}return r<e.length&&a.push(e.substring(r,e.length)),a}function shapeText(e,t,a,r,i,n,l,c,o,s){var h=e.trim();s===WritingMode.vertical&&(h=verticalizePunctuation(h));var g,u=[],p={positionedGlyphs:u,text:h,top:c[1],bottom:c[1],left:c[0],right:c[0],writingMode:s},b=rtlTextPlugin.processBidirectionalText;return g=b?b(h,determineLineBreaks(h,l,a,t)):breakLines(h,determineLineBreaks(h,l,a,t)),shapeLines(p,t,g,r,i,n,s,l,o),!!u.length&&p}function determineAverageLineWidth(e,t,a,r){for(var i=0,n=0;n<e.length;n++){var l=r[e.charCodeAt(n)];l&&(i+=l.metrics.advance+t)}return i/Math.max(1,Math.ceil(i/a))}function calculateBadness(e,t,a,r){var i=Math.pow(e-t,2);return r?e<t?i/2:2*i:i+Math.abs(a)*a}function calculatePenalty(e,t){var a=0;return 10===e&&(a-=1e4),40!==e&&65288!==e||(a+=50),41!==t&&65289!==t||(a+=50),a}function evaluateBreak(e,t,a,r,i,n){for(var l=null,c=calculateBadness(t,a,i,n),o=0,s=r;o<s.length;o+=1){var h=s[o],g=t-h.x,u=calculateBadness(g,a,i,n)+h.badness;u<=c&&(l=h,c=u)}return{index:e,x:t,priorBreak:l,badness:c}}function leastBadBreaks(e){return e?leastBadBreaks(e.priorBreak).concat(e.index):[]}function determineLineBreaks(e,t,a,r){if(!a)return[];if(!e)return[];for(var i=[],n=determineAverageLineWidth(e,t,a,r),l=0,c=0;c<e.length;c++){var o=e.charCodeAt(c),s=r[o];s&&!whitespace[o]&&(l+=s.metrics.advance+t),c<e.length-1&&(breakable[o]||scriptDetection.charAllowsIdeographicBreaking(o))&&i.push(evaluateBreak(c+1,l,n,i,calculatePenalty(o,e.charCodeAt(c+1)),!1))}return leastBadBreaks(evaluateBreak(e.length,l,n,i,0,!0))}function getAnchorAlignment(e){var t=.5,a=.5;switch(e){case"right":case"top-right":case"bottom-right":t=1;break;case"left":case"top-left":case"bottom-left":t=0}switch(e){case"bottom":case"bottom-right":case"bottom-left":a=1;break;case"top":case"top-right":case"top-left":a=0}return{horizontalAlign:t,verticalAlign:a}}function shapeLines(e,t,a,r,i,n,l,c,o){for(var s=0,h=-17,g=0,u=e.positionedGlyphs,p="right"===n?1:"left"===n?0:.5,b=0,v=a;b<v.length;b+=1){var d=v[b];if(d=d.trim(),d.length){for(var f=u.length,k=0;k<d.length;k++){var m=d.charCodeAt(k),x=t[m];x&&(scriptDetection.charHasUprightVerticalOrientation(m)&&l!==WritingMode.horizontal?(u.push({glyph:m,x:s,y:0,vertical:!0}),s+=o+c):(u.push({glyph:m,x:s,y:h,vertical:!1}),s+=x.metrics.advance+c))}if(u.length!==f){var A=s-c;g=Math.max(A,g),justifyLine(u,t,f,u.length-1,p)}s=0,h+=r}else h+=r}var B=getAnchorAlignment(i),y=B.horizontalAlign,w=B.verticalAlign;align(u,p,y,w,g,r,a.length);var z=a.length*r;e.top+=-w*z,e.bottom=e.top+z,e.left+=-y*g,e.right=e.left+g}function justifyLine(e,t,a,r,i){if(i){var n=t[e[r].glyph];if(n)for(var l=n.metrics.advance,c=(e[r].x+l)*i,o=a;o<=r;o++)e[o].x-=c}}function align(e,t,a,r,i,n,l){for(var c=(t-a)*i,o=(-r*l+.5)*n,s=0;s<e.length;s++)e[s].x+=c,e[s].y+=o}function shapeIcon(e,t,a){var r=getAnchorAlignment(a),i=r.horizontalAlign,n=r.verticalAlign,l=t[0],c=t[1],o=l-e.displaySize[0]*i,s=o+e.displaySize[0],h=c-e.displaySize[1]*n;return{image:e,top:h,bottom:h+e.displaySize[1],left:o,right:s}}var scriptDetection=_dereq_("../util/script_detection"),verticalizePunctuation=_dereq_("../util/verticalize_punctuation"),rtlTextPlugin=_dereq_("../source/rtl_text_plugin"),WritingMode={horizontal:1,vertical:2};module.exports={shapeText:shapeText,shapeIcon:shapeIcon,WritingMode:WritingMode};var whitespace={};whitespace[9]=!0,whitespace[10]=!0,whitespace[11]=!0,whitespace[12]=!0,whitespace[13]=!0,whitespace[32]=!0;var breakable={};breakable[10]=!0,breakable[32]=!0,breakable[38]=!0,breakable[40]=!0,breakable[41]=!0,breakable[43]=!0,breakable[45]=!0,breakable[47]=!0,breakable[173]=!0,breakable[183]=!0,breakable[8203]=!0,breakable[8208]=!0,breakable[8211]=!0,breakable[8231]=!0;
},{"../source/rtl_text_plugin":96,"../util/script_detection":218,"../util/verticalize_punctuation":225}],178:[function(_dereq_,module,exports){
"use strict";function evaluateSizeForFeature(e,o,t){var i=o;return e.isFeatureConstant?i.uSize:e.isZoomConstant?t.lowerSize/10:interpolate.number(t.lowerSize/10,t.upperSize/10,i.uSizeT)}function evaluateSizeForZoom(e,o,t,i){var a={};if(e.isZoomConstant||e.isFeatureConstant)if(e.isFeatureConstant&&!e.isZoomConstant){var n;if("interval"===e.functionType)n=t.getLayoutValue(i?"text-size":"icon-size",{zoom:o.zoom});else{var r="interval"===e.functionType?0:interpolationFactor(o.zoom,e.functionBase,e.coveringZoomRange[0],e.coveringZoomRange[1]),u=e.coveringStopValues[0],l=e.coveringStopValues[1];n=u+(l-u)*util.clamp(r,0,1)}a.uSize=n}else e.isFeatureConstant&&e.isZoomConstant&&(a.uSize=e.layoutSize);else{var s=interpolationFactor(o.zoom,e.functionBase,e.coveringZoomRange[0],e.coveringZoomRange[1]);a.uSizeT=util.clamp(s,0,1)}return a}var interpolate=_dereq_("../style-spec/util/interpolate"),ref=_dereq_("../style-spec/function"),interpolationFactor=ref.interpolationFactor,util=_dereq_("../util/util");module.exports={evaluateSizeForFeature:evaluateSizeForFeature,evaluateSizeForZoom:evaluateSizeForZoom};
},{"../style-spec/function":112,"../style-spec/util/interpolate":127,"../util/util":223}],179:[function(_dereq_,module,exports){
"use strict";var rtlTextPlugin=_dereq_("../source/rtl_text_plugin");module.exports=function(e,r,t,a){var l=r.getLayoutValue("text-transform",t,a);return"uppercase"===l?e=e.toLocaleUpperCase():"lowercase"===l&&(e=e.toLocaleLowerCase()),rtlTextPlugin.applyArabicShaping&&(e=rtlTextPlugin.applyArabicShaping(e)),e};
},{"../source/rtl_text_plugin":96}],180:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../util/dom"),Point=_dereq_("@mapbox/point-geometry"),handlers={scrollZoom:_dereq_("./handler/scroll_zoom"),boxZoom:_dereq_("./handler/box_zoom"),dragRotate:_dereq_("./handler/drag_rotate"),dragPan:_dereq_("./handler/drag_pan"),keyboard:_dereq_("./handler/keyboard"),doubleClickZoom:_dereq_("./handler/dblclick_zoom"),touchZoomRotate:_dereq_("./handler/touch_zoom_rotate")};module.exports=function(e,t){function n(e){h("mouseout",e)}function o(t){e.stop(),L=DOM.mousePos(g,t),h("mousedown",t),E=!0}function r(t){var n=e.dragRotate&&e.dragRotate.isActive();p&&!n&&h("contextmenu",p),p=null,E=!1,h("mouseup",t)}function a(t){if(!(e.dragPan&&e.dragPan.isActive()||e.dragRotate&&e.dragRotate.isActive())){for(var n=t.toElement||t.target;n&&n!==g;)n=n.parentNode;n===g&&h("mousemove",t)}}function u(t){e.stop(),f("touchstart",t),!t.touches||t.touches.length>1||(b?(clearTimeout(b),b=null,h("dblclick",t)):b=setTimeout(l,300))}function i(e){f("touchmove",e)}function c(e){f("touchend",e)}function d(e){f("touchcancel",e)}function l(){b=null}function s(e){DOM.mousePos(g,e).equals(L)&&h("click",e)}function m(e){h("dblclick",e),e.preventDefault()}function v(t){var n=e.dragRotate&&e.dragRotate.isActive();E||n?E&&(p=t):h("contextmenu",t),t.preventDefault()}function h(t,n){var o=DOM.mousePos(g,n);return e.fire(t,{lngLat:e.unproject(o),point:o,originalEvent:n})}function f(t,n){var o=DOM.touchPos(g,n),r=o.reduce(function(e,t,n,o){return e.add(t.div(o.length))},new Point(0,0));return e.fire(t,{lngLat:e.unproject(r),point:r,lngLats:o.map(function(t){return e.unproject(t)},this),points:o,originalEvent:n})}var g=e.getCanvasContainer(),p=null,E=!1,L=null,b=null;for(var q in handlers)e[q]=new handlers[q](e,t),t.interactive&&t[q]&&e[q].enable(t[q]);g.addEventListener("mouseout",n,!1),g.addEventListener("mousedown",o,!1),g.addEventListener("mouseup",r,!1),g.addEventListener("mousemove",a,!1),g.addEventListener("touchstart",u,!1),g.addEventListener("touchend",c,!1),g.addEventListener("touchmove",i,!1),g.addEventListener("touchcancel",d,!1),g.addEventListener("click",s,!1),g.addEventListener("dblclick",m,!1),g.addEventListener("contextmenu",v,!1)};
},{"../util/dom":209,"./handler/box_zoom":189,"./handler/dblclick_zoom":190,"./handler/drag_pan":191,"./handler/drag_rotate":192,"./handler/keyboard":193,"./handler/scroll_zoom":194,"./handler/touch_zoom_rotate":195,"@mapbox/point-geometry":2}],181:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),interpolate=_dereq_("../style-spec/util/interpolate"),browser=_dereq_("../util/browser"),LngLat=_dereq_("../geo/lng_lat"),LngLatBounds=_dereq_("../geo/lng_lat_bounds"),Point=_dereq_("@mapbox/point-geometry"),Evented=_dereq_("../util/evented"),Camera=function(t){function e(e,i){t.call(this),this.moving=!1,this.transform=e,this._bearingSnap=i.bearingSnap}return t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e,e.prototype.getCenter=function(){return this.transform.center},e.prototype.setCenter=function(t,e){return this.jumpTo({center:t},e)},e.prototype.panBy=function(t,e,i){return t=Point.convert(t).mult(-1),this.panTo(this.transform.center,util.extend({offset:t},e),i)},e.prototype.panTo=function(t,e,i){return this.easeTo(util.extend({center:t},e),i)},e.prototype.getZoom=function(){return this.transform.zoom},e.prototype.setZoom=function(t,e){return this.jumpTo({zoom:t},e),this},e.prototype.zoomTo=function(t,e,i){return this.easeTo(util.extend({zoom:t},e),i)},e.prototype.zoomIn=function(t,e){return this.zoomTo(this.getZoom()+1,t,e),this},e.prototype.zoomOut=function(t,e){return this.zoomTo(this.getZoom()-1,t,e),this},e.prototype.getBearing=function(){return this.transform.bearing},e.prototype.setBearing=function(t,e){return this.jumpTo({bearing:t},e),this},e.prototype.rotateTo=function(t,e,i){return this.easeTo(util.extend({bearing:t},e),i)},e.prototype.resetNorth=function(t,e){return this.rotateTo(0,util.extend({duration:1e3},t),e),this},e.prototype.snapToNorth=function(t,e){return Math.abs(this.getBearing())<this._bearingSnap?this.resetNorth(t,e):this},e.prototype.getPitch=function(){return this.transform.pitch},e.prototype.setPitch=function(t,e){return this.jumpTo({pitch:t},e),this},e.prototype.fitBounds=function(t,e,i){if(e=util.extend({padding:{top:0,bottom:0,right:0,left:0},offset:[0,0],maxZoom:this.transform.maxZoom},e),"number"==typeof e.padding){var o=e.padding;e.padding={top:o,bottom:o,right:o,left:o}}if(!util.deepEqual(Object.keys(e.padding).sort(function(t,e){return t<e?-1:t>e?1:0}),["bottom","left","right","top"]))return util.warnOnce("options.padding must be a positive number, or an Object with keys 'bottom', 'left', 'right', 'top'"),this;t=LngLatBounds.convert(t);var n=[e.padding.left-e.padding.right,e.padding.top-e.padding.bottom],r=Math.min(e.padding.right,e.padding.left),a=Math.min(e.padding.top,e.padding.bottom);e.offset=[e.offset[0]+n[0],e.offset[1]+n[1]];var s=Point.convert(e.offset),h=this.transform,p=h.project(t.getNorthWest()),u=h.project(t.getSouthEast()),c=u.sub(p),m=(h.width-2*r-2*Math.abs(s.x))/c.x,f=(h.height-2*a-2*Math.abs(s.y))/c.y;return f<0||m<0?(util.warnOnce("Map cannot fit within canvas with the given bounds, padding, and/or offset."),this):(e.center=h.unproject(p.add(u).div(2)),e.zoom=Math.min(h.scaleZoom(h.scale*Math.min(m,f)),e.maxZoom),e.bearing=0,e.linear?this.easeTo(e,i):this.flyTo(e,i))},e.prototype.jumpTo=function(t,e){this.stop();var i=this.transform,o=!1,n=!1,r=!1;return"zoom"in t&&i.zoom!==+t.zoom&&(o=!0,i.zoom=+t.zoom),void 0!==t.center&&(i.center=LngLat.convert(t.center)),"bearing"in t&&i.bearing!==+t.bearing&&(n=!0,i.bearing=+t.bearing),"pitch"in t&&i.pitch!==+t.pitch&&(r=!0,i.pitch=+t.pitch),this.fire("movestart",e).fire("move",e),o&&this.fire("zoomstart",e).fire("zoom",e).fire("zoomend",e),n&&this.fire("rotate",e),r&&this.fire("pitchstart",e).fire("pitch",e).fire("pitchend",e),this.fire("moveend",e)},e.prototype.easeTo=function(t,e){var i=this;this.stop(),t=util.extend({offset:[0,0],duration:500,easing:util.ease},t),!1===t.animate&&(t.duration=0),t.smoothEasing&&0!==t.duration&&(t.easing=this._smoothOutEasing(t.duration));var o=this.transform,n=this.getZoom(),r=this.getBearing(),a=this.getPitch(),s="zoom"in t?+t.zoom:n,h="bearing"in t?this._normalizeBearing(t.bearing,r):r,p="pitch"in t?+t.pitch:a,u=o.centerPoint.add(Point.convert(t.offset)),c=o.pointLocation(u),m=LngLat.convert(t.center||c);this._normalizeCenter(m);var f,g,d=o.project(c),l=o.project(m).sub(d),v=o.zoomScale(s-n);return t.around&&(f=LngLat.convert(t.around),g=o.locationPoint(f)),this.zooming=s!==n,this.rotating=r!==h,this.pitching=p!==a,this._prepareEase(e,t.noMoveStart),clearTimeout(this._onEaseEnd),this._ease(function(t){if(this.zooming&&(o.zoom=interpolate(n,s,t)),this.rotating&&(o.bearing=interpolate(r,h,t)),this.pitching&&(o.pitch=interpolate(a,p,t)),f)o.setLocationAtPoint(f,g);else{var i=o.zoomScale(o.zoom-n),c=s>n?Math.min(2,v):Math.max(.5,v),m=Math.pow(c,1-t),b=o.unproject(d.add(l.mult(t*m)).mult(i));o.setLocationAtPoint(o.renderWorldCopies?b.wrap():b,u)}this._fireMoveEvents(e)},function(){t.delayEndEvents?i._onEaseEnd=setTimeout(function(){return i._easeToEnd(e)},t.delayEndEvents):i._easeToEnd(e)},t),this},e.prototype._prepareEase=function(t,e){this.moving=!0,e||this.fire("movestart",t),this.zooming&&this.fire("zoomstart",t),this.pitching&&this.fire("pitchstart",t)},e.prototype._fireMoveEvents=function(t){this.fire("move",t),this.zooming&&this.fire("zoom",t),this.rotating&&this.fire("rotate",t),this.pitching&&this.fire("pitch",t)},e.prototype._easeToEnd=function(t){var e=this.zooming,i=this.pitching;this.moving=!1,this.zooming=!1,this.rotating=!1,this.pitching=!1,e&&this.fire("zoomend",t),i&&this.fire("pitchend",t),this.fire("moveend",t)},e.prototype.flyTo=function(t,e){function i(t){var e=(M*M-z*z+(t?-1:1)*L*L*E*E)/(2*(t?M:z)*L*E);return Math.log(Math.sqrt(e*e+1)-e)}function o(t){return(Math.exp(t)-Math.exp(-t))/2}function n(t){return(Math.exp(t)+Math.exp(-t))/2}function r(t){return o(t)/n(t)}var a=this;this.stop(),t=util.extend({offset:[0,0],speed:1.2,curve:1.42,easing:util.ease},t);var s=this.transform,h=this.getZoom(),p=this.getBearing(),u=this.getPitch(),c="zoom"in t?util.clamp(+t.zoom,s.minZoom,s.maxZoom):h,m="bearing"in t?this._normalizeBearing(t.bearing,p):p,f="pitch"in t?+t.pitch:u,g=s.zoomScale(c-h),d=s.centerPoint.add(Point.convert(t.offset)),l=s.pointLocation(d),v=LngLat.convert(t.center||l);this._normalizeCenter(v);var b=s.project(l),y=s.project(v).sub(b),_=t.curve,z=Math.max(s.width,s.height),M=z/g,E=y.mag();if("minZoom"in t){var T=util.clamp(Math.min(t.minZoom,h,c),s.minZoom,s.maxZoom),x=z/s.zoomScale(T-h);_=Math.sqrt(x/E*2)}var L=_*_,j=i(0),Z=function(t){return n(j)/n(j+_*t)},w=function(t){return z*((n(j)*r(j+_*t)-o(j))/L)/E},P=(i(1)-j)/_;if(Math.abs(E)<1e-6||isNaN(P)){if(Math.abs(z-M)<1e-6)return this.easeTo(t,e);var q=M<z?-1:1;P=Math.abs(Math.log(M/z))/_,w=function(){return 0},Z=function(t){return Math.exp(q*_*t)}}if("duration"in t)t.duration=+t.duration;else{var B="screenSpeed"in t?+t.screenSpeed/_:+t.speed;t.duration=1e3*P/B}return this.zooming=!0,this.rotating=p!==m,this.pitching=f!==u,this._prepareEase(e,!1),this._ease(function(t){var i=t*P,o=1/Z(i);s.zoom=h+s.scaleZoom(o),this.rotating&&(s.bearing=interpolate(p,m,t)),this.pitching&&(s.pitch=interpolate(u,f,t));var n=s.unproject(b.add(y.mult(w(i))).mult(o));s.setLocationAtPoint(s.renderWorldCopies?n.wrap():n,d),this._fireMoveEvents(e)},function(){return a._easeToEnd(e)},t),this},e.prototype.isEasing=function(){return!!this._abortFn},e.prototype.isMoving=function(){return this.moving},e.prototype.stop=function(){return this._abortFn&&(this._abortFn(),this._finishEase()),this},e.prototype._ease=function(t,e,i){this._finishFn=e,this._abortFn=browser.timed(function(e){t.call(this,i.easing(e)),1===e&&this._finishEase()},!1===i.animate?0:i.duration,this)},e.prototype._finishEase=function(){delete this._abortFn;var t=this._finishFn;delete this._finishFn,t.call(this)},e.prototype._normalizeBearing=function(t,e){t=util.wrap(t,-180,180);var i=Math.abs(t-e);return Math.abs(t-360-e)<i&&(t-=360),Math.abs(t+360-e)<i&&(t+=360),t},e.prototype._normalizeCenter=function(t){var e=this.transform;if(e.renderWorldCopies&&!e.lngRange){var i=t.lng-e.center.lng;t.lng+=i>180?-360:i<-180?360:0}},e.prototype._smoothOutEasing=function(t){var e=util.ease;if(this._prevEase){var i=this._prevEase,o=(Date.now()-i.start)/i.duration,n=i.easing(o+.01)-i.easing(o),r=.27/Math.sqrt(n*n+1e-4)*.01,a=Math.sqrt(.0729-r*r);e=util.bezier(r,a,.25,1)}return this._prevEase={start:(new Date).getTime(),duration:t,easing:e},e},e}(Evented);module.exports=Camera;
},{"../geo/lng_lat":58,"../geo/lng_lat_bounds":59,"../style-spec/util/interpolate":127,"../util/browser":202,"../util/evented":210,"../util/util":223,"@mapbox/point-geometry":2}],182:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),config=_dereq_("../../util/config"),AttributionControl=function(t){this.options=t,util.bindAll(["_updateEditLink","_updateData","_updateCompact"],this)};AttributionControl.prototype.getDefaultPosition=function(){return"bottom-right"},AttributionControl.prototype.onAdd=function(t){var i=this.options&&this.options.compact;return this._map=t,this._container=DOM.create("div","mapboxgl-ctrl mapboxgl-ctrl-attrib"),i&&this._container.classList.add("mapboxgl-compact"),this._updateAttributions(),this._updateEditLink(),this._map.on("sourcedata",this._updateData),this._map.on("moveend",this._updateEditLink),void 0===i&&(this._map.on("resize",this._updateCompact),this._updateCompact()),this._container},AttributionControl.prototype.onRemove=function(){DOM.remove(this._container),this._map.off("sourcedata",this._updateData),this._map.off("moveend",this._updateEditLink),this._map.off("resize",this._updateCompact),this._map=void 0},AttributionControl.prototype._updateEditLink=function(){var t=this._editLink;t||(t=this._editLink=this._container.querySelector(".mapbox-improve-map"));var i=[{key:"owner",value:this.styleOwner},{key:"id",value:this.styleId},{key:"access_token",value:config.ACCESS_TOKEN}];if(t){var o=i.reduce(function(t,o,e){return o.value&&(t+=o.key+"="+o.value+(e<i.length-1?"&":"")),t},"?");t.href="https://www.mapbox.com/feedback/"+o+(this._map._hash?this._map._hash.getHashString(!0):"")}},AttributionControl.prototype._updateData=function(t){t&&"metadata"===t.sourceDataType&&(this._updateAttributions(),this._updateEditLink())},AttributionControl.prototype._updateAttributions=function(){if(this._map.style){var t=[];if(this._map.style.stylesheet){var i=this._map.style.stylesheet;this.styleOwner=i.owner,this.styleId=i.id}var o=this._map.style.sourceCaches;for(var e in o){var n=o[e].getSource();n.attribution&&t.indexOf(n.attribution)<0&&t.push(n.attribution)}t.sort(function(t,i){return t.length-i.length}),t=t.filter(function(i,o){for(var e=o+1;e<t.length;e++)if(t[e].indexOf(i)>=0)return!1;return!0}),this._container.innerHTML=t.join(" | "),this._editLink=null}},AttributionControl.prototype._updateCompact=function(){this._map.getCanvasContainer().offsetWidth<=640?this._container.classList.add("mapboxgl-compact"):this._container.classList.remove("mapboxgl-compact")},module.exports=AttributionControl;
},{"../../util/config":206,"../../util/dom":209,"../../util/util":223}],183:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),window=_dereq_("../../util/window"),FullscreenControl=function(){this._fullscreen=!1,util.bindAll(["_onClickFullscreen","_changeIcon"],this),"onfullscreenchange"in window.document?this._fullscreenchange="fullscreenchange":"onmozfullscreenchange"in window.document?this._fullscreenchange="mozfullscreenchange":"onwebkitfullscreenchange"in window.document?this._fullscreenchange="webkitfullscreenchange":"onmsfullscreenchange"in window.document&&(this._fullscreenchange="MSFullscreenChange"),this._className="mapboxgl-ctrl"};FullscreenControl.prototype.onAdd=function(e){return this._map=e,this._mapContainer=this._map.getContainer(),this._container=DOM.create("div",this._className+" mapboxgl-ctrl-group"),this._checkFullscreenSupport()?this._setupUI():(this._container.style.display="none",util.warnOnce("This device does not support fullscreen mode.")),this._container},FullscreenControl.prototype.onRemove=function(){DOM.remove(this._container),this._map=null,window.document.removeEventListener(this._fullscreenchange,this._changeIcon)},FullscreenControl.prototype._checkFullscreenSupport=function(){return!!(window.document.fullscreenEnabled||window.document.mozFullScreenEnabled||window.document.msFullscreenEnabled||window.document.webkitFullscreenEnabled)},FullscreenControl.prototype._setupUI=function(){var e=this._fullscreenButton=DOM.create("button",this._className+"-icon "+this._className+"-fullscreen",this._container);e.setAttribute("aria-label","Toggle fullscreen"),e.type="button",this._fullscreenButton.addEventListener("click",this._onClickFullscreen),window.document.addEventListener(this._fullscreenchange,this._changeIcon)},FullscreenControl.prototype._isFullscreen=function(){return this._fullscreen},FullscreenControl.prototype._changeIcon=function(){(window.document.fullscreenElement||window.document.mozFullScreenElement||window.document.webkitFullscreenElement||window.document.msFullscreenElement)===this._mapContainer!==this._fullscreen&&(this._fullscreen=!this._fullscreen,this._fullscreenButton.classList.toggle(this._className+"-shrink"),this._fullscreenButton.classList.toggle(this._className+"-fullscreen"))},FullscreenControl.prototype._onClickFullscreen=function(){this._isFullscreen()?window.document.exitFullscreen?window.document.exitFullscreen():window.document.mozCancelFullScreen?window.document.mozCancelFullScreen():window.document.msExitFullscreen?window.document.msExitFullscreen():window.document.webkitCancelFullScreen&&window.document.webkitCancelFullScreen():this._mapContainer.requestFullscreen?this._mapContainer.requestFullscreen():this._mapContainer.mozRequestFullScreen?this._mapContainer.mozRequestFullScreen():this._mapContainer.msRequestFullscreen?this._mapContainer.msRequestFullscreen():this._mapContainer.webkitRequestFullscreen&&this._mapContainer.webkitRequestFullscreen()},module.exports=FullscreenControl;
},{"../../util/dom":209,"../../util/util":223,"../../util/window":204}],184:[function(_dereq_,module,exports){
"use strict";function checkGeolocationSupport(t){void 0!==supportsGeolocation?t(supportsGeolocation):void 0!==window.navigator.permissions?window.navigator.permissions.query({name:"geolocation"}).then(function(o){supportsGeolocation="denied"!==o.state,t(supportsGeolocation)}):(supportsGeolocation=!!window.navigator.geolocation,t(supportsGeolocation))}var Evented=_dereq_("../../util/evented"),DOM=_dereq_("../../util/dom"),window=_dereq_("../../util/window"),util=_dereq_("../../util/util"),LngLat=_dereq_("../../geo/lng_lat"),Marker=_dereq_("../marker"),defaultOptions={positionOptions:{enableHighAccuracy:!1,timeout:6e3},fitBoundsOptions:{maxZoom:15},trackUserLocation:!1,showUserLocation:!0},className="mapboxgl-ctrl",supportsGeolocation,GeolocateControl=function(t){function o(o){t.call(this),this.options=util.extend({},defaultOptions,o),util.bindAll(["_onSuccess","_onError","_finish","_setupUI","_updateCamera","_updateMarker","_onClickGeolocate"],this)}return t&&(o.__proto__=t),o.prototype=Object.create(t&&t.prototype),o.prototype.constructor=o,o.prototype.onAdd=function(t){return this._map=t,this._container=DOM.create("div",className+" "+className+"-group"),checkGeolocationSupport(this._setupUI),this._container},o.prototype.onRemove=function(){void 0!==this._geolocationWatchID&&(window.navigator.geolocation.clearWatch(this._geolocationWatchID),this._geolocationWatchID=void 0),this.options.showUserLocation&&this._userLocationDotMarker.remove(),DOM.remove(this._container),this._map=void 0},o.prototype._onSuccess=function(t){if(this.options.trackUserLocation)switch(this._lastKnownPosition=t,this._watchState){case"WAITING_ACTIVE":case"ACTIVE_LOCK":case"ACTIVE_ERROR":this._watchState="ACTIVE_LOCK",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active-error"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-active");break;case"BACKGROUND":case"BACKGROUND_ERROR":this._watchState="BACKGROUND",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-background-error"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-background")}this.options.showUserLocation&&"OFF"!==this._watchState&&this._updateMarker(t),this.options.trackUserLocation&&"ACTIVE_LOCK"!==this._watchState||this._updateCamera(t),this.options.showUserLocation&&this._dotElement.classList.remove("mapboxgl-user-location-dot-stale"),this.fire("geolocate",t),this._finish()},o.prototype._updateCamera=function(t){var o=new LngLat(t.coords.longitude,t.coords.latitude),e=t.coords.accuracy;this._map.fitBounds(o.toBounds(e),this.options.fitBoundsOptions,{geolocateSource:!0})},o.prototype._updateMarker=function(t){t?this._userLocationDotMarker.setLngLat([t.coords.longitude,t.coords.latitude]).addTo(this._map):this._userLocationDotMarker.remove()},o.prototype._onError=function(t){if(this.options.trackUserLocation)if(1===t.code)this._watchState="OFF",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active-error"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-background"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-background-error"),void 0!==this._geolocationWatchID&&this._clearWatch();else switch(this._watchState){case"WAITING_ACTIVE":this._watchState="ACTIVE_ERROR",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-active-error");break;case"ACTIVE_LOCK":this._watchState="ACTIVE_ERROR",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-active-error"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-waiting");break;case"BACKGROUND":this._watchState="BACKGROUND_ERROR",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-background"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-background-error"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-waiting")}"OFF"!==this._watchState&&this.options.showUserLocation&&this._dotElement.classList.add("mapboxgl-user-location-dot-stale"),this.fire("error",t),this._finish()},o.prototype._finish=function(){this._timeoutId&&clearTimeout(this._timeoutId),this._timeoutId=void 0},o.prototype._setupUI=function(t){var o=this;!1!==t&&(this._container.addEventListener("contextmenu",function(t){return t.preventDefault()}),this._geolocateButton=DOM.create("button",className+"-icon "+className+"-geolocate",this._container),this._geolocateButton.type="button",this._geolocateButton.setAttribute("aria-label","Geolocate"),this.options.trackUserLocation&&(this._geolocateButton.setAttribute("aria-pressed","false"),this._watchState="OFF"),this.options.showUserLocation&&(this._dotElement=DOM.create("div","mapboxgl-user-location-dot"),this._userLocationDotMarker=new Marker(this._dotElement),this.options.trackUserLocation&&(this._watchState="OFF")),this._geolocateButton.addEventListener("click",this._onClickGeolocate.bind(this)),this.options.trackUserLocation&&this._map.on("movestart",function(t){t.geolocateSource||"ACTIVE_LOCK"!==o._watchState||(o._watchState="BACKGROUND",o._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-background"),o._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active"),o.fire("trackuserlocationend"))}))},o.prototype._onClickGeolocate=function(){if(this.options.trackUserLocation){switch(this._watchState){case"OFF":this._watchState="WAITING_ACTIVE",this.fire("trackuserlocationstart");break;case"WAITING_ACTIVE":case"ACTIVE_LOCK":case"ACTIVE_ERROR":case"BACKGROUND_ERROR":this._watchState="OFF",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-active-error"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-background"),this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-background-error"),this.fire("trackuserlocationend");break;case"BACKGROUND":this._watchState="ACTIVE_LOCK",this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-background"),this._lastKnownPosition&&this._updateCamera(this._lastKnownPosition),this.fire("trackuserlocationstart")}switch(this._watchState){case"WAITING_ACTIVE":this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-active");break;case"ACTIVE_LOCK":this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-active");break;case"ACTIVE_ERROR":this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-active-error");break;case"BACKGROUND":this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-background");break;case"BACKGROUND_ERROR":this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-background-error")}"OFF"===this._watchState&&void 0!==this._geolocationWatchID?this._clearWatch():void 0===this._geolocationWatchID&&(this._geolocateButton.classList.add("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.setAttribute("aria-pressed","true"),this._geolocationWatchID=window.navigator.geolocation.watchPosition(this._onSuccess,this._onError,this.options.positionOptions))}else window.navigator.geolocation.getCurrentPosition(this._onSuccess,this._onError,this.options.positionOptions),this._timeoutId=setTimeout(this._finish,1e4)},o.prototype._clearWatch=function(){window.navigator.geolocation.clearWatch(this._geolocationWatchID),this._geolocationWatchID=void 0,this._geolocateButton.classList.remove("mapboxgl-ctrl-geolocate-waiting"),this._geolocateButton.setAttribute("aria-pressed","false"),this.options.showUserLocation&&this._updateMarker(null)},o}(Evented);module.exports=GeolocateControl;
},{"../../geo/lng_lat":58,"../../util/dom":209,"../../util/evented":210,"../../util/util":223,"../../util/window":204,"../marker":198}],185:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),LogoControl=function(){util.bindAll(["_updateLogo"],this)};LogoControl.prototype.onAdd=function(o){this._map=o,this._container=DOM.create("div","mapboxgl-ctrl");var t=DOM.create("a","mapboxgl-ctrl-logo");return t.target="_blank",t.href="https://www.mapbox.com/",t.setAttribute("aria-label","Mapbox logo"),this._container.appendChild(t),this._container.style.display="none",this._map.on("sourcedata",this._updateLogo),this._updateLogo(),this._container},LogoControl.prototype.onRemove=function(){DOM.remove(this._container),this._map.off("sourcedata",this._updateLogo)},LogoControl.prototype.getDefaultPosition=function(){return"bottom-left"},LogoControl.prototype._updateLogo=function(o){o&&"metadata"!==o.sourceDataType||(this._container.style.display=this._logoRequired()?"block":"none")},LogoControl.prototype._logoRequired=function(){if(this._map.style){var o=this._map.style.sourceCaches;for(var t in o){if(o[t].getSource().mapbox_logo)return!0}return!1}},module.exports=LogoControl;
},{"../../util/dom":209,"../../util/util":223}],186:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),DragRotateHandler=_dereq_("../handler/drag_rotate"),NavigationControl=function(){var t=this;util.bindAll(["_rotateCompassArrow"],this),this._container=DOM.create("div","mapboxgl-ctrl mapboxgl-ctrl-group"),this._container.addEventListener("contextmenu",function(t){return t.preventDefault()}),this._zoomInButton=this._createButton("mapboxgl-ctrl-icon mapboxgl-ctrl-zoom-in","Zoom In",function(){return t._map.zoomIn()}),this._zoomOutButton=this._createButton("mapboxgl-ctrl-icon mapboxgl-ctrl-zoom-out","Zoom Out",function(){return t._map.zoomOut()}),this._compass=this._createButton("mapboxgl-ctrl-icon mapboxgl-ctrl-compass","Reset North",function(){return t._map.resetNorth()}),this._compassArrow=DOM.create("span","mapboxgl-ctrl-compass-arrow",this._compass)};NavigationControl.prototype._rotateCompassArrow=function(){var t="rotate("+this._map.transform.angle*(180/Math.PI)+"deg)";this._compassArrow.style.transform=t},NavigationControl.prototype.onAdd=function(t){return this._map=t,this._map.on("rotate",this._rotateCompassArrow),this._rotateCompassArrow(),this._handler=new DragRotateHandler(t,{button:"left",element:this._compass,pitchWithRotate:!1}),this._handler.enable(),this._container},NavigationControl.prototype.onRemove=function(){DOM.remove(this._container),this._map.off("rotate",this._rotateCompassArrow),delete this._map,this._handler.disable(),delete this._handler},NavigationControl.prototype._createButton=function(t,o,r){var e=DOM.create("button",t,this._container);return e.type="button",e.setAttribute("aria-label",o),e.addEventListener("click",r),e},module.exports=NavigationControl;
},{"../../util/dom":209,"../../util/util":223,"../handler/drag_rotate":192}],187:[function(_dereq_,module,exports){
"use strict";function updateScale(t,e,o){var n=o&&o.maxWidth||100,i=t._container.clientHeight/2,a=getDistance(t.unproject([0,i]),t.unproject([n,i]));if(o&&"imperial"===o.unit){var l=3.2808*a;if(l>5280){setScale(e,n,l/5280,"mi")}else setScale(e,n,l,"ft")}else if(o&&"nautical"===o.unit){var r=a/1852;setScale(e,n,r,"nm")}else setScale(e,n,a,"m")}function setScale(t,e,o,n){var i=getRoundNum(o),a=i/o;"m"===n&&i>=1e3&&(i/=1e3,n="km"),t.style.width=e*a+"px",t.innerHTML=i+n}function getDistance(t,e){var o=Math.PI/180,n=t.lat*o,i=e.lat*o,a=Math.sin(n)*Math.sin(i)+Math.cos(n)*Math.cos(i)*Math.cos((e.lng-t.lng)*o);return 6371e3*Math.acos(Math.min(a,1))}function getRoundNum(t){var e=Math.pow(10,(""+Math.floor(t)).length-1),o=t/e;return o=o>=10?10:o>=5?5:o>=3?3:o>=2?2:1,e*o}var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),ScaleControl=function(t){this.options=t,util.bindAll(["_onMove"],this)};ScaleControl.prototype.getDefaultPosition=function(){return"bottom-left"},ScaleControl.prototype._onMove=function(){updateScale(this._map,this._container,this.options)},ScaleControl.prototype.onAdd=function(t){return this._map=t,this._container=DOM.create("div","mapboxgl-ctrl mapboxgl-ctrl-scale",t.getContainer()),this._map.on("move",this._onMove),this._onMove(),this._container},ScaleControl.prototype.onRemove=function(){DOM.remove(this._container),this._map.off("move",this._onMove),this._map=void 0},module.exports=ScaleControl;
},{"../../util/dom":209,"../../util/util":223}],188:[function(_dereq_,module,exports){
"use strict";
},{}],189:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),LngLatBounds=_dereq_("../../geo/lng_lat_bounds"),util=_dereq_("../../util/util"),window=_dereq_("../../util/window"),BoxZoomHandler=function(o){this._map=o,this._el=o.getCanvasContainer(),this._container=o.getContainer(),util.bindAll(["_onMouseDown","_onMouseMove","_onMouseUp","_onKeyDown"],this)};BoxZoomHandler.prototype.isEnabled=function(){return!!this._enabled},BoxZoomHandler.prototype.isActive=function(){return!!this._active},BoxZoomHandler.prototype.enable=function(){this.isEnabled()||(this._map.dragPan&&this._map.dragPan.disable(),this._el.addEventListener("mousedown",this._onMouseDown,!1),this._map.dragPan&&this._map.dragPan.enable(),this._enabled=!0)},BoxZoomHandler.prototype.disable=function(){this.isEnabled()&&(this._el.removeEventListener("mousedown",this._onMouseDown),this._enabled=!1)},BoxZoomHandler.prototype._onMouseDown=function(o){o.shiftKey&&0===o.button&&(window.document.addEventListener("mousemove",this._onMouseMove,!1),window.document.addEventListener("keydown",this._onKeyDown,!1),window.document.addEventListener("mouseup",this._onMouseUp,!1),DOM.disableDrag(),this._startPos=DOM.mousePos(this._el,o),this._active=!0)},BoxZoomHandler.prototype._onMouseMove=function(o){var e=this._startPos,t=DOM.mousePos(this._el,o);this._box||(this._box=DOM.create("div","mapboxgl-boxzoom",this._container),this._container.classList.add("mapboxgl-crosshair"),this._fireEvent("boxzoomstart",o));var n=Math.min(e.x,t.x),i=Math.max(e.x,t.x),s=Math.min(e.y,t.y),a=Math.max(e.y,t.y);DOM.setTransform(this._box,"translate("+n+"px,"+s+"px)"),this._box.style.width=i-n+"px",this._box.style.height=a-s+"px"},BoxZoomHandler.prototype._onMouseUp=function(o){if(0===o.button){var e=this._startPos,t=DOM.mousePos(this._el,o),n=(new LngLatBounds).extend(this._map.unproject(e)).extend(this._map.unproject(t));this._finish(),e.x===t.x&&e.y===t.y?this._fireEvent("boxzoomcancel",o):this._map.fitBounds(n,{linear:!0}).fire("boxzoomend",{originalEvent:o,boxZoomBounds:n})}},BoxZoomHandler.prototype._onKeyDown=function(o){27===o.keyCode&&(this._finish(),this._fireEvent("boxzoomcancel",o))},BoxZoomHandler.prototype._finish=function(){this._active=!1,window.document.removeEventListener("mousemove",this._onMouseMove,!1),window.document.removeEventListener("keydown",this._onKeyDown,!1),window.document.removeEventListener("mouseup",this._onMouseUp,!1),this._container.classList.remove("mapboxgl-crosshair"),this._box&&(DOM.remove(this._box),this._box=null),DOM.enableDrag()},BoxZoomHandler.prototype._fireEvent=function(o,e){return this._map.fire(o,{originalEvent:e})},module.exports=BoxZoomHandler;
},{"../../geo/lng_lat_bounds":59,"../../util/dom":209,"../../util/util":223,"../../util/window":204}],190:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../../util/util"),DoubleClickZoomHandler=function(l){this._map=l,util.bindAll(["_onDblClick"],this)};DoubleClickZoomHandler.prototype.isEnabled=function(){return!!this._enabled},DoubleClickZoomHandler.prototype.enable=function(){this.isEnabled()||(this._map.on("dblclick",this._onDblClick),this._enabled=!0)},DoubleClickZoomHandler.prototype.disable=function(){this.isEnabled()&&(this._map.off("dblclick",this._onDblClick),this._enabled=!1)},DoubleClickZoomHandler.prototype._onDblClick=function(l){this._map.zoomTo(this._map.getZoom()+(l.originalEvent.shiftKey?-1:1),{around:l.lngLat},l)},module.exports=DoubleClickZoomHandler;
},{"../../util/util":223}],191:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),window=_dereq_("../../util/window"),inertiaLinearity=.3,inertiaEasing=util.bezier(0,0,inertiaLinearity,1),inertiaMaxSpeed=1400,inertiaDeceleration=2500,DragPanHandler=function(t){this._map=t,this._el=t.getCanvasContainer(),util.bindAll(["_onDown","_onMove","_onUp","_onTouchEnd","_onMouseUp"],this)};DragPanHandler.prototype.isEnabled=function(){return!!this._enabled},DragPanHandler.prototype.isActive=function(){return!!this._active},DragPanHandler.prototype.enable=function(){this.isEnabled()||(this._el.classList.add("mapboxgl-touch-drag-pan"),this._el.addEventListener("mousedown",this._onDown),this._el.addEventListener("touchstart",this._onDown),this._enabled=!0)},DragPanHandler.prototype.disable=function(){this.isEnabled()&&(this._el.classList.remove("mapboxgl-touch-drag-pan"),this._el.removeEventListener("mousedown",this._onDown),this._el.removeEventListener("touchstart",this._onDown),this._enabled=!1)},DragPanHandler.prototype._onDown=function(t){this._ignoreEvent(t)||this.isActive()||(t.touches?(window.document.addEventListener("touchmove",this._onMove),window.document.addEventListener("touchend",this._onTouchEnd)):(window.document.addEventListener("mousemove",this._onMove),window.document.addEventListener("mouseup",this._onMouseUp)),window.addEventListener("blur",this._onMouseUp),this._active=!1,this._startPos=this._pos=DOM.mousePos(this._el,t),this._inertia=[[Date.now(),this._pos]])},DragPanHandler.prototype._onMove=function(t){if(!this._ignoreEvent(t)){this.isActive()||(this._active=!0,this._map.moving=!0,this._fireEvent("dragstart",t),this._fireEvent("movestart",t));var e=DOM.mousePos(this._el,t),n=this._map;n.stop(),this._drainInertiaBuffer(),this._inertia.push([Date.now(),e]),n.transform.setLocationAtPoint(n.transform.pointLocation(this._pos),e),this._fireEvent("drag",t),this._fireEvent("move",t),this._pos=e,t.preventDefault()}},DragPanHandler.prototype._onUp=function(t){var e=this;if(this.isActive()){this._active=!1,this._fireEvent("dragend",t),this._drainInertiaBuffer();var n=function(){e._map.moving=!1,e._fireEvent("moveend",t)},i=this._inertia;if(i.length<2)return void n();var o=i[i.length-1],r=i[0],a=o[1].sub(r[1]),s=(o[0]-r[0])/1e3;if(0===s||o[1].equals(r[1]))return void n();var u=a.mult(inertiaLinearity/s),d=u.mag();d>inertiaMaxSpeed&&(d=inertiaMaxSpeed,u._unit()._mult(d));var h=d/(inertiaDeceleration*inertiaLinearity),v=u.mult(-h/2);this._map.panBy(v,{duration:1e3*h,easing:inertiaEasing,noMoveStart:!0},{originalEvent:t})}},DragPanHandler.prototype._onMouseUp=function(t){this._ignoreEvent(t)||(this._onUp(t),window.document.removeEventListener("mousemove",this._onMove),window.document.removeEventListener("mouseup",this._onMouseUp),window.removeEventListener("blur",this._onMouseUp))},DragPanHandler.prototype._onTouchEnd=function(t){this._ignoreEvent(t)||(this._onUp(t),window.document.removeEventListener("touchmove",this._onMove),window.document.removeEventListener("touchend",this._onTouchEnd))},DragPanHandler.prototype._fireEvent=function(t,e){return this._map.fire(t,{originalEvent:e})},DragPanHandler.prototype._ignoreEvent=function(t){var e=this._map;return!(!e.boxZoom||!e.boxZoom.isActive())||(!(!e.dragRotate||!e.dragRotate.isActive())||(t.touches?t.touches.length>1:!!t.ctrlKey||"mousemove"!==t.type&&t.button&&0!==t.button))},DragPanHandler.prototype._drainInertiaBuffer=function(){for(var t=this._inertia,e=Date.now();t.length>0&&e-t[0][0]>160;)t.shift()},module.exports=DragPanHandler;
},{"../../util/dom":209,"../../util/util":223,"../../util/window":204}],192:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),window=_dereq_("../../util/window"),inertiaLinearity=.25,inertiaEasing=util.bezier(0,0,inertiaLinearity,1),inertiaMaxSpeed=180,inertiaDeceleration=720,DragRotateHandler=function(t,e){this._map=t,this._el=e.element||t.getCanvasContainer(),this._button=e.button||"right",this._bearingSnap=e.bearingSnap||0,this._pitchWithRotate=!1!==e.pitchWithRotate,util.bindAll(["_onDown","_onMove","_onUp"],this)};DragRotateHandler.prototype.isEnabled=function(){return!!this._enabled},DragRotateHandler.prototype.isActive=function(){return!!this._active},DragRotateHandler.prototype.enable=function(){this.isEnabled()||(this._el.addEventListener("mousedown",this._onDown),this._enabled=!0)},DragRotateHandler.prototype.disable=function(){this.isEnabled()&&(this._el.removeEventListener("mousedown",this._onDown),this._enabled=!1)},DragRotateHandler.prototype._onDown=function(t){if(!(this._map.boxZoom&&this._map.boxZoom.isActive()||this._map.dragPan&&this._map.dragPan.isActive()||this.isActive())){if("right"===this._button){var e=t.ctrlKey?0:2,i=t.button;if(void 0!==window.InstallTrigger&&2===t.button&&t.ctrlKey&&window.navigator.platform.toUpperCase().indexOf("MAC")>=0&&(i=0),i!==e)return}else if(t.ctrlKey||0!==t.button)return;DOM.disableDrag(),window.document.addEventListener("mousemove",this._onMove,{capture:!0}),window.document.addEventListener("mouseup",this._onUp),window.addEventListener("blur",this._onUp),this._active=!1,this._inertia=[[Date.now(),this._map.getBearing()]],this._startPos=this._pos=DOM.mousePos(this._el,t),this._center=this._map.transform.centerPoint,t.preventDefault()}},DragRotateHandler.prototype._onMove=function(t){this.isActive()||(this._active=!0,this._map.moving=!0,this._fireEvent("rotatestart",t),this._fireEvent("movestart",t),this._pitchWithRotate&&this._fireEvent("pitchstart",t));var e=this._map;e.stop();var i=this._pos,n=DOM.mousePos(this._el,t),r=.8*(i.x-n.x),a=-.5*(i.y-n.y),o=e.getBearing()-r,s=e.getPitch()-a,h=this._inertia,_=h[h.length-1];this._drainInertiaBuffer(),h.push([Date.now(),e._normalizeBearing(o,_[1])]),e.transform.bearing=o,this._pitchWithRotate&&(this._fireEvent("pitch",t),e.transform.pitch=s),this._fireEvent("rotate",t),this._fireEvent("move",t),this._pos=n},DragRotateHandler.prototype._onUp=function(t){var e=this;if(window.document.removeEventListener("mousemove",this._onMove,{capture:!0}),window.document.removeEventListener("mouseup",this._onUp),window.removeEventListener("blur",this._onUp),DOM.enableDrag(),this.isActive()){this._active=!1,this._fireEvent("rotateend",t),this._drainInertiaBuffer();var i=this._map,n=i.getBearing(),r=this._inertia,a=function(){Math.abs(n)<e._bearingSnap?i.resetNorth({noMoveStart:!0},{originalEvent:t}):(e._map.moving=!1,e._fireEvent("moveend",t)),e._pitchWithRotate&&e._fireEvent("pitchend",t)};if(r.length<2)return void a();var o=r[0],s=r[r.length-1],h=r[r.length-2],_=i._normalizeBearing(n,h[1]),p=s[1]-o[1],v=p<0?-1:1,d=(s[0]-o[0])/1e3;if(0===p||0===d)return void a();var l=Math.abs(p*(inertiaLinearity/d));l>inertiaMaxSpeed&&(l=inertiaMaxSpeed);var u=l/(inertiaDeceleration*inertiaLinearity);_+=v*l*(u/2),Math.abs(i._normalizeBearing(_,0))<this._bearingSnap&&(_=i._normalizeBearing(0,_)),i.rotateTo(_,{duration:1e3*u,easing:inertiaEasing,noMoveStart:!0},{originalEvent:t})}},DragRotateHandler.prototype._fireEvent=function(t,e){return this._map.fire(t,{originalEvent:e})},DragRotateHandler.prototype._drainInertiaBuffer=function(){for(var t=this._inertia,e=Date.now();t.length>0&&e-t[0][0]>160;)t.shift()},module.exports=DragRotateHandler;
},{"../../util/dom":209,"../../util/util":223,"../../util/window":204}],193:[function(_dereq_,module,exports){
"use strict";function easeOut(e){return e*(2-e)}var util=_dereq_("../../util/util"),panStep=100,bearingStep=15,pitchStep=10,KeyboardHandler=function(e){this._map=e,this._el=e.getCanvasContainer(),util.bindAll(["_onKeyDown"],this)};KeyboardHandler.prototype.isEnabled=function(){return!!this._enabled},KeyboardHandler.prototype.enable=function(){this.isEnabled()||(this._el.addEventListener("keydown",this._onKeyDown,!1),this._enabled=!0)},KeyboardHandler.prototype.disable=function(){this.isEnabled()&&(this._el.removeEventListener("keydown",this._onKeyDown),this._enabled=!1)},KeyboardHandler.prototype._onKeyDown=function(e){if(!(e.altKey||e.ctrlKey||e.metaKey)){var t=0,a=0,n=0,r=0,i=0;switch(e.keyCode){case 61:case 107:case 171:case 187:t=1;break;case 189:case 109:case 173:t=-1;break;case 37:e.shiftKey?a=-1:(e.preventDefault(),r=-1);break;case 39:e.shiftKey?a=1:(e.preventDefault(),r=1);break;case 38:e.shiftKey?n=1:(e.preventDefault(),i=-1);break;case 40:e.shiftKey?n=-1:(i=1,e.preventDefault());break;default:return}var s=this._map,o=s.getZoom(),l={duration:300,delayEndEvents:500,easing:easeOut,zoom:t?Math.round(o)+t*(e.shiftKey?2:1):o,bearing:s.getBearing()+a*bearingStep,pitch:s.getPitch()+n*pitchStep,offset:[-r*panStep,-i*panStep],center:s.getCenter()};s.easeTo(l,{originalEvent:e})}},module.exports=KeyboardHandler;
},{"../../util/util":223}],194:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),browser=_dereq_("../../util/browser"),window=_dereq_("../../util/window"),ua=window.navigator.userAgent.toLowerCase(),firefox=-1!==ua.indexOf("firefox"),safari=-1!==ua.indexOf("safari")&&-1===ua.indexOf("chrom"),ScrollZoomHandler=function(e){this._map=e,this._el=e.getCanvasContainer(),util.bindAll(["_onWheel","_onTimeout"],this)};ScrollZoomHandler.prototype.isEnabled=function(){return!!this._enabled},ScrollZoomHandler.prototype.enable=function(e){this.isEnabled()||(this._el.addEventListener("wheel",this._onWheel,!1),this._el.addEventListener("mousewheel",this._onWheel,!1),this._enabled=!0,this._aroundCenter=e&&"center"===e.around)},ScrollZoomHandler.prototype.disable=function(){this.isEnabled()&&(this._el.removeEventListener("wheel",this._onWheel),this._el.removeEventListener("mousewheel",this._onWheel),this._enabled=!1)},ScrollZoomHandler.prototype._onWheel=function(e){var t=0;"wheel"===e.type?(t=e.deltaY,firefox&&e.deltaMode===window.WheelEvent.DOM_DELTA_PIXEL&&(t/=browser.devicePixelRatio),e.deltaMode===window.WheelEvent.DOM_DELTA_LINE&&(t*=40)):"mousewheel"===e.type&&(t=-e.wheelDeltaY,safari&&(t/=3));var o=browser.now(),i=o-(this._time||0);this._pos=DOM.mousePos(this._el,e),this._time=o,0!==t&&t%4.000244140625==0?this._type="wheel":0!==t&&Math.abs(t)<4?this._type="trackpad":i>400?(this._type=null,this._lastValue=t,this._timeout=setTimeout(this._onTimeout,40)):this._type||(this._type=Math.abs(i*t)<200?"trackpad":"wheel",this._timeout&&(clearTimeout(this._timeout),this._timeout=null,t+=this._lastValue)),e.shiftKey&&t&&(t/=4),this._type&&this._zoom(-t,e),e.preventDefault()},ScrollZoomHandler.prototype._onTimeout=function(){this._type="wheel",this._zoom(-this._lastValue)},ScrollZoomHandler.prototype._zoom=function(e,t){if(0!==e){var o=this._map,i=2/(1+Math.exp(-Math.abs(e/100)));e<0&&0!==i&&(i=1/i);var l=o.ease?o.ease.to:o.transform.scale,s=o.transform.scaleZoom(l*i);o.zoomTo(s,{duration:"wheel"===this._type?200:0,around:this._aroundCenter?o.getCenter():o.unproject(this._pos),delayEndEvents:200,smoothEasing:!0},{originalEvent:t})}},module.exports=ScrollZoomHandler;
},{"../../util/browser":202,"../../util/dom":209,"../../util/util":223,"../../util/window":204}],195:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../../util/dom"),util=_dereq_("../../util/util"),window=_dereq_("../../util/window"),inertiaLinearity=.15,inertiaEasing=util.bezier(0,0,inertiaLinearity,1),inertiaDeceleration=12,inertiaMaxSpeed=2.5,significantScaleThreshold=.15,significantRotateThreshold=10,TouchZoomRotateHandler=function(t){this._map=t,this._el=t.getCanvasContainer(),util.bindAll(["_onStart","_onMove","_onEnd"],this)};TouchZoomRotateHandler.prototype.isEnabled=function(){return!!this._enabled},TouchZoomRotateHandler.prototype.enable=function(t){this.isEnabled()||(this._el.classList.add("mapboxgl-touch-zoom-rotate"),this._el.addEventListener("touchstart",this._onStart,!1),this._enabled=!0,this._aroundCenter=t&&"center"===t.around)},TouchZoomRotateHandler.prototype.disable=function(){this.isEnabled()&&(this._el.classList.remove("mapboxgl-touch-zoom-rotate"),this._el.removeEventListener("touchstart",this._onStart),this._enabled=!1)},TouchZoomRotateHandler.prototype.disableRotation=function(){this._rotationDisabled=!0},TouchZoomRotateHandler.prototype.enableRotation=function(){this._rotationDisabled=!1},TouchZoomRotateHandler.prototype._onStart=function(t){if(2===t.touches.length){var e=DOM.mousePos(this._el,t.touches[0]),o=DOM.mousePos(this._el,t.touches[1]);this._startVec=e.sub(o),this._startScale=this._map.transform.scale,this._startBearing=this._map.transform.bearing,this._gestureIntent=void 0,this._inertia=[],window.document.addEventListener("touchmove",this._onMove,!1),window.document.addEventListener("touchend",this._onEnd,!1)}},TouchZoomRotateHandler.prototype._onMove=function(t){if(2===t.touches.length){var e=DOM.mousePos(this._el,t.touches[0]),o=DOM.mousePos(this._el,t.touches[1]),i=e.add(o).div(2),n=e.sub(o),a=n.mag()/this._startVec.mag(),r=this._rotationDisabled?0:180*n.angleWith(this._startVec)/Math.PI,s=this._map;if(this._gestureIntent){var h={duration:0,around:s.unproject(i)};"rotate"===this._gestureIntent&&(h.bearing=this._startBearing+r),"zoom"!==this._gestureIntent&&"rotate"!==this._gestureIntent||(h.zoom=s.transform.scaleZoom(this._startScale*a)),s.stop(),this._drainInertiaBuffer(),this._inertia.push([Date.now(),a,i]),s.easeTo(h,{originalEvent:t})}else{var u=Math.abs(1-a)>significantScaleThreshold;Math.abs(r)>significantRotateThreshold?this._gestureIntent="rotate":u&&(this._gestureIntent="zoom"),this._gestureIntent&&(this._startVec=n,this._startScale=s.transform.scale,this._startBearing=s.transform.bearing)}t.preventDefault()}},TouchZoomRotateHandler.prototype._onEnd=function(t){window.document.removeEventListener("touchmove",this._onMove),window.document.removeEventListener("touchend",this._onEnd),this._drainInertiaBuffer();var e=this._inertia,o=this._map;if(e.length<2)return void o.snapToNorth({},{originalEvent:t});var i=e[e.length-1],n=e[0],a=o.transform.scaleZoom(this._startScale*i[1]),r=o.transform.scaleZoom(this._startScale*n[1]),s=a-r,h=(i[0]-n[0])/1e3,u=i[2];if(0===h||a===r)return void o.snapToNorth({},{originalEvent:t});var l=s*inertiaLinearity/h;Math.abs(l)>inertiaMaxSpeed&&(l=l>0?inertiaMaxSpeed:-inertiaMaxSpeed);var d=1e3*Math.abs(l/(inertiaDeceleration*inertiaLinearity)),c=a+l*d/2e3;c<0&&(c=0),o.easeTo({zoom:c,duration:d,easing:inertiaEasing,around:this._aroundCenter?o.getCenter():o.unproject(u)},{originalEvent:t})},TouchZoomRotateHandler.prototype._drainInertiaBuffer=function(){for(var t=this._inertia,e=Date.now();t.length>2&&e-t[0][0]>160;)t.shift()},module.exports=TouchZoomRotateHandler;
},{"../../util/dom":209,"../../util/util":223,"../../util/window":204}],196:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("../util/util"),window=_dereq_("../util/window"),Hash=function(){util.bindAll(["_onHashChange","_updateHash"],this)};Hash.prototype.addTo=function(t){return this._map=t,window.addEventListener("hashchange",this._onHashChange,!1),this._map.on("moveend",this._updateHash),this},Hash.prototype.remove=function(){return window.removeEventListener("hashchange",this._onHashChange,!1),this._map.off("moveend",this._updateHash),delete this._map,this},Hash.prototype.getHashString=function(t){var a=this._map.getCenter(),h=Math.round(100*this._map.getZoom())/100,e=Math.max(0,Math.ceil(Math.log(h)/Math.LN2)),n=Math.round(a.lng*Math.pow(10,e))/Math.pow(10,e),o=Math.round(a.lat*Math.pow(10,e))/Math.pow(10,e),i=this._map.getBearing(),s=this._map.getPitch(),r="";return r+=t?"#/"+n+"/"+o+"/"+h:"#"+h+"/"+o+"/"+n,(i||s)&&(r+="/"+Math.round(10*i)/10),s&&(r+="/"+Math.round(s)),r},Hash.prototype._onHashChange=function(){var t=window.location.hash.replace("#","").split("/");return t.length>=3&&(this._map.jumpTo({center:[+t[2],+t[1]],zoom:+t[0],bearing:+(t[3]||0),pitch:+(t[4]||0)}),!0)},Hash.prototype._updateHash=function(){var t=this.getHashString();window.history.replaceState("","",t)},module.exports=Hash;
},{"../util/util":223,"../util/window":204}],197:[function(_dereq_,module,exports){
"use strict";function removeNode(t){t.parentNode&&t.parentNode.removeChild(t)}var util=_dereq_("../util/util"),browser=_dereq_("../util/browser"),window=_dereq_("../util/window"),ref=_dereq_("../util/window"),HTMLImageElement=ref.HTMLImageElement,DOM=_dereq_("../util/dom"),ajax=_dereq_("../util/ajax"),Style=_dereq_("../style/style"),AnimationLoop=_dereq_("../style/animation_loop"),Painter=_dereq_("../render/painter"),Transform=_dereq_("../geo/transform"),Hash=_dereq_("./hash"),bindHandlers=_dereq_("./bind_handlers"),Camera=_dereq_("./camera"),LngLat=_dereq_("../geo/lng_lat"),LngLatBounds=_dereq_("../geo/lng_lat_bounds"),Point=_dereq_("@mapbox/point-geometry"),AttributionControl=_dereq_("./control/attribution_control"),LogoControl=_dereq_("./control/logo_control"),isSupported=_dereq_("mapbox-gl-supported");_dereq_("./events");var defaultMinZoom=0,defaultMaxZoom=22,defaultOptions={center:[0,0],zoom:0,bearing:0,pitch:0,minZoom:defaultMinZoom,maxZoom:defaultMaxZoom,interactive:!0,scrollZoom:!0,boxZoom:!0,dragRotate:!0,dragPan:!0,keyboard:!0,doubleClickZoom:!0,touchZoomRotate:!0,bearingSnap:7,hash:!1,attributionControl:!0,failIfMajorPerformanceCaveat:!1,preserveDrawingBuffer:!1,trackResize:!0,renderWorldCopies:!0,refreshExpiredTiles:!0,maxTileCacheSize:null,transformRequest:null},Map=function(t){function e(e){var o=this;if(e=util.extend({},defaultOptions,e),null!=e.minZoom&&null!=e.maxZoom&&e.minZoom>e.maxZoom)throw new Error("maxZoom must be greater than minZoom");var r=new Transform(e.minZoom,e.maxZoom,e.renderWorldCopies);t.call(this,r,e),this._interactive=e.interactive,this._maxTileCacheSize=e.maxTileCacheSize,this._failIfMajorPerformanceCaveat=e.failIfMajorPerformanceCaveat,this._preserveDrawingBuffer=e.preserveDrawingBuffer,this._trackResize=e.trackResize,this._bearingSnap=e.bearingSnap,this._refreshExpiredTiles=e.refreshExpiredTiles;var i=e.transformRequest;if(this._transformRequest=i?function(t,e){return i(t,e)||{url:t}}:function(t){return{url:t}},"string"==typeof e.container){var s=window.document.getElementById(e.container);if(!s)throw new Error("Container '"+e.container+"' not found.");this._container=s}else this._container=e.container;this.animationLoop=new AnimationLoop,e.maxBounds&&this.setMaxBounds(e.maxBounds),util.bindAll(["_onWindowOnline","_onWindowResize","_contextLost","_contextRestored","_update","_render","_onData","_onDataLoading"],this),this._setupContainer(),this._setupPainter(),this.on("move",this._update.bind(this,!1)),this.on("zoom",this._update.bind(this,!0)),this.on("moveend",function(){o.animationLoop.set(300),o._rerender()}),void 0!==window&&(window.addEventListener("online",this._onWindowOnline,!1),window.addEventListener("resize",this._onWindowResize,!1)),bindHandlers(this,e),this._hash=e.hash&&(new Hash).addTo(this),this._hash&&this._hash._onHashChange()||this.jumpTo({center:e.center,zoom:e.zoom,bearing:e.bearing,pitch:e.pitch}),this._classes=[],this.resize(),e.classes&&this.setClasses(e.classes),e.style&&this.setStyle(e.style,{localIdeographFontFamily:e.localIdeographFontFamily}),e.attributionControl&&this.addControl(new AttributionControl),this.addControl(new LogoControl,e.logoPosition),this.on("style.load",function(){this.transform.unmodified&&this.jumpTo(this.style.stylesheet),this.style.update(this._classes,{transition:!1})}),this.on("data",this._onData),this.on("dataloading",this._onDataLoading)}t&&(e.__proto__=t),e.prototype=Object.create(t&&t.prototype),e.prototype.constructor=e;var o={showTileBoundaries:{},showCollisionBoxes:{},showOverdrawInspector:{},repaint:{},vertices:{}};return e.prototype.addControl=function(t,e){void 0===e&&t.getDefaultPosition&&(e=t.getDefaultPosition()),void 0===e&&(e="top-right");var o=t.onAdd(this),r=this._controlPositions[e];return-1!==e.indexOf("bottom")?r.insertBefore(o,r.firstChild):r.appendChild(o),this},e.prototype.removeControl=function(t){return t.onRemove(this),this},e.prototype.addClass=function(t,e){return util.warnOnce("Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS."),this._classes.indexOf(t)>=0||""===t?this:(this._classes.push(t),this._classOptions=e,this.style&&this.style.updateClasses(),this._update(!0))},e.prototype.removeClass=function(t,e){util.warnOnce("Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.");var o=this._classes.indexOf(t);return o<0||""===t?this:(this._classes.splice(o,1),this._classOptions=e,this.style&&this.style.updateClasses(),this._update(!0))},e.prototype.setClasses=function(t,e){util.warnOnce("Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS.");for(var o={},r=0;r<t.length;r++)""!==t[r]&&(o[t[r]]=!0);return this._classes=Object.keys(o),this._classOptions=e,this.style&&this.style.updateClasses(),this._update(!0)},e.prototype.hasClass=function(t){return util.warnOnce("Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS."),this._classes.indexOf(t)>=0},e.prototype.getClasses=function(){return util.warnOnce("Style classes are deprecated and will be removed in an upcoming release of Mapbox GL JS."),this._classes},e.prototype.resize=function(){var t=this._containerDimensions(),e=t[0],o=t[1];return this._resizeCanvas(e,o),this.transform.resize(e,o),this.painter.resize(e,o),this.fire("movestart").fire("move").fire("resize").fire("moveend")},e.prototype.getBounds=function(){var t=new LngLatBounds(this.transform.pointLocation(new Point(0,this.transform.height)),this.transform.pointLocation(new Point(this.transform.width,0)));return(this.transform.angle||this.transform.pitch)&&(t.extend(this.transform.pointLocation(new Point(this.transform.size.x,0))),t.extend(this.transform.pointLocation(new Point(0,this.transform.size.y)))),t},e.prototype.getMaxBounds=function(){return this.transform.latRange&&2===this.transform.latRange.length&&this.transform.lngRange&&2===this.transform.lngRange.length?new LngLatBounds([this.transform.lngRange[0],this.transform.latRange[0]],[this.transform.lngRange[1],this.transform.latRange[1]]):null},e.prototype.setMaxBounds=function(t){if(t){var e=LngLatBounds.convert(t);this.transform.lngRange=[e.getWest(),e.getEast()],this.transform.latRange=[e.getSouth(),e.getNorth()],this.transform._constrain(),this._update()}else null!==t&&void 0!==t||(this.transform.lngRange=null,this.transform.latRange=null,this._update());return this},e.prototype.setMinZoom=function(t){if((t=null===t||void 0===t?defaultMinZoom:t)>=defaultMinZoom&&t<=this.transform.maxZoom)return this.transform.minZoom=t,this._update(),this.getZoom()<t&&this.setZoom(t),this;throw new Error("minZoom must be between "+defaultMinZoom+" and the current maxZoom, inclusive")},e.prototype.getMinZoom=function(){return this.transform.minZoom},e.prototype.setMaxZoom=function(t){if((t=null===t||void 0===t?defaultMaxZoom:t)>=this.transform.minZoom)return this.transform.maxZoom=t,this._update(),this.getZoom()>t&&this.setZoom(t),this;throw new Error("maxZoom must be greater than the current minZoom")},e.prototype.getMaxZoom=function(){return this.transform.maxZoom},e.prototype.project=function(t){return this.transform.locationPoint(LngLat.convert(t))},e.prototype.unproject=function(t){return this.transform.pointLocation(Point.convert(t))},e.prototype.on=function(e,o,r){var i=this;if(void 0===r)return t.prototype.on.call(this,e,o);var s=function(){if("mouseenter"===e||"mouseover"===e){var t=!1;return{layer:o,listener:r,delegates:{mousemove:function(s){var n=i.getLayer(o)?i.queryRenderedFeatures(s.point,{layers:[o]}):[];n.length?t||(t=!0,r.call(i,util.extend({features:n},s,{type:e}))):t=!1},mouseout:function(){t=!1}}}}if("mouseleave"===e||"mouseout"===e){var s=!1;return{layer:o,listener:r,delegates:{mousemove:function(t){(i.getLayer(o)?i.queryRenderedFeatures(t.point,{layers:[o]}):[]).length?s=!0:s&&(s=!1,r.call(i,util.extend({},t,{type:e})))},mouseout:function(t){s&&(s=!1,r.call(i,util.extend({},t,{type:e})))}}}}var n=function(t){var e=i.getLayer(o)?i.queryRenderedFeatures(t.point,{layers:[o]}):[];e.length&&r.call(i,util.extend({features:e},t))};return{layer:o,listener:r,delegates:(a={},a[e]=n,a)};var a}();this._delegatedListeners=this._delegatedListeners||{},this._delegatedListeners[e]=this._delegatedListeners[e]||[],this._delegatedListeners[e].push(s);for(var n in s.delegates)i.on(n,s.delegates[n]);return this},e.prototype.off=function(e,o,r){var i=this;if(void 0===r)return t.prototype.off.call(this,e,o);if(this._delegatedListeners&&this._delegatedListeners[e])for(var s=this._delegatedListeners[e],n=0;n<s.length;n++){var a=s[n];if(a.layer===o&&a.listener===r){for(var h in a.delegates)i.off(h,a.delegates[h]);return s.splice(n,1),i}}return this},e.prototype.queryRenderedFeatures=function(){for(var t=[],e=arguments.length;e--;)t[e]=arguments[e];var o,r={};return 2===t.length?(o=arguments[0],r=arguments[1]):1===t.length&&function(t){return t instanceof Point||Array.isArray(t)}(t[0])?o=t[0]:1===t.length&&(r=t[0]),this.style?this.style.queryRenderedFeatures(this._makeQueryGeometry(o),r,this.transform.zoom,this.transform.angle):[]},e.prototype._makeQueryGeometry=function(t){var e=this;void 0===t&&(t=[Point.convert([0,0]),Point.convert([this.transform.width,this.transform.height])]);var o;if(t instanceof Point||"number"==typeof t[0]){o=[Point.convert(t)]}else{var r=[Point.convert(t[0]),Point.convert(t[1])];o=[r[0],new Point(r[1].x,r[0].y),r[1],new Point(r[0].x,r[1].y),r[0]]}return o=o.map(function(t){return e.transform.pointCoordinate(t)})},e.prototype.querySourceFeatures=function(t,e){return this.style.querySourceFeatures(t,e)},e.prototype.setStyle=function(t,e){if((!e||!1!==e.diff&&!e.localIdeographFontFamily)&&this.style&&t&&!(t instanceof Style)&&"string"!=typeof t)try{return this.style.setState(t)&&this._update(!0),this}catch(t){util.warnOnce("Unable to perform style diff: "+(t.message||t.error||t)+".  Rebuilding the style from scratch.")}return this.style&&(this.style.setEventedParent(null),this.style._remove(),this.off("rotate",this.style._redoPlacement),this.off("pitch",this.style._redoPlacement),this.off("move",this.style._redoPlacement)),t?(this.style=t instanceof Style?t:new Style(t,this,e||{}),this.style.setEventedParent(this,{style:this.style}),this.on("rotate",this.style._redoPlacement),this.on("pitch",this.style._redoPlacement),this.on("move",this.style._redoPlacement),this):(this.style=null,this)},e.prototype.getStyle=function(){if(this.style)return this.style.serialize()},e.prototype.isStyleLoaded=function(){return this.style?this.style.loaded():util.warnOnce("There is no style added to the map.")},e.prototype.addSource=function(t,e){return this.style.addSource(t,e),this._update(!0),this},e.prototype.isSourceLoaded=function(t){var e=this.style&&this.style.sourceCaches[t];return void 0===e?void this.fire("error",{error:new Error("There is no source with ID '"+t+"'")}):e.loaded()},e.prototype.areTilesLoaded=function(){var t=this.style&&this.style.sourceCaches;for(var e in t){var o=t[e],r=o._tiles;for(var i in r){var s=r[i];if("loaded"!==s.state&&"errored"!==s.state)return!1}}return!0},e.prototype.addSourceType=function(t,e,o){return this.style.addSourceType(t,e,o)},e.prototype.removeSource=function(t){return this.style.removeSource(t),this._update(!0),this},e.prototype.getSource=function(t){return this.style.getSource(t)},e.prototype.addImage=function(t,e,o){void 0===o&&(o={});var r=o.pixelRatio;void 0===r&&(r=1);var i=o.sdf;if(void 0===i&&(i=!1),e instanceof HTMLImageElement)e=browser.getImageData(e);else if(void 0===e.width||void 0===e.height)return this.fire("error",{error:new Error("Invalid arguments to map.addImage(). The second argument must be an `HTMLImageElement`, `ImageData`, or object with `width`, `height`, and `data` properties with the same format as `ImageData`")});this.style.addImage(t,{data:e,pixelRatio:r,sdf:i})},e.prototype.removeImage=function(t){this.style.removeImage(t)},e.prototype.loadImage=function(t,e){ajax.getImage(this._transformRequest(t,ajax.ResourceType.Image),e)},e.prototype.addLayer=function(t,e){return this.style.addLayer(t,e),this._update(!0),this},e.prototype.moveLayer=function(t,e){return this.style.moveLayer(t,e),this._update(!0),this},e.prototype.removeLayer=function(t){return this.style.removeLayer(t),this._update(!0),this},e.prototype.getLayer=function(t){return this.style.getLayer(t)},e.prototype.setFilter=function(t,e){return this.style.setFilter(t,e),this._update(!0),this},e.prototype.setLayerZoomRange=function(t,e,o){return this.style.setLayerZoomRange(t,e,o),this._update(!0),this},e.prototype.getFilter=function(t){return this.style.getFilter(t)},e.prototype.setPaintProperty=function(t,e,o,r){return this.style.setPaintProperty(t,e,o,r),this._update(!0),this},e.prototype.getPaintProperty=function(t,e,o){return this.style.getPaintProperty(t,e,o)},e.prototype.setLayoutProperty=function(t,e,o){return this.style.setLayoutProperty(t,e,o),this._update(!0),this},e.prototype.getLayoutProperty=function(t,e){return this.style.getLayoutProperty(t,e)},e.prototype.setLight=function(t){return this.style.setLight(t),this._update(!0),this},e.prototype.getLight=function(){return this.style.getLight()},e.prototype.getContainer=function(){return this._container},e.prototype.getCanvasContainer=function(){return this._canvasContainer},e.prototype.getCanvas=function(){return this._canvas},e.prototype._containerDimensions=function(){var t=0,e=0;return this._container&&(t=this._container.offsetWidth||400,e=this._container.offsetHeight||300),[t,e]},e.prototype._setupContainer=function(){var t=this._container;t.classList.add("mapboxgl-map");var e=this._canvasContainer=DOM.create("div","mapboxgl-canvas-container",t);this._interactive&&e.classList.add("mapboxgl-interactive"),this._canvas=DOM.create("canvas","mapboxgl-canvas",e),this._canvas.style.position="absolute",this._canvas.addEventListener("webglcontextlost",this._contextLost,!1),this._canvas.addEventListener("webglcontextrestored",this._contextRestored,!1),this._canvas.setAttribute("tabindex","0"),this._canvas.setAttribute("aria-label","Map");var o=this._containerDimensions();this._resizeCanvas(o[0],o[1]);var r=this._controlContainer=DOM.create("div","mapboxgl-control-container",t),i=this._controlPositions={};["top-left","top-right","bottom-left","bottom-right"].forEach(function(t){i[t]=DOM.create("div","mapboxgl-ctrl-"+t,r)})},e.prototype._resizeCanvas=function(t,e){var o=window.devicePixelRatio||1;this._canvas.width=o*t,this._canvas.height=o*e,this._canvas.style.width=t+"px",this._canvas.style.height=e+"px"},e.prototype._setupPainter=function(){var t=util.extend({failIfMajorPerformanceCaveat:this._failIfMajorPerformanceCaveat,preserveDrawingBuffer:this._preserveDrawingBuffer},isSupported.webGLContextAttributes),e=this._canvas.getContext("webgl",t)||this._canvas.getContext("experimental-webgl",t);if(!e)return void this.fire("error",{error:new Error("Failed to initialize WebGL")});this.painter=new Painter(e,this.transform)},e.prototype._contextLost=function(t){t.preventDefault(),this._frameId&&(browser.cancelFrame(this._frameId),this._frameId=null),this.fire("webglcontextlost",{originalEvent:t})},e.prototype._contextRestored=function(t){this._setupPainter(),this.resize(),this._update(),this.fire("webglcontextrestored",{originalEvent:t})},e.prototype.loaded=function(){return!this._styleDirty&&!this._sourcesDirty&&!(!this.style||!this.style.loaded())},e.prototype._update=function(t){return this.style?(this._styleDirty=this._styleDirty||t,this._sourcesDirty=!0,this._rerender(),this):this},e.prototype._render=function(){return this.style&&this._styleDirty&&(this._styleDirty=!1,this.style.update(this._classes,this._classOptions),this._classOptions=null,this.style._recalculate(this.transform.zoom)),this.style&&this._sourcesDirty&&(this._sourcesDirty=!1,this.style._updateSources(this.transform)),this.painter.render(this.style,{showTileBoundaries:this.showTileBoundaries,showOverdrawInspector:this._showOverdrawInspector,rotating:this.rotating,zooming:this.zooming}),this.fire("render"),this.loaded()&&!this._loaded&&(this._loaded=!0,this.fire("load")),this._frameId=null,this.animationLoop.stopped()||(this._styleDirty=!0),(this._sourcesDirty||this._repaint||this._styleDirty)&&this._rerender(),this},e.prototype.remove=function(){this._hash&&this._hash.remove(),browser.cancelFrame(this._frameId),this._frameId=null,this.setStyle(null),void 0!==window&&(window.removeEventListener("resize",this._onWindowResize,!1),window.removeEventListener("online",this._onWindowOnline,!1));var t=this.painter.gl.getExtension("WEBGL_lose_context");t&&t.loseContext(),removeNode(this._canvasContainer),removeNode(this._controlContainer),this._container.classList.remove("mapboxgl-map"),this.fire("remove")},e.prototype._rerender=function(){this.style&&!this._frameId&&(this._frameId=browser.frame(this._render))},e.prototype._onWindowOnline=function(){this._update()},e.prototype._onWindowResize=function(){this._trackResize&&this.stop().resize()._update()},o.showTileBoundaries.get=function(){return!!this._showTileBoundaries},o.showTileBoundaries.set=function(t){this._showTileBoundaries!==t&&(this._showTileBoundaries=t,this._update())},o.showCollisionBoxes.get=function(){return!!this._showCollisionBoxes},o.showCollisionBoxes.set=function(t){this._showCollisionBoxes!==t&&(this._showCollisionBoxes=t,this.style._redoPlacement())},o.showOverdrawInspector.get=function(){return!!this._showOverdrawInspector},o.showOverdrawInspector.set=function(t){this._showOverdrawInspector!==t&&(this._showOverdrawInspector=t,this._update())},o.repaint.get=function(){return!!this._repaint},o.repaint.set=function(t){this._repaint=t,this._update()},o.vertices.get=function(){return!!this._vertices},o.vertices.set=function(t){this._vertices=t,this._update()},e.prototype._onData=function(t){this._update("style"===t.dataType),this.fire(t.dataType+"data",t)},e.prototype._onDataLoading=function(t){this.fire(t.dataType+"dataloading",t)},Object.defineProperties(e.prototype,o),e}(Camera);module.exports=Map;
},{"../geo/lng_lat":58,"../geo/lng_lat_bounds":59,"../geo/transform":60,"../render/painter":79,"../style/animation_loop":150,"../style/style":156,"../util/ajax":201,"../util/browser":202,"../util/dom":209,"../util/util":223,"../util/window":204,"./bind_handlers":180,"./camera":181,"./control/attribution_control":182,"./control/logo_control":185,"./events":188,"./hash":196,"@mapbox/point-geometry":2,"mapbox-gl-supported":28}],198:[function(_dereq_,module,exports){
"use strict";var DOM=_dereq_("../util/dom"),LngLat=_dereq_("../geo/lng_lat"),Point=_dereq_("@mapbox/point-geometry"),smartWrap=_dereq_("../util/smart_wrap"),ref=_dereq_("../util/util"),bindAll=ref.bindAll,Marker=function(t,e){this._offset=Point.convert(e&&e.offset||[0,0]),bindAll(["_update","_onMapClick"],this),t||(t=DOM.create("div")),t.classList.add("mapboxgl-marker"),this._element=t,this._popup=null};Marker.prototype.addTo=function(t){return this.remove(),this._map=t,t.getCanvasContainer().appendChild(this._element),t.on("move",this._update),t.on("moveend",this._update),this._update(),this._map.on("click",this._onMapClick),this},Marker.prototype.remove=function(){return this._map&&(this._map.off("click",this._onMapClick),this._map.off("move",this._update),this._map.off("moveend",this._update),delete this._map),DOM.remove(this._element),this._popup&&this._popup.remove(),this},Marker.prototype.getLngLat=function(){return this._lngLat},Marker.prototype.setLngLat=function(t){return this._lngLat=LngLat.convert(t),this._pos=null,this._popup&&this._popup.setLngLat(this._lngLat),this._update(),this},Marker.prototype.getElement=function(){return this._element},Marker.prototype.setPopup=function(t){return this._popup&&(this._popup.remove(),this._popup=null),t&&("offset"in t.options||(t.options.offset=this._offset),this._popup=t,this._popup.setLngLat(this._lngLat)),this},Marker.prototype._onMapClick=function(t){var e=t.originalEvent.target,p=this._element;this._popup&&(e===p||p.contains(e))&&this.togglePopup()},Marker.prototype.getPopup=function(){return this._popup},Marker.prototype.togglePopup=function(){var t=this._popup;return t?(t.isOpen()?t.remove():t.addTo(this._map),this):this},Marker.prototype._update=function(t){this._map&&(this._map.transform.renderWorldCopies&&(this._lngLat=smartWrap(this._lngLat,this._pos,this._map.transform)),this._pos=this._map.project(this._lngLat)._add(this._offset),t&&"moveend"!==t.type||(this._pos=this._pos.round()),DOM.setTransform(this._element,"translate(-50%, -50%) translate("+this._pos.x+"px, "+this._pos.y+"px)"))},module.exports=Marker;
},{"../geo/lng_lat":58,"../util/dom":209,"../util/smart_wrap":219,"../util/util":223,"@mapbox/point-geometry":2}],199:[function(_dereq_,module,exports){
"use strict";function normalizeOffset(t){if(t){if("number"==typeof t){var o=Math.round(Math.sqrt(.5*Math.pow(t,2)));return{top:new Point(0,t),"top-left":new Point(o,o),"top-right":new Point(-o,o),bottom:new Point(0,-t),"bottom-left":new Point(o,-o),"bottom-right":new Point(-o,-o),left:new Point(t,0),right:new Point(-t,0)}}if(t instanceof Point||Array.isArray(t)){var e=Point.convert(t);return{top:e,"top-left":e,"top-right":e,bottom:e,"bottom-left":e,"bottom-right":e,left:e,right:e}}return{top:Point.convert(t.top||[0,0]),"top-left":Point.convert(t["top-left"]||[0,0]),"top-right":Point.convert(t["top-right"]||[0,0]),bottom:Point.convert(t.bottom||[0,0]),"bottom-left":Point.convert(t["bottom-left"]||[0,0]),"bottom-right":Point.convert(t["bottom-right"]||[0,0]),left:Point.convert(t.left||[0,0]),right:Point.convert(t.right||[0,0])}}return normalizeOffset(new Point(0,0))}var util=_dereq_("../util/util"),Evented=_dereq_("../util/evented"),DOM=_dereq_("../util/dom"),LngLat=_dereq_("../geo/lng_lat"),Point=_dereq_("@mapbox/point-geometry"),window=_dereq_("../util/window"),smartWrap=_dereq_("../util/smart_wrap"),defaultOptions={closeButton:!0,closeOnClick:!0},Popup=function(t){function o(o){t.call(this),this.options=util.extend(Object.create(defaultOptions),o),util.bindAll(["_update","_onClickClose"],this)}return t&&(o.__proto__=t),o.prototype=Object.create(t&&t.prototype),o.prototype.constructor=o,o.prototype.addTo=function(t){return this._map=t,this._map.on("move",this._update),this.options.closeOnClick&&this._map.on("click",this._onClickClose),this._update(),this},o.prototype.isOpen=function(){return!!this._map},o.prototype.remove=function(){return this._content&&DOM.remove(this._content),this._container&&(DOM.remove(this._container),delete this._container),this._map&&(this._map.off("move",this._update),this._map.off("click",this._onClickClose),delete this._map),this.fire("close"),this},o.prototype.getLngLat=function(){return this._lngLat},o.prototype.setLngLat=function(t){return this._lngLat=LngLat.convert(t),this._pos=null,this._update(),this},o.prototype.setText=function(t){return this.setDOMContent(window.document.createTextNode(t))},o.prototype.setHTML=function(t){var o,e=window.document.createDocumentFragment(),n=window.document.createElement("body");for(n.innerHTML=t;;){if(!(o=n.firstChild))break;e.appendChild(o)}return this.setDOMContent(e)},o.prototype.setDOMContent=function(t){return this._createContent(),this._content.appendChild(t),this._update(),this},o.prototype._createContent=function(){this._content&&DOM.remove(this._content),this._content=DOM.create("div","mapboxgl-popup-content",this._container),this.options.closeButton&&(this._closeButton=DOM.create("button","mapboxgl-popup-close-button",this._content),this._closeButton.type="button",this._closeButton.setAttribute("aria-label","Close popup"),this._closeButton.innerHTML="&#215;",this._closeButton.addEventListener("click",this._onClickClose))},o.prototype._update=function(){if(this._map&&this._lngLat&&this._content){this._container||(this._container=DOM.create("div","mapboxgl-popup",this._map.getContainer()),this._tip=DOM.create("div","mapboxgl-popup-tip",this._container),this._container.appendChild(this._content)),this._map.transform.renderWorldCopies&&(this._lngLat=smartWrap(this._lngLat,this._pos,this._map.transform));var t=this._pos=this._map.project(this._lngLat),o=this.options.anchor,e=normalizeOffset(this.options.offset);if(!o){var n=this._container.offsetWidth,i=this._container.offsetHeight;o=t.y+e.bottom.y<i?["top"]:t.y>this._map.transform.height-i?["bottom"]:[],t.x<n/2?o.push("left"):t.x>this._map.transform.width-n/2&&o.push("right"),o=0===o.length?"bottom":o.join("-")}var r=t.add(e[o]).round(),s={top:"translate(-50%,0)","top-left":"translate(0,0)","top-right":"translate(-100%,0)",bottom:"translate(-50%,-100%)","bottom-left":"translate(0,-100%)","bottom-right":"translate(-100%,-100%)",left:"translate(0,-50%)",right:"translate(-100%,-50%)"},p=this._container.classList;for(var a in s)p.remove("mapboxgl-popup-anchor-"+a);p.add("mapboxgl-popup-anchor-"+o),DOM.setTransform(this._container,s[o]+" translate("+r.x+"px,"+r.y+"px)")}},o.prototype._onClickClose=function(){this.remove()},o}(Evented);module.exports=Popup;
},{"../geo/lng_lat":58,"../util/dom":209,"../util/evented":210,"../util/smart_wrap":219,"../util/util":223,"../util/window":204,"@mapbox/point-geometry":2}],200:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("./util"),Actor=function(t,e,r){this.target=t,this.parent=e,this.mapId=r,this.callbacks={},this.callbackID=0,util.bindAll(["receive"],this),this.target.addEventListener("message",this.receive,!1)};Actor.prototype.send=function(t,e,r,a,i){var s=r?this.mapId+":"+this.callbackID++:null;r&&(this.callbacks[s]=r),this.target.postMessage({targetMapId:i,sourceMapId:this.mapId,type:t,id:String(s),data:e},a)},Actor.prototype.receive=function(t){var e,r=this,a=t.data,i=a.id;if(!a.targetMapId||this.mapId===a.targetMapId){var s=function(t,e,a){r.target.postMessage({sourceMapId:r.mapId,type:"<response>",id:String(i),error:t?String(t):null,data:e},a)};if("<response>"===a.type)e=this.callbacks[a.id],delete this.callbacks[a.id],e&&a.error?e(new Error(a.error)):e&&e(null,a.data);else if(void 0!==a.id&&this.parent[a.type])this.parent[a.type](a.sourceMapId,a.data,s);else if(void 0!==a.id&&this.parent.getWorkerSource){var o=a.type.split("."),p=this.parent.getWorkerSource(a.sourceMapId,o[0]);p[o[1]](a.data,s)}else this.parent[a.type](a.data)}},Actor.prototype.remove=function(){this.target.removeEventListener("message",this.receive,!1)},module.exports=Actor;
},{"./util":223}],201:[function(_dereq_,module,exports){
"use strict";function makeRequest(e){var t=new window.XMLHttpRequest;t.open("GET",e.url,!0);for(var r in e.headers)t.setRequestHeader(r,e.headers[r]);return t.withCredentials="include"===e.credentials,t}function sameOrigin(e){var t=window.document.createElement("a");return t.href=e,t.protocol===window.document.location.protocol&&t.host===window.document.location.host}var window=_dereq_("./window"),ResourceType={Unknown:"Unknown",Style:"Style",Source:"Source",Tile:"Tile",Glyphs:"Glyphs",SpriteImage:"SpriteImage",SpriteJSON:"SpriteJSON",Image:"Image"};exports.ResourceType=ResourceType,"function"==typeof Object.freeze&&Object.freeze(ResourceType);var AJAXError=function(e){function t(t,r){e.call(this,t),this.status=r}return e&&(t.__proto__=e),t.prototype=Object.create(e&&e.prototype),t.prototype.constructor=t,t}(Error);exports.getJSON=function(e,t){var r=makeRequest(e);return r.setRequestHeader("Accept","application/json"),r.onerror=function(){t(new Error(r.statusText))},r.onload=function(){if(r.status>=200&&r.status<300&&r.response){var e;try{e=JSON.parse(r.response)}catch(e){return t(e)}t(null,e)}else t(new AJAXError(r.statusText,r.status))},r.send(),r},exports.getArrayBuffer=function(e,t){var r=makeRequest(e);return r.responseType="arraybuffer",r.onerror=function(){t(new Error(r.statusText))},r.onload=function(){var e=r.response;if(0===e.byteLength&&200===r.status)return t(new Error("http status 200 returned without content."));r.status>=200&&r.status<300&&r.response?t(null,{data:e,cacheControl:r.getResponseHeader("Cache-Control"),expires:r.getResponseHeader("Expires")}):t(new AJAXError(r.statusText,r.status))},r.send(),r};var transparentPngUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=";exports.getImage=function(e,t){return exports.getArrayBuffer(e,function(e,r){if(e)t(e);else if(r){var n=new window.Image,o=window.URL||window.webkitURL;n.onload=function(){t(null,n),o.revokeObjectURL(n.src)};var s=new window.Blob([new Uint8Array(r.data)],{type:"image/png"});n.cacheControl=r.cacheControl,n.expires=r.expires,n.src=r.data.byteLength?o.createObjectURL(s):transparentPngUrl}})},exports.getVideo=function(e,t){var r=window.document.createElement("video");r.onloadstart=function(){t(null,r)};for(var n=0;n<e.length;n++){var o=window.document.createElement("source");sameOrigin(e[n])||(r.crossOrigin="Anonymous"),o.src=e[n],r.appendChild(o)}return r};
},{"./window":204}],202:[function(_dereq_,module,exports){
"use strict";var window=_dereq_("./window"),now=window.performance&&window.performance.now?window.performance.now.bind(window.performance):Date.now.bind(Date),frame=window.requestAnimationFrame||window.mozRequestAnimationFrame||window.webkitRequestAnimationFrame||window.msRequestAnimationFrame,cancel=window.cancelAnimationFrame||window.mozCancelAnimationFrame||window.webkitCancelAnimationFrame||window.msCancelAnimationFrame;module.exports={now:now,frame:function(e){return frame(e)},cancelFrame:function(e){return cancel(e)},timed:function(e,n,t){function a(){if(!i){var r=now();r>=o+n?e.call(t,1):(e.call(t,(r-o)/n),frame(a))}}if(!n)return e.call(t,1),null;var i=!1,o=now();return frame(a),function(){i=!0}},getImageData:function(e){var n=window.document.createElement("canvas"),t=n.getContext("2d");if(!t)throw new Error("failed to create canvas 2d context");return n.width=e.width,n.height=e.height,t.drawImage(e,0,0,e.width,e.height),t.getImageData(0,0,e.width,e.height)},hardwareConcurrency:window.navigator.hardwareConcurrency||4,get devicePixelRatio(){return window.devicePixelRatio},supportsWebp:!1};var webpImgTest=window.document.createElement("img");webpImgTest.onload=function(){module.exports.supportsWebp=!0},webpImgTest.src="data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAQAAAAfQ//73v/+BiOh/AAA=";
},{"./window":204}],203:[function(_dereq_,module,exports){
"use strict";var WebWorkify=_dereq_("webworkify"),window=_dereq_("../window"),workerURL=window.URL.createObjectURL(new WebWorkify(_dereq_("../../source/worker"),{bare:!0}));module.exports=function(){return new window.Worker(workerURL)};
},{"../../source/worker":105,"../window":204,"webworkify":39}],204:[function(_dereq_,module,exports){
"use strict";module.exports=self;
},{}],205:[function(_dereq_,module,exports){
"use strict";function compareAreas(e,r){return r.area-e.area}var quickselect=_dereq_("quickselect"),calculateSignedArea=_dereq_("./util").calculateSignedArea;module.exports=function(e,r){var a=e.length;if(a<=1)return[e];for(var t,u,c=[],i=0;i<a;i++){var l=calculateSignedArea(e[i]);0!==l&&(e[i].area=Math.abs(l),void 0===u&&(u=l<0),u===l<0?(t&&c.push(t),t=[e[i]]):t.push(e[i]))}if(t&&c.push(t),r>1)for(var n=0;n<c.length;n++)c[n].length<=r||(quickselect(c[n],r,1,c[n].length-1,compareAreas),c[n]=c[n].slice(0,r));return c};
},{"./util":223,"quickselect":31}],206:[function(_dereq_,module,exports){
"use strict";var config={API_URL:"https://api.mapbox.com",REQUIRE_ACCESS_TOKEN:!0,ACCESS_TOKEN:null};module.exports=config;
},{}],207:[function(_dereq_,module,exports){
"use strict";var DictionaryCoder=function(r){var t=this;this._stringToNumber={},this._numberToString=[];for(var o=0;o<r.length;o++){var i=r[o];t._stringToNumber[i]=o,t._numberToString[o]=i}};DictionaryCoder.prototype.encode=function(r){return this._stringToNumber[r]},DictionaryCoder.prototype.decode=function(r){return this._numberToString[r]},module.exports=DictionaryCoder;
},{}],208:[function(_dereq_,module,exports){
"use strict";var util=_dereq_("./util"),Actor=_dereq_("./actor"),Dispatcher=function(t,r){var o=this;this.workerPool=t,this.actors=[],this.currentActor=0,this.id=util.uniqueId();for(var i=this.workerPool.acquire(this.id),e=0;e<i.length;e++){var s=i[e],c=new Actor(s,r,o.id);c.name="Worker "+e,o.actors.push(c)}};Dispatcher.prototype.broadcast=function(t,r,o){o=o||function(){},util.asyncAll(this.actors,function(o,i){o.send(t,r,i)},o)},Dispatcher.prototype.send=function(t,r,o,i,e){return("number"!=typeof i||isNaN(i))&&(i=this.currentActor=(this.currentActor+1)%this.actors.length),this.actors[i].send(t,r,o,e),i},Dispatcher.prototype.remove=function(){this.actors.forEach(function(t){t.remove()}),this.actors=[],this.workerPool.release(this.id)},module.exports=Dispatcher;
},{"./actor":200,"./util":223}],209:[function(_dereq_,module,exports){
"use strict";function testProp(e){for(var t=0;t<e.length;t++)if(e[t]in docStyle)return e[t];return e[0]}var Point=_dereq_("@mapbox/point-geometry"),window=_dereq_("./window");exports.create=function(e,t,o){var n=window.document.createElement(e);return t&&(n.className=t),o&&o.appendChild(n),n};var docStyle=window.document.documentElement.style,selectProp=testProp(["userSelect","MozUserSelect","WebkitUserSelect","msUserSelect"]),userSelect;exports.disableDrag=function(){selectProp&&(userSelect=docStyle[selectProp],docStyle[selectProp]="none")},exports.enableDrag=function(){selectProp&&(docStyle[selectProp]=userSelect)};var transformProp=testProp(["transform","WebkitTransform"]);exports.setTransform=function(e,t){e.style[transformProp]=t};var suppressClick=function(e){e.preventDefault(),e.stopPropagation(),window.removeEventListener("click",suppressClick,!0)};exports.suppressClick=function(){window.addEventListener("click",suppressClick,!0),window.setTimeout(function(){window.removeEventListener("click",suppressClick,!0)},0)},exports.mousePos=function(e,t){var o=e.getBoundingClientRect();return t=t.touches?t.touches[0]:t,new Point(t.clientX-o.left-e.clientLeft,t.clientY-o.top-e.clientTop)},exports.touchPos=function(e,t){for(var o=e.getBoundingClientRect(),n=[],r="touchend"===t.type?t.changedTouches:t.touches,s=0;s<r.length;s++)n.push(new Point(r[s].clientX-o.left-e.clientLeft,r[s].clientY-o.top-e.clientTop));return n},exports.remove=function(e){e.parentNode&&e.parentNode.removeChild(e)};
},{"./window":204,"@mapbox/point-geometry":2}],210:[function(_dereq_,module,exports){
"use strict";function _addEventListener(e,t,n){n[e]=n[e]||[],n[e].push(t)}function _removeEventListener(e,t,n){if(n&&n[e]){var i=n[e].indexOf(t);-1!==i&&n[e].splice(i,1)}}var util=_dereq_("./util"),Evented=function(){};Evented.prototype.on=function(e,t){return this._listeners=this._listeners||{},_addEventListener(e,t,this._listeners),this},Evented.prototype.off=function(e,t){return _removeEventListener(e,t,this._listeners),_removeEventListener(e,t,this._oneTimeListeners),this},Evented.prototype.once=function(e,t){return this._oneTimeListeners=this._oneTimeListeners||{},_addEventListener(e,t,this._oneTimeListeners),this},Evented.prototype.fire=function(e,t){var n=this;if(this.listens(e)){t=util.extend({},t,{type:e,target:this});for(var i=this._listeners&&this._listeners[e]?this._listeners[e].slice():[],s=0;s<i.length;s++)i[s].call(n,t);for(var r=this._oneTimeListeners&&this._oneTimeListeners[e]?this._oneTimeListeners[e].slice():[],o=0;o<r.length;o++)r[o].call(n,t),_removeEventListener(e,r[o],n._oneTimeListeners);this._eventedParent&&this._eventedParent.fire(e,util.extend({},t,"function"==typeof this._eventedParentData?this._eventedParentData():this._eventedParentData))}else util.endsWith(e,"error")&&console.error(t&&t.error||t||"Empty error event");return this},Evented.prototype.listens=function(e){return this._listeners&&this._listeners[e]&&this._listeners[e].length>0||this._oneTimeListeners&&this._oneTimeListeners[e]&&this._oneTimeListeners[e].length>0||this._eventedParent&&this._eventedParent.listens(e)},Evented.prototype.setEventedParent=function(e,t){return this._eventedParent=e,this._eventedParentData=t,this},module.exports=Evented;
},{"./util":223}],211:[function(_dereq_,module,exports){
"use strict";function compareMax(e,t){return t.max-e.max}function Cell(e,t,n,o){this.p=new Point(e,t),this.h=n,this.d=pointToPolygonDist(this.p,o),this.max=this.d+this.h*Math.SQRT2}function pointToPolygonDist(e,t){for(var n=!1,o=1/0,r=0;r<t.length;r++)for(var i=t[r],l=0,u=i.length,a=u-1;l<u;a=l++){var s=i[l],p=i[a];s.y>e.y!=p.y>e.y&&e.x<(p.x-s.x)*(e.y-s.y)/(p.y-s.y)+s.x&&(n=!n),o=Math.min(o,distToSegmentSquared(e,s,p))}return(n?1:-1)*Math.sqrt(o)}function getCentroidCell(e){for(var t=0,n=0,o=0,r=e[0],i=0,l=r.length,u=l-1;i<l;u=i++){var a=r[i],s=r[u],p=a.x*s.y-s.x*a.y;n+=(a.x+s.x)*p,o+=(a.y+s.y)*p,t+=3*p}return new Cell(n/t,o/t,0,e)}var Queue=_dereq_("tinyqueue"),Point=_dereq_("@mapbox/point-geometry"),distToSegmentSquared=_dereq_("./intersection_tests").distToSegmentSquared;module.exports=function(e,t,n){void 0===t&&(t=1),void 0===n&&(n=!1);for(var o=1/0,r=1/0,i=-1/0,l=-1/0,u=e[0],a=0;a<u.length;a++){var s=u[a];(!a||s.x<o)&&(o=s.x),(!a||s.y<r)&&(r=s.y),(!a||s.x>i)&&(i=s.x),(!a||s.y>l)&&(l=s.y)}var p=i-o,h=l-r,d=Math.min(p,h),x=d/2,y=new Queue(null,compareMax);if(0===d)return new Point(o,r);for(var g=o;g<i;g+=d)for(var f=r;f<l;f+=d)y.push(new Cell(g+x,f+x,x,e));for(var m=getCentroidCell(e),v=y.length;y.length;){var c=y.pop();(c.d>m.d||!m.d)&&(m=c,n&&console.log("found best %d after %d probes",Math.round(1e4*c.d)/1e4,v)),c.max-m.d<=t||(x=c.h/2,y.push(new Cell(c.p.x-x,c.p.y-x,x,e)),y.push(new Cell(c.p.x+x,c.p.y-x,x,e)),y.push(new Cell(c.p.x-x,c.p.y+x,x,e)),y.push(new Cell(c.p.x+x,c.p.y+x,x,e)),v+=4)}return n&&(console.log("num probes: "+v),console.log("best distance: "+m.d)),m.p};
},{"./intersection_tests":214,"@mapbox/point-geometry":2,"tinyqueue":33}],212:[function(_dereq_,module,exports){
"use strict";var WorkerPool=_dereq_("./worker_pool"),globalWorkerPool;module.exports=function(){return globalWorkerPool||(globalWorkerPool=new WorkerPool),globalWorkerPool};
},{"./worker_pool":226}],213:[function(_dereq_,module,exports){
"use strict";function createImage(e,t,i){var h=e.width,a=e.height;if(i){if(i.length!==h*a*t)throw new RangeError("mismatched image size")}else i=new Uint8Array(h*a*t);return{width:h,height:a,data:i}}function resizeImage(e,t,i){var h=t.width,a=t.height;if(h===e.width&&a===e.height)return e;var r=createImage({width:h,height:a},i);copyImage(e,r,{x:0,y:0},{x:0,y:0},{width:Math.min(e.width,h),height:Math.min(e.height,a)},i),e.width=h,e.height=a,e.data=r.data}function copyImage(e,t,i,h,a,r){if(0===a.width||0===a.height)return t;if(a.width>e.width||a.height>e.height||i.x>e.width-a.width||i.y>e.height-a.height)throw new RangeError("out of range source coordinates for image copy");if(a.width>t.width||a.height>t.height||h.x>t.width-a.width||h.y>t.height-a.height)throw new RangeError("out of range destination coordinates for image copy");for(var g=e.data,n=t.data,o=0;o<a.height;o++)for(var m=((i.y+o)*e.width+i.x)*r,c=((h.y+o)*t.width+h.x)*r,d=0;d<a.width*r;d++)n[c+d]=g[m+d];return t}var AlphaImage=function(){};AlphaImage.create=function(e,t){return createImage(e,1,t)},AlphaImage.resize=function(e,t){resizeImage(e,t,1)},AlphaImage.copy=function(e,t,i,h,a){copyImage(e,t,i,h,a,1)};var RGBAImage=function(){};RGBAImage.create=function(e,t){return createImage(e,4,t)},RGBAImage.resize=function(e,t){resizeImage(e,t,4)},RGBAImage.copy=function(e,t,i,h,a){copyImage(e,t,i,h,a,4)},module.exports={AlphaImage:AlphaImage,RGBAImage:RGBAImage};
},{}],214:[function(_dereq_,module,exports){
"use strict";function polygonIntersectsPolygon(n,t){for(var e=0;e<n.length;e++)if(polygonContainsPoint(t,n[e]))return!0;for(var r=0;r<t.length;r++)if(polygonContainsPoint(n,t[r]))return!0;return!!lineIntersectsLine(n,t)}function multiPolygonIntersectsBufferedMultiPoint(n,t,e){for(var r=0;r<n.length;r++)for(var o=n[r],i=0;i<t.length;i++)for(var l=t[i],u=0;u<l.length;u++){var s=l[u];if(polygonContainsPoint(o,s))return!0;if(pointIntersectsBufferedLine(s,o,e))return!0}return!1}function multiPolygonIntersectsMultiPolygon(n,t){if(1===n.length&&1===n[0].length)return multiPolygonContainsPoint(t,n[0][0]);for(var e=0;e<t.length;e++)for(var r=t[e],o=0;o<r.length;o++)if(multiPolygonContainsPoint(n,r[o]))return!0;for(var i=0;i<n.length;i++){for(var l=n[i],u=0;u<l.length;u++)if(multiPolygonContainsPoint(t,l[u]))return!0;for(var s=0;s<t.length;s++)if(lineIntersectsLine(l,t[s]))return!0}return!1}function multiPolygonIntersectsBufferedMultiLine(n,t,e){for(var r=0;r<t.length;r++)for(var o=t[r],i=0;i<n.length;i++){var l=n[i];if(l.length>=3)for(var u=0;u<o.length;u++)if(polygonContainsPoint(l,o[u]))return!0;if(lineIntersectsBufferedLine(l,o,e))return!0}return!1}function lineIntersectsBufferedLine(n,t,e){if(n.length>1){if(lineIntersectsLine(n,t))return!0;for(var r=0;r<t.length;r++)if(pointIntersectsBufferedLine(t[r],n,e))return!0}for(var o=0;o<n.length;o++)if(pointIntersectsBufferedLine(n[o],t,e))return!0;return!1}function lineIntersectsLine(n,t){if(0===n.length||0===t.length)return!1;for(var e=0;e<n.length-1;e++)for(var r=n[e],o=n[e+1],i=0;i<t.length-1;i++){var l=t[i],u=t[i+1];if(lineSegmentIntersectsLineSegment(r,o,l,u))return!0}return!1}function lineSegmentIntersectsLineSegment(n,t,e,r){return isCounterClockwise(n,e,r)!==isCounterClockwise(t,e,r)&&isCounterClockwise(n,t,e)!==isCounterClockwise(n,t,r)}function pointIntersectsBufferedLine(n,t,e){var r=e*e;if(1===t.length)return n.distSqr(t[0])<r;for(var o=1;o<t.length;o++){if(distToSegmentSquared(n,t[o-1],t[o])<r)return!0}return!1}function distToSegmentSquared(n,t,e){var r=t.distSqr(e);if(0===r)return n.distSqr(t);var o=((n.x-t.x)*(e.x-t.x)+(n.y-t.y)*(e.y-t.y))/r;return o<0?n.distSqr(t):o>1?n.distSqr(e):n.distSqr(e.sub(t)._mult(o)._add(t))}function multiPolygonContainsPoint(n,t){for(var e,r,o,i=!1,l=0;l<n.length;l++){e=n[l];for(var u=0,s=e.length-1;u<e.length;s=u++)r=e[u],o=e[s],r.y>t.y!=o.y>t.y&&t.x<(o.x-r.x)*(t.y-r.y)/(o.y-r.y)+r.x&&(i=!i)}return i}function polygonContainsPoint(n,t){for(var e=!1,r=0,o=n.length-1;r<n.length;o=r++){var i=n[r],l=n[o];i.y>t.y!=l.y>t.y&&t.x<(l.x-i.x)*(t.y-i.y)/(l.y-i.y)+i.x&&(e=!e)}return e}var ref=_dereq_("./util"),isCounterClockwise=ref.isCounterClockwise;module.exports={multiPolygonIntersectsBufferedMultiPoint:multiPolygonIntersectsBufferedMultiPoint,multiPolygonIntersectsMultiPolygon:multiPolygonIntersectsMultiPolygon,multiPolygonIntersectsBufferedMultiLine:multiPolygonIntersectsBufferedMultiLine,polygonIntersectsPolygon:polygonIntersectsPolygon,distToSegmentSquared:distToSegmentSquared};
},{"./util":223}],215:[function(_dereq_,module,exports){
"use strict";var unicodeBlockLookup={"Latin-1 Supplement":function(n){return n>=128&&n<=255},Arabic:function(n){return n>=1536&&n<=1791},"Arabic Supplement":function(n){return n>=1872&&n<=1919},"Arabic Extended-A":function(n){return n>=2208&&n<=2303},"Hangul Jamo":function(n){return n>=4352&&n<=4607},"Unified Canadian Aboriginal Syllabics":function(n){return n>=5120&&n<=5759},"Unified Canadian Aboriginal Syllabics Extended":function(n){return n>=6320&&n<=6399},"General Punctuation":function(n){return n>=8192&&n<=8303},"Letterlike Symbols":function(n){return n>=8448&&n<=8527},"Number Forms":function(n){return n>=8528&&n<=8591},"Miscellaneous Technical":function(n){return n>=8960&&n<=9215},"Control Pictures":function(n){return n>=9216&&n<=9279},"Optical Character Recognition":function(n){return n>=9280&&n<=9311},"Enclosed Alphanumerics":function(n){return n>=9312&&n<=9471},"Geometric Shapes":function(n){return n>=9632&&n<=9727},"Miscellaneous Symbols":function(n){return n>=9728&&n<=9983},"Miscellaneous Symbols and Arrows":function(n){return n>=11008&&n<=11263},"CJK Radicals Supplement":function(n){return n>=11904&&n<=12031},"Kangxi Radicals":function(n){return n>=12032&&n<=12255},"Ideographic Description Characters":function(n){return n>=12272&&n<=12287},"CJK Symbols and Punctuation":function(n){return n>=12288&&n<=12351},Hiragana:function(n){return n>=12352&&n<=12447},Katakana:function(n){return n>=12448&&n<=12543},Bopomofo:function(n){return n>=12544&&n<=12591},"Hangul Compatibility Jamo":function(n){return n>=12592&&n<=12687},Kanbun:function(n){return n>=12688&&n<=12703},"Bopomofo Extended":function(n){return n>=12704&&n<=12735},"CJK Strokes":function(n){return n>=12736&&n<=12783},"Katakana Phonetic Extensions":function(n){return n>=12784&&n<=12799},"Enclosed CJK Letters and Months":function(n){return n>=12800&&n<=13055},"CJK Compatibility":function(n){return n>=13056&&n<=13311},"CJK Unified Ideographs Extension A":function(n){return n>=13312&&n<=19903},"Yijing Hexagram Symbols":function(n){return n>=19904&&n<=19967},"CJK Unified Ideographs":function(n){return n>=19968&&n<=40959},"Yi Syllables":function(n){return n>=40960&&n<=42127},"Yi Radicals":function(n){return n>=42128&&n<=42191},"Hangul Jamo Extended-A":function(n){return n>=43360&&n<=43391},"Hangul Syllables":function(n){return n>=44032&&n<=55215},"Hangul Jamo Extended-B":function(n){return n>=55216&&n<=55295},"Private Use Area":function(n){return n>=57344&&n<=63743},"CJK Compatibility Ideographs":function(n){return n>=63744&&n<=64255},"Arabic Presentation Forms-A":function(n){return n>=64336&&n<=65023},"Vertical Forms":function(n){return n>=65040&&n<=65055},"CJK Compatibility Forms":function(n){return n>=65072&&n<=65103},"Small Form Variants":function(n){return n>=65104&&n<=65135},"Arabic Presentation Forms-B":function(n){return n>=65136&&n<=65279},"Halfwidth and Fullwidth Forms":function(n){return n>=65280&&n<=65519}};module.exports=unicodeBlockLookup;
},{}],216:[function(_dereq_,module,exports){
"use strict";var LRUCache=function(t,e){this.max=t,this.onRemove=e,this.reset()};LRUCache.prototype.reset=function(){var t=this;for(var e in t.data)t.onRemove(t.data[e]);return this.data={},this.order=[],this},LRUCache.prototype.add=function(t,e){if(this.has(t))this.order.splice(this.order.indexOf(t),1),this.data[t]=e,this.order.push(t);else if(this.data[t]=e,this.order.push(t),this.order.length>this.max){var r=this.get(this.order[0]);r&&this.onRemove(r)}return this},LRUCache.prototype.has=function(t){return t in this.data},LRUCache.prototype.keys=function(){return this.order},LRUCache.prototype.get=function(t){if(!this.has(t))return null;var e=this.data[t];return delete this.data[t],this.order.splice(this.order.indexOf(t),1),e},LRUCache.prototype.getWithoutRemoving=function(t){return this.has(t)?this.data[t]:null},LRUCache.prototype.remove=function(t){if(!this.has(t))return this;var e=this.data[t];return delete this.data[t],this.onRemove(e),this.order.splice(this.order.indexOf(t),1),this},LRUCache.prototype.setMaxSize=function(t){var e=this;for(this.max=t;this.order.length>this.max;){var r=e.get(e.order[0]);r&&e.onRemove(r)}return this},module.exports=LRUCache;
},{}],217:[function(_dereq_,module,exports){
"use strict";function makeAPIURL(r,e){var t=parseUrl(config.API_URL);if(r.protocol=t.protocol,r.authority=t.authority,"/"!==t.path&&(r.path=""+t.path+r.path),!config.REQUIRE_ACCESS_TOKEN)return formatUrl(r);if(!(e=e||config.ACCESS_TOKEN))throw new Error("An API access token is required to use Mapbox GL. "+help);if("s"===e[0])throw new Error("Use a public access token (pk.*) with Mapbox GL, not a secret access token (sk.*). "+help);return r.params.push("access_token="+e),formatUrl(r)}function isMapboxURL(r){return 0===r.indexOf("mapbox:")}function replaceTempAccessToken(r){for(var e=0;e<r.length;e++)0===r[e].indexOf("access_token=tk.")&&(r[e]="access_token="+(config.ACCESS_TOKEN||""))}function parseUrl(r){var e=r.match(urlRe);if(!e)throw new Error("Unable to parse URL object");return{protocol:e[1],authority:e[2],path:e[3]||"/",params:e[4]?e[4].split("&"):[]}}function formatUrl(r){var e=r.params.length?"?"+r.params.join("&"):"";return r.protocol+"://"+r.authority+r.path+e}var config=_dereq_("./config"),browser=_dereq_("./browser"),help="See https://www.mapbox.com/api-documentation/#access-tokens";exports.isMapboxURL=isMapboxURL,exports.normalizeStyleURL=function(r,e){if(!isMapboxURL(r))return r;var t=parseUrl(r);return t.path="/styles/v1"+t.path,makeAPIURL(t,e)},exports.normalizeGlyphsURL=function(r,e){if(!isMapboxURL(r))return r;var t=parseUrl(r);return t.path="/fonts/v1"+t.path,makeAPIURL(t,e)},exports.normalizeSourceURL=function(r,e){if(!isMapboxURL(r))return r;var t=parseUrl(r);return t.path="/v4/"+t.authority+".json",t.params.push("secure"),makeAPIURL(t,e)},exports.normalizeSpriteURL=function(r,e,t,a){var o=parseUrl(r);return isMapboxURL(r)?(o.path="/styles/v1"+o.path+"/sprite"+e+t,makeAPIURL(o,a)):(o.path+=""+e+t,formatUrl(o))};var imageExtensionRe=/(\.(png|jpg)\d*)(?=$)/;exports.normalizeTileURL=function(r,e,t){if(!e||!isMapboxURL(e))return r;var a=parseUrl(r),o=browser.devicePixelRatio>=2||512===t?"@2x":"",p=browser.supportsWebp?".webp":"$1";return a.path=a.path.replace(imageExtensionRe,""+o+p),replaceTempAccessToken(a.params),formatUrl(a)};var urlRe=/^(\w+):\/\/([^\/?]*)(\/[^?]+)?\??(.+)?/;
},{"./browser":202,"./config":206}],218:[function(_dereq_,module,exports){
"use strict";var isChar=_dereq_("./is_char_in_unicode_block");module.exports.allowsIdeographicBreaking=function(a){for(var i=0,r=a;i<r.length;i+=1){var s=r[i];if(!exports.charAllowsIdeographicBreaking(s.charCodeAt(0)))return!1}return!0},module.exports.allowsVerticalWritingMode=function(a){for(var i=0,r=a;i<r.length;i+=1){var s=r[i];if(exports.charHasUprightVerticalOrientation(s.charCodeAt(0)))return!0}return!1},module.exports.allowsLetterSpacing=function(a){for(var i=0,r=a;i<r.length;i+=1){var s=r[i];if(!exports.charAllowsLetterSpacing(s.charCodeAt(0)))return!1}return!0},module.exports.charAllowsLetterSpacing=function(a){return!isChar.Arabic(a)&&(!isChar["Arabic Supplement"](a)&&(!isChar["Arabic Extended-A"](a)&&(!isChar["Arabic Presentation Forms-A"](a)&&!isChar["Arabic Presentation Forms-B"](a))))},module.exports.charAllowsIdeographicBreaking=function(a){return!(a<11904)&&(!!isChar["Bopomofo Extended"](a)||(!!isChar.Bopomofo(a)||(!!isChar["CJK Compatibility Forms"](a)||(!!isChar["CJK Compatibility Ideographs"](a)||(!!isChar["CJK Compatibility"](a)||(!!isChar["CJK Radicals Supplement"](a)||(!!isChar["CJK Strokes"](a)||(!!isChar["CJK Symbols and Punctuation"](a)||(!!isChar["CJK Unified Ideographs Extension A"](a)||(!!isChar["CJK Unified Ideographs"](a)||(!!isChar["Enclosed CJK Letters and Months"](a)||(!!isChar["Halfwidth and Fullwidth Forms"](a)||(!!isChar.Hiragana(a)||(!!isChar["Ideographic Description Characters"](a)||(!!isChar["Kangxi Radicals"](a)||(!!isChar["Katakana Phonetic Extensions"](a)||(!!isChar.Katakana(a)||(!!isChar["Vertical Forms"](a)||(!!isChar["Yi Radicals"](a)||!!isChar["Yi Syllables"](a))))))))))))))))))))},exports.charHasUprightVerticalOrientation=function(a){return 746===a||747===a||!(a<4352)&&(!!isChar["Bopomofo Extended"](a)||(!!isChar.Bopomofo(a)||(!(!isChar["CJK Compatibility Forms"](a)||a>=65097&&a<=65103)||(!!isChar["CJK Compatibility Ideographs"](a)||(!!isChar["CJK Compatibility"](a)||(!!isChar["CJK Radicals Supplement"](a)||(!!isChar["CJK Strokes"](a)||(!(!isChar["CJK Symbols and Punctuation"](a)||a>=12296&&a<=12305||a>=12308&&a<=12319||12336===a)||(!!isChar["CJK Unified Ideographs Extension A"](a)||(!!isChar["CJK Unified Ideographs"](a)||(!!isChar["Enclosed CJK Letters and Months"](a)||(!!isChar["Hangul Compatibility Jamo"](a)||(!!isChar["Hangul Jamo Extended-A"](a)||(!!isChar["Hangul Jamo Extended-B"](a)||(!!isChar["Hangul Jamo"](a)||(!!isChar["Hangul Syllables"](a)||(!!isChar.Hiragana(a)||(!!isChar["Ideographic Description Characters"](a)||(!!isChar.Kanbun(a)||(!!isChar["Kangxi Radicals"](a)||(!!isChar["Katakana Phonetic Extensions"](a)||(!(!isChar.Katakana(a)||12540===a)||(!(!isChar["Halfwidth and Fullwidth Forms"](a)||65288===a||65289===a||65293===a||a>=65306&&a<=65310||65339===a||65341===a||65343===a||a>=65371&&a<=65503||65507===a||a>=65512&&a<=65519)||(!(!isChar["Small Form Variants"](a)||a>=65112&&a<=65118||a>=65123&&a<=65126)||(!!isChar["Unified Canadian Aboriginal Syllabics"](a)||(!!isChar["Unified Canadian Aboriginal Syllabics Extended"](a)||(!!isChar["Vertical Forms"](a)||(!!isChar["Yijing Hexagram Symbols"](a)||(!!isChar["Yi Syllables"](a)||!!isChar["Yi Radicals"](a))))))))))))))))))))))))))))))},exports.charHasNeutralVerticalOrientation=function(a){return!(!isChar["Latin-1 Supplement"](a)||167!==a&&169!==a&&174!==a&&177!==a&&188!==a&&189!==a&&190!==a&&215!==a&&247!==a)||(!(!isChar["General Punctuation"](a)||8214!==a&&8224!==a&&8225!==a&&8240!==a&&8241!==a&&8251!==a&&8252!==a&&8258!==a&&8263!==a&&8264!==a&&8265!==a&&8273!==a)||(!!isChar["Letterlike Symbols"](a)||(!!isChar["Number Forms"](a)||(!(!isChar["Miscellaneous Technical"](a)||!(a>=8960&&a<=8967||a>=8972&&a<=8991||a>=8996&&a<=9e3||9003===a||a>=9085&&a<=9114||a>=9150&&a<=9165||9167===a||a>=9169&&a<=9179||a>=9186&&a<=9215))||(!(!isChar["Control Pictures"](a)||9251===a)||(!!isChar["Optical Character Recognition"](a)||(!!isChar["Enclosed Alphanumerics"](a)||(!!isChar["Geometric Shapes"](a)||(!(!isChar["Miscellaneous Symbols"](a)||a>=9754&&a<=9759)||(!(!isChar["Miscellaneous Symbols and Arrows"](a)||!(a>=11026&&a<=11055||a>=11088&&a<=11097||a>=11192&&a<=11243))||(!!isChar["CJK Symbols and Punctuation"](a)||(!!isChar.Katakana(a)||(!!isChar["Private Use Area"](a)||(!!isChar["CJK Compatibility Forms"](a)||(!!isChar["Small Form Variants"](a)||(!!isChar["Halfwidth and Fullwidth Forms"](a)||(8734===a||8756===a||8757===a||a>=9984&&a<=10087||a>=10102&&a<=10131||65532===a||65533===a)))))))))))))))))},exports.charHasRotatedVerticalOrientation=function(a){return!(exports.charHasUprightVerticalOrientation(a)||exports.charHasNeutralVerticalOrientation(a))};
},{"./is_char_in_unicode_block":215}],219:[function(_dereq_,module,exports){
"use strict";var LngLat=_dereq_("../geo/lng_lat");module.exports=function(n,t,l){if(n=new LngLat(n.lng,n.lat),t){var a=new LngLat(n.lng-360,n.lat),i=new LngLat(n.lng+360,n.lat),o=l.locationPoint(n).distSqr(t);l.locationPoint(a).distSqr(t)<o?n=a:l.locationPoint(i).distSqr(t)<o&&(n=i)}for(;Math.abs(n.lng-l.center.lng)>180;){var e=l.locationPoint(n);if(e.x>=0&&e.y>=0&&e.x<=l.width&&e.y<=l.height)break;n.lng>l.center.lng?n.lng-=360:n.lng+=360}return n};
},{"../geo/lng_lat":58}],220:[function(_dereq_,module,exports){
"use strict";function createStructArrayType(t){var r=JSON.stringify(t);if(structArrayTypeCache[r])return structArrayTypeCache[r];var e=void 0===t.alignment?1:t.alignment,i=0,n=0,a=["Uint8"],s=t.members.map(function(t){a.indexOf(t.type)<0&&a.push(t.type);var r=sizeOf(t.type),s=i=align(i,Math.max(e,r)),o=t.components||1;return n=Math.max(n,r),i+=r*o,{name:t.name,type:t.type,components:o,offset:s}}),o=align(i,Math.max(n,e)),p=function(t){function r(){t.apply(this,arguments)}return t&&(r.__proto__=t),r.prototype=Object.create(t&&t.prototype),r.prototype.constructor=r,r}(Struct);p.prototype.alignment=e,p.prototype.size=o;for(var y=0,c=s;y<c.length;y+=1)for(var h=c[y],u=0;u<h.components;u++){var f=h.name;if(h.components>1&&(f+=u),f in p.prototype)throw new Error(f+" is a reserved name and cannot be used as a member name.");Object.defineProperty(p.prototype,f,createAccessors(h,u))}var m=function(t){function r(){t.apply(this,arguments)}return t&&(r.__proto__=t),r.prototype=Object.create(t&&t.prototype),r.prototype.constructor=r,r}(StructArray);return m.prototype.members=s,m.prototype.StructType=p,m.prototype.bytesPerElement=o,m.prototype.emplaceBack=createEmplaceBack(s,o),m.prototype._usedTypes=a,structArrayTypeCache[r]=m,m}function align(t,r){return Math.ceil(t/r)*r}function sizeOf(t){return viewTypes[t].BYTES_PER_ELEMENT}function getArrayViewName(t){return t.toLowerCase()}function createEmplaceBack(t,r){for(var e=[],i=[],n="var i = this.length;\nthis.resize(this.length + 1);\n",a=0,s=t;a<s.length;a+=1){var o=s[a],p=sizeOf(o.type);e.indexOf(p)<0&&(e.push(p),n+="var o"+p.toFixed(0)+" = i * "+(r/p).toFixed(0)+";\n");for(var y=0;y<o.components;y++){var c="v"+i.length,h="o"+p.toFixed(0)+" + "+(o.offset/p+y).toFixed(0);n+="this."+getArrayViewName(o.type)+"["+h+"] = "+c+";\n",i.push(c)}}return n+="return i;",new Function(i.toString(),n)}function createMemberComponentString(t,r){var e="this._pos"+sizeOf(t.type).toFixed(0),i=(t.offset/sizeOf(t.type)+r).toFixed(0),n=e+" + "+i;return"this._structArray."+getArrayViewName(t.type)+"["+n+"]"}function createAccessors(t,r){var e=createMemberComponentString(t,r);return{get:new Function("return "+e+";"),set:new Function("x",e+" = x;")}}module.exports=createStructArrayType;var viewTypes={Int8:Int8Array,Uint8:Uint8Array,Int16:Int16Array,Uint16:Uint16Array,Int32:Int32Array,Uint32:Uint32Array,Float32:Float32Array},Struct=function(t,r){this._structArray=t,this._pos1=r*this.size,this._pos2=this._pos1/2,this._pos4=this._pos1/4,this._pos8=this._pos1/8},DEFAULT_CAPACITY=128,RESIZE_MULTIPLIER=5,StructArray=function(t){this.isTransferred=!1,void 0!==t?(this.arrayBuffer=t.arrayBuffer,this.length=t.length,this.capacity=this.arrayBuffer.byteLength/this.bytesPerElement,this._refreshViews()):(this.capacity=-1,this.resize(0))};StructArray.serialize=function(){return{members:this.prototype.members,alignment:this.prototype.StructType.prototype.alignment}},StructArray.prototype.serialize=function(t){return this._trim(),t&&(this.isTransferred=!0,t.push(this.arrayBuffer)),{length:this.length,arrayBuffer:this.arrayBuffer}},StructArray.prototype.get=function(t){return new this.StructType(this,t)},StructArray.prototype._trim=function(){this.length!==this.capacity&&(this.capacity=this.length,this.arrayBuffer=this.arrayBuffer.slice(0,this.length*this.bytesPerElement),this._refreshViews())},StructArray.prototype.clear=function(){this.length=0},StructArray.prototype.resize=function(t){if(this.length=t,t>this.capacity){this.capacity=Math.max(t,Math.floor(this.capacity*RESIZE_MULTIPLIER),DEFAULT_CAPACITY),this.arrayBuffer=new ArrayBuffer(this.capacity*this.bytesPerElement);var r=this.uint8;this._refreshViews(),r&&this.uint8.set(r)}},StructArray.prototype._refreshViews=function(){for(var t=this,r=0,e=t._usedTypes;r<e.length;r+=1){var i=e[r];t[getArrayViewName(i)]=new viewTypes[i](t.arrayBuffer)}},StructArray.prototype.toArray=function(t,r){for(var e=this,i=[],n=t;n<r;n++){var a=e.get(n);i.push(a)}return i};var structArrayTypeCache={};
},{}],221:[function(_dereq_,module,exports){
"use strict";var browser=_dereq_("./browser"),Throttler=function(t,o){this.frequency=t,this.throttledFunction=o,this.lastInvocation=0};Throttler.prototype.invoke=function(){var t=this;if(!this.pendingInvocation){var o=0===this.lastInvocation?0:this.lastInvocation+this.frequency-browser.now();o<=0?(this.lastInvocation=browser.now(),this.throttledFunction()):this.pendingInvocation=setTimeout(function(){t.pendingInvocation=void 0,t.lastInvocation=browser.now(),t.throttledFunction()},o)}},Throttler.prototype.stop=function(){this.pendingInvocation&&(clearTimeout(this.pendingInvocation),this.pendingInvocation=void 0)},module.exports=Throttler;
},{"./browser":202}],222:[function(_dereq_,module,exports){
"use strict";function resolveTokens(e,n){return n.replace(/{([^{}]+)}/g,function(n,r){return r in e?String(e[r]):""})}module.exports=resolveTokens;
},{}],223:[function(_dereq_,module,exports){
"use strict";var UnitBezier=_dereq_("@mapbox/unitbezier"),Coordinate=_dereq_("../geo/coordinate"),Point=_dereq_("@mapbox/point-geometry");exports.easeCubicInOut=function(r){if(r<=0)return 0;if(r>=1)return 1;var e=r*r,t=e*r;return 4*(r<.5?t:3*(r-e)+t-.75)},exports.bezier=function(r,e,t,n){var o=new UnitBezier(r,e,t,n);return function(r){return o.solve(r)}},exports.ease=exports.bezier(.25,.1,.25,1),exports.clamp=function(r,e,t){return Math.min(t,Math.max(e,r))},exports.wrap=function(r,e,t){var n=t-e,o=((r-e)%n+n)%n+e;return o===e?t:o},exports.asyncAll=function(r,e,t){if(!r.length)return t(null,[]);var n=r.length,o=new Array(r.length),a=null;r.forEach(function(r,i){e(r,function(r,e){r&&(a=r),o[i]=e,0==--n&&t(a,o)})})},exports.values=function(r){var e=[];for(var t in r)e.push(r[t]);return e},exports.keysDifference=function(r,e){var t=[];for(var n in r)n in e||t.push(n);return t},exports.extend=function(r){for(var e=[],t=arguments.length-1;t-- >0;)e[t]=arguments[t+1];for(var n=0,o=e;n<o.length;n+=1){var a=o[n];for(var i in a)r[i]=a[i]}return r},exports.pick=function(r,e){for(var t={},n=0;n<e.length;n++){var o=e[n];o in r&&(t[o]=r[o])}return t};var id=1;exports.uniqueId=function(){return id++},exports.bindAll=function(r,e){r.forEach(function(r){e[r]&&(e[r]=e[r].bind(e))})},exports.getCoordinatesCenter=function(r){for(var e=1/0,t=1/0,n=-1/0,o=-1/0,a=0;a<r.length;a++)e=Math.min(e,r[a].column),t=Math.min(t,r[a].row),n=Math.max(n,r[a].column),o=Math.max(o,r[a].row);var i=n-e,u=o-t,s=Math.max(i,u),c=Math.max(0,Math.floor(-Math.log(s)/Math.LN2));return new Coordinate((e+n)/2,(t+o)/2,0).zoomTo(c)},exports.endsWith=function(r,e){return-1!==r.indexOf(e,r.length-e.length)},exports.mapObject=function(r,e,t){var n=this,o={};for(var a in r)o[a]=e.call(t||n,r[a],a,r);return o},exports.filterObject=function(r,e,t){var n=this,o={};for(var a in r)e.call(t||n,r[a],a,r)&&(o[a]=r[a]);return o},exports.deepEqual=function(r,e){if(Array.isArray(r)){if(!Array.isArray(e)||r.length!==e.length)return!1;for(var t=0;t<r.length;t++)if(!exports.deepEqual(r[t],e[t]))return!1;return!0}if("object"==typeof r&&null!==r&&null!==e){if("object"!=typeof e)return!1;if(Object.keys(r).length!==Object.keys(e).length)return!1;for(var n in r)if(!exports.deepEqual(r[n],e[n]))return!1;return!0}return r===e},exports.clone=function(r){return Array.isArray(r)?r.map(exports.clone):"object"==typeof r&&r?exports.mapObject(r,exports.clone):r},exports.arraysIntersect=function(r,e){for(var t=0;t<r.length;t++)if(e.indexOf(r[t])>=0)return!0;return!1};var warnOnceHistory={};exports.warnOnce=function(r){warnOnceHistory[r]||("undefined"!=typeof console&&console.warn(r),warnOnceHistory[r]=!0)},exports.isCounterClockwise=function(r,e,t){return(t.y-r.y)*(e.x-r.x)>(e.y-r.y)*(t.x-r.x)},exports.calculateSignedArea=function(r){for(var e=0,t=0,n=r.length,o=n-1,a=void 0,i=void 0;t<n;o=t++)a=r[t],i=r[o],e+=(i.x-a.x)*(a.y+i.y);return e},exports.isClosedPolygon=function(r){if(r.length<4)return!1;var e=r[0],t=r[r.length-1];return!(Math.abs(e.x-t.x)>0||Math.abs(e.y-t.y)>0)&&Math.abs(exports.calculateSignedArea(r))>.01},exports.sphericalToCartesian=function(r){var e=r[0],t=r[1],n=r[2];return t+=90,t*=Math.PI/180,n*=Math.PI/180,[e*Math.cos(t)*Math.sin(n),e*Math.sin(t)*Math.sin(n),e*Math.cos(n)]},exports.parseCacheControl=function(r){var e=/(?:^|(?:\s*\,\s*))([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)(?:\=(?:([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)|(?:\"((?:[^"\\]|\\.)*)\")))?/g,t={};if(r.replace(e,function(r,e,n,o){var a=n||o;return t[e]=!a||a.toLowerCase(),""}),t["max-age"]){var n=parseInt(t["max-age"],10);isNaN(n)?delete t["max-age"]:t["max-age"]=n}return t};
},{"../geo/coordinate":57,"@mapbox/point-geometry":2,"@mapbox/unitbezier":5}],224:[function(_dereq_,module,exports){
"use strict";var Feature=function(e,t,r,o){this.type="Feature",this._vectorTileFeature=e,e._z=t,e._x=r,e._y=o,this.properties=e.properties,null!=e.id&&(this.id=e.id)},prototypeAccessors={geometry:{}};prototypeAccessors.geometry.get=function(){return void 0===this._geometry&&(this._geometry=this._vectorTileFeature.toGeoJSON(this._vectorTileFeature._x,this._vectorTileFeature._y,this._vectorTileFeature._z).geometry),this._geometry},prototypeAccessors.geometry.set=function(e){this._geometry=e},Feature.prototype.toJSON=function(){var e=this,t={geometry:this.geometry};for(var r in e)"_geometry"!==r&&"_vectorTileFeature"!==r&&(t[r]=e[r]);return t},Object.defineProperties(Feature.prototype,prototypeAccessors),module.exports=Feature;
},{}],225:[function(_dereq_,module,exports){
"use strict";var scriptDetection=_dereq_("./script_detection");module.exports=function(t){for(var o="",e=0;e<t.length;e++){var r=t.charCodeAt(e+1)||null,l=t.charCodeAt(e-1)||null;(!r||!scriptDetection.charHasRotatedVerticalOrientation(r)||module.exports.lookup[t[e+1]])&&(!l||!scriptDetection.charHasRotatedVerticalOrientation(l)||module.exports.lookup[t[e-1]])&&module.exports.lookup[t[e]]?o+=module.exports.lookup[t[e]]:o+=t[e]}return o},module.exports.lookup={"!":"︕","#":"＃",$:"＄","%":"％","&":"＆","(":"︵",")":"︶","*":"＊","+":"＋",",":"︐","-":"︲",".":"・","/":"／",":":"︓",";":"︔","<":"︿","=":"＝",">":"﹀","?":"︖","@":"＠","[":"﹇","\\":"＼","]":"﹈","^":"＾",_:"︳","`":"｀","{":"︷","|":"―","}":"︸","~":"～","¢":"￠","£":"￡","¥":"￥","¦":"￤","¬":"￢","¯":"￣","–":"︲","—":"︱","‘":"﹃","’":"﹄","“":"﹁","”":"﹂","…":"︙","‧":"・","₩":"￦","、":"︑","。":"︒","〈":"︿","〉":"﹀","《":"︽","》":"︾","「":"﹁","」":"﹂","『":"﹃","』":"﹄","【":"︻","】":"︼","〔":"︹","〕":"︺","〖":"︗","〗":"︘","！":"︕","（":"︵","）":"︶","，":"︐","－":"︲","．":"・","：":"︓","；":"︔","＜":"︿","＞":"﹀","？":"︖","［":"﹇","］":"﹈","＿":"︳","｛":"︷","｜":"―","｝":"︸","｟":"︵","｠":"︶","｡":"︒","｢":"﹁","｣":"﹂"};
},{"./script_detection":218}],226:[function(_dereq_,module,exports){
"use strict";var WebWorker=_dereq_("./web_worker"),WorkerPool=function(){this.active={}};WorkerPool.prototype.acquire=function(r){var e=this;if(!this.workers){var o=_dereq_("../").workerCount;for(this.workers=[];this.workers.length<o;)e.workers.push(new WebWorker)}return this.active[r]=!0,this.workers.slice()},WorkerPool.prototype.release=function(r){delete this.active[r],0===Object.keys(this.active).length&&(this.workers.forEach(function(r){r.terminate()}),this.workers=null)},module.exports=WorkerPool;
},{"../":63,"./web_worker":203}]},{},[63])(63)
});


//# sourceMappingURL=mapbox-gl.js.map
/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(18)))

/***/ }),
/* 18 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || Function("return this")() || (1,eval)("this");
} catch(e) {
	// This works if the window reference is available
	if(typeof window === "object")
		g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var angular = __webpack_require__(0);

angular.module('ijwApp').factory('AuthService', ['$rootScope', '$q', '$timeout', '$http', '$log', function ($rootScope, $q, $timeout, $http, $log) {

    // create user variable
    var user = null;
    var _id = null;
    var admin = null;

    var config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    function getUserId() {
      return _id;
    }

    function isLoggedIn() {
      if(user) {
        return true;
      } else {
        return false;
      }
    }

    function getUserStatus() {
      return $http.get('/user/status')
      // handle success
      .then(function(response) {
          if (response.data.status === true) {
            user = true;
            $rootScope.loggedIn = true;
            _id = response.data.user;
          } else {
            user = false;
            $rootScope.loggedIn = false;
            _id = null;
          }
      }, function (data) {
        user = false;
      });
    }

    function login(email, password) {

      // create a new instance of deferred
      var deferred = $q.defer();

      // send a post request to the server
      $http.post('/user/login',
        {email: email, password: password}, config)
        // handle success
        .then(function(response) {
            if(response.status === 200){
              user = true;
              _id = response.data.user;
              deferred.resolve();
            } else {
              $log.error(data);
              user = false;
              _id = null;
              deferred.reject();
            }
        }, function(data) {
          user = false;
          _id = null;
          deferred.reject();
        });

      // return promise object
      return deferred.promise;

    }

    function logout() {

      // create a new instance of deferred
      var deferred = $q.defer();

      // send a get request to the server
      $http.get('/user/logout').then(function(data) {
            user = false;
            deferred.resolve();
        }, function(data) {
          console.log('error', data);
          user = false;
          deferred.reject();
        });

      // return promise object
      return deferred.promise;

    }

    function register(email, username, password, confirmPassword) {

      // create a new instance of deferred
      var deferred = $q.defer();

      // send a post request to the server
      $http.post('/user/register', JSON.stringify({email: email, name: username, password: password, confirmPassword: confirmPassword}), config)

        // handle success
        .then(function(data, status) {
            if(/*status === 200 && */data.status === 200){
              deferred.resolve();
            } else {
              $log.error(data);
              deferred.reject();
            }
        }, function(data) {
          user = false;
          deferred.reject();
        });

      // return promise object
      return deferred.promise;

    }

    function getUserRoles() {
        return $http.get('/api/users/' + _id)
        // handle success
        .then(function(response) {
             if (response.data.roles.includes('admin')) {
                admin = true;
            } else {
                $log.info('not an admin');
                admin = false;
            }
        }, function (data) {
            admin = false;
        });
    }

    function isAdmin() {
      if(admin) {
        return true;
      } else {
        return false;
      }
    }

    // return available functions for use in the controllers
    return ({
      isLoggedIn: isLoggedIn,
      getUserStatus: getUserStatus,
      login: login,
      logout: logout,
      register: register,
      getUserId: getUserId,
      getUserRoles: getUserRoles,
      isAdmin: isAdmin
    });

}]);

/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);
var api = __webpack_require__(21);
// longitude, latitude format
var locations = __webpack_require__(25);

angular.module('ijwApp')
    .service("dataService", function($http, $log, $q, $timeout, $location, $httpParamSerializer, AuthService) {

        ! function(vm) {

            // The base URL for the REST API is http://localhost:5000/
            /*const HOME = 'http://localhost:3000';*/
            let config = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            var _id = AuthService.getUserId();
            var user = {};

            /* BEGIN VARIABLES EXCLUSIVE TO MAP AND WEATHER APIS */

            var mission = {};
            var weather = {};
            var _actions = {};
            var matches = undefined;

            var weatherURL = 'http://api.openweathermap.org/data/2.5/weather';
            var timezonedbURL = 'http://api.timezonedb.com/v2/get-time-zone?key=';

            var styles = {
                'satellite': 'mapbox://styles/mapbox/satellite-v9',
                'satellite-streets': 'mapbox://styles/mapbox/satellite-streets-v9',
                'streets': 'mapbox://styles/mapbox/streets-v9',
                'outdoors': 'mapbox://styles/mapbox/outdoors-v10',
                'light': 'mapbox://styles/mapbox/light-v9',
                'dark': 'mapbox://styles/mapbox/dark-v9',
                'personal': 'mapbox://styles/thebluecow/cj7t3fpw70uo12sphdf24ihyo'
            };

            /* END VARIABLES EXCLUSIVE TO MAP AND WEATHER APIS */

            /* BEGIN FUNCTIONS EXCLUSIVE TO MAP AND WEATHER APIS */

            // get current mission and weather
            (function() {
                var location = locations[_getRandomInt(0, locations.length)];
                mission.location = location.city;

                var weatherQuery = '?lat=' + mission.location.global[1] + '&lon=' + mission.location.global[0] + '&units=imperial';
                var newWeatherURL = `${weatherURL}${weatherQuery}&APPID=${api.openweather.key}`;
                var p1 = $http.get(newWeatherURL);

                var timezonedbQuery = '&lat=' + mission.location.global[1] + '&lng=' + mission.location.global[0];
                var newTimezoneURL = `${timezonedbURL}${api.timezonedb.apiKey}&format=json&by=position${timezonedbQuery}`;
                var p2 = $http.get(newTimezoneURL);

                weather = $q.all([p1, p2]).then(function (result) {
                                return {
                                    "weather" : result[0]['data'],
                                    "timezone": result[1]['data']
                                }
                            });
            }()); 

            // return the user's id
            vm.getUserId = function() {
                return _id;
            }

            // return only the necessary components for the mission with weather
            vm.getMission = function() {
                return mission;
            }

            // return weather
            vm.getWeather = function() {
                return weather;
            }

            // returns an array of actions. Can return all actions or only those fields
            // specified
            vm.getActions = function (fields) {
                var deferred = $q.defer();

                vm.getAllActions().then( result => {
                    var actions = [];
                    if (fields.length > 0) {
                        result.data.forEach( action => {
                            var _action = {};
                            for (var i = 0; i < fields.length; i++) {
                                _action[fields[i]] = action[fields[i]];
                            }
                            actions.push(_action);
                        });
                        result.data = actions;
                    }

                    deferred.resolve(result);
                });

                return deferred.promise;
            }

            // returns a random integer
            function _getRandomInt(min, max) {
                min = Math.ceil(min);
                max = Math.floor(max);
                return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
            }

            /* END FUNCTIONS EXCLUSIVE TO MAP AND WEATHER APIS */

            // GET /api/actions - Gets all of the actions.
            vm.getAllActions = function() {
                return $http.get('/api/actions');
            };

            // GET /api/actions/all - Gets all of the actions.
            // TODO - remove this after switching up its call
            vm.getActionValues = function() {
                return $http.get('/api/actions/all');
            };

            // GET /api/users/:userId - Gets a single user
            vm.getUser = function(userId) {
                return $http.get('/api/users/' + userId);
            }

             // GET /api/users/- Gets all users
            vm.getAllUsers = function() {
                return $http.get('/api/users/');
            }

            // get the current user's info
            vm.getCurrentUser = function() {
                var deferred = $q.defer();

                // send a get request to the server
                $http.get('/api/users/' + _id).then(function(response) {
                    user = response.data;
                    deferred.resolve(user);
                }, function(error) {
                  $log.error(error);
                  deferred.reject();
                });

                // return promise object
                return deferred.promise;
            }

            // get the current user's matches
            vm.getCurrentUserMatches = function() {
                var deferred = $q.defer();
                var matches = {};

                // send a get request to the server
                $http.get('/api/matches/user/' + _id).then(function(response) {
                    matches = response.data;
                    deferred.resolve(matches);
                }, function(error) {
                  $log.error(error);
                  deferred.reject();
                });

                // return promise object
                return deferred.promise;
            }

            // GET /api/decks - Gets all decks
            vm.getAllDecks = function() {
                return $http.get('/api/decks');
            }

            // GET /api/decks/user/:userId - Gets all decks by a user (should only be one)
            vm.getUserDecks = function(userId) {
                return $http.get('/api/decks/user/' + userId);
            }

            // POST /api/users/:userId/results-win - updates the user's record
            vm.updateUserRecord = function(userId, result) {
                return $http.post('/api/users/' + userId + '/result-' + result);
            }

            // POST /api/users/:userId/results-win - updates the user's record
            vm.updateActionStatus = function(actionId, status) {
                return $http.post('/api/actions/' + actionId + '/status-' + status);
            }

            // POST /api/history - Save and then modify action values
            vm.updateActionValues = function() {
                return $http.post('/api/history/');
            }

            // POST /api/history - Save and then modify action values
            vm.createAction = function(action) {
                return $http.post('/api/actions/', JSON.stringify(action), config);
            }

            // PUT /api/actions/:aID - Update an action
            vm.updateActionBonuses = function(actionId, action) {
                return $http.put('api/actions/' + actionId, JSON.stringify(action), config);
            }

            // POST /api/matches - Creates a match for the specified user
            vm.createMatch = function(match) {
                return $http.post('/api/matches', JSON.stringify(match), config);
            }

            // GET /api/matches/user/:userId - Gets the most recent match for the user
            vm.getUserMatches = function(userId) {
                return $http.get('/api/matches/user/' + userId);
            }

            // POST /api/decks - Create a deck for the specified user
            vm.updateOrCreateDeck = function(deck, userId) {
                return $http.post(/* HOME + */'/api/decks/user/' + userId, JSON.stringify(deck), config);
            }

            // DELETE /api/decks/:deckId
            vm.deleteDeck = function(deckId) {
                return $http.delete(/* HOME + */'/api/decks/' + deckId);
            }

            // redirect browser to path
            vm.go = function(path) {
                return $location.path(path);
            };

            return vm;

        }(this);

    });

/***/ }),
/* 21 */
/***/ (function(module, exports) {

module.exports = {"mapbox":{"styleURL":"mapbox://styles/thebluecow/cj7t3fpw70uo12sphdf24ihyo","accessToken":"pk.eyJ1IjoidGhlYmx1ZWNvdyIsImEiOiJjajdzdndjd3AxZDl4MzducWNsMHprMzl2In0._WHslvWYG1dB7GQQGJJ6dw"},"openweather":{"key":"5a05f6359147d5fb27c9dbae68a8e285"},"timezonedb":{"apiKey":"I6PO4E87OH8B"}}

/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var angular = __webpack_require__(0);
var reporter = __webpack_require__(23);

angular.module('ijwApp')
    .service("gameService", function($http, $q, $log, dataService, config) {

        ! function(game) {

            // _actions will hold values from database
            var _actions = {};
            // used for individual play
            var _newActions = {};
            var _weather = {};

            var MAX_MOVES = config.MAX_MOVES;

            const MOMENTUM = config.MOMENTUM;

            // placeholder for later. For the moment, all games will be 'vs'
            // this will allow us to add tournament modes
            var _mode = null;

            // get current all actions with values
            (function() {
                dataService.getActionValues()
                    .then(function(actions) {
                        _actions = (actions !== 'null') ? actions.data : {};
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            // get weather conditions
            (function() {
                dataService.getWeather()
                    .then(function(weather) {
                        _weather = (weather !== 'null') ? weather.weather : {};
                        _weather.sunrise = _convertUnixTime(_weather.sys.sunrise);
                        _weather.sunset = _convertUnixTime(_weather.sys.sunset);
                    }, function(reason) {
                        $log.error(reason);
                    });
            }());

            // based on code from openweathermap
            // https://openweathermap.org/weather-conditions
            var _getWeatherCondition = function() {
                var code = parseInt(_weather.weather[0]['id']);
                code = 781;
                var condition = '';
                if (code === 511 || code === 601 || code === 602 || code === 622) {
                    condition = 'snow';
                }
                else if (code === 202 || code === 211 || code === 212 || code === 502 || code === 503 || code === 504)
                {
                    condition = 'rain';
                }
                else if (code === 781 || code === 900 || code === 902 || code === 905 || code === 961 || code === 962)
                {
                    condition = 'extreme';
                }

                return condition;
            }

            // verify decks are of the correct length
            var verifyDecks = function(player1, player2) {
                var verified = false;

                verified = (player1.actions.length === MAX_MOVES && player2.actions.length === MAX_MOVES);

                return verified;
            };

            // returns the action with the new value after bonuses were applied
            // for individual play, random values are first assigned then bonuses are +/-
            var _getValue = function(move, bonuses) {
                var newAction = {};
                var value = 0;

                // use the _newActions array (after randomized) when 'vs mode'
                if (_mode === 'vs') {
                        _newActions.forEach(function(action) {
                        if (action._id === move._id) {
                            value = action.value;
                            newAction.name = action.name;

                            if (bonuses.condition) {
                                value += action.bonuses[bonuses.condition];
                            }

                            if (bonuses.mission.location.terrain) {
                                value += action.bonuses[bonuses.mission.location.terrain];
                            }
                        }
                    });
                } else {
                        _actions.forEach(function(action) {
                        if (action._id === move._id) {
                            value = action.value;
                            newAction.name = action.name;

                            if (bonuses.condition) {
                                value += action.bonuses[bonuses.condition];
                            }

                            if (bonuses.mission.location.terrain) {
                                value += action.bonuses[bonuses.mission.location.terrain];
                            }
                        }
                    });
                }

                newAction.value = value;

                return newAction;
            }

            // based on same randomize function in action model
            // TODO: make this DRY
            var _randomizeValues = function() {
              
              var actionValues = [];
              var totalActions = 0;

              var _buildArray = function() {
                // set max to be half of totalActions
                var max = Math.floor(totalActions / 2);

                // push the same value twice since two actions
                // will have a value of 1, two of 2, etc.
                for (var i = 1; i <= max; i++) {
                  actionValues.push(i);
                  actionValues.push(i);
                }

                totalActions % 2 === 0 ? true : actionValues.push(max + 1);

                // call shuffle function to return the array of shuffled values
                return _shuffle(actionValues);
              };

              // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
              // Fisher-Yates Shuffle Algorithm
              function _shuffle(array) {
                  var currentIndex = array.length, temporaryValue, randomIndex;

                  // While there remain elements to shuffle...
                  while (0 !== currentIndex) {

                    // Pick a remaining element...
                    randomIndex = Math.floor(Math.random() * currentIndex);
                    currentIndex -= 1;

                    // And swap it with the current element.
                    temporaryValue = array[currentIndex];
                    array[currentIndex] = array[randomIndex];
                    array[randomIndex] = temporaryValue;
                  }

                  return array;
              }

              _newActions = angular.copy(_actions);

              totalActions = _newActions.length;
              _buildArray();

              _newActions.map(_newAction => {
                _newAction.value = actionValues.pop();
              }, function(err, result) {
                if (err) {
                    $log.error(err);
                }
              });
            }

            // compare the actions and return the round info (win, loss, tie)
            var compareActions = function(action_p1, action_p2) {
                var bonuses = {};
                bonuses.condition = _getWeatherCondition();
                bonuses.mission = dataService.getMission();

                action_p1 = _getValue(action_p1, bonuses);
                action_p2 = _getValue(action_p2, bonuses);

                var round = {};
                // set round information
                round.player1 = {
                    'name': action_p1.name,
                    'value': action_p1.value
                };

                round.player2 = {
                    'name': action_p2.name,
                    'value': action_p2.value
                };

                // check action values
                if (action_p1.value > action_p2.value) {
                    round.winner = 'player 1';
                    round.diff = (action_p1.value - action_p2.value);
                } else if (action_p2.value > action_p1.value) {
                    round.winner = 'player 2';
                    round.diff = (action_p2.value - action_p1.value);
                } else {
                    round.winner = 'tie';
                    round.diff = 0;
                }

                return round;
            }

            // converts time from openweathermap
            function _convertUnixTime(time) {
                //return new Date(time * 1000).toString().substring(4, 24);
                return new Date(time * 1000).toString();
            }

            // runs through the round information, determining match winner
            var _getResults = function(results) {
                var player1 = 0;
                var player2 = 0;
                var consecutive = 0;
                var last = '';
                var won = false;

                var lastFour = function(property) {
                    var move = property.substring(5, 6);
                    var moves = [];

                    if (!isNaN(move)) {

                        moves.push(parseInt(move));

                        while (moves.length < MOMENTUM) {
                            moves.push(--move);
                        }
                    }

                    return moves;
                };

                for (var property in results) {
                    if (results.hasOwnProperty(property) && !won) {
                        console.log('propery', results[property]);
                        var move = results[property];
                        if (move.winner === 'player 1') {
                            player1++;
                            if (last === 'player 1' || last === '' || last === 'tie') {
                                consecutive++;
                                last = 'player 1';
                            } else {
                                consecutive = 1;
                                last = 'player 1';
                            }
                        } else if (move.winner === 'player 2') {
                            player2++;
                            if (last === 'player 2' || last === '' || last === 'tie') {
                                consecutive++;
                                last = 'player 2';
                            } else {
                                consecutive = 1;
                                last = 'player 2';
                            }
                        } else {
                            last = 'tie';
                            consecutive = 0;
                        }

                        if (consecutive === MOMENTUM) {
                            results.winner = last;
                            results.cause = 'momentum';
                            results.final = lastFour(property);
                            won = true;
                        }
                    }


                }

                if (won && results.cause === 'momentum') {
                    results.reason = 'surrender';
                    results.story = reporter.getStory('momentum', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                } else if (player1 > player2) {
                    results.winner = 'player 1';
                    results.reason = 'moves';
                    results.story = reporter.getStory('standard', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                } else if (player2 > player1) {
                    results.winner = 'player 2';
                    results.reason = 'moves';
                    results.story = reporter.getStory('standard', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                } else {
                    results.winner = 'draw';
                    results.reason = 'draw';
                    results.story = reporter.getStory('draw', { "player 1" : results["player 1"], "player 2" : results["player 2"], "winner" : results.winner});
                }

                // pushes values to match form
                _updateResults(results);

                results.player_1_moves = player1;
                results.player_2_moves = player2;

                // calls the function to return log for controller
                _buildGameLog(results);

                return results;
            }

            // creates a match and also updates both users wins/losses/draws
            var _updateResults = function(results) {
                var promiseUser;
                var promiseOpp;
                var promiseMatch;
                var winnerId;
                var loserId;

                var match = {
                    "deck_one"  : results["deck_one"],
                    "deck_two"  : results["deck_two"],
                    "story"     : results.story,
                    "reason"    : results.reason
                };

                if (results.winner === "player 1") {
                    winnerId = results["player 1"]["_id"];
                    loserId  = results["player 2"]["_id"];
                } else {
                    winnerId = results["player 2"]["_id"];
                    loserId =  results["player 1"]["_id"];
                }

                match.winner = winnerId;
                match.player_one = results["player 1"]["_id"];
                match.player_two = results["player 2"]["_id"];
                
                promiseMatch =  dataService.createMatch(match)
                                .then(function(result) {
                                
                                }, function(reason) {
                                    $log.error(reason);
                                });

                if (results.reason === 'draw') {
                    promiseUser =   dataService.updateUserRecord(winnerId, 'draw')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                        $log.error(reason);
                                    });

                    promiseOpp  =   dataService.updateUserRecord(loserId, 'draw')
                                    .then(result => {
                                        // dataService.go('/results');
                                    }, reason => {
                                        $log.error(reason);
                                    });
                }

                else {
                    promiseUser =   dataService.updateUserRecord(winnerId, 'win')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                        $log.error(reason);
                                    });

                    promiseOpp  =   dataService.updateUserRecord(loserId, 'loss')
                                    .then(result => {
                                        //dataService.go('/result');
                                    }, reason => {
                                       $log.error(reason);
                                    });
                }

                $q.all([promiseMatch, promiseUser, promiseOpp]).then(function() {
                    dataService.go('/results');
                });
            };

            // build out the results that we want to expose
            var _buildGameLog = function(results) {
                // first delete all the properties we don't need
                var log = angular.copy(results);
                delete log.deck_one;
                delete log.deck_two;
                delete log.story;
                delete log['player 1'];
                delete log['player 2'];
                // hide the values in case a crafty player figures out the values
                // uncomment to hide this information
                /*for (var i = 0; i < MAX_MOVES; i++) {
                    delete log['move_' + i]['player1']['value'];
                    delete log['move_' + i]['player2']['value'];
                    delete log['move_' + i]['diff'];
                }*/

                game.log = log;
            }

            // return the game.log
            // game.log is set in _buildGameLog function
            game.getLastLog = function() {
                if (game.log) { return game.log; }
            }

            // open to controllers
            game.playGame = function(player1, player2, mode) {

                var results = {};
                results['player 1'] = player1.user;
                results['player 2'] = player2.user;
                results.deck_one = player1._id;
                results.deck_two = player2._id;

                _mode = mode;

                if (_mode === 'vs') {
                    _randomizeValues();
                }

                // first, verify deck action arrays have the correct length
                if (verifyDecks(player1, player2)) {
                    // loop through actions and return results
                    for (var i = 0; i < MAX_MOVES; i++) {
                        results['move_' + i] = compareActions(player1.actions[i], player2.actions[i]);
                    }

                }

                return _getResults(results);
            }

            return game;

        }(this);

    });

/***/ }),
/* 23 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";



var _stories = {
    "draw": [{
            "story": ["WINNER, your pathetic attempts at world domination were countered at ever turn.",
                " What's worse is that OPPONENT laughed at your feeble attempts and is now more emboldened than ever.",
                " Perhaps next time you should choose more carefully before picking on the neighborhood bully and now having",
                " your lunch money stolen daily. I would suggest training, starting with an opponent more equal to your skill",
                " level--Alf, perhaps--and trying anew. Just not on this server. We're ashamed of you."
            ]
        },
        {
            "story": ["WINNER, you came. You saw. You conquered...the time tested art of negotiation. Seeing that OPPONENT was of equal",
                " strength, you wisely chose to call your duel a draw and live to fight another day. Will this gain you honor in",
                " the eyes of your friends and family? Perhaps not. They are shortsighted and narrowminded. They are the type of",
                " people that buy cereal simply for the toys. Not you. Eat your Wheaties, friend. Reach for the stars. Perhaps",
                " next time you'll conquer your foe and win adulation for your clan."
            ]
        }
    ],
    "momentum": [{
            "story": ["Few things in life are as rewarding as absolute domination, and in this respect {WINNER} excel{s}. [OPPONENT] [was]",
                " overmatched at every turn, and in the end, [OPPONENT] decided that surrendering was the best course of action. Would",
                " someone with actual courage do such a thing? No. But [OPPONENT] [was] never one to possess much courage while {WINNER} measure{s}",
                " courage by the APC full. Congratulations WINNER. Of all the opponents you could have chosen this day, you found the most",
                " craven, and that, my friend, is a real talent!"
            ]
        },
        {
            "story": ["We're ashamed for [OPPONENT]. We've combed through the records and found little evidence to support that",
                " [OPPONENT] exists on our server[s]. Did {WINNER} invent this person? Surrender? Sometimes people have bad days. You roll out of bed.",
                " You slip on a banana peel. You veer into a truckload of manure. We understand. {WINNER} dominated [OPPONENT] so thoroughly",
                " that [OPPONENT] [was] seen weeping in the corner with a sun-warmed glass of Kool Aid and a worn copy of the Tao Te Ching.",
                " Perhaps combat isn't their specialty? Perk up, OPPONENT. Tomorrow you start your new job brushing feral hamsters at the",
                " local animal shelter. Opportunity!"
            ]
        }
    ],
    "standard": [{
            "story": ["One day, in the not so distant future, [OPPONENT] will look back upon this day and consider this battle as a",
                " learning experience. 'The loss does not matter,' [OPPONENT] think[s]. Of course, this is pretty silly and of course the",
                " loss matters. Moral victories are great for the movies, but in real life, {WINNER} understand{s} that the sweet taste of",
                " victory is more important than slow motion celebrations in the runner's up tent. Congratulations WINNER. The day is",
                " yours. Hold your head high as you march through the streets, waving your victory banner. Does a beverage taste better",
                " after a win. Yes. Yes it does. Enjoy a beverage of choice!"
            ]
        },
        {
            "story": ["It was perhaps the most exciting match we've yet seen here. Perhaps. It could also be described as a waste of our",
                " time because we bet money on [OPPONENT] and now we've lost. We lost big.",
                " The odds on {WINNER} were 100-1, the longest of long shots, and we bet accordingly. Is gambling illegal? Not when it's a sure thing.",
                " That's called investing, friend, and now we realize that we should have 'invested' in Cheetos instead. Oh, to think of our champagne",
                " wishes and caviar dreams now being turned into RC Cola and Spam. OPPONENT, we never should have doubted your ability to screw everything up.",
                " WINNER, we never should have doubted your tenacity and force of will. Also your big guns. Those came in handy.",
                " Probably more than the tenacity and will. Yes. Much, much more."
            ]
        }
    ]
};

var _replaceRules = {

};

function _getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

function _capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function _buildStory(storyArray, players) {
    var story = '';
    var opponent = '';
    var winner = '';

    if (players.winner === "player 1" || players.winner === "draw") {
        winner = players["player 1"]["name"];
        opponent = players["player 2"]["name"];
    } else {
        winner = players["player 2"]["name"];
        opponent = players["player 1"]["name"];
    }

    for (var i = 0; i < storyArray['story'].length; i++) {
        var line = storyArray['story'][i];
        // let's do some fun 2nd person and verb conjugation
        /* the rules:
            1. [] - brackets are for opponent
            2. {} - braces are for winner
            3. if player1 wins, {s} should be removed; [s] should be replaced with s;
               [was] remains as was
            4. if player1 loses, {s} remains as s; [was] becomes were; {s} is dropped
        */

        if (players.winner === "player 1" || players.winner === "draw") {
            line = line.replace("{WINNER}", 'you');
            line = line.replace("{s}", '');
            line = line.replace("[OPPONENT]", opponent);
            line = line.replace("[was]", "was");
            line = line.replace("[s]", "s");
        } else {
            line = line.replace("{WINNER}", winner);
            line = line.replace("{s}", 's');
            line = line.replace("[OPPONENT]", 'you');
            line = line.replace("[was]", 'were');
            line = line.replace("[s]", '');
        }
        line = line.replace("WINNER", winner);
        line = line.replace("OPPONENT", opponent);
        line = line.replace('. you', '. You');

        story += line;
    }
    return story;
}

function getStory(type, players) {
    var story = _stories[type];
    story = story[_getRandomInt(0, story.length)];
    return _buildStory(story, players);
}

module.exports.getStory = getStory;

/***/ }),
/* 24 */,
/* 25 */
/***/ (function(module, exports) {

module.exports = [{"city":{"location":"Amazon","global":[-62.215881,-3.465305],"title":"Deep in the Amazon","story":"The jungle is teeming with Cobra operatives. We haven't seen activity like this since last year's Dreanok's Super Bowl party, and NOBODY wants the Patriots to win again. HQ speculates it's deep in the jungle where Tom Brady finds his elixir or youth, and we're tasked with stopping it.","terrain":"jungle","offset":0}},{"city":{"location":"Russia, Novosibirsk","global":[82.93573270000002,55.00835259999999],"title":"Sibera Novosibirsk","story":"Cobra siezes control of the Russian servers, posting fake news on FaceBook. The Cobra operative Litterbox was hired to create cat memes that controlled the viewer's mind into wishing to eat processed fish sticks and play with wadded up aluminum foil. Needless to say, the situation is...delicate. Insurance providers are scrambling to add a hairball clause.","terrain":"city","offset":11}},{"city":{"location":"Bruges, Belgium","global":[3.2246995000000425,51.209348],"title":"In Bruges?","story":"GI Joe finds Cobra operatives hiding away in a small bread and breakfast in Bruges, Belgium. In Bruges? Sure, in Bruges. There are canals, the architecture is beautiful, and if you're a farmer you'll love the historical attractions. Mind the stairwell to the tower. It's narrow!","terrain":"city","offset":6}},{"city":{"location":"Kalahari Desert","global":[21.093731,-25.592021],"title":"Sand, Sand, Everywhere ","story":"Cobra has taken shelter in southern Africa, building B.A.T.S. and robotic cheetahs that meow in code. HQ is worried that the cheetahs will be organized into choirs in time for the holiday season and pass our valued secrets. They must be stopped!","terrain":"desert","offset":6}},{"city":{"location":"Mariana Trench","global":[142.1999992,11.3499986],"title":"Time to get Soaked","story":"Deep in the Mariana Trench, our sensors have picked up disturbing activity that we believe to be Cobra working in the area. Based on local intelligence--Echo the Dolphin and friends--we believe Cobra is building a Rebounderz style trampoline facility that will undoubtedly be too much fun to ignore. From there, they will capture the minds of unwitting patrons into buying souvenirs and cruddy funnel cakes. Yuck! Stop this, okay?","terrain":"ocean","offset":14}}]

/***/ })
],[1]);