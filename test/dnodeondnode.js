var test = require('tap').test;
var turtles = require('../index');

test("can do dnode over dnode",function(t){
  t.plan(2);

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
          // prints 'got the two turtle jive!'
          t.equals(data,'got the two turtle jive!',' should get correct callback response from twoTurtle/allTheWayDown dnode');
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
          // prints 'ballerz'
          t.equals(data,'ballerz',' should get correct callback response from twoTurtle/allTheWayDown dnode');
        });
      }); 

      dnode.pipe(stream).pipe(dnode);

    });
  });


  oneTurtle.pipe(twoTurtle).pipe(oneTurtle);
});
