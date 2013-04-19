
turtles
=======

image of a turtle with other turtles comming out of its eye lasers here.

adds stream passing support for dnode callbacks 

example
=======

dnode over dnode

```js
var turtles = require('turtles');

var value;

var oneTurtle = turtles({
  setValue:function(v){
    value = v;
  },
  moarTurtles:function(cb){
    var dnode = turtles({
      dnodeOnDnode:function(cb){
        cb(false,value)
      }
    });

    var stream = this.stream();

    stream.pipe(dnode).pipe(stream);

    dnode.on('remote',function(remote){
      remote.twoTurtleJiveTime(function(err,data){
        console.log(data);
        //
        // prints 'got the two turtle jive!'
        //
      });
    });

    cb(false,stream);

  }
})

var twoTurtle = turtles({});

twoTurtle.on('remote',function(remote){

  var firstTurtle = remote;

  remote.moarTurtles(function(err,stream){
    var dnode = turtles({
      twoTurtleJiveTime:function(cb){
        cb(false,'got the two turtle jive!');
      }
    });


    dnode.on('remote',function(remote){
      firstTurtle.setValue('ballerz')
      remote.dnodeOnDnode(function(err,data){
        console.log(data);
        //
        // prints 'ballerz'
        //
      });
    }); 

    dnode.pipe(stream).pipe(dnode);

  });
});

oneTurtle.pipe(twoTurtle).pipe(oneTurtle);
```


