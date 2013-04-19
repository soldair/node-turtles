var test = require('tap').test;
var turtles = require('../index');



test("can duplex stream.",function(t){
  var interval;
  var c = 0;
  var dataBackEvents = 0;
  var closes = 0;

  var t1 = turtles({
    getStream:function(n,v,cb){

      t.ok(true,'hit add');

      var s = this.stream();
      var z = this;
      cb(false,s);

      interval = setInterval(function(){
        n += (+n)+(+v);
        s.write(n);
        c++;
        if(c === 10) {
          clearInterval(interval);
          s.end();
        }
      },0);

      s.on('data',function(data){

        dataBackEvents++;

      }).on('end',function(){

        t.equals(dataBackEvents,10,'should have had 10 dataBackEvents');

      }).on('close',function(){
        process.nextTick(function(){
          closes++;
          t.equals(Object.keys(z._streams).length,0,' should have no more streams if this is closed.');
          if(closes === 2) t.end();
        });
      });

    }
  });

  var t2 = turtles({});
  var dataEvents = 0;

  t2.on('remote',function(r){

    r.getStream(8,2,function(err,stream){

      stream.on('data',function(data){

        dataEvents++;        
        stream.write('hi');

      }).on('end',function(){

        t.equals(dataEvents,10,'should have had 10 data events');
        // with duplex streams both ends have to end to stop the show.
        this.end();

      }).on('close',function(){

        process.nextTick(function(){
          closes++;
          t.equals(Object.keys(t2._remoteStreams).length,0,' should have no more remote streams if this is closed.');
          if(closes === 2) t.end();
        });

      });

    });
  });

  t1.pipe(t2).pipe(t1);
 
});

