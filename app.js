console.log('app loading');

var myApp = angular.module('myApp', ['bf.DnD']);
myApp.run(function() {
  console.log('Ruuning!');
});

myApp.component('main', {
  templateUrl: 'main.html',
  controllerAs: '$ctrl',
  controller: ['BfDnD', function(BfDnD) {
    this.container1 = { name: 'Container 1', list: [
      {id:1, name: 'Alice',   number: 123, containerId: 'cont-1', listPos: 0 },
      {id:2, name: 'Bob',     number: 567, containerId: 'cont-1', listPos: 1 },
      {id:3, name: 'Argilac', number: 001, containerId: 'cont-1', listPos: 2 },
      {id:4, name: 'Roy',     number: 007, containerId: 'cont-1', listPos: 3 }
    ]};
    this.container2 = { name: 'Container 2', list: [] };
    this.container3 = { name: 'Container 3', list: [] };

    this.placeholders = [
      { pos: 0, empty: true },
      { pos: 1, empty: true },
      { pos: 2, empty: true },
      { pos: 3, empty: true },
    ]

    BfDnD.onDragStart = ($element, bfDraggable, bfDragMode) => {
      console.log('Starting a dragging');
    }
    BfDnD.onDragEndKo = (bfDraggable) => {
      console.log('Drop out');
    };
    
    BfDnD.onDragEndOk = (bfDraggable, bfDropContainer, bfDropPlaceholder) => {
      console.log('Drop into container', bfDropContainer.name);
      bfDropContainer.list.push(bfDraggable);
      this.myList = this.myList.filter(function(item) { return item.id !== bfDraggable.id });
    }

  }]
});

