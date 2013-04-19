var test = require('tap').test;
var turtles = require('../index.js');

test("can be just a writable stream",function(t){
  var closes = 0;
  
  var t1 = turtles({
    getStream:function(cb){
      // new streams are paused and buffered in this process until they exist on the remote
      var s = this.stream()

      var data = '';

      s.on('data',function(d){
        console.log('ZZ> ',d);
        data += d;
        t.ok(d,'should have data in data event');

      }).on('end',function(){

        t.equals(data,'hihihi','data should be correct');

      }).on('close',function(){

        t.ok(true,'close called on local side');
        console.log('t1 CLOSE CALLED!');

        closes++;
        if(closes === 2) t.end();
      });

      cb(s);
    }
  });

  var t2 = turtles({});
  t2.on('remote',function(r){

    r.getStream(function(s){

      s.write('hi');
      s.write('hi');
      process.nextTick(function(){
        s.write('hi');
        s.end();
      });

      var ended = 0;
      s.on('end',function(){
        console.log('UU< end');
        ended++;
      }).on('close',function(){

        t.ok(true,' i should get close because i never wrote to this stream.');
        t.ok(ended > 0,'should have ended too');

        closes++;
        if(closes === 2) t.end();
      });

    });

  });

  t1.pipe(t2).pipe(t1);

});


