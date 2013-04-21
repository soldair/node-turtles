var test = require('tap').test;
var turtles = require('../index.js');


test("should pass stream errors to clients",function(t){
  t.plan(2);

  var t1 = turtles({
    err:function(cb){
      var s = this.stream()
      s.on('error',function(err){

        t.equals(err,'oh no!','got an error on t1');
      })

      process.nextTick(function(){
        s.emit('error','oh no!');
      });
      cb(false,s);
    }
  });

  var t2 = turtles();
  t2.on('remote',function(remote){
    remote.err(function(err,stream){
      stream.on('error',function(err){
        t.equals(err,'oh no!','should get error on remote stream');
      });
    });
  });

  t2.pipe(t1).pipe(t2);

});
