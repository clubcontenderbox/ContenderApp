// ═══════════════════════════════════════════════════════════════
// VERSION DEL ARCHIVO: 2026.08.07.1854 | supabasedb.js | Contender Club | actualización 2026-08-07
//
// IMPORTANTE: antes de usar este archivo ejecuta UNA VEZ en el SQL
// Editor de Supabase el bloque SQL que aparece al FINAL de este TXT.
// Después copia la parte JavaScript de este archivo como supabasedb.js.
// ═══════════════════════════════════════════════════════════════

var GymDB = (function () {
  'use strict';

  var CONTENDER_SUPABASE_VERSION = '2026.08.07.1854';

  var URL = 'https://ytbujmamijrzmpeqiadx.supabase.co/rest/v1';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YnVqbWFtaWpyem1wZXFpYWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDcxODcsImV4cCI6MjA5NTc4MzE4N30.u76APTL2nKmhZy-hpPx4iPPyT5wPC1BHbsBkNcZYZqg';

  var DB_CONFIG = {
    REQUEST_TIMEOUT_MS: 12000
  };

  var C = {
    socios:[], deudas:{}, checkins:{}, ventas:[], membresias:[], clases:[], productos:[], mensajes:[],
    inscritos:{}, rutinas:{}, historico:{ventas:[],checkins:[],socios:[]}, trainers:[], cuentas:[],
    saldoMovimientos:[]
  };

  function h(extra){
    var base={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'};
    if(extra)Object.keys(extra).forEach(function(k){base[k]=extra[k];});
    return base;
  }
  function dbError(method,table,status,code,message,userMessage){
    var err={
      _error:true,
      status:Number(status)||0,
      code:code||'DB_ERROR',
      message:message||'Error de base de datos',
      userMessage:userMessage||'⚠ Error al comunicarse con Supabase'
    };
    console.error('[GymDB]',method,table,err.status,err.code,err.message);
    if(typeof mostrarToast==='function')mostrarToast(err.userMessage);
    return err;
  }

  function sbFetch(method,table,query,body){
    var url=URL+'/'+table+(query?'?'+query:'');
    var opts={method:method,headers:h(method!=='GET'?{'Prefer':'return=representation'}:null)};
    if(body!==undefined)opts.body=JSON.stringify(body);

    var controller=typeof AbortController!=='undefined'?new AbortController():null;
    if(controller)opts.signal=controller.signal;
    var timeoutMs=Math.max(1000,Number(DB_CONFIG.REQUEST_TIMEOUT_MS)||12000);

    return new Promise(function(resolve){
      var terminado=false;
      var timer=null;

      function terminar(resultado){
        if(terminado)return;
        terminado=true;
        if(timer!==null)clearTimeout(timer);
        resolve(resultado);
      }

      timer=setTimeout(function(){
        if(controller){try{controller.abort();}catch(e){}}
        terminar(dbError(method,table,0,'TIMEOUT','Supabase no respondió dentro de '+timeoutMs+' ms','⚠ Supabase tardó demasiado en responder. Intenta de nuevo.'));
      },timeoutMs);

      fetch(url,opts).then(function(r){
        if(r.status===204)return {response:r,payload:[]};
        return r.text().then(function(text){
          var payload=[];
          if(text){
            try{payload=JSON.parse(text);}
            catch(e){payload={message:text};}
          }
          return {response:r,payload:payload};
        });
      }).then(function(result){
        if(terminado)return;
        var r=result.response,json=result.payload;
        if(!r.ok){
          var msg=(json&&json.message)?String(json.message):JSON.stringify(json);
          var code=json&&json.code?String(json.code):'';
          var details=json&&json.details?String(json.details):'';
          var mensajeUsuario='⚠ DB '+r.status+': '+msg.slice(0,80);
          if(table==='membresias'&&(r.status===409||code==='23505')&&(msg.indexOf('membresias_nombre_key')>-1||details.indexOf('nombre')>-1))mensajeUsuario='⚠ Ya existe una membresía con ese nombre';
          if((table==='rpc/cambiar_numero_socio'||table==='socios')&&(r.status===409||code==='23505'))mensajeUsuario='⚠ Ya existe un socio con ese número';
          terminar(dbError(method,table,r.status,code||'HTTP_ERROR',msg,mensajeUsuario));
          return;
        }
        terminar(json);
      }).catch(function(e){
        if(terminado)return;
        var abortado=e&&e.name==='AbortError';
        terminar(dbError(method,table,0,abortado?'TIMEOUT':'NETWORK_ERROR',e&&e.message?e.message:String(e),abortado?'⚠ Supabase tardó demasiado en responder. Intenta de nuevo.':'⚠ No se pudo conectar con Supabase'));
      });
    });
  }
  var get=function(t,q){return sbFetch('GET',t,q);};
  var post=function(t,b){return sbFetch('POST',t,null,b);};
  var pat=function(t,q,b){return sbFetch('PATCH',t,q,b);};
  var del=function(t,q){return sbFetch('DELETE',t,q);};

  function hoy(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function ahoraHora(){return new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});}
  function findIdx(arr,id){var sid=String(id);for(var i=0;i<arr.length;i++)if(String(arr[i].id)===sid)return i;return -1;}
  function deepCopy(arr){return JSON.parse(JSON.stringify(arr||[]));}
  function deepCopyObj(obj){return JSON.parse(JSON.stringify(obj||{}));}
  var _pending={};
  function bump(){try{localStorage.setItem('gymdb_sb_v',Date.now().toString());}catch(e){}}

  function loadAll(){
    return Promise.all([
      get('socios','select=*,abonos(*)&order=id.asc'),
      get('deudas','select=*&order=fecha.desc'),
      get('checkins','select=*&fecha=eq.'+hoy()),
      get('ventas','select=*&order=id.desc&limit=200'),
      get('membresias','select=*&order=id.asc'),
      get('clases','select=*&order=id.asc'),
      get('productos','select=*&order=id.asc'),
      get('mensajes_wa','select=*&order=id.asc'),
      get('inscritos','select=*'),
      get('trainers','select=*'),
      get('cuentas','select=*'),
      get('historico','select=*&order=id.asc'),
      get('rutinas','select=*,ejercicios(*)&order=dia.asc'),
      get('saldo_movimientos','select=*&order=created_at.desc,id.desc')
    ]).then(function(res){
      function arr(x){return Array.isArray(x)?x:[];}res=res.map(arr);
      C.socios=res[0].map(function(s){s.id=String(s.id);s.abonos=(s.abonos||[]).sort(function(a,b){return a.numero-b.numero;});s.abonos.forEach(function(a){a.id=String(a.id);});return s;});
      Object.keys(_pending).forEach(function(pid){if(findIdx(C.socios,pid)===-1)C.socios.push(_pending[pid]);else delete _pending[pid];});
      C.deudas={};res[1].forEach(function(d){d.id=String(d.id);d.socio_id=String(d.socio_id);if(!C.deudas[d.socio_id])C.deudas[d.socio_id]=[];C.deudas[d.socio_id].push(d);});
      C.checkins={};C.checkins[hoy()]=res[2].map(function(c){c.socio_id=String(c.socio_id);return c;});
      C.ventas=res[3].map(function(v){v.socio_id=v.socio_id==null?null:String(v.socio_id);return v;});
      C.membresias=res[4].map(function(m){m.unidad_duracion=String(m.unidad_duracion||'dias').toLowerCase();m.cantidad_duracion=Number(m.cantidad_duracion)||1;m.precio=Number(m.precio)||0;return m;});
      C.clases=res[5].map(function(cl){var d=cl.dias;if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){d=d.replace(/[{}\[\]"']/g,'').split(',').map(function(x){return x.trim();}).filter(Boolean);}}if(!Array.isArray(d))d=[];cl.dias=d;return cl;});
      C.productos=res[6];C.mensajes=res[7];
      C.inscritos={};res[8].forEach(function(i){var f=i.fecha||hoy(),key=String(i.clase_id)+'|'+f;if(!C.inscritos[key])C.inscritos[key]=[];C.inscritos[key].push(String(i.socio_id));});
      C.trainers=res[9];C.cuentas=res[10];
      var hist={ventas:[],checkins:[],socios:[]};res[11].forEach(function(x){if(hist[x.tipo])hist[x.tipo].push({m:x.mes,v:x.valor});});C.historico=hist;
      C.rutinas={};res[12].forEach(function(r){var sid=String(r.socio_id);if(!C.rutinas[sid])C.rutinas[sid]=[];C.rutinas[sid].push({dia:r.dia,grupo:r.grupo,icono:r.icono,_id:r.id,ejercicios:(r.ejercicios||[]).map(function(e){return{id:e.id,nombre:e.nombre,series:e.series,notas:e.notas,manual:e.manual};})});});
      C.saldoMovimientos=res[13].map(function(m){m.socio_id=String(m.socio_id);m.monto=Number(m.monto)||0;return m;});
    });
  }

  return {
    VERSION:CONTENDER_SUPABASE_VERSION,
    init:function(){return loadAll();},
    reset:function(){console.warn('[GymDB] reset() no disponible en modo Supabase.');},

    getSocios:function(){return deepCopy(C.socios);},
    saveSocios:function(arr){C.socios=arr;},
    getSocio:function(id){var idx=findIdx(C.socios,id);return idx>-1?C.socios[idx]:null;},

    setSocio:function(socio){
      var self=this,idx=findIdx(C.socios,socio.id),abonos=(socio.abonos||[]).slice();
      function nd(v){return(v===''||v===undefined)?null:v;}
      var data={id:String(socio.id),nombre:socio.nombre,apellido_paterno:socio.apellido_paterno,apellido_materno:nd(socio.apellido_materno),numero:nd(socio.numero),correo:nd(socio.correo),numero_emergencia:nd(socio.numero_emergencia),plan:nd(socio.plan),fecha_inicio:nd(socio.fecha_inicio),fecha_vencimiento:nd(socio.fecha_vencimiento),fecha_nacimiento:nd(socio.fecha_nacimiento),visitas:socio.visitas||0,activo:socio.activo!==false,sexo:nd(socio.sexo),notas:nd(socio.notas),color:socio.color||'#C8F135',vendedor_id:nd(socio.vendedor_id),vendedor_nombre:nd(socio.vendedor_nombre),ultima_visita:nd(socio.ultima_visita),avisos_ids:JSON.stringify(Array.isArray(socio.avisos_ids)?socio.avisos_ids:[])};
      if(idx>-1){
        C.socios[idx]=socio;pat('socios','id=eq.'+encodeURIComponent(socio.id),data);
        if(nd(socio.numero)){
          var ci=-1;for(var i=0;i<C.cuentas.length;i++){if(Array.isArray(C.cuentas[i].socios)&&C.cuentas[i].socios.map(String).indexOf(String(socio.id))>-1){ci=i;break;}}
          if(ci>-1){if(C.cuentas[ci].telefono!==socio.numero){C.cuentas[ci].telefono=socio.numero;pat('cuentas','id=eq.'+C.cuentas[ci].id,{telefono:socio.numero});}}
          else self.crearCuenta(String(socio.id),socio.numero);
        }
      }else{
        _pending[String(socio.id)]=socio;C.socios.push(socio);
        post('socios',data).then(function(r){if(r&&!r._error&&Array.isArray(r)&&r.length){delete _pending[String(socio.id)];if(nd(socio.numero))self.crearCuenta(String(socio.id),socio.numero);bump();}});
        return;
      }
      abonos.forEach(function(a){var aData={socio_id:socio.id,numero:a.numero,monto:a.monto,fecha_pago:a.fecha_pago||null,fecha_limite:a.fecha_pago||null,pagado:true};if(a.id&&!isNaN(Number(a.id)))pat('abonos','id=eq.'+a.id,{monto:a.monto,fecha_pago:a.fecha_pago||null});else post('abonos',aData).then(function(r){if(r&&r[0])a.id=String(r[0].id);});});
      bump();
    },

    cambiarNumeroSocio:function(anterior,nuevo){
      anterior=String(anterior).trim();nuevo=String(nuevo).trim();var self=this;
      if(!anterior||!nuevo)return Promise.resolve(false);
      if(anterior===nuevo)return Promise.resolve(true);
      if(findIdx(C.socios,nuevo)>-1){if(typeof mostrarToast==='function')mostrarToast('⚠ Ya existe el socio '+nuevo);return Promise.resolve(false);}
      return sbFetch('POST','rpc/cambiar_numero_socio',null,{p_anterior:anterior,p_nuevo:nuevo}).then(function(r){
        if(r&&r._error)return false;
        var si=findIdx(C.socios,anterior);if(si>-1)C.socios[si].id=nuevo;
        if(C.deudas[anterior]){C.deudas[nuevo]=C.deudas[anterior];delete C.deudas[anterior];C.deudas[nuevo].forEach(function(d){d.socio_id=nuevo;});}
        Object.keys(C.checkins).forEach(function(f){(C.checkins[f]||[]).forEach(function(c){if(String(c.socio_id)===anterior)c.socio_id=nuevo;});});
        C.ventas.forEach(function(v){if(String(v.socio_id)===anterior)v.socio_id=nuevo;});
        C.saldoMovimientos.forEach(function(m){if(String(m.socio_id)===anterior)m.socio_id=nuevo;});
        Object.keys(C.inscritos).forEach(function(k){C.inscritos[k]=(C.inscritos[k]||[]).map(function(x){return String(x)===anterior?nuevo:String(x);});});
        if(C.rutinas[anterior]){C.rutinas[nuevo]=C.rutinas[anterior];delete C.rutinas[anterior];}
        C.cuentas.forEach(function(c){
          if(!Array.isArray(c.socios))return;
          var cambio=false;c.socios=c.socios.map(function(x){if(String(x)===anterior){cambio=true;return nuevo;}return String(x);});
          if(cambio){c.codigo=nuevo;pat('cuentas','id=eq.'+c.id,{socios:c.socios,codigo:nuevo});}
        });
        if(_pending[anterior]){_pending[nuevo]=_pending[anterior];delete _pending[anterior];}
        bump();return true;
      });
    },

    getCuenta:function(telefono,codigo){for(var i=0;i<C.cuentas.length;i++){var c=C.cuentas[i];if(c.telefono===telefono&&c.codigo===codigo)return c;}return null;},
    clearAbonos:function(socioId){return del('abonos','socio_id=eq.'+encodeURIComponent(socioId));},
    crearCuenta:function(socioId,telefono){var codigo=String(socioId),existe=C.cuentas.some(function(c){return Array.isArray(c.socios)&&c.socios.map(String).indexOf(String(socioId))>-1;});if(existe)return;var cuenta={telefono:telefono,codigo:codigo,socios:[String(socioId)]};C.cuentas.push(cuenta);post('cuentas',cuenta).then(function(r){if(r&&!r._error&&Array.isArray(r)&&r[0])cuenta.id=r[0].id;});},

    // ── SALDO / MONEDERO ───────────────────────────────────────
    getSaldoMovimientos:function(sid){sid=String(sid);return deepCopy(C.saldoMovimientos.filter(function(m){return String(m.socio_id)===sid;}).sort(function(a,b){return String(b.created_at||b.fecha||'').localeCompare(String(a.created_at||a.fecha||''))||(Number(b.id)||0)-(Number(a.id)||0);}));},
    getSaldo:function(sid){sid=String(sid);return C.saldoMovimientos.filter(function(m){return String(m.socio_id)===sid;}).reduce(function(a,m){return a+(Number(m.monto)||0);},0);},
    addSaldoMovimiento:function(sid,monto,tipo,concepto){
      sid=String(sid);monto=Number(monto)||0;if(!monto)return null;
      var mov={id:'tmp'+Date.now()+Math.random(),socio_id:sid,tipo:tipo||'ajuste',monto:monto,concepto:concepto||null,fecha:hoy(),hora:ahoraHora(),created_at:new Date().toISOString()};
      C.saldoMovimientos.unshift(mov);
      post('saldo_movimientos',{socio_id:sid,tipo:mov.tipo,monto:monto,concepto:mov.concepto,fecha:mov.fecha,hora:mov.hora}).then(function(r){if(r&&r[0]){mov.id=r[0].id;mov.created_at=r[0].created_at||mov.created_at;}else console.error('[GymDB] El movimiento de saldo no se guardó en Supabase.');});
      bump();return mov;
    },

    registrarCobro:function(cobro){return post('cobros',{tipo:cobro.tipo||'deuda',socio_id:cobro.socio_id||null,socio_nombre:cobro.socio_nombre||null,producto:cobro.producto,monto:cobro.monto,fecha:hoy(),vendedor_id:cobro.vendedor_id||null,vendedor_nombre:cobro.vendedor_nombre||null,notas:cobro.notas||null});},
    getCobros:function(vendedorId){var q=vendedorId?'vendedor_id=eq.'+encodeURIComponent(vendedorId)+'&order=fecha.desc':'order=fecha.desc';return get('cobros',q);},

    getSeguimiento:function(socioId,callback){get('seguimiento_socio','select=*&socio_id=eq.'+encodeURIComponent(socioId)+'&order=fecha.desc,mes.desc').then(function(r){callback(Array.isArray(r)?r:[]);});},
    saveSeguimiento:function(socioId,mes,peso,musculo,imc,grasa,fecha,callback){var fechaFinal=fecha||hoy(),data={socio_id:socioId,mes:mes,peso:peso||null,musculo:musculo||null,imc:imc||null,grasa:grasa||null,fecha:fechaFinal};get('seguimiento_socio','select=id&socio_id=eq.'+encodeURIComponent(socioId)+'&mes=eq.'+encodeURIComponent(mes)).then(function(r){if(Array.isArray(r)&&r.length)pat('seguimiento_socio','id=eq.'+r[0].id,data);else post('seguimiento_socio',data);if(callback)callback();});},
    removeSeguimiento:function(id,callback){del('seguimiento_socio','id=eq.'+id).then(function(){if(callback)callback();});},

    getAllDeudas:function(){return deepCopyObj(C.deudas);},
    getDeudas:function(sid){return C.deudas[sid]||[];},
    saveAllDeudas:function(obj){
      Object.keys(C.deudas).forEach(function(sid){var prev=C.deudas[sid]||[],next=obj[sid]||[];prev.forEach(function(pd){if(!next.some(function(nd){return nd.id===pd.id;}))del('deudas','id=eq.'+pd.id);});next.forEach(function(nd){if(!prev.some(function(pd){return pd.id===nd.id;}))post('deudas',{socio_id:sid,producto:nd.producto,total:nd.total,fecha:nd.fecha,trainer:nd.trainer||null,tipo:nd.tipo||'producto'}).then(function(r){if(r&&r[0])nd.id=String(r[0].id);});});});
      Object.keys(obj).forEach(function(sid){if(!C.deudas[sid])obj[sid].forEach(function(nd){post('deudas',{socio_id:sid,producto:nd.producto,total:nd.total,fecha:nd.fecha,trainer:nd.trainer||null,tipo:nd.tipo||'producto'}).then(function(r){if(r&&r[0])nd.id=String(r[0].id);});});});C.deudas=obj;bump();
    },
    addDeuda:function(sid,deuda){sid=String(sid);if(!C.deudas[sid])C.deudas[sid]=[];C.deudas[sid].push(deuda);post('deudas',{socio_id:sid,producto:deuda.producto,total:deuda.total,fecha:deuda.fecha,trainer:deuda.trainer||null,tipo:deuda.tipo||'producto'}).then(function(r){if(r&&r[0])deuda.id=String(r[0].id);});bump();},
    removeDeuda:function(sid,did){sid=String(sid);if(C.deudas[sid])C.deudas[sid]=C.deudas[sid].filter(function(d){return String(d.id)!==String(did);});if(/^d\d+$/.test(String(did))){bump();return;}del('deudas','id=eq.'+did);bump();},

    getAllCheckins:function(){return C.checkins;},
    getTodayCheckins:function(){return C.checkins[hoy()]||[];},
    getCheckinsByFecha:function(f){return C.checkins[f]||[];},
    saveTodayCheckins:function(arr){C.checkins[hoy()]=arr;},
    getCheckinsRango:function(desde,hasta){var q='select=*&order=fecha.desc,hora.desc';if(desde)q+='&fecha=gte.'+desde;if(hasta)q+='&fecha=lte.'+hasta;return get('checkins',q).then(function(rows){return Array.isArray(rows)?rows:[];});},
    addCheckin:function(sid,saldoPorCheckin){
      sid=String(sid);var arr=this.getTodayCheckins();for(var i=0;i<arr.length;i++)if(String(arr[i].socio_id)===sid)return false;
      var hora=ahoraHora();arr.push({socio_id:sid,hora:hora,fecha:hoy()});C.checkins[hoy()]=arr;
      var si=findIdx(C.socios,sid);if(si>-1){C.socios[si].visitas=(C.socios[si].visitas||0)+1;pat('socios','id=eq.'+encodeURIComponent(sid),{visitas:C.socios[si].visitas});}
      post('checkins',{socio_id:sid,hora:hora,fecha:hoy()});
      if(Number(saldoPorCheckin)>0)this.addSaldoMovimiento(sid,Number(saldoPorCheckin),'checkin','Check-in');
      bump();return true;
    },

    getVentas:function(){return deepCopy(C.ventas);},
    _esIdTemporal:function(id){var n=Number(id);return !isNaN(n)&&n>2147483647;},
    removeVenta:function(ventaId){C.ventas=C.ventas.filter(function(v){return String(v.id)!==String(ventaId);});if(this._esIdTemporal(ventaId)){bump();return;}del('ventas','id=eq.'+ventaId);bump();},
    saveVentas:function(arr){var prev=C.ventas;C.ventas=arr;arr.forEach(function(v){if(!prev.some(function(p){return p.id===v.id;}))post('ventas',{socio_id:v.socio_id,socio_nombre:v.socio_nombre,producto:v.producto,cantidad:v.cantidad,total:v.total,fecha:v.fecha,status:v.status,tipo:v.tipo,trainer:v.trainer||null,membresia_inicio:v.membresia_inicio||null,membresia_vencimiento:v.membresia_vencimiento||null}).then(function(r){if(r&&r[0])v.id=r[0].id;});});bump();},
    updateVenta:function(id,campos){var idx=-1;for(var i=0;i<C.ventas.length;i++)if(String(C.ventas[i].id)===String(id)){idx=i;break;}if(idx>-1)Object.keys(campos).forEach(function(k){C.ventas[idx][k]=campos[k];});if(this._esIdTemporal(id)){bump();return;}pat('ventas','id=eq.'+id,campos);bump();},

    getMembresias:function(){return deepCopy(C.membresias);},
    guardarMembresia:function(datos){
      var body={
        nombre:String(datos.nombre||'').trim(),
        unidad_duracion:String(datos.unidad_duracion||'dias').toLowerCase(),
        cantidad_duracion:Number(datos.cantidad_duracion)||1,
        precio:Number(datos.precio)||0,
        descripcion:datos.descripcion||null
      };
      var id=datos.id;
      var req=id!==undefined&&id!==null?pat('membresias','id=eq.'+encodeURIComponent(id),body):post('membresias',body);
      return req.then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo guardar la membresía'};
        var guardada=Array.isArray(r)&&r.length?r[0]:null;
        if(!guardada)return {ok:false,error:'Supabase no devolvió la membresía guardada'};
        var idx=findIdx(C.membresias,guardada.id);
        if(idx>-1)C.membresias[idx]=guardada;
        else C.membresias.push(guardada);
        C.membresias.sort(function(a,b){return Number(a.id)-Number(b.id);});
        bump();
        return {ok:true,data:deepCopy([guardada])[0]};
      });
    },
    eliminarMembresia:function(id){
      id=String(id);
      return del('membresias','id=eq.'+encodeURIComponent(id)).then(function(r){
        if(r&&r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo eliminar la membresía'};
        C.membresias=C.membresias.filter(function(m){return String(m.id)!==id;});
        bump();
        return {ok:true};
      });
    },
    getClases:function(){return deepCopy(C.clases);},
    saveClases:function(arr){_syncCat('clases',C.clases,arr,['nombre','hora','coach','cupo','dias']);C.clases=arr;bump();},
    getProductos:function(){return deepCopy(C.productos);},
    saveProductos:function(arr){_syncCat('productos',C.productos,arr,['nombre','costo','stock','cat']);C.productos=arr;bump();},
    getMensajes:function(){return deepCopy(C.mensajes);},
    saveMensajes:function(arr){_syncCat('mensajes_wa',C.mensajes,arr,['nombre','cuerpo']);C.mensajes=arr;bump();},

    getAllInscritos:function(){return deepCopyObj(C.inscritos);},
    getInscritosPorClase:function(cid,fecha){var f=fecha||hoy();return C.inscritos[String(cid)+'|'+f]||[];},
    saveAllInscritos:function(obj){C.inscritos=obj;},
    inscribirSocio:function(cid,sid,fecha){var cids=String(cid),sids=String(sid),f=fecha||hoy(),key=cids+'|'+f;if(!C.inscritos[key])C.inscritos[key]=[];if(C.inscritos[key].indexOf(sids)===-1){C.inscritos[key].push(sids);post('inscritos',{clase_id:+cid,socio_id:sids,fecha:f});bump();}},
    desinscribirSocio:function(cid,sid,fecha){var f=fecha||hoy(),key=String(cid)+'|'+f;if(C.inscritos[key])C.inscritos[key]=C.inscritos[key].filter(function(x){return String(x)!==String(sid);});del('inscritos','clase_id=eq.'+cid+'&socio_id=eq.'+encodeURIComponent(sid)+'&fecha=eq.'+f);bump();},

    getRutina:function(sid){return C.rutinas[sid]||null;},
    saveRutina:function(sid,rutina){C.rutinas[sid]=rutina;del('rutinas','socio_id=eq.'+encodeURIComponent(sid)).then(function(){rutina.forEach(function(dia){post('rutinas',{socio_id:sid,dia:dia.dia,grupo:dia.grupo,icono:dia.icono}).then(function(r){if(!r||!r[0])return;var rid=r[0].id;(dia.ejercicios||[]).forEach(function(e){post('ejercicios',{rutina_id:rid,nombre:e.nombre,series:e.series,notas:e.notas,manual:!!e.manual});});});});});bump();},

    getHistorico:function(){return C.historico;},
    getTrainers:function(){return deepCopy(C.trainers);},
    saveTrainers:function(arr){_syncCat('trainers',C.trainers,arr,['telefono','codigo','nombre','especialidad']);C.trainers=arr;bump();},
    onChange:function(callback){window.addEventListener('storage',function(e){if(e.key==='gymdb_sb_v')loadAll().then(function(){setTimeout(callback,80);});});}
  };

  function _syncCat(table,prev,next,fields){
    var prevMap={};prev.forEach(function(p){prevMap[p.id]=p;});
    next.forEach(function(item){var body={};fields.forEach(function(f){body[f]=item[f];});if(item.id&&prevMap[item.id]){var cambio=fields.some(function(f){return JSON.stringify(item[f])!==JSON.stringify(prevMap[item.id][f]);});if(cambio)pat(table,'id=eq.'+item.id,body);}else post(table,body).then(function(r){if(r&&r[0])item.id=r[0].id;});});
    var nextIds=next.map(function(n){return n.id;});prev.forEach(function(p){if(nextIds.indexOf(p.id)===-1)del(table,'id=eq.'+p.id);});
  }
})();

/*
════════════════════════════════════════════════════════════════
SQL PARA EJECUTAR UNA SOLA VEZ EN SUPABASE → SQL EDITOR
NO PEGUES ESTE BLOQUE DENTRO DEL ARCHIVO .js DEL SITIO.
════════════════════════════════════════════════════════════════

-- 1) Monedero / saldo del socio. El saldo es la suma de movimientos.
create table if not exists public.saldo_movimientos (
  id bigserial primary key,
  socio_id text not null,
  tipo text not null check (tipo in ('checkin','abono','cargo','ajuste')),
  monto numeric(12,2) not null check (monto <> 0),
  concepto text,
  fecha date not null default current_date,
  hora time not null default localtime,
  created_at timestamptz not null default now()
);

create index if not exists idx_saldo_movimientos_socio
  on public.saldo_movimientos (socio_id);

create index if not exists idx_saldo_movimientos_fecha
  on public.saldo_movimientos (fecha desc, id desc);

-- Permisos para el mismo esquema de acceso REST que ya usa tu app.
alter table public.saldo_movimientos enable row level security;

drop policy if exists "saldo_movimientos_select_anon" on public.saldo_movimientos;
create policy "saldo_movimientos_select_anon" on public.saldo_movimientos
  for select to anon using (true);

drop policy if exists "saldo_movimientos_insert_anon" on public.saldo_movimientos;
create policy "saldo_movimientos_insert_anon" on public.saldo_movimientos
  for insert to anon with check (true);

drop policy if exists "saldo_movimientos_update_anon" on public.saldo_movimientos;
create policy "saldo_movimientos_update_anon" on public.saldo_movimientos
  for update to anon using (true) with check (true);

drop policy if exists "saldo_movimientos_delete_anon" on public.saldo_movimientos;
create policy "saldo_movimientos_delete_anon" on public.saldo_movimientos
  for delete to anon using (true);

-- 2) Cambio transaccional del número de socio.
-- Crea primero una copia del socio con el ID nuevo, mueve todas las
-- referencias conocidas y al final elimina el ID anterior. Así funciona
-- incluso si existen llaves foráneas sin ON UPDATE CASCADE.
create or replace function public.cambiar_numero_socio(
  p_anterior text,
  p_nuevo text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  coltype text;
begin
  p_anterior := trim(p_anterior);
  p_nuevo := trim(p_nuevo);

  if p_anterior is null or p_anterior = '' or p_nuevo is null or p_nuevo = '' then
    raise exception 'Los números de socio son requeridos';
  end if;

  if p_anterior = p_nuevo then
    return;
  end if;

  if not exists (select 1 from public.socios where id::text = p_anterior) then
    raise exception 'No existe el socio %', p_anterior;
  end if;

  if exists (select 1 from public.socios where id::text = p_nuevo) then
    raise exception 'Ya existe el socio %', p_nuevo using errcode = '23505';
  end if;

  -- Copia completa de la fila, cambiando solo el ID. Evita tener que
  -- enumerar todas las columnas actuales/futuras de socios.
  insert into public.socios
  select (jsonb_populate_record(null::public.socios,
           to_jsonb(s) || jsonb_build_object('id', p_nuevo))).*
  from public.socios s
  where s.id::text = p_anterior;

  -- Tablas conocidas que apuntan a socio_id. Si alguna no existe en
  -- una instalación concreta, se omite sin abortar la migración.
  foreach t in array array[
    'abonos','deudas','checkins','ventas','inscritos','rutinas',
    'seguimiento_socio','cobros','saldo_movimientos'
  ] loop
    begin
      select format_type(a.atttypid, a.atttypmod)
        into coltype
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t
        and a.attname = 'socio_id' and not a.attisdropped;

      if coltype is not null then
        execute format('update public.%I set socio_id = $1::%s where socio_id::text = $2', t, coltype)
          using p_nuevo, p_anterior;
      end if;
      coltype := null;
    exception
      when undefined_table then null;
    end;
  end loop;

  delete from public.socios where id::text = p_anterior;
end;
$$;

grant execute on function public.cambiar_numero_socio(text,text) to anon;
grant execute on function public.cambiar_numero_socio(text,text) to authenticated;

-- FIN DEL SQL
*/
