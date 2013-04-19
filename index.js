var dnode = require('dnode');
var duplex = require('duplex');

var streamId = 0;

module.exports = function(cons,opts){

    opts = opts||{};

    var remote;
    var remoteq = [];
    var id = 0;
    var streams = {};
    var remoteStreams = {};
    var streamSecretProperty = opts.secretProperty||"im a stream";
    // turtleBuffers need turtle buffer limits.
    var turtleBuffers = {};

    var _streamId = ++streamId;
    
    var log = function(){
      var args = [].slice.call(arguments);
      args.unshift('s'+_streamId+': ');
      //console.log.apply(console,args);
    }
    
    cons._turtles = function(yourstream,id,ev,data){

      log('turtles called!',yourstream?'local':'remote',id,ev,data);
      var s;

      if(!id) {
        return log('empty id passed to turtles');
      }

      if(yourstream) {
        s = streams[id];
        if(!s) {
          log('no local stream with id',id);
          return remote._turtles(yourstream?false:true,id,'end');
        }
      } else {
        s = remoteStreams[id];
        if(!s) {
            return log('this stream has been destroyed on this side or has never existed.',id);
        }
      }

      if(ev === 'turtle' && !s._connected) {
        // the remote end now has this stream.
        s._connected = true;
        if(turtleBuffers[id]) {
          log('draining turtle buffer');
          while(turtleBuffers[id].length){
            var _args = turtleBuffers[id].shift();
            log('drain ',_args);
            //s.emit.apply(s,_args);
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

    // expose collection of streams.
    d._streams = streams;
    d._remoteStreams = remoteStreams;
    d._turtleBuffers = turtleBuffers;

    function streamy(cb){
      if(typeof cb !== 'function') return cb;
      return function(){
        for(var i=0;i<arguments.length;++i){

          if(arguments[i] && arguments[i][streamSecretProperty]){
            if(arguments[i].serialized) {
              //arguments[i] = hydrateStream(arguments[i]);
              var _id = arguments[i].stream;

              log('making stream ',arguments[i]);

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
        s[streamSecretProperty+' remote'] = 1;
        remoteStreams[_id] = s;
        s._connected = true;
        log('created remote stream',_id);
      } else {
        streams[_id] = s;
        log('created local stream',_id);
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
            log('calling remote with: ',args);
            remote._turtles.apply(remote,args);
          } else if(ev === '_data' || ev === '_end') {
            log("buffering ",ev,' with args ',arguments);
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
    function hydrateStream(opts){
      var s = duplex();
      s[streamSecretProperty] = opts.stream||' ';
      s[streamSecretProperty+' remote'] = 1;
      remoteStreams[opts.stream] = s;

      log('got remote stream ',s[streamSecretProperty]);

      s._written = false;
      s._read = false;
      
      // bind events that alter remote's state.
      s.on('_data',function(data){
        log('remote stream got data');
        // local sending data
        remote._turtles(true,s[streamSecretProperty],'data',data);
      }).on('pause',function(){

        log('remote stream got pause');
        // local paused
        remote._turtles(true,s[streamSecretProperty],'pause',data);
      }).on('end',function(data){

        log('remote stream got end?',data);
        // local ended
        remote._turtles(true,s[streamSecretProperty],'end',data);
        if(!this._written) {
          log('remote has not been written but read has. calling end');
          // i was the write side of a through stream. lets close the read side.
          this.end();
        }

      }).on('drain',function(){

        log('remote stream got drain');

      }).on('close',function(){
         
        delete remoteStreams[s[streamSecretProperty]];

      });

      //  tell the remote i got the stream and i want buffered events
      // but defer it to next tick so you can bind listeners.
      process.nextTick(function(){
        remote._turtles(true,opts.stream,'turtle');
      });
      return s;
    }
    

    return d;
}

