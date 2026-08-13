// ═══════════════════════════════════════════════════════════════
// VERSION DEL ARCHIVO: 2026.08.12.2140 | supabasedb_v2026.08.12.2140.js | Contender Club | actualización 2026-08-12
//
// IMPORTANTE: antes de usar este archivo ejecuta UNA VEZ en el SQL
// Editor de Supabase el bloque SQL que aparece al FINAL de este TXT.
// Después cambia la extensión de este archivo a .js y conserva el nombre: supabasedb_v2026.08.12.2140.js.
// ═══════════════════════════════════════════════════════════════

var GymDB = (function () {
  'use strict';

  var CONTENDER_SUPABASE_VERSION = '2026.08.12.2140';

  var URL = 'https://ytbujmamijrzmpeqiadx.supabase.co/rest/v1';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YnVqbWFtaWpyem1wZXFpYWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDcxODcsImV4cCI6MjA5NTc4MzE4N30.u76APTL2nKmhZy-hpPx4iPPyT5wPC1BHbsBkNcZYZqg';

  var DB_CONFIG = {
    REQUEST_TIMEOUT_MS: 12000,
    PUNTOS_POR_CHECKIN: 1,
    CLUB_TIMEZONE: 'America/Mexico_City'
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
          if((table==='checkins'||table==='rpc/contender_registrar_checkin')&&(r.status===409||code==='23505'))mensajeUsuario='⚠ Este socio ya tiene check-in hoy';
          if(table==='rpc/contender_agregar_venta_producto'&&msg.toLowerCase().indexOf('stock insuficiente')>-1)mensajeUsuario='⚠ Stock insuficiente para completar la venta';
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

  function ahoraClub(){
    var d=new Date(),fmt=new Intl.DateTimeFormat('en-CA',{timeZone:DB_CONFIG.CLUB_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),parts=fmt.formatToParts(d),v={};
    parts.forEach(function(x){if(x.type!=='literal')v[x.type]=x.value;});
    return {fecha:v.year+'-'+v.month+'-'+v.day,hora:v.hour+':'+v.minute+':'+v.second};
  }
  function hoy(){return ahoraClub().fecha;}
  function ahoraHora(){return ahoraClub().hora;}
  function findIdx(arr,id){var sid=String(id);for(var i=0;i<arr.length;i++)if(String(arr[i].id)===sid)return i;return -1;}
  function deepCopy(arr){return JSON.parse(JSON.stringify(arr||[]));}
  function deepCopyObj(obj){return JSON.parse(JSON.stringify(obj||{}));}
  var _pending={};
  function bump(){try{localStorage.setItem('gymdb_sb_v',Date.now().toString());}catch(e){}}
  function normalizarMovimientoSaldo(m,sid){if(!m)return null;m.socio_id=String(m.socio_id||sid);m.monto=Number(m.monto)||0;return m;}
  function asegurarSaldoCheckin(sid,fecha,hora){
    var q='select=*&socio_id=eq.'+encodeURIComponent(sid)+'&tipo=eq.checkin&fecha=eq.'+encodeURIComponent(fecha)+'&order=id.asc&limit=1';
    return get('saldo_movimientos',q).then(function(rows){
      if(rows&&rows._error)return {ok:false,error:rows.userMessage||rows.message||'No se pudo verificar el saldo del check-in'};
      if(Array.isArray(rows)&&rows.length)return {ok:true,data:normalizarMovimientoSaldo(rows[0],sid)};
      return post('saldo_movimientos',{socio_id:sid,tipo:'checkin',monto:DB_CONFIG.PUNTOS_POR_CHECKIN,concepto:'Check-in',fecha:fecha,hora:hora}).then(function(r){
        if(r&&r._error){
          if(String(r.code||'')==='23505'||Number(r.status)===409)return get('saldo_movimientos',q).then(function(rr){return Array.isArray(rr)&&rr.length?{ok:true,data:normalizarMovimientoSaldo(rr[0],sid)}:{ok:false,error:'El check-in se guardó, pero no se pudo confirmar el +1 de saldo'};});
          return {ok:false,error:r.userMessage||r.message||'El check-in se guardó, pero no se pudo sumar +1 al saldo'};
        }
        var mov=Array.isArray(r)&&r.length?normalizarMovimientoSaldo(r[0],sid):null;return mov?{ok:true,data:mov}:{ok:false,error:'El check-in se guardó, pero Supabase no devolvió el movimiento de saldo'};
      });
    });
  }

  function loadAll(){
    return Promise.all([
      get('socios','select=*,abonos(*)&order=id.asc'),
      get('deudas','select=*&order=fecha.desc'),
      get('checkins','select=*&fecha=eq.'+hoy()),
      get('ventas','select=*&tipo=eq.prod&order=id.desc&limit=200'),
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
      if(res[2]&&res[2]._error)throw new Error(res[2].userMessage||res[2].message||'No se pudieron cargar los check-ins');
      if(res[13]&&res[13]._error)throw new Error((res[13].userMessage||res[13].message||'No se pudo cargar el saldo')+'. Ejecuta la migración de check-in/saldo de esta versión.');
      function arr(x){return Array.isArray(x)?x:[];}res=res.map(arr);
      C.socios=res[0].map(function(s){s.id=String(s.id);s.abonos=(s.abonos||[]).sort(function(a,b){return (Number(a.numero)||0)-(Number(b.numero)||0);});s.abonos.forEach(function(a){a.id=String(a.id);a.socio_id=String(a.socio_id||s.id);a.monto=Number(a.monto)||0;a.plan=a.plan||null;a.membresia_inicio=a.membresia_inicio||null;a.membresia_vencimiento=a.membresia_vencimiento||null;a.trainer=a.trainer||null;});return s;});
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
    PUNTOS_POR_CHECKIN:DB_CONFIG.PUNTOS_POR_CHECKIN,
    init:function(){return loadAll();},
    reset:function(){console.warn('[GymDB] reset() no disponible en modo Supabase.');},

    getSocios:function(){return deepCopy(C.socios);},
    saveSocios:function(arr){C.socios=arr;},
    getSocio:function(id){var idx=findIdx(C.socios,id);return idx>-1?C.socios[idx]:null;},

    setSocio:function(socio){
      var self=this,idx=findIdx(C.socios,socio.id);
      function nd(v){return(v===''||v===undefined)?null:v;}
      var abonosCache=idx>-1?(C.socios[idx].abonos||[]):(socio.abonos||[]);
      var socioCache=deepCopy([socio])[0];socioCache.abonos=deepCopy(abonosCache);
      var data={id:String(socio.id),nombre:socio.nombre,apellido_paterno:socio.apellido_paterno,apellido_materno:nd(socio.apellido_materno),numero:nd(socio.numero),correo:nd(socio.correo),numero_emergencia:nd(socio.numero_emergencia),plan:nd(socio.plan),fecha_inicio:nd(socio.fecha_inicio),fecha_vencimiento:nd(socio.fecha_vencimiento),fecha_nacimiento:nd(socio.fecha_nacimiento),visitas:socio.visitas||0,activo:socio.activo!==false,sexo:nd(socio.sexo),notas:nd(socio.notas),color:socio.color||'#C8F135',vendedor_id:nd(socio.vendedor_id),vendedor_nombre:nd(socio.vendedor_nombre),ultima_visita:nd(socio.ultima_visita),avisos_ids:JSON.stringify(Array.isArray(socio.avisos_ids)?socio.avisos_ids:[])};
      if(idx>-1){
        C.socios[idx]=socioCache;
        return pat('socios','id=eq.'+encodeURIComponent(socio.id),data).then(function(r){
          if(r&&r._error)throw new Error(r.userMessage||r.message||'No se pudo guardar el socio');
          if(nd(socio.numero)){
            var ci=-1;for(var i=0;i<C.cuentas.length;i++){if(Array.isArray(C.cuentas[i].socios)&&C.cuentas[i].socios.map(String).indexOf(String(socio.id))>-1){ci=i;break;}}
            if(ci>-1){if(C.cuentas[ci].telefono!==socio.numero){C.cuentas[ci].telefono=socio.numero;pat('cuentas','id=eq.'+C.cuentas[ci].id,{telefono:socio.numero});}}
            else self.crearCuenta(String(socio.id),socio.numero);
          }
          bump();return true;
        });
      }
      _pending[String(socio.id)]=socioCache;C.socios.push(socioCache);
      return post('socios',data).then(function(r){
        if(r&&r._error){C.socios=C.socios.filter(function(x){return String(x.id)!==String(socio.id);});delete _pending[String(socio.id)];throw new Error(r.userMessage||r.message||'No se pudo crear el socio');}
        delete _pending[String(socio.id)];if(nd(socio.numero))self.crearCuenta(String(socio.id),socio.numero);bump();return true;
      });
    },

    cambiarNumeroSocio:function(anterior,nuevo){
      anterior=String(anterior).trim();nuevo=String(nuevo).trim();var self=this;
      if(!anterior||!nuevo)return Promise.resolve(false);
      if(anterior===nuevo)return Promise.resolve(true);
      if(findIdx(C.socios,nuevo)>-1){if(typeof mostrarToast==='function')mostrarToast('⚠ Ya existe el socio '+nuevo);return Promise.resolve(false);}
      return sbFetch('POST','rpc/cambiar_numero_socio',null,{p_anterior:anterior,p_nuevo:nuevo}).then(function(r){
        if(r&&r._error)return false;
        var si=findIdx(C.socios,anterior);if(si>-1){C.socios[si].id=nuevo;(C.socios[si].abonos||[]).forEach(function(a){a.socio_id=nuevo;});}
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
    getAbonos:function(socioId){var si=findIdx(C.socios,socioId);return si>-1?deepCopy(C.socios[si].abonos||[]):[];},
    guardarAbono:function(datos){
      var sid=String(datos.socio_id||''),si=findIdx(C.socios,sid);if(si<0)return Promise.resolve({ok:false,error:'Socio no encontrado'});
      var existentes=C.socios[si].abonos||[],id=datos.id!=null?String(datos.id):null,numero=Number(datos.numero)||0;
      if(!numero)numero=existentes.reduce(function(m,a){return Math.max(m,Number(a.numero)||0);},0)+1;
      var body={socio_id:sid,numero:numero,monto:Number(datos.monto)||0,fecha_pago:datos.fecha_pago||hoy(),fecha_limite:datos.membresia_vencimiento||datos.fecha_limite||null,pagado:true,plan:datos.plan||null,membresia_inicio:datos.membresia_inicio||null,membresia_vencimiento:datos.membresia_vencimiento||null,trainer:datos.trainer||null};
      var req=id&&/^\d+$/.test(id)?pat('abonos','id=eq.'+encodeURIComponent(id),body):post('abonos',body);
      return req.then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo guardar el pago'};
        var guardado=Array.isArray(r)&&r.length?r[0]:null;if(!guardado)return {ok:false,error:'Supabase no devolvió el pago guardado'};
        guardado.id=String(guardado.id);guardado.socio_id=String(guardado.socio_id||sid);guardado.monto=Number(guardado.monto)||0;
        var ai=findIdx(existentes,guardado.id);if(ai>-1)existentes[ai]=guardado;else existentes.push(guardado);existentes.sort(function(a,b){return (Number(a.numero)||0)-(Number(b.numero)||0);});C.socios[si].abonos=existentes;bump();return {ok:true,data:deepCopy([guardado])[0]};
      });
    },
    eliminarAbono:function(id){
      id=String(id);var sid=null;
      for(var i=0;i<C.socios.length;i++){if((C.socios[i].abonos||[]).some(function(a){return String(a.id)===id;})){sid=C.socios[i].id;break;}}
      return del('abonos','id=eq.'+encodeURIComponent(id)).then(function(r){
        if(r&&r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo eliminar el pago'};
        if(sid!=null){var si=findIdx(C.socios,sid);if(si>-1)C.socios[si].abonos=(C.socios[si].abonos||[]).filter(function(a){return String(a.id)!==id;});}bump();return {ok:true};
      });
    },
    crearCuenta:function(socioId,telefono){var codigo=String(socioId),existe=C.cuentas.some(function(c){return Array.isArray(c.socios)&&c.socios.map(String).indexOf(String(socioId))>-1;});if(existe)return;var cuenta={telefono:telefono,codigo:codigo,socios:[String(socioId)]};C.cuentas.push(cuenta);post('cuentas',cuenta).then(function(r){if(r&&!r._error&&Array.isArray(r)&&r[0])cuenta.id=r[0].id;});},

    // ── SALDO DEL SOCIO: +1 por check-in; abonos/cargos manuales ─
    getSaldoMovimientos:function(sid){sid=String(sid);return deepCopy(C.saldoMovimientos.filter(function(m){return String(m.socio_id)===sid;}).sort(function(a,b){return String(b.created_at||b.fecha||'').localeCompare(String(a.created_at||a.fecha||''))||(Number(b.id)||0)-(Number(a.id)||0);}));},
    getSaldo:function(sid){sid=String(sid);return C.saldoMovimientos.filter(function(m){return String(m.socio_id)===sid;}).reduce(function(a,m){return a+(Number(m.monto)||0);},0);},
    addSaldoMovimiento:function(sid,monto,tipo,concepto){
      sid=String(sid);monto=Number(monto)||0;if(!monto)return Promise.resolve({ok:false,error:'El monto debe ser distinto de cero'});
      var body={socio_id:sid,tipo:tipo||'ajuste',monto:monto,concepto:concepto||null,fecha:hoy(),hora:ahoraHora()};
      return post('saldo_movimientos',body).then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo guardar el movimiento de saldo'};
        var mov=Array.isArray(r)&&r.length?r[0]:null;if(!mov)return {ok:false,error:'Supabase no devolvió el movimiento guardado'};
        mov.socio_id=String(mov.socio_id||sid);mov.monto=Number(mov.monto)||0;C.saldoMovimientos.unshift(mov);bump();return {ok:true,data:deepCopy([mov])[0]};
      });
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
    addCheckin:function(sid){
      sid=String(sid);var fechaLocal=hoy(),arrLocal=C.checkins[fechaLocal]||[];
      for(var i=0;i<arrLocal.length;i++)if(String(arrLocal[i].socio_id)===sid)return Promise.resolve({ok:false,duplicate:true,error:'El socio ya tiene check-in hoy'});
      return post('rpc/contender_registrar_checkin',{p_socio_id:sid,p_timezone:DB_CONFIG.CLUB_TIMEZONE}).then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error){var dup=String(r.code||'')==='23505'||Number(r.status)===409||String(r.message||'').toLowerCase().indexOf('check-in hoy')>-1;return {ok:false,duplicate:dup,error:dup?'El socio ya tiene check-in hoy':(r.userMessage||r.message||'No se pudo registrar el check-in')};}
        var ci=Array.isArray(r)?(r.length?r[0]:null):r;if(!ci||typeof ci!=='object')return {ok:false,error:'Supabase no devolvió el check-in guardado'};
        ci.socio_id=String(ci.socio_id||sid);var fecha=String(ci.fecha||fechaLocal),hora=String(ci.hora||ahoraHora()),arr=C.checkins[fecha]||[];ci.fecha=fecha;ci.hora=hora;
        if(!arr.some(function(x){return String(x.id||'')===String(ci.id||'')||(String(x.socio_id)===sid&&String(x.fecha)===fecha);}))arr.push(ci);C.checkins[fecha]=arr;
        var si=findIdx(C.socios,sid);if(si>-1){C.socios[si].visitas=(C.socios[si].visitas||0)+1;pat('socios','id=eq.'+encodeURIComponent(sid),{visitas:C.socios[si].visitas});}
        return asegurarSaldoCheckin(sid,fecha,hora).then(function(sr){
          if(sr&&sr.ok&&sr.data){var existe=C.saldoMovimientos.some(function(m){return String(m.id)===String(sr.data.id)||(String(m.socio_id)===sid&&m.tipo==='checkin'&&String(m.fecha)===fecha);});if(!existe)C.saldoMovimientos.unshift(sr.data);}
          bump();return {ok:true,checkin:deepCopy([ci])[0],warning:sr&&sr.ok?null:(sr&&sr.error?sr.error:'El check-in se guardó, pero no se pudo confirmar el +1 de saldo')};
        });
      });
    },

    getVentas:function(){return deepCopy(C.ventas);},
    agregarVentaProducto:function(datos){
      var body={p_socio_id:String(datos.socio_id),p_socio_nombre:String(datos.socio_nombre||''),p_producto_id:String(datos.producto_id),p_cantidad:Number(datos.cantidad)||0,p_trainer:datos.trainer||null,p_timezone:DB_CONFIG.CLUB_TIMEZONE};
      return post('rpc/contender_agregar_venta_producto',body).then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo agregar el producto'};
        var x=Array.isArray(r)?(r.length?r[0]:null):r;if(!x||!x.venta||!x.producto)return {ok:false,error:'Supabase no devolvió la venta y el stock actualizados'};
        var v=x.venta;v.socio_id=v.socio_id==null?null:String(v.socio_id);v.total=Number(v.total)||0;v.cantidad=Number(v.cantidad)||0;v.status=v.status||'debe';
        C.ventas=C.ventas.filter(function(z){return String(z.id)!==String(v.id)});C.ventas.unshift(v);
        var pi=findIdx(C.productos,x.producto.id);if(pi>-1)C.productos[pi]=x.producto;else C.productos.push(x.producto);
        bump();return {ok:true,data:deepCopy([v])[0],producto:deepCopy([x.producto])[0]};
      });
    },
    cambiarEstadoVentaProducto:function(id,status){
      status=status==='pagado'?'pagado':'debe';
      return pat('ventas','id=eq.'+encodeURIComponent(id)+'&tipo=eq.prod',{status:status}).then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo cambiar el estado de la venta'};
        var guardada=Array.isArray(r)&&r.length?r[0]:null;if(!guardada)return {ok:false,error:'No se encontró la venta a actualizar'};
        guardada.socio_id=guardada.socio_id==null?null:String(guardada.socio_id);var idx=findIdx(C.ventas,guardada.id);if(idx>-1)C.ventas[idx]=guardada;else C.ventas.unshift(guardada);bump();return {ok:true,data:deepCopy([guardada])[0]};
      });
    },

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

-- 0) Membresías: soporte real para duraciones por días o meses.
alter table public.membresias
  add column if not exists unidad_duracion text;

