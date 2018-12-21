/*
 Copyright 2005 - 2018 Blueface Ltd.
 All Rights Reserved.

 All information contained herein is, and remains the property of Blueface Ltd.
 and its suppliers, if any.  The intellectual and technical concepts contained
 herein are proprietary to Blueface Ltd. And its suppliers and may be covered by Irish,
 European and Foreign Patents, patents in process, and are protected by trade secret or
 copyright law. Dissemination of this information or reproduction of this material
 is strictly forbidden unless prior written permission is obtained from Blueface Ltd.
 */

'use strict';

/**
 * @ngdoc service
 * @name BfDnD
 * @description Custom drag & drop module
 *
 */

(function() {
  var bfDnDModule = angular.module('bf.DnD', []); // <-- Module to export

  var isDebugMode = false;    // Turn it on to see debugging info on the view
  var isAccurateMode = false; // It requires more calculation but gives a better accuracy to select the active placeholder
  var renderedShadowRect = {};

  bfDnDModule.service('BfDnD', function($timeout, $rootScope) {
    "ngInject";
    var BfDnD = {};
    BfDnD.isDragging = false;       // Whether there is a dragging operation ongoing
    BfDnD.bfDraggable = null;       // Model attach to the dragging element
    BfDnD.bfDragMode = null;        // Current dragging mode (copy / move)

    // Callback functions
    BfDnD.onDragStart = angular.noop;   // When a drag operation starts
    BfDnD.onDragEndOk = angular.noop;   // When a drag operation finishes successfully (drop into valid container)
    BfDnD.onDragEndKo = angular.noop;   // When a drag operation finishes unsuccessfully (drop out of any container)

    BfDnD.containers = [];              // List of the registered containers (<bf-drop-container>)
    BfDnD.placeholders = [];            // List of the registered placeholders (<bf-drop-placeholder>)
                                        // id, element, model, containerId
    BfDnD.activePlaceholder = null;     // Reference to the active (closest) placeholder in placeholders[]
    BfDnD.activeContainer = null;       // Reference to the active (dragging over) container in containers[]

    // Internals
    var isDropping = false;   // To know whether the drop occurs into a valid container (true) or not (false)
    var currentDropContainer = null; // Model attach to the current dropping container

    // This happens when you start dragging a <bf-draggable> element
    BfDnD.startDrag = function($event, $element, bfDraggable, bfDragMode) {
      isDropping = false;
      BfDnD.isDragging = true;
      BfDnD.bfDraggable = bfDraggable;
      BfDnD.bfDragMode = bfDragMode;
      BfDnD.activePlaceholder = null;

      if (typeof BfDnD.onDragStart === 'function') {
        BfDnD.onDragStart($element, bfDraggable, bfDragMode);
        $rootScope.$apply();
      }
    };

    // This happens when you drop a dragging element into a <bf-drop-container>
    BfDnD.dropInto = function($event, $element, bfDropContainer) {
      if (BfDnD.isDragging) {
        isDropping = true;
        currentDropContainer = bfDropContainer;
      }
    };

    // This happens when you stop dragging an element. I can be dropped into a container or out
    BfDnD.dragEnd = function() {
      var ghost = document.getElementById('bf-drag-ghost-id');
      if (!!ghost) { ghost.remove(); }

      if (isDropping) { // That means the drop was into a container
        if (typeof BfDnD.onDragEndOk === 'function') {
          BfDnD.onDragEndOk(BfDnD.bfDraggable, currentDropContainer, BfDnD.activePlaceholder);
        }
      } else {
        if (typeof BfDnD.onDragEndKo === 'function') {
          BfDnD.onDragEndKo(BfDnD.bfDraggable);
        }
      }
      isDropping = false;
      BfDnD.isDragging = false;
      BfDnD.activePlaceholder = null;
      BfDnD.bfDragMode = null;
      $rootScope.$apply();
    };

    return BfDnD;
  });

  bfDnDModule.directive('bfDraggable', function(BfDnD, $timeout) {
    "ngInject";
    return {
      restrict: 'A',
      scope: {
        bfDraggable : '=',
        bfDragMode  : '@'   // copy (default) --> Keeps the original element
                            // move --> Removes the original element when drag starts
      },
      link: function($scope, $element, $attrs) {

        // Turn DOM element draggable automatically
        $element.attr('draggable', 'true');

        $element.on('dragstart', function(event) { // When the drag starts
          event = event.originalEvent || event;
          $element.addClass('is-dragging');
          $scope.bfDragMode = $scope.bfDragMode || 'copy';

          // The dragging data is handled by $scope.bfDraggable, but we still need to add a dataTransfer to make it work in Firefox
          // Correct mime type would be 'application/x-dnd', but Microsoft Edge and IE only support 'application/json' / 'Text'
          // https://github.com/marceljuenemann/angular-drag-and-drop-lists/wiki/Data-Transfer-Design
          event.dataTransfer.setData('Text', '');

          // Creates a div to wrap a copy of the selected element, and float it along the dragging
          var ghost = document.getElementById('bf-drag-ghost-id');
          if (!!ghost) { ghost.remove(); }
          ghost = document.createElement('div');
          ghost.setAttribute('id', 'bf-drag-ghost-id');
          ghost.setAttribute('class', 'bf-drag-ghost');
          ghost.appendChild(this.cloneNode(true));
          document.body.appendChild(ghost);
          ghost.style.position = 'fixed';

          var isSafari = window.safari !== undefined;
          if (!isSafari) {
            // No Safari browsers (the setDragImage needs to be done in the same cycle)
            renderedShadowRect = document.getElementById('bf-drag-ghost-id').getBoundingClientRect();
            renderedShadowRect.halfWidth = renderedShadowRect.width / 2;
            renderedShadowRect.halfHeight = renderedShadowRect.height / 2;
            event.dataTransfer.setDragImage(ghost, renderedShadowRect.halfWidth , renderedShadowRect.halfHeight);
            $timeout(function() { // Firefox needs to wait till ghost is rendered in the dom
              ghost.style.display = 'none';
              BfDnD.startDrag(event, $element, $scope.bfDraggable, $scope.bfDragMode);
            });

          } else { // Safari is super picky and needs to have the element rendered before we use setDragImage()
            $timeout(function() {
              renderedShadowRect = document.getElementById('bf-drag-ghost-id').getBoundingClientRect();
              renderedShadowRect.halfWidth = renderedShadowRect.width / 2;
              renderedShadowRect.halfHeight = renderedShadowRect.height / 2;
              event.dataTransfer.setDragImage(ghost, renderedShadowRect.halfWidth , renderedShadowRect.halfHeight);
              ghost.style.display = 'none';
              BfDnD.startDrag(event, $element, $scope.bfDraggable, $scope.bfDragMode);
            }, 20);
          }

          event.stopPropagation();
        });

        if (isDebugMode) { // When dragging the element (it's constantly triggered)
          $element.on('drag', function(event) { debugRenderPannel(event, BfDnD); });
        }

        $element.on('dragend', function(event) { // When the drag ends (drop)
          $element.removeClass('is-dragging');
          BfDnD.dragEnd(event, $element, $scope.bfDraggable);
          if (isDebugMode) { debugRenderPannel(event, BfDnD); }
        });

        // Workaround to make element draggable in IE9
        $element.on('selectstart', function() {
          if (this.dragDrop) this.dragDrop();
        });

      }
    };
  });

  bfDnDModule.directive('bfDropContainer', function(BfDnD, $timeout, $rootScope) {
    "ngInject";
    return {
      restrict: 'A',
      scope: {
        id: '@',                    // Unique identifier
        bfDropContainer: '=?'       // Object to link
      },
      link: function($scope, $element, $attrs) {
        var dragStatus = 0; // 0=none, 1=over, 2=leaving
        var container = {};

        // Register the element in BfDnD.containers[]
        if (!!$scope.id) {

          // Make sure it's not registered yet
          for (var ind = 0; ind < BfDnD.containers.length; ind++) {
            if (BfDnD.containers[ind].id === $scope.id) {
              console.error('<bf-drop-container> with a duplicated ID: ', $scope.id);
              BfDnD.containers.splice(ind, 1);
              break;
            }
          }
          // if (BfDnD.containers.getById($scope.id)) {
          //   console.error('<bf-drop-container> with a duplicated ID: ', $scope.id);
          //   BfDnD.containers.removeById($scope.id);
          // }
          container = {
            id      : $scope.id,
            element : $element,
            model   : $scope.bfDropContainer
          };
          BfDnD.containers.push(container);
        }

        // Unregister on destroy
        $scope.$on('$destroy', function() {
          // BfDnD.containers.removeById($scope.id);
          var ind = BfDnD.containers.indexOf(container);
          if (ind >= 0) { BfDnD.containers.splice(ind, 1); }
        });

        // Get all <bf-drop-placeholder> elements for this container (with bf-drop-container-id = [element.id])
        var allPlaceholders = BfDnD.placeholders.filter(function(item) { return (!!$attrs.id && item.containerId === $attrs.id); });

        // Variables to manage the calcPositions() delay
        var delayTimeout = null, isDelayed = false;

        // When dragging the element over it (it's constantly triggered)
        $element.on('dragover', function($event) {
          dragStatus = 1;
          BfDnD.activeContainer = container;

          // This weird function is to delay the placeholder's position calculation
          // If the placeholder positions are constantly changing, only recalculate their center position every .5 seconds
          // This should give enough time for animations or other transitions (expanding placeholders)
          function calcPositions() {
            if (!!delayTimeout && delayTimeout.$$state.status === 0) {  // If timeout running
              isDelayed = true;
            } else {

              // Calc the center position for every placeholder
              allPlaceholders.forEach(function(placeholder) {
                var dropSpot = placeholder.element.get(0).getBoundingClientRect();
                placeholder.midX = dropSpot.left + (dropSpot.width / 2);
                placeholder.midY = dropSpot.top + (dropSpot.height / 2);

                if (isAccurateMode) {
                  placeholder.rect = {
                    left   : dropSpot.left,
                    right  : dropSpot.left + dropSpot.width,
                    top    : dropSpot.top,
                    bottom : dropSpot.top + dropSpot.height,
                    width  : dropSpot.width,
                    height : dropSpot.height
                  }
                }
              });

              // Set the timeout to avoid triggering that again for the next 0.5s
              delayTimeout = $timeout(function() {
                if (isDelayed) {
                  delayTimeout = null;
                  isDelayed = false;
                  calcPositions();
                }
              }, 500);
            }
          }

          calcPositions();

          // Select which placeholders is closest to the dragging option
          var closestPlaceholder = null;
          if (!isAccurateMode) {

            // It calculates the distance between the placeholder center
            // and the mouse pointer for every placeholder, and takes the element with the lowest.
            allPlaceholders.forEach(function(placeholder) { // Find the closest placeholder
              // Pythagoras:
              placeholder.distance = (($event.clientX - placeholder.midX) * ($event.clientX - placeholder.midX))
                                   + (($event.clientY - placeholder.midY) * ($event.clientY - placeholder.midY));

              if (!closestPlaceholder || placeholder.distance < closestPlaceholder.distance) {
                closestPlaceholder = placeholder;
              }
            });

          } else {

            // Accurate mode calculation.
            // Find out the shortest distance between the borders (rectangles) of the placeholder and the shadow
            // To do so, we asses the different cases that positioning can have:
            // Case 1, 3, 5, 7 --> They are not aligned, so the shortest distance goes from one corner to another
            // Case 2, 6 --> Aligned vertically: the shortest distance is the difference between top/bottom margins
            // Case 4, 8 --> Aligned horizontally: the shortest distance is the difference between left/right margins
            // Case 88, 99 --> Intersection. In case of intersection (part or all shadow is inside the placeholder),
            //                 instead of calculating the distance between 2 points, we calculate the square area
            //                 that intersects. We set this value as negative, so the bigger the area, the closest
            //                 we assume the placeholder is from the shadow (biggest intersection = active placeholder)
            var shadowRect = {
              left   : $event.clientX - renderedShadowRect.halfWidth,
              right  : $event.clientX + renderedShadowRect.halfWidth,
              top    : $event.clientY - renderedShadowRect.halfHeight,
              bottom : $event.clientY + renderedShadowRect.halfHeight
            };
            allPlaceholders.forEach(function(placeholder) {
              var sh = shadowRect;
              var ph = placeholder.rect;
              var x = 0, y = 0;

              if (!isDebugMode) {

                // In those cases, calc the distance from the angles (no possible intersection)
                if      (sh.right < ph.left && sh.bottom < ph.top) {  x = ph.left - sh.right; y = ph.top - sh.bottom; } // Case 1
                else if (sh.left > ph.right && sh.bottom < ph.top) {  x = ph.right - sh.left; y = ph.top - sh.bottom; } // Case 3
                else if (sh.left > ph.right && sh.top > ph.bottom) {  x = sh.left - ph.right; y = sh.top - ph.bottom; } // Case 5
                else if (sh.right < ph.left && sh.top > ph.bottom) {  x = ph.left - sh.right; y = ph.bottom - sh.top; } // Case 7
                else if (sh.left <= ph.right && sh.right >= ph.left) {
                  if      (sh.bottom < ph.top) { y = ph.top - sh.bottom; x = 0; } // Case 2
                  else if (sh.top > ph.bottom) { y = sh.top - ph.bottom; x = 0; } // Case 6
                } else if (sh.top <= ph.bottom && sh.bottom >= ph.top) {
                  if      (sh.left > ph.right) { x = sh.left - ph.right; y = 0; } // Case 4
                  else if (sh.right < ph.left) { x = sh.right - ph.left; y = 0; } // Case 8
                }
                if (!!x || !!y) {
                  placeholder.distance = ((x*x)+(y*y)); // Distance between corners
                } else {
                  x = Math.abs((sh.right > ph.right ? ph.right : sh.right) - (sh.left < ph.left ? ph.left : sh.left));
                  y = Math.abs((sh.top < ph.top ? ph.top : sh.top) - (sh.bottom > ph.bottom ? ph.bottom : sh.bottom));
                  placeholder.distance = (x * y * -1); // Intersection area
                }

              } else {
                debugDistCalc(placeholder, shadowRect);
                placeholder.distance = placeholder.minDistArr[4];
              }

              if (isNaN(placeholder.distance)) { placeholder.distance = 99999; }

              if (!closestPlaceholder || placeholder.distance < closestPlaceholder.distance) {
                closestPlaceholder = placeholder;
              }
            });
          }

          // If the active placeholder has to change (or be removed), switch the 'active-placeholder' class
          if (!BfDnD.activePlaceholder || !closestPlaceholder || (BfDnD.activePlaceholder !== closestPlaceholder)) {
            if (!!BfDnD.activePlaceholder && !!BfDnD.activePlaceholder.element) {
              BfDnD.activePlaceholder.element.removeClass('active-placeholder');
            }
            if (!!closestPlaceholder && !!closestPlaceholder.element) {
              BfDnD.activePlaceholder = closestPlaceholder;
              BfDnD.activePlaceholder.element.addClass('active-placeholder');
            }
          }

          if (isDebugMode) { debugRenderCanvas(allPlaceholders, closestPlaceholder, $rootScope, $event, BfDnD, $element); }
          $event.preventDefault();

        });

        // When the dragging pointer gets into the container area
        $element.on('dragenter', function($event) {
          dragStatus = 1;
          $element.addClass('dragging-over');
          $event.preventDefault();
        });

        // When the dragging pointer leaves the container area
        $element.on('dragleave', function($event) {
          dragStatus = 2;
          $timeout(function() {
            if (dragStatus === 2) {
              dragStatus = 0;
              $element.removeClass('dragging-over');
              if (!!BfDnD.activePlaceholder && !!BfDnD.activePlaceholder.element) {
                BfDnD.activePlaceholder.element.removeClass('active-placeholder');
                BfDnD.activePlaceholder = null;
              }
              BfDnD.activeContainer = null;
            }
          }, 50);
          $event.preventDefault();
        });

        // When an element is dropped onto the container
        $element.on('drop', function($event) {
          $element.removeClass('dragging-over');
          if (!!BfDnD.activePlaceholder && !!BfDnD.activePlaceholder.element) {
            BfDnD.activePlaceholder.element.removeClass('active-placeholder');
          }
          BfDnD.dropInto($event, $element, $scope.bfDropContainer);
          $event.preventDefault();
        });

      }
    };
  });

  bfDnDModule.directive('bfDropPlaceholder', function(BfDnD) {
    "ngInject";
    return {
      restrict: 'E',
      transclude: true,
      template:
      '<div class="{{placeholder.wrapperClass}}">' +
      '  <ng-transclude></ng-transclude>' +
      '</div>',
      scope: {
        bfDropModel : '=?',
        bfDropContainerId : '@'    // Id of the <bf-drop-container> the spot is linked to
      },
      link: function($scope, $element, $attrs) {

        // Check if the element is already registered in BfDnD.placeholders[]
        BfDnD.placeholders.forEach(function(placeholder) {
          if (placeholder.element === $element) {
            $scope.placeholder = placeholder;
          }
        });

        // If not, register the element in BfDnD.placeholders[]
        if (!$scope.placeholder) {
          $scope.placeholder = {
            element      : $element,
            model        : $scope.bfDropModel,
            containerId  : $scope.bfDropContainerId,
            wrapperClass : 'valid'
          };
          BfDnD.placeholders.push($scope.placeholder);
        }

        // Unregister on destroy
        $scope.$on('$destroy', function() {
          var ind = BfDnD.placeholders.indexOf($scope.placeholder);
          if (ind >= 0) { BfDnD.placeholders.splice(ind, 1); }
        });

      }
    };
  });

  // --------------------------------------------------------------------------------------------------
  // All this below is for debugging.
  var BfDnDPE = {};
  var canvasElem;
  if (isDebugMode) { setDebugMode(BfDnDPE); }
  function setDebugMode() {
    // Creates canvas element to print debugging lines to the placeholders while dragging
    canvasElem = document.getElementById('bf-dnd-canvas-debugger') || document.createElement('canvas');
    canvasElem.setAttribute('id', 'bf-dnd-canvas-debugger');
    canvasElem.style.position = 'fixed';
    canvasElem.style.left = '0';
    canvasElem.style.top = '0';
    canvasElem.style['z-index'] = '-1';
    canvasElem.width = window.innerWidth;
    canvasElem.height = window.innerHeight;
    document.body.appendChild(canvasElem);

    // Creates debugging panel to show debugging info
    var devPannel = document.getElementById('bf-dnd-pannel-debugger') || document.createElement('div');
    devPannel.setAttribute('id', 'bf-dnd-pannel-debugger');
    devPannel.style.position = 'fixed';
    devPannel.style.left = '10px';
    devPannel.style.right = '10px';
    devPannel.style.bottom = '10px';
    devPannel.style.height = '100px';
    devPannel.style['z-index'] = '9999';
    devPannel.style['background'] = 'rgba(255, 165, 83, 0.85)';
    devPannel.style['padding'] = '10px';
    devPannel.style['border'] = '3px solid black';
    devPannel.style['color'] = 'black';

    addDEl('isDragging');
    addDEl('bfDraggable', ', ');
    addDEl('dragPos', ', ');
    devPannel.appendChild(document.createElement('br'));
    addDEl('activeContainer');
    addDEl('activePlaceholder', ', ');
    devPannel.appendChild(document.createElement('br'));
    addDEl('placeholders');
    function addDEl(propName, prefix) {
      var elem = document.createElement('span');
      elem.textContent = (prefix? prefix:'') + propName + ' = ';
      devPannel.appendChild(elem);
      BfDnDPE[propName] = document.createElement('span');
      BfDnDPE[propName].style['color'] = 'blue';
      devPannel.appendChild(BfDnDPE[propName]);
    }
    document.body.appendChild(devPannel);
  }
  function debugRenderPannel($event, BfDnD) {
    BfDnDPE.isDragging.textContent = (BfDnD.isDragging ? 'true' : 'false');
    BfDnDPE.dragPos.textContent = '[' + $event.clientX + ', ' + $event.clientY + ']';
    BfDnDPE.bfDraggable.textContent = (!!BfDnD.bfDraggable ? JSON.stringify(BfDnD.bfDraggable) : '-');

    BfDnDPE.activeContainer.textContent = (!!BfDnD.activeContainer ? BfDnD.activeContainer.id : '-');
    var phInd = BfDnD.placeholders.indexOf(BfDnD.activePlaceholder); if (phInd < 0) { phInd = '-'; }
    BfDnDPE.activePlaceholder.textContent = '[' + phInd + '] ' + (!!BfDnD.activePlaceholder ? JSON.stringify(BfDnD.activePlaceholder.model) : '-');

    var phList = '';
    BfDnD.placeholders.forEach(function(ph, ind) {
      if (!!ind) { phList += ', '; }
      // if (ind == phInd) { phList += '<<'; }

      if (isAccurateMode && ph.minDistArr) {
        phList += '[' + ind + ']=('
          + Math.round(ph.minDistArr[0]) + ', '
          + Math.round(ph.minDistArr[1]) + ', '
          + Math.round(ph.minDistArr[2]) + ', '
          + Math.round(ph.minDistArr[3])
          +  ', d=' + Math.round(ph.minDistArr[4]) + ')';
      } else {
        phList += '[' + ind + ']=(' + Math.round(ph.midX) + ',' + Math.round(ph.midY) +  ', d=' + Math.round(ph.distance) + ')';
      }

      if (ind == phInd) { phList += '<--- active  '; }
    });
    BfDnDPE.placeholders.textContent = phList;

    if (!BfDnD.isDragging) {
      canvasElem.style['z-index'] = '-1';
    }
  }

  function debugRenderCanvas(allPlaceholders, closestPlaceholder, $rootScope, $event, BfDnD, $containerElement) {
    var c = document.getElementById('bf-dnd-canvas-debugger');
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);

    if (canvasElem.style['z-index'] === '-1') {
      var contElem = $containerElement.get(0);
      var contZInd = contElem.style['z-index'];
      if (!contZInd) {
        contZInd = '100'; contElem.style['z-index'] = contZInd;
      }
      canvasElem.style['z-index'] = ((+contZInd) - 1) + '';
    }

    if (!isAccurateMode) {
      allPlaceholders.forEach(function(placeholder) {
        ctx.beginPath();
        ctx.moveTo(placeholder.midX, placeholder.midY);
        ctx.lineTo($event.clientX - 1, $event.clientY - 1);
        ctx.lineWidth = (closestPlaceholder == placeholder ? 5 : 1);
        ctx.strokeStyle = '#ff0000';
        ctx.stroke();
      });

    } else {
      allPlaceholders.forEach(function(placeholder, phInd) {
        if (!!placeholder.minDistArr) {
          var distArr = placeholder.minDistArr;
          // placeholder.distances.forEach(function(distArr) {
            var fillColor;
            switch (phInd) {
              case 0: fillColor = 'red'; break;
              case 1: fillColor = 'blueviolet'; break;
              case 2: fillColor = 'darkcyan'; break;
              case 3: fillColor = 'darkorange'; break;
              case 4: fillColor = 'blue'; break;
              case 5: fillColor = 'deeppink'; break;
              case 6: fillColor = 'chartreuse'; break;
              default: fillColor = '#ff0000'; break;
            }
            ctx.beginPath();
            if (distArr[4] >= 0) {
              ctx.moveTo(distArr[0], distArr[1]);
              ctx.lineTo(distArr[2], distArr[3]);
              ctx.lineWidth = (closestPlaceholder == placeholder ? 5 : 1);
              ctx.strokeStyle = fillColor;
              ctx.stroke();

            } else {
              ctx.rect(distArr[0], distArr[1], distArr[2] - distArr[0], distArr[3] - distArr[1]);
              ctx.fillStyle = fillColor;
              ctx.fill();
            }

          // });
        }
      });
    }
  }

  // Extended version of the distance calculation between 2 rectangles, adding debuggind data
  function debugDistCalc(placeholder, shadowRect) {
    var sh = shadowRect;
    var ph = placeholder.rect;
    var fp, x, y;
    var intersect = false;

      // In those cases, calc the distance from the angles (no possible intersection)
    if (sh.right < ph.left && sh.bottom < ph.top) { // Case 1
      x = ph.left - sh.right;
      y = ph.top - sh.bottom;
      placeholder.minDistArr = [ph.left, ph.top,  sh.right, sh.bottom, (x*x)+(y*y)];
      placeholder.dCase = 1;
    }
    if (sh.left > ph.right && sh.bottom < ph.top) { // Case 3
      x = ph.right - sh.left;
      y = ph.top - sh.bottom;
      placeholder.minDistArr = [ph.right, ph.top,  sh.left, sh.bottom, (x*x)+(y*y)];
      placeholder.dCase = 3;
    }
    if (sh.left > ph.right && sh.top > ph.bottom) { // Case 5
      x = sh.left - ph.right;
      y = sh.top - ph.bottom;
      placeholder.minDistArr = [ph.right, ph.bottom,  sh.left, sh.top, (x*x)+(y*y)];
      placeholder.dCase = 5;
    }
    if (sh.right < ph.left && sh.top > ph.bottom) { // Case 7
      x = ph.left - sh.right;
      y = ph.bottom - sh.top;
      placeholder.minDistArr = [ph.left, ph.bottom,  sh.right, sh.top, (x*x)+(y*y)];
      placeholder.dCase = 7;
    }

    if (sh.left < ph.right && sh.right > ph.left) {
      if (sh.right > ph.left && sh.right < ph.right) { fp = sh.right; }
      if (sh.left > ph.left && sh.left < ph.right)   { fp = sh.left; }

      if (sh.bottom < ph.top) { // Case 2
        y = ph.top - sh.bottom; x = 0;
        placeholder.minDistArr = [fp, ph.top, fp, sh.bottom, (x*x)+(y*y)];
        placeholder.dCase = 2;
      } else {
        if (sh.top > ph.bottom) { // Case 6
          y = sh.top - ph.bottom; x = 0;
          placeholder.minDistArr = [fp, ph.bottom,  fp, sh.top, (x*x)+(y*y)];
          placeholder.dCase = 6;
        } else {
          // Intersection
          placeholder.minDistArr = [ph.left, ph.bottom,  ph.right, ph.top, 0];
          placeholder.dCase = 99;
          intersect = true;
        }
      }
    }

    if (sh.top < ph.bottom && sh.bottom > ph.top) {
      if (sh.bottom > ph.top && sh.bottom < ph.bottom) { fp = sh.bottom; }
      if (sh.top > ph.top && sh.top < ph.bottom)       { fp = sh.top; }

      if (sh.left > ph.right) { // Case 4
        x = sh.left - ph.right; y = 0;
        placeholder.minDistArr = [ph.right, fp,  sh.left, fp, (x*x)+(y*y)];
        placeholder.dCase = 4;
      } else {
        if (sh.right < ph.left) { // Case 8
          x = sh.right - ph.left; y = 0;
          placeholder.minDistArr = [ph.left, fp,  sh.right, fp, (x*x)+(y*y)];
          placeholder.dCase = 8;
        } else {
          // Intersection
          placeholder.minDistArr = [ph.left, ph.bottom,  ph.right, ph.top, 0];
          placeholder.dCase = 88;
          intersect = true;
        }
      }
    }


    if (intersect) {
      placeholder.minDistArr[0] = (sh.left < ph.left ? ph.left : sh.left);
      placeholder.minDistArr[2] = (sh.right > ph.right ? ph.right : sh.right);
      placeholder.minDistArr[1] = (sh.top < ph.top ? ph.top : sh.top);
      placeholder.minDistArr[3] = (sh.bottom > ph.bottom ? ph.bottom : sh.bottom);

      x = Math.abs(placeholder.minDistArr[2] - placeholder.minDistArr[0]);
      y = Math.abs(placeholder.minDistArr[1] - placeholder.minDistArr[3]);
      placeholder.minDistArr[4] = x * y * -1;
    }
  }

}());