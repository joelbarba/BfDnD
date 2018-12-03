console.log('app loading');

var myApp = angular.module('myApp', []);

myApp.run(function() {
  console.log('Ruuning!');
});


myApp.component('main', {
  templateUrl: 'main.html',
  controllerAs: '$ctrl',
  controller: function(BfDnD, $scope) {
    console.log('main component');

    this.obj1 = {id:1, name: 'Alice', number: 1234 };

    // var a = [
    //   {id:1, name: 'Alice', number: 1234 },
    //   {id:2, name: 'Bob', number: 1234 },
    //   {id:3, name: 'Wallace', number: 1234 },
    //   {id:4, name: 'Shane', number: 1234 },
    // ];

    // var b = a.getById(2);
    // console.log(b);


  }
});




// --------- Globals ----------------

myApp.generateGUID = function() {
  // If we have a cryptographically secure PRNG, use that
  if (typeof (window.crypto) !== 'undefined' && typeof (window.crypto.getRandomValues) !== 'undefined') {
    var buf = new Uint16Array(8);
    window.crypto.getRandomValues(buf);
    var S4 = function (num) {
      var ret = num.toString(16);
      while (ret.length < 4) {
        ret = "0" + ret;
      }
      return ret;
    };
    return (S4(buf[0]) + S4(buf[1]) + "-" + S4(buf[2]) + "-" + S4(buf[3]) + "-" + S4(buf[4]) + "-" + S4(buf[5]) + S4(buf[6]) + S4(buf[7]));
  }
  else {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};




/**
 * @function getByProp
 * @memberOf Array
 * @param {String} property - the name of the objects property
 * @param {String} value - the value we want it to equal
 * @description returns an item if its in a list and its property is equal to the value.
 * */
Array.prototype.getByProp = function(property, value){
  for(let i = 0; i < this.length; ++i){
    if(this[i].hasOwnProperty(property)){
      if(this[i][property] === value){
        return this[i]
      }
    }
  }
  return undefined;
};


/**
 * @function getById
 * @memberOf Array
 * @param {String} value - the value we want it to equal
 * @description gets an item by its id and returns it if present.
 * */
Array.prototype['getById'] = function(value) {
  let item = this.getByProp('id', value);
  if(!!item){
    return item;
  }
  return false;
};


/**
 * @function removeById
 * @memberOf Array
 * @param {String} id - the id of the object we want to find
 * @description removes an object by finding its index.
 * */
Array.prototype['removeById'] = function(id) {
  let idx = this.getIndexById(id);
  if(idx >= 0){
    this.splice(idx, 1);
  }
  return this;
};