alter table public.membresias
  add column if not exists cantidad_duracion integer;

-- Normaliza instalaciones anteriores.
update public.membresias
set unidad_duracion = case
  when lower(trim(coalesce(unidad_duracion,''))) in ('mes','meses') then 'meses'
  else 'dias'
end
where unidad_duracion is null
   or lower(trim(unidad_duracion)) in ('dia','día','dias','días','mes','meses');

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='membresias' and column_name='dias'
  ) then
    execute 'update public.membresias set cantidad_duracion = dias where cantidad_duracion is null and dias is not null';
    execute 'alter table public.membresias alter column dias drop not null';
  end if;
end $$;

update public.membresias
set cantidad_duracion = 1
where cantidad_duracion is null or cantidad_duracion <= 0;

alter table public.membresias alter column unidad_duracion set default 'dias';
alter table public.membresias alter column unidad_duracion set not null;
alter table public.membresias alter column cantidad_duracion set default 1;
alter table public.membresias alter column cantidad_duracion set not null;

alter table public.membresias drop constraint if exists membresias_unidad_duracion_check;
alter table public.membresias add constraint membresias_unidad_duracion_check
  check (unidad_duracion in ('dias','meses'));

alter table public.membresias drop constraint if exists membresias_cantidad_duracion_check;
alter table public.membresias add constraint membresias_cantidad_duracion_check
  check (cantidad_duracion > 0);

