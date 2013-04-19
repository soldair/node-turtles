
[![Build Status](https://secure.travis-ci.org/soldair/node-turtles.png)](http://travis-ci.org/soldair/node-walkdir)


turtles
=======

![turtles: callback streams for dnode](https://raw.github.com/soldair/node-turtles/master/img/turtle-eyelasers.png)

Adds stream passing support for [dnode](https://github.com/substack/dnode) callbacks. i use it with dnode on top of [shoe](https://github.com/substack/shoe).
readable/writeable/duplex stream support in one!

For those unfamiliar with dnode. dnode is a really great way to treat your server like a module.

examples
========

pipe a file
-----------

```js

var t1 = turtles({
  lines:function(cb){
    var stream = fs.createReadStream('file.txt')
      .pipe(linestream())// parse it to lines of text
      .pipe(this.stream());

    cb(false,stream);
  }
});

t2 = turtles();

t2.on('remote',function(remote){
    remote.lines(function(err,stream){
      stream.on('data',function(line){
        console.log('a line:',line);
      })
    });
});

t2.pipe(t1).pipe(t2);
```


api
===

the api extends dnode with exactly one method

turtles.stream()
  - returns a duplex stream
  - a stream is not cleaned up until both sides close. if you dont use one side it will be closed automatically for you.
  - if you only read from this stream and it ends is will close the write side for you and cleanup the stream.
  - if you only write from this stream and it ends is will close the read side for you and cleanup the stream.
  - you may pass these as data arguments to callbacks

the api reserves the name of one callback _turtles


thanks
======

@substack for making awesome stuff! and for hopefully giving me permission to use the turtle picture.

inception!
==========

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


