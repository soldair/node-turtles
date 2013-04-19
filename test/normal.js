var test = require('tap').test;
var turtles = require('../index.js');

test("can be normal",function(t){
  t.plan(4);
  var t1 = turtles({
    add:function(n,v,cb){
      t.ok(true,'hit add');
      cb(false,(+n)+(+v));
    }
  });

  var t2 = turtles({
    sub:function(n,v,cb){
      t.ok(true,'hit sub');
      cb(false,(+n)-(+v));
    }
  });

  t1.on('remote',function(r){
    r.sub(8,2,function(err,data){   
      t.equals(data,6,'should subtract to 6');
    });
  });

  t2.on('remote',function(r){
    r.add(8,2,function(err,data){
      t.equals(data,10,'should add to 10');
    });
  });

  t1.pipe(t2).pipe(t1);

});