-- 1) Pagos de membresía: `abonos` es la única fuente de verdad.
--    Se agregan metadatos del ciclo para separar correctamente renovaciones.
alter table public.abonos add column if not exists plan text;
alter table public.abonos add column if not exists membresia_inicio date;
alter table public.abonos add column if not exists membresia_vencimiento date;
alter table public.abonos add column if not exists trainer text;

-- Completa metadatos de abonos existentes usando las antiguas ventas de membresía,
-- emparejando socio + monto + fecha. Esto NO duplica pagos.
with emparejados as (
  select a.id as abono_id,
         v.producto as plan,
         v.membresia_inicio,
         v.membresia_vencimiento,
         v.trainer
  from public.abonos a
  join lateral (
    select v.*
    from public.ventas v
    where v.tipo='memb'
      and v.socio_id::text=a.socio_id::text
      and coalesce(v.total,0)=coalesce(a.monto,0)
      and (a.fecha_pago is null or v.fecha=a.fecha_pago)
    order by v.id desc
    limit 1
  ) v on true
)
update public.abonos a
set plan=coalesce(a.plan,e.plan),
    membresia_inicio=coalesce(a.membresia_inicio,e.membresia_inicio),
    membresia_vencimiento=coalesce(a.membresia_vencimiento,e.membresia_vencimiento),
    trainer=coalesce(a.trainer,e.trainer),
    fecha_limite=coalesce(a.fecha_limite,e.membresia_vencimiento)
