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

  myApp.service('BfDnD', function($timeout, $rootScope) {
    "ngInject";
    var BfDnD = {};
    BfDnD.isDragging = false;       // Whether there is a dragging operation ongoing
    BfDnD.isDropping = false;       // Whether the drop option occurs into a valid container (true) or not (false)
    BfDnD.bfDraggable = null;       // Model attach to the dragging element
    BfDnD.bfDragMode = null;        // Current dragging mode (copy / move)
    BfDnD.bfDropContainer = null;   // Model attach to the dropping container (array where to push)
    BfDnD.draggingElement = null;   // Html dragging element
    BfDnD.droppingElement = null;   // Html container element where draggingElement is dropped

    // Callback functions
    BfDnD.onDragStart = angular.noop;   // When a drag operation starts
    BfDnD.onDragEndOk = angular.noop;   // When a drag operation finishes successfully (drop into valid container)
    BfDnD.onDragEndKo = angular.noop;   // When a drag operation finishes unsuccessfully (drop out of any container)

    BfDnD.containers = [];              // List of the registered containers (<bf-drop-container>)
    BfDnD.placeholders = [];            // List of the registered placeholders (<bf-drop-placeholder>)
                                        // id, element, model, containerId
    BfDnD.activePlaceholder = null;     // Reference to the active (closest) placeholder in placeholders[]
    BfDnD.activeContainer = null;       // Reference to the active (dragging over) container in containers[]

    // This happens when you start dragging a <bf-draggable> element
    BfDnD.startDrag = function($event, $element, bfDraggable, bfDragMode) {
      BfDnD.isDragging = true;
      BfDnD.isDropping = false;
      BfDnD.bfDraggable = bfDraggable;
      BfDnD.bfDragMode = bfDragMode;
      BfDnD.draggingElement = $element;
      BfDnD.activePlaceholder = null;

      if (typeof BfDnD.onDragStart === 'function') {
        BfDnD.onDragStart($element, bfDraggable, bfDragMode);
        $rootScope.$apply();
      }
    };

    // This happens when you drop a dragging element into a <bf-drop-container>
    BfDnD.dropInto = function($event, $element, bfDropContainer) {
      if (BfDnD.isDragging) {
        BfDnD.isDropping = true;
        BfDnD.bfDropContainer = bfDropContainer;
        BfDnD.droppingElement = $element;

        // Dragging element is not destroyed. It is append to the body, so it can always trigger the dragend
        // If no draggingElement (it was destroyed) dragEnd will never be triggered: Do it manually
        // if (!BfDnD.draggingElement) {
        //   BfDnD.dragEnd();
        // }
      }
    };

    // This happens when you stop dragging an element. I can be dropped into a container or out
    BfDnD.dragEnd = function() {
      var ghost = document.getElementById('bf-drag-ghost-id');
      if (!!ghost) { ghost.remove(); }

      if (BfDnD.isDropping) { // That means the drop was into a container
        if (typeof BfDnD.onDragEndOk === 'function') {
          BfDnD.onDragEndOk(BfDnD.bfDraggable, BfDnD.bfDropContainer, BfDnD.activePlaceholder);
        }
      } else {
        if (typeof BfDnD.onDragEndKo === 'function') {
          BfDnD.onDragEndKo();
        }
      }
      BfDnD.isDragging = false;
      BfDnD.isDropping = false;
      BfDnD.activePlaceholder = null;
      BfDnD.bfDragMode = null;
      $rootScope.$apply();
    };

    return BfDnD;
  });

  myApp.directive('bfDraggable', function(BfDnD, $timeout) {
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

          // Fix the size as the same of the current element
          var currentElemSize = $element.get(0).getBoundingClientRect();
          ghost.style.position = 'fixed';
          ghost.style.width = currentElemSize.width + 'px';
          ghost.style.height = currentElemSize.height + 'px';
          // Safari needs to have the element rendered before the drag starts, so we hide it in the next cycle.
          $timeout(function() {
            // ghost.style.top = '-2500px';
            // ghost.style.left = '-2500px'; // Move it out
            ghost.style.display = 'none';
          }, 500);

          ghost.appendChild(this.cloneNode(true));
          document.body.appendChild(ghost);
          event.dataTransfer.setDragImage(ghost, 90, 20);

          $element.addClass('is-dragging');

          $scope.bfDragMode = $scope.bfDragMode || 'copy';
          BfDnD.startDrag(event, $element, $scope.bfDraggable, $scope.bfDragMode);

          event.stopPropagation();
        });

        $element.on('drag', function(event) { // When dragging the element (it's constantly triggered)
          // console.log('element', 'drag');
        });

        $element.on('dragend', function(event) { // When the drag ends (drop)
          $element.removeClass('is-dragging');
          BfDnD.dragEnd(event, $element, $scope.bfDraggable);
        });

        $scope.$on('$destroy', function() {
          BfDnD.draggingElement = null;
        });
      }
    };
  });

  myApp.directive('bfDropContainer', function(BfDnD, $timeout, $rootScope, $interval) {
    "ngInject";
    return {
      restrict: 'A',
      scope: {
        id: '@',                    // Unique identifer
        bfDropContainer: '=?',      // Object to link
        bfDropRelativeParent: '@'   // Class of the parent relative container, to calculate the scrollTop/Left
      },
      link: function($scope, $element, $attrs) {
        var dragStatus = 0; // 0=none, 1=over, 2=leaving

        // Register the element in BfDnD.containers[]
        // console.log('registering container', $scope.id);
        if (BfDnD.containers.getById($scope.id)) {
          console.error('<bf-drop-container> with a duplicated ID: ', $scope.id);
          BfDnD.containers.removeById($scope.id);
        }
        var container = {
          id      : $scope.id,
          element : $element,
          model   : $scope.bfDropContainer
        };
        BfDnD.containers.push(container);

        // Unregister on destroy
        $scope.$on('$destroy', function() {
          BfDnD.containers.removeById($scope.id);
        });


        // Scrollable container to get the relative positions for the placeholders
        var scrollContainer = document.getElementsByClassName($scope.bfDropRelativeParent)[0];
        if (!scrollContainer) { scrollContainer = { scrollLeft: 0, scrollTop: 0 }; }

        // Get all <bf-drop-placeholder> elements for this container (with bf-drop-container-id = [element.id])
        var allPlaceholders = BfDnD.placeholders.getElementsByProp('containerId', $attrs.id);

        // Variables to manage the calcPositions() delay
        var delayTimeout = null, isDelayed = false;



        // When dragging the element over it (it's constantly triggered)
        $element.on('dragover', function($event) {
          dragStatus = 1;
          BfDnD.activeContainer = container;

          // This weird function is to delay the placeholder's position calculation
          function calcPositions() {
            if (!!delayTimeout && delayTimeout.$$state.status === 0) {  // If timeout running
              isDelayed = true;
            } else {

              // console.log('scrollContainer.scrollTop', scrollContainer.scrollTop);

              // Calc the center position for every placeholder
              allPlaceholders.forEach(function(placeholder) {
                var dropSpot = placeholder.element.get(0);  // Get the original Node element
                placeholder.midX = dropSpot.offsetLeft + (dropSpot.offsetWidth / 2) - scrollContainer.scrollLeft;
                placeholder.midY = dropSpot.offsetTop + (dropSpot.offsetHeight / 2) - scrollContainer.scrollTop;
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

          // Select which of the drop placeholders is closest to the dragging option,
          // and set the unique class 'active-placeholder' to that
          // To know which is the closest it calculates the distance between the placeholder center
          // and the mouse pointer for every placeholder, and takes the element with the lowest.
          var minProximity = null;
          var minPlaceholder = null;
          allPlaceholders.forEach(function(placeholder) { // Find the closest placeholder
            // Calc the distance between the mouse and the center of the spot
            var proximity = ((placeholder.midX - $event.offsetX)*(placeholder.midX - $event.offsetX)
            + (placeholder.midY - $event.offsetY)*(placeholder.midY - $event.offsetY));

            if (minProximity === null || minProximity > proximity) {
              minProximity = proximity;
              minPlaceholder = placeholder;
            }
          });

          // If the active placeholder has to change (or be removed), switch the 'active-placeholder' class
          if (!BfDnD.activePlaceholder || !minPlaceholder || (BfDnD.activePlaceholder.id !== minPlaceholder.id)) {
            if (!!BfDnD.activePlaceholder && !!BfDnD.activePlaceholder.element) {
              BfDnD.activePlaceholder.element.removeClass('active-placeholder');
            }
            if (!!minPlaceholder && !!minPlaceholder.element) {
              BfDnD.activePlaceholder = minPlaceholder;
              BfDnD.activePlaceholder.element.addClass('active-placeholder');
              // console.log('Active Placeholder --> ', $attrs.id, ' --> ', allPlaceholders.indexOf(BfDnD.activePlaceholder));
            }
          }

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

  myApp.directive('bfDropPlaceholder', function(BfDnD) {
    "ngInject";
    return {
      restrict: 'E',
      transclude: true,
      template: '<div class="{{placeholder.wrapperClass}}">' +
      '  <ng-transclude></ng-transclude>' +
      '</div>',
      scope: {
        bfDropModel : '=?',
        bfDropContainerId : '@'    // Id of the <bf-drop-container> the spot is linked to
      },
      link: function($scope, $element, $attrs) {
        var placeholderId;  // Unique identifier for the element

        // Check if the element is already registered in BfDnD.placeholders[]
        var isRegistered = false;
        var regElements = BfDnD.placeholders.getElementsByProp('containerId', $scope.bfDropContainerId);
        if (!!regElements) {
          regElements.forEach(function(regElement) {
            if (regElement.element === $element) {
              isRegistered = true;
              placeholderId = regElement.id;
              regElement.model = $scope.bfDropModel;
            }
          });
        }

        // If not, register the element in BfDnD.placeholders[]
        if (!isRegistered) {
          placeholderId = myApp.generateGUID();
          $scope.placeholder = {
            id           : placeholderId,
            element      : $element,
            model        : $scope.bfDropModel,
            containerId  : $scope.bfDropContainerId,
            wrapperClass : 'valid'
          };
          BfDnD.placeholders.push($scope.placeholder);
        }

        // Unregister on destroy
        $scope.$on('$destroy', function() {
          BfDnD.placeholders.removeById(placeholderId);
        });

      }
    };
  });

}());