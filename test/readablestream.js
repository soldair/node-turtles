var test = require('tap').test;
var turtles = require('../index.js');

test("can be just a readable stream",function(t){
  var closes = 0;
  var str = 'heyyo';
  
  var t1 = turtles({
    getStream:function(cb){
      // new streams are paused and buffered in this process until they exist on the remote
      var s = this.stream()
      s.write(str)
      s.end();// end cannot be called with data on this side.

      cb(s);

      s.on('close',function(){
        t.ok(true,'close called on local side');
        console.log('t1 CLOSE CALLED!');
        closes++;
        if(closes === 2) t.end();
      });

    }
  });

  var t2 = turtles({});
  t2.on('remote',function(r){
    r.getStream(function(s){

      var data = '';
      s.on('data',function(d){
        data += d;
      }).on('end',function(){
        t.equals(data,str,'my data should be correct when im done.') 
      }).on('close',function(){
        t.ok(true,' i should get close because i never wrote to this stream.');
        closes++;
        if(closes === 2) t.end();
      });

    });
  });

  t1.pipe(t2).pipe(t1);

});