from emparejados e
where a.id=e.abono_id;

-- Si un abono del ciclo actual no tenía metadatos, toma los datos actuales del socio.
update public.abonos a
set plan=coalesce(a.plan,s.plan),
    membresia_inicio=coalesce(a.membresia_inicio,s.fecha_inicio),
    membresia_vencimiento=coalesce(a.membresia_vencimiento,s.fecha_vencimiento),
    fecha_limite=coalesce(a.fecha_limite,s.fecha_vencimiento)
from public.socios s
where a.socio_id::text=s.id::text
  and a.membresia_inicio is null
  and a.fecha_pago is not null
  and s.fecha_inicio is not null
  and s.fecha_vencimiento is not null
  and a.fecha_pago between s.fecha_inicio and s.fecha_vencimiento;

-- Migra cualquier venta histórica de membresía que no tenga su abono equivalente.
-- row_number conserva correctamente múltiples pagos iguales realizados el mismo día.
with ventas_memb as (
  select v.*,
         row_number() over(partition by v.socio_id::text,coalesce(v.total,0),v.fecha order by v.id) as rn
  from public.ventas v
  where v.tipo='memb'
),
abonos_existentes as (
  select a.*,
         row_number() over(partition by a.socio_id::text,coalesce(a.monto,0),a.fecha_pago order by a.id) as rn
  from public.abonos a
),
faltantes as (
  select v.*
  from ventas_memb v
  left join abonos_existentes a
    on a.socio_id::text=v.socio_id::text
   and coalesce(a.monto,0)=coalesce(v.total,0)
   and a.fecha_pago=v.fecha
   and a.rn=v.rn
  where a.id is null
),
faltantes_num as (
  select f.*,
         row_number() over(partition by f.socio_id::text order by f.fecha,f.id) as nuevo_n
  from faltantes f
)
insert into public.abonos
  (socio_id,numero,monto,fecha_pago,fecha_limite,pagado,plan,membresia_inicio,membresia_vencimiento,trainer)
