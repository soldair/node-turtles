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
      console.log.apply(console,args);
    }
    
    cons._turtles = function(yourstream,id,ev,data){

      log('turtles called!',yourstream?'local':'remote',id,ev,data);
      var s;
      if(yourstream) {

        s = streams[id];
        log("----local stream! ",ev);
        
      } else {
        s = remoteStreams[id];
        log('REMOTE STREAM WOO!',ev);
      }

      if(!s) {
        log('this stream has been destroyed on this side or has never existed.',id);
        return remote._turtles(yourstream?false:true,id,'end');
      }

      if(ev === 'turtle' && !s.connected) {
        // the remote end now has this stream.
        s._connected = true;
        if(turtleBuffers[id]) {
          log('draining turtle buffer');
          while(turtleBuffers[id].length){
            s.emit.apply(s,turtleBuffers[id].shift());
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
              arguments[i] = hydrateStream(arguments[i]);
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
        throw new Error('please dont re serialize remote streams. pipe local first if you must');
      }
      
      var o = {stream:id,serialized:true};
      o[streamSecretProperty] = 1;
      return o;

    }


    function stream(local,_id,data,end){
      var s = duplex(data,end);
      var _id = s[streamSecretProperty] = ++id;

      s[streamSecretProperty] = _id;
      if(!local){
        s[streamSecretProperty+' remote'] = 1;
        remoteStreams[_id] = s;
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
      
      //var emit = s.emit;
      //s.emit = function(ev){
      //  s.emit.call('')
      //}

      s.on('_data',function(data){
        this._written = true;
        if(this._connected) {
          remote._turtles(false,_id,'data',data);
        } else {
          if(!turtleBuffers[_id]) turtleBuffers[_id] = [];
          var args = [].slice.call(arguments);
          args.unshift('_data');
          turtleBuffers[_id].push(args);
        }
      }).on('_pause',function(){

        remote._turtles(false,_id,'pause');

      }).on('_drain',function(){

        remote._turtles(false,_id,'drain');

      }).on('_end',function(data){

        if(this._connected) {
          remote._turtles(false,_id,'end',data);
          if(!this._read) {
            log('I HAVE NEVER BEEN READ IM CLOSING MY READ SIDE');
            // i was the write side of a through stream. lets close the read side.
            this._end();
          }
        } else {
          if(!turtleBuffers[_id]) turtleBuffers[_id] = [];
          var args = [].slice.call(arguments);
          args.unshift('_end');
          turtleBuffers[_id].push(args);
        }
      }).on('end',function(){
        if(!this._written) {
          this.end();
        }
      }).on('close',function(){
        delete turtleBuffers[_id];
        delete streams[_id];
      }).once('data',function(){
        this._read = true;
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

