var dnode = require('dnode');
var duplex = require('duplex');

module.exports = function(cons,opts){

    opts = opts||{};
    cons = cons||{};

    var remote
    , remoteq = []
    , id = 0
    , streams = {}
    , remoteStreams = {}
    , streamSecretProperty = opts.secretProperty||"im a stream"
    // turtleBuffers are data/end events sent to the stream before it has arrived on the remote.
    // they may need turtle buffer limits but because the stream is paused they should never get more than one data event.
    , turtleBuffers = {}
    
    cons._turtles = function(yourstream,id,ev,data,cb){

      var s;
      if(!id) return;//missing id

      if(yourstream) {
        s = streams[id];
        if(!s) {
          //no local stream with id
          return remote._turtles(yourstream?false:true,id,'end');
        }
      } else {
        s = remoteStreams[id];
        //this stream has been destroyed on this side or has never been.
        if(!s) return;
      }

      if(ev === 'turtle' && !s._connected) {
        // the remote end now has this stream.
        s._connected = true;
        if(turtleBuffers[id]) {
          while(turtleBuffers[id].length){
            var _args = turtleBuffers[id].shift();
            remote._turtles(false,id,_args[0],_args[1]);
          }
          delete turtleBuffers[id];
        }
        s.emit('drain');
      } else if(ev === 'data'){
        s._data(data);
      } else if(ev === 'pause'){
        s._pause();
      } else if(ev === 'drain'){
        s.emit('drain');
      } else if(ev === 'end'){
        s._end();
      }  
    };

    // curry stream hydration
    Object.keys(cons).forEach(function(method){
      cons[method] = streamy(cons[method]);
    });
  
    var d = dnode(cons,opts);
    d.on('remote',function(r){
      remote = r;
      Object.keys(remote).forEach(function(method){
        r[method] = streamy(r[method]);
      });
    });

    d.stream = function(data,end){
      return stream(true,++id); 
    };

    // expose collections of streams and buffers just in case.
    // these are not offical api and may be altered in a patch version.
    d._streams = streams;
    d._remoteStreams = remoteStreams;
    d._turtleBuffers = turtleBuffers;

    function streamy(cb){
      if(typeof cb !== 'function') return cb;
      return function(){
        for(var i=0;i<arguments.length;++i){

          if(arguments[i] && arguments[i][streamSecretProperty]){
            if(arguments[i].serialized) {

              var _id = arguments[i].stream;
              arguments[i] = stream(false,arguments[i].stream);

              //  tell the remote i got the stream and i want buffered events
              // but defer it to next tick so you can bind listeners.
              process.nextTick(function(){
                remote._turtles(true,_id,'turtle');
              });

            } else {
              arguments[i] = serializeStream(arguments[i]);
            }
          } else if(typeof arguments[i] === 'function'){
            arguments[i] = streamy(arguments[i]);
          }
        }
        return cb.apply(d,arguments);
      }
    }

    function serializeStream(stream){

      var id = stream[streamSecretProperty];
      var remote = stream[streamSecretProperty+' remote'];
      if(remote) {
        remote.emit('error',new Error('please dont re serialize remote streams. pipe local first if you must'));
        return;
      }
      
      var o = {stream:id,serialized:true};
      o[streamSecretProperty] = 1;
      return o;

    }

    function stream(local,_id,data,end){
       var s = duplex(data,end);

      s[streamSecretProperty] = _id;

      if(!local){
        //create remote stream
        s[streamSecretProperty+' remote'] = 1;
        remoteStreams[_id] = s;
        s._connected = true;
      } else {
        //create local stream
        streams[_id] = s;
        // this always starts paused so piped streams pause
        // when the remote grabs it it passes a 'turtle' event back so the show can get started.
        s._pause();
      }

      // if ive been written too i am at least a writeable stream.
      // if im never read from im only a writable stream and i should end the read side also when im done writing
      s._written = false;
      // like the above but for read.
      s._read = false;
      
      var on = function(s,ev){
        s.on(ev,function(){
          var args = [].slice.call(arguments);
          if(this._connected) {
            args.unshift.apply(args,[local?false:true,_id,ev.replace('_','')]);
            //calling remote with args
            remote._turtles.apply(remote,args);
          } else if(ev === '_data' || ev === '_end') {
            //buffering ev because the remote doesnt have this stream yet.
            if(!turtleBuffers[_id]) turtleBuffers[_id] = [];
            args.unshift(ev.replace('_',''));
            turtleBuffers[_id].push(args);
          }
        });
      }

      on(s,'_data');
      on(s,'_pause');
      on(s,'_drain');
      on(s,'_end');

      s.once('_data',function(ev){
        this._written = true;
      }).once('data',function(){
        this._read = true;
      }).on('end',function(){
        if(!this._written) {
          this.end();
        }
      }).on('_end',function(){
        if(!this._read) {
          this._end();
        }
      }).on('close',function(){
        if(local) {
          delete turtleBuffers[_id];
          delete streams[_id];
        } else {
          delete remoteStreams[_id];
        }
      });

      return s;
    }

    return d;
}