select f.socio_id,
       coalesce((select max(a.numero) from public.abonos a where a.socio_id::text=f.socio_id::text),0)+f.nuevo_n,
       f.total,
       f.fecha,
       f.membresia_vencimiento,
       true,
       f.producto,
       f.membresia_inicio,
       f.membresia_vencimiento,
       f.trainer
from faltantes_num f;

-- A partir de esta versión, ventas contiene solamente ventas de productos.
delete from public.ventas where tipo='memb';

create index if not exists idx_abonos_socio_ciclo
  on public.abonos (socio_id,membresia_inicio,membresia_vencimiento);

-- 2) Saldo del socio. El saldo es la suma de movimientos.
--    Desde la VERSION 2026.08.10.2040 cada check-in agrega +1 mediante trigger SQL.
--    Abonos y descuentos son manuales; las compras NO descuentan saldo automáticamente.
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

-- 2.1) Reconciliación y automatización de saldo por check-in (VERSION 2026.08.10.2040).
-- El error anterior se producía porque JavaScript enviaba horas como "05:12 p.m." a una
-- columna SQL de hora. La app nueva envía HH:MM:SS y este trigger mantiene check-in/saldo unidos.
with repetidos as (
  select id,
         row_number() over (partition by socio_id, fecha order by id) as rn
  from public.saldo_movimientos
  where tipo='checkin'
)
delete from public.saldo_movimientos sm
using repetidos r
where sm.id=r.id and r.rn>1;

create unique index if not exists uq_saldo_checkin_socio_fecha
  on public.saldo_movimientos (socio_id,fecha)
  where tipo='checkin';

with checkins_unicos as (
  select distinct on (c.socio_id::text,c.fecha)
         c.socio_id::text as socio_id,c.fecha,c.hora
  from public.checkins c
  order by c.socio_id::text,c.fecha,c.hora
)
insert into public.saldo_movimientos (socio_id,tipo,monto,concepto,fecha,hora)
select cu.socio_id,'checkin',1,'Check-in',cu.fecha,
       coalesce(nullif(substring(cu.hora::text from '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?'),'')::time,'00:00:00'::time)
from checkins_unicos cu
where not exists (
  select 1 from public.saldo_movimientos sm
  where sm.socio_id=cu.socio_id and sm.fecha=cu.fecha and sm.tipo='checkin'
)
on conflict (socio_id,fecha) where tipo='checkin' do nothing;

create or replace function public.contender_saldo_por_checkin()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_hora time := localtime;
  v_txt text;
begin
  begin
    if new.hora is not null then
      v_txt := substring(new.hora::text from '^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?');
      if v_txt is not null and v_txt<>'' then v_hora:=v_txt::time; end if;
    end if;
  exception when others then
    v_hora:=localtime;
  end;

  insert into public.saldo_movimientos (socio_id,tipo,monto,concepto,fecha,hora)
  values (new.socio_id::text,'checkin',1,'Check-in',new.fecha,v_hora)
  on conflict (socio_id,fecha) where tipo='checkin' do nothing;
  return new;
end;
$$;

drop trigger if exists trg_contender_saldo_por_checkin on public.checkins;
create trigger trg_contender_saldo_por_checkin
after insert on public.checkins
for each row execute function public.contender_saldo_por_checkin();

-- 3) Cambio transaccional del número de socio.
-- Crea primero una copia del socio con el ID nuevo, mueve todas las
-- referencias conocidas y al final elimina el ID anterior. Así funciona
-- incluso si existen llaves foráneas sin ON UPDATE CASCADE.
drop function if exists public.cambiar_numero_socio(text,text);

create function public.cambiar_numero_socio(
  p_anterior text,
  p_nuevo text
) returns boolean
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
    return true;
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
  return true;
end;
$$;

grant execute on function public.cambiar_numero_socio(text,text) to anon;
grant execute on function public.cambiar_numero_socio(text,text) to authenticated;

notify pgrst, 'reload schema';


-- ============================================================
-- CHECK-IN CON HORA AUTORITATIVA DEL SERVIDOR
-- VERSION 2026.08.11.1745
-- La hora del check-in ya no depende del formato AM/PM del navegador.
-- Se toma una sola vez desde PostgreSQL y se convierte a la zona del club.
-- ============================================================

create or replace function public.contender_registrar_checkin(
  p_socio_id text,
  p_timezone text default 'America/Mexico_City'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_local timestamp without time zone;
  v_fecha date;
  v_hora time without time zone;
  v_coltype text;
  v_row jsonb;
begin
  if p_socio_id is null or btrim(p_socio_id) = '' then
    raise exception 'Socio requerido';
  end if;

  begin
    v_local := timezone(p_timezone, now());
  exception when invalid_parameter_value then
    raise exception 'Zona horaria invalida: %', p_timezone;
  end;

  v_fecha := v_local::date;
  v_hora := v_local::time;

  -- Serializa dos intentos simultaneos del mismo socio/dia.
  perform pg_advisory_xact_lock(hashtext(p_socio_id || '|' || v_fecha::text));

  if exists (
    select 1 from public.checkins
    where socio_id::text = p_socio_id and fecha = v_fecha
  ) then
    raise exception 'Este socio ya tiene check-in hoy' using errcode = '23505';
  end if;

  select format_type(a.atttypid, a.atttypmod)
    into v_coltype
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'checkins'
    and a.attname = 'socio_id'
    and not a.attisdropped;

  if v_coltype is null then
    raise exception 'No existe public.checkins.socio_id';
  end if;

  execute format(
    'insert into public.checkins as c (socio_id, fecha, hora) values ($1::%s, $2, $3) returning to_jsonb(c)',
    v_coltype
  ) into v_row using p_socio_id, v_fecha, v_hora;

  return v_row;
end;
$$;

grant execute on function public.contender_registrar_checkin(text,text) to anon;
grant execute on function public.contender_registrar_checkin(text,text) to authenticated;

notify pgrst, 'reload schema';



-- ============================================================
-- VENTAS DE PRODUCTOS + STOCK ATOMICO
-- VERSION 2026.08.12.2140
-- ============================================================

create or replace function public.contender_agregar_venta_producto(
  p_socio_id text,
  p_socio_nombre text,
  p_producto_id text,
  p_cantidad integer,
  p_trainer text,
  p_timezone text default 'America/Mexico_City'
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_socio public.socios%rowtype;
  v_producto public.productos%rowtype;
  v_venta public.ventas%rowtype;
  v_fecha date;
  v_nombre text;
begin
  if p_socio_id is null or trim(p_socio_id) = '' then
    raise exception 'Socio requerido';
  end if;

  if p_producto_id is null or trim(p_producto_id) = '' then
    raise exception 'Producto requerido';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'Cantidad invalida';
  end if;

  if p_trainer is null or trim(p_trainer) = '' then
    raise exception 'Entrenador requerido';
  end if;

  select *
  into v_socio
  from public.socios
  where id::text = trim(p_socio_id)
  limit 1;

  if not found then
    raise exception 'No existe el socio %', p_socio_id;
  end if;

  -- FOR UPDATE bloquea el producto mientras se valida y descuenta stock.
  -- Esto evita que dos ventas simultaneas usen el mismo inventario.
  select *
  into v_producto
  from public.productos
  where id::text = trim(p_producto_id)
  for update;

  if not found then
    raise exception 'No existe el producto %', p_producto_id;
  end if;

  if coalesce(v_producto.stock, 0) < p_cantidad then
    raise exception 'Stock insuficiente. Disponible: %', coalesce(v_producto.stock, 0);
  end if;

  v_fecha := (now() at time zone coalesce(nullif(trim(p_timezone), ''), 'America/Mexico_City'))::date;
  v_nombre := coalesce(
    nullif(trim(p_socio_nombre), ''),
    trim(concat_ws(' ', v_socio.nombre, v_socio.apellido_paterno, v_socio.apellido_materno))
  );

  update public.productos
  set stock = coalesce(stock, 0) - p_cantidad
  where id = v_producto.id
  returning * into v_producto;

  insert into public.ventas (
    socio_id,
    socio_nombre,
    producto,
    cantidad,
    total,
    fecha,
    status,
    tipo,
    trainer
  ) values (
    v_socio.id,
    v_nombre,
    v_producto.nombre,
    p_cantidad,
    coalesce(v_producto.costo, 0) * p_cantidad,
    v_fecha,
    'debe',
    'prod',
    trim(p_trainer)
  )
  returning * into v_venta;

  return jsonb_build_object(
    'venta', to_jsonb(v_venta),
    'producto', to_jsonb(v_producto)
  );
end;
$$;

-- El frontend actual usa la clave anon. Cuando se active RLS/Auth,
-- estos permisos deben endurecerse para dejar solo authenticated/admin.
revoke execute on function public.contender_agregar_venta_producto(text,text,text,integer,text,text) from public;
grant execute on function public.contender_agregar_venta_producto(text,text,text,integer,text,text) to anon;
grant execute on function public.contender_agregar_venta_producto(text,text,text,integer,text,text) to authenticated;

-- Reconciliacion de estados anteriores:
-- En versiones viejas, al marcar una deuda de producto como pagada se borraba
-- la fila de `deudas`, pero `ventas.status` podia quedarse en 'debe'.
-- Esta consulta conserva como 'debe' exactamente el numero de deudas que aun
-- existen para cada grupo equivalente y marca el resto como 'pagado'.
with ventas_debe as (
  select
    v.id,
    v.socio_id::text as socio_id_txt,
    coalesce(v.producto,'') as producto_txt,
    coalesce(v.total,0) as total_val,
    v.fecha,
    coalesce(v.trainer,'') as trainer_txt,
    row_number() over (
      partition by v.socio_id::text, coalesce(v.producto,''), coalesce(v.total,0), v.fecha, coalesce(v.trainer,'')
      order by v.id desc
    ) as rn
  from public.ventas v
  where v.tipo='prod' and v.status='debe'
),
deudas_pendientes as (
  select
    d.socio_id::text as socio_id_txt,
    coalesce(d.producto,'') as producto_txt,
    coalesce(d.total,0) as total_val,
    d.fecha,
    coalesce(d.trainer,'') as trainer_txt,
    count(*)::integer as cantidad
  from public.deudas d
  where coalesce(d.tipo,'producto')='producto'
  group by d.socio_id::text, coalesce(d.producto,''), coalesce(d.total,0), d.fecha, coalesce(d.trainer,'')
)
update public.ventas v
set status='pagado'
from ventas_debe vd
left join deudas_pendientes dp
  on dp.socio_id_txt=vd.socio_id_txt
 and dp.producto_txt=vd.producto_txt
 and dp.total_val=vd.total_val
 and dp.fecha=vd.fecha
 and dp.trainer_txt=vd.trainer_txt
where v.id=vd.id
  and vd.rn>coalesce(dp.cantidad,0);

-- Indice util para detalle de socio y reportes.
create index if not exists idx_ventas_socio_tipo_fecha
  on public.ventas (socio_id, tipo, fecha desc);

notify pgrst, 'reload schema';

-- FIN DEL SQL
*/
