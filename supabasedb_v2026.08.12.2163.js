// CONTENDER CLUB | SUPABASE VERSION 2026.08.12.2163 | MULTIPLES HORARIOS DE CLASE + RESERVAS DE ESPACIOS + TRAINER AUTH + ABONO POR VISITAS
// ═══════════════════════════════════════════════════════════════
// VERSION DEL ARCHIVO: 2026.08.12.2163 | supabasedb_v2026.08.12.2163.js | Contender Club | TRAINER AUTH + ABONO POR VISITAS
//
// ETAPA 5 COMPLETA: requiere ejecutar la migración SQL 2150 después de la 2148.
// El bloque SQL histórico al final se conserva solo como referencia de migraciones anteriores.
// Cambia la extensión de este archivo a .js y conserva el nombre: supabasedb_v2026.08.12.2163.js.
// ═══════════════════════════════════════════════════════════════

var GymDB = (function () {
  'use strict';

  var CONTENDER_SUPABASE_VERSION = '2026.08.12.2163';

  var PROJECT_URL = 'https://ytbujmamijrzmpeqiadx.supabase.co';
  var URL = PROJECT_URL + '/rest/v1';
  var AUTH_URL = PROJECT_URL + '/auth/v1';
  var FUNCTIONS_URL = PROJECT_URL + '/functions/v1';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YnVqbWFtaWpyem1wZXFpYWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDcxODcsImV4cCI6MjA5NTc4MzE4N30.u76APTL2nKmhZy-hpPx4iPPyT5wPC1BHbsBkNcZYZqg';
  var ADMIN_SESSION_KEY = 'contender_admin_session_v1';
  var SOCIO_SESSION_KEY = 'contender_socio_session_v1';
  var TRAINER_SESSION_KEY = 'contender_trainer_session_v1';
  var AUTH_SESSION = null;
  var AUTH_REFRESH_TIMER = null;
  var SOCIO_AUTH_SESSION = null;
  var SOCIO_AUTH_REFRESH_TIMER = null;
  var TRAINER_AUTH_SESSION = null;
  var TRAINER_AUTH_REFRESH_TIMER = null;
  var TRAINER_ACTUAL = null;
  var ACTIVE_AUTH_ROLE = null;

  var DB_CONFIG = {
    REQUEST_TIMEOUT_MS: 12000,
    PUNTOS_POR_CHECKIN: 1,
    CLUB_TIMEZONE: 'America/Mexico_City'
  };

  var C = {
    socios:[], checkins:{}, ventas:[], membresias:[], clases:[], productos:[], mensajes:[],
    inscritos:{}, cuposClases:{}, claseHorarios:[], trainers:[], saldoMovimientos:[], abonosVisitas:[], anuncios:[], socioAppEstado:null
  };

  function h(extra){
    var bearer=KEY;
    if(ACTIVE_AUTH_ROLE==='admin'&&AUTH_SESSION&&AUTH_SESSION.access_token)bearer=AUTH_SESSION.access_token;
    else if(ACTIVE_AUTH_ROLE==='trainer'&&TRAINER_AUTH_SESSION&&TRAINER_AUTH_SESSION.access_token)bearer=TRAINER_AUTH_SESSION.access_token;
    else if(ACTIVE_AUTH_ROLE==='socio'&&SOCIO_AUTH_SESSION&&SOCIO_AUTH_SESSION.access_token)bearer=SOCIO_AUTH_SESSION.access_token;
    else if(AUTH_SESSION&&AUTH_SESSION.access_token)bearer=AUTH_SESSION.access_token;
    else if(TRAINER_AUTH_SESSION&&TRAINER_AUTH_SESSION.access_token)bearer=TRAINER_AUTH_SESSION.access_token;
    else if(SOCIO_AUTH_SESSION&&SOCIO_AUTH_SESSION.access_token)bearer=SOCIO_AUTH_SESSION.access_token;
    var base={'apikey':KEY,'Authorization':'Bearer '+bearer,'Content-Type':'application/json'};
    if(extra)Object.keys(extra).forEach(function(k){base[k]=extra[k];});
    return base;
  }
  function authStorageGet(){try{return sessionStorage.getItem(ADMIN_SESSION_KEY);}catch(e){return null;}}
  function authStorageSet(value){try{if(value==null)sessionStorage.removeItem(ADMIN_SESSION_KEY);else sessionStorage.setItem(ADMIN_SESSION_KEY,value);}catch(e){}}
  function limpiarSesionAdmin(){AUTH_SESSION=null;if(ACTIVE_AUTH_ROLE==='admin')ACTIVE_AUTH_ROLE=null;authStorageSet(null);if(AUTH_REFRESH_TIMER){clearTimeout(AUTH_REFRESH_TIMER);AUTH_REFRESH_TIMER=null;}}
  function programarRefreshAdmin(){
    if(AUTH_REFRESH_TIMER){clearTimeout(AUTH_REFRESH_TIMER);AUTH_REFRESH_TIMER=null;}
    if(!AUTH_SESSION||!AUTH_SESSION.refresh_token)return;
    var exp=Number(AUTH_SESSION.expires_at)||0,delay=exp?Math.max(30000,(exp*1000-Date.now())-120000):3000000;
    AUTH_REFRESH_TIMER=setTimeout(function(){refrescarSesionAdmin().catch(function(){limpiarSesionAdmin();});},delay);
  }
  function guardarSesionAdmin(s){
    if(!s||!s.access_token){limpiarSesionAdmin();return null;}
    if(!s.expires_at&&s.expires_in)s.expires_at=Math.floor(Date.now()/1000)+Number(s.expires_in);
    AUTH_SESSION=s;ACTIVE_AUTH_ROLE='admin';authStorageSet(JSON.stringify(s));programarRefreshAdmin();return s;
  }
  function rawFetch(url,opts,timeoutMs){
    timeoutMs=Math.max(1000,Number(timeoutMs)||DB_CONFIG.REQUEST_TIMEOUT_MS);var controller=typeof AbortController!=='undefined'?new AbortController():null,timer=null;
    opts=opts||{};if(controller)opts.signal=controller.signal;
    return new Promise(function(resolve,reject){
      timer=setTimeout(function(){if(controller){try{controller.abort();}catch(e){}}reject(new Error('Tiempo de espera agotado'));},timeoutMs);
      fetch(url,opts).then(function(r){return r.text().then(function(text){var data=null;if(text){try{data=JSON.parse(text);}catch(e){data={message:text};}}return{ok:r.ok,status:r.status,data:data,headers:r.headers};});}).then(function(x){clearTimeout(timer);resolve(x);}).catch(function(e){clearTimeout(timer);reject(e);});
    });
  }
  function authCall(path,body,token){
    var headers={'apikey':KEY,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
    return rawFetch(AUTH_URL+path,{method:'POST',headers:headers,body:JSON.stringify(body||{})}).then(function(r){if(!r.ok){var msg=r.data&&(r.data.msg||r.data.message||r.data.error_description||r.data.error)||('Auth HTTP '+r.status);throw new Error(String(msg));}return r.data||{};});
  }
  function authUser(token){
    return rawFetch(AUTH_URL+'/user',{method:'GET',headers:{'apikey':KEY,'Authorization':'Bearer '+token}}).then(function(r){if(!r.ok)throw new Error((r.data&&(r.data.msg||r.data.message))||'Sesión inválida');return r.data;});
  }
  function refrescarSesionAdmin(){
    if(!AUTH_SESSION||!AUTH_SESSION.refresh_token)return Promise.reject(new Error('No hay sesión para renovar'));
    return authCall('/token?grant_type=refresh_token',{refresh_token:AUTH_SESSION.refresh_token}).then(function(s){guardarSesionAdmin(s);return s;});
  }
  function asegurarSesionAdmin(){
    var raw=authStorageGet();if(!raw)return Promise.resolve(null);
    try{AUTH_SESSION=JSON.parse(raw);}catch(e){limpiarSesionAdmin();return Promise.resolve(null);}
    if(!AUTH_SESSION||!AUTH_SESSION.access_token){limpiarSesionAdmin();return Promise.resolve(null);}
    var exp=Number(AUTH_SESSION.expires_at)||0;
    var ready=(exp&&exp*1000<Date.now()+60000&&AUTH_SESSION.refresh_token)?refrescarSesionAdmin():Promise.resolve(AUTH_SESSION);
    return ready.then(function(s){return authUser(s.access_token).then(function(user){AUTH_SESSION.user=user;guardarSesionAdmin(AUTH_SESSION);return AUTH_SESSION;});}).catch(function(){limpiarSesionAdmin();return null;});
  }
  function socioStorageGet(){try{return localStorage.getItem(SOCIO_SESSION_KEY);}catch(e){return null;}}
  function socioStorageSet(value){try{if(value==null)localStorage.removeItem(SOCIO_SESSION_KEY);else localStorage.setItem(SOCIO_SESSION_KEY,value);}catch(e){}}
  function limpiarSesionSocio(){SOCIO_AUTH_SESSION=null;if(ACTIVE_AUTH_ROLE==='socio')ACTIVE_AUTH_ROLE=null;socioStorageSet(null);if(SOCIO_AUTH_REFRESH_TIMER){clearTimeout(SOCIO_AUTH_REFRESH_TIMER);SOCIO_AUTH_REFRESH_TIMER=null;}}
  function socioIdDesdeUsuario(user){var meta=user&&user.user_metadata?user.user_metadata:{};return String(meta&&meta.socio_id!=null?meta.socio_id:'').trim();}
  function emailSocio(telefono){telefono=String(telefono||'').replace(/\D/g,'');return telefono?telefono+'@contenderclub.com':'';}
  function passwordSocio(telefono,codigo){telefono=String(telefono||'').replace(/\D/g,'');codigo=String(codigo||'').trim();return 'CC!'+telefono+'!'+codigo+'!SOCIO';}
  function programarRefreshSocio(){
    if(SOCIO_AUTH_REFRESH_TIMER){clearTimeout(SOCIO_AUTH_REFRESH_TIMER);SOCIO_AUTH_REFRESH_TIMER=null;}
    if(!SOCIO_AUTH_SESSION||!SOCIO_AUTH_SESSION.refresh_token)return;
    var exp=Number(SOCIO_AUTH_SESSION.expires_at)||0,delay=exp?Math.max(30000,(exp*1000-Date.now())-120000):3000000;
    SOCIO_AUTH_REFRESH_TIMER=setTimeout(function(){refrescarSesionSocio().catch(function(){limpiarSesionSocio();});},delay);
  }
  function guardarSesionSocio(s,persistir){
    if(!s||!s.access_token){limpiarSesionSocio();return null;}
    if(!s.expires_at&&s.expires_in)s.expires_at=Math.floor(Date.now()/1000)+Number(s.expires_in);
    SOCIO_AUTH_SESSION=s;ACTIVE_AUTH_ROLE='socio';if(persistir!==false)socioStorageSet(JSON.stringify(s));programarRefreshSocio();return s;
  }
  function refrescarSesionSocio(){
    if(!SOCIO_AUTH_SESSION||!SOCIO_AUTH_SESSION.refresh_token)return Promise.reject(new Error('No hay sesión de socio para renovar'));
    return authCall('/token?grant_type=refresh_token',{refresh_token:SOCIO_AUTH_SESSION.refresh_token}).then(function(s){guardarSesionSocio(s,true);return s;});
  }
  function validarSesionSocio(s,persistir){
    if(!s||!s.access_token)return Promise.resolve(null);
    SOCIO_AUTH_SESSION=s;
    var exp=Number(s.expires_at)||0;
    var ready=(exp&&exp*1000<Date.now()+60000&&s.refresh_token)?refrescarSesionSocio():Promise.resolve(s);
    return ready.then(function(actual){return authUser(actual.access_token).then(function(user){actual.user=user;var socioId=socioIdDesdeUsuario(user);if(!socioId)throw new Error('La cuenta Auth no está vinculada a un socio');guardarSesionSocio(actual,persistir!==false);return actual;});});
  }
  function asegurarSesionSocio(){
    var raw=socioStorageGet();if(!raw)return Promise.resolve(null);var s=null;
    try{s=JSON.parse(raw);}catch(e){limpiarSesionSocio();return Promise.resolve(null);}
    return validarSesionSocio(s,true).catch(function(){limpiarSesionSocio();return null;});
  }
  // ── ETAPA 12: sesión Auth real del entrenador ─────────────
  function trainerStorageGet(){try{return sessionStorage.getItem(TRAINER_SESSION_KEY);}catch(e){return null;}}
  function trainerStorageSet(value){try{if(value==null)sessionStorage.removeItem(TRAINER_SESSION_KEY);else sessionStorage.setItem(TRAINER_SESSION_KEY,value);}catch(e){}}
  function limpiarSesionTrainer(){TRAINER_AUTH_SESSION=null;TRAINER_ACTUAL=null;if(ACTIVE_AUTH_ROLE==='trainer')ACTIVE_AUTH_ROLE=null;trainerStorageSet(null);if(TRAINER_AUTH_REFRESH_TIMER){clearTimeout(TRAINER_AUTH_REFRESH_TIMER);TRAINER_AUTH_REFRESH_TIMER=null;}}
  function emailTrainer(telefono){telefono=String(telefono||'').replace(/\D/g,'');return telefono?telefono+'@trainer.contenderclub.com':'';}
  function passwordTrainer(telefono,pin){telefono=String(telefono||'').replace(/\D/g,'');pin=String(pin||'').trim();return 'CC!'+telefono+'!'+pin+'!TRAINER';}
  function programarRefreshTrainer(){
    if(TRAINER_AUTH_REFRESH_TIMER){clearTimeout(TRAINER_AUTH_REFRESH_TIMER);TRAINER_AUTH_REFRESH_TIMER=null;}
    if(!TRAINER_AUTH_SESSION||!TRAINER_AUTH_SESSION.refresh_token)return;
    var exp=Number(TRAINER_AUTH_SESSION.expires_at)||0,delay=exp?Math.max(30000,(exp*1000-Date.now())-120000):3000000;
    TRAINER_AUTH_REFRESH_TIMER=setTimeout(function(){refrescarSesionTrainer().catch(function(){limpiarSesionTrainer();});},delay);
  }
  function guardarSesionTrainer(s){
    if(!s||!s.access_token){limpiarSesionTrainer();return null;}
    if(!s.expires_at&&s.expires_in)s.expires_at=Math.floor(Date.now()/1000)+Number(s.expires_in);
    TRAINER_AUTH_SESSION=s;ACTIVE_AUTH_ROLE='trainer';trainerStorageSet(JSON.stringify(s));programarRefreshTrainer();return s;
  }
  function refrescarSesionTrainer(){
    if(!TRAINER_AUTH_SESSION||!TRAINER_AUTH_SESSION.refresh_token)return Promise.reject(new Error('No hay sesión de entrenador para renovar'));
    return authCall('/token?grant_type=refresh_token',{refresh_token:TRAINER_AUTH_SESSION.refresh_token}).then(function(s){guardarSesionTrainer(s);return s;});
  }
  function cargarTrainerActual(){
    if(!TRAINER_AUTH_SESSION||!TRAINER_AUTH_SESSION.access_token)return Promise.reject(new Error('Sesión de entrenador requerida'));
    return sbFetch('POST','rpc/contender_trainer_actual',null,{}).then(function(r){
      if(r&&r._error)throw new Error(r.userMessage||r.message||'No se pudo validar el perfil de entrenador');
      var x=Array.isArray(r)?r[0]:r;if(!x||!x.trainer_id||x.activo===false)throw new Error('La cuenta Auth no está vinculada a un entrenador activo');
      TRAINER_ACTUAL=x;return x;
    });
  }
  function validarSesionTrainer(s){
    if(!s||!s.access_token)return Promise.resolve(null);TRAINER_AUTH_SESSION=s;
    var exp=Number(s.expires_at)||0,ready=(exp&&exp*1000<Date.now()+60000&&s.refresh_token)?refrescarSesionTrainer():Promise.resolve(s);
    return ready.then(function(actual){return authUser(actual.access_token).then(function(user){actual.user=user;guardarSesionTrainer(actual);return cargarTrainerActual().then(function(){return actual;});});});
  }
  function asegurarSesionTrainer(){
    var raw=trainerStorageGet();if(!raw)return Promise.resolve(null);var s=null;
    try{s=JSON.parse(raw);}catch(e){limpiarSesionTrainer();return Promise.resolve(null);}
    return validarSesionTrainer(s).catch(function(){limpiarSesionTrainer();return null;});
  }
  function functionCall(name,body){
    var sesion=null;
    if(ACTIVE_AUTH_ROLE==='admin'&&AUTH_SESSION&&AUTH_SESSION.access_token)sesion=AUTH_SESSION;
    else if(ACTIVE_AUTH_ROLE==='trainer'&&TRAINER_AUTH_SESSION&&TRAINER_AUTH_SESSION.access_token)sesion=TRAINER_AUTH_SESSION;
    else sesion=AUTH_SESSION&&AUTH_SESSION.access_token?AUTH_SESSION:(TRAINER_AUTH_SESSION&&TRAINER_AUTH_SESSION.access_token?TRAINER_AUTH_SESSION:null);
    if(!sesion)return Promise.resolve({ok:false,error:'Sesión de staff requerida'});
    return rawFetch(FUNCTIONS_URL+'/'+name,{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+sesion.access_token,'Content-Type':'application/json'},body:JSON.stringify(body||{})}).then(function(r){
      if(!r.ok)return{ok:false,status:r.status,error:String((r.data&&(r.data.error||r.data.message))||('Function HTTP '+r.status)),data:r.data};
      return r.data&&typeof r.data==='object'?r.data:{ok:true,data:r.data};
    }).catch(function(e){return{ok:false,error:e&&e.message?e.message:String(e)};});
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
          if(table==='rpc/contender_agregar_venta_producto_v2'&&msg.toLowerCase().indexOf('stock insuficiente')>-1)mensajeUsuario='⚠ Stock insuficiente para completar la venta';
          if(r.status===401&&AUTH_SESSION)mensajeUsuario='⚠ Sesión de administrador vencida. Vuelve a iniciar sesión.';else if(r.status===401&&TRAINER_AUTH_SESSION)mensajeUsuario='⚠ Sesión del entrenador vencida. Vuelve a iniciar sesión.';else if(r.status===401&&SOCIO_AUTH_SESSION)mensajeUsuario='⚠ Sesión del socio vencida. Vuelve a iniciar sesión.';
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
  // 2161: el saldo por check-in es autoritativo en SQL. El frontend solo consulta
  // si el trigger otorgó el punto; nunca crea el +1 por su cuenta.
  function consultarSaldoCheckin(sid,fecha){
    var q='select=*&socio_id=eq.'+encodeURIComponent(sid)+'&tipo=eq.checkin&fecha=eq.'+encodeURIComponent(fecha)+'&order=id.asc&limit=1';
    return get('saldo_movimientos',q).then(function(rows){
      if(rows&&rows._error)return {ok:false,error:rows.userMessage||rows.message||'No se pudo verificar el saldo del check-in'};
      if(Array.isArray(rows)&&rows.length)return {ok:true,data:normalizarMovimientoSaldo(rows[0],sid)};
      return {ok:true,data:null};
    });
  }

  // ── SEGURIDAD ETAPA 4 + 6: carga mínima del socio autenticado ──
  function normalizarMembresia(m){
    m=m||{};m.unidad_duracion=String(m.unidad_duracion||'dias').toLowerCase();m.cantidad_duracion=Number(m.cantidad_duracion)||1;m.precio=Number(m.precio)||0;
    m.deposito_minimo=m.deposito_minimo==null?null:Number(m.deposito_minimo);m.costo_por_visita=m.costo_por_visita==null?null:Number(m.costo_por_visita);return m;
  }
  function normalizarAbonoVisitas(x){
    x=x||{};x.id=String(x.id||'');x.socio_id=String(x.socio_id||'');x.membresia_id=String(x.membresia_id||'');x.deposito_minimo=Number(x.deposito_minimo)||0;x.costo_por_visita=Number(x.costo_por_visita)||0;x.monto_acumulado=Number(x.monto_acumulado)||0;x.remanente=Number(x.remanente)||0;x.visitas_asignadas=Number(x.visitas_asignadas)||0;x.visitas_consumidas=Number(x.visitas_consumidas)||0;x.activo=x.activo!==false;return x;
  }
  function horaHHMM(v){var m=String(v||'').match(/^(\d{1,2}):(\d{2})/);return m?String(Number(m[1])).padStart(2,'0')+':'+m[2]:'';}
  function minutosHHMM(v){var h=horaHHMM(v);if(!h)return null;var p=h.split(':');return Number(p[0])*60+Number(p[1]);}
  function hhmmDesdeMin(n){n=Number(n);if(!Number.isFinite(n))return'';n=((Math.floor(n)%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
  function normalizarClase(cl){
    cl=cl||{};var d=cl.dias;if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){d=d.replace(/[{}\[\]\"']/g,'').split(',').map(function(x){return x.trim();}).filter(Boolean);}}if(!Array.isArray(d))d=[];cl.dias=d;
    cl.tipo=String(cl.tipo||'clase').toLowerCase()==='espacio'?'espacio':'clase';cl.hora=horaHHMM(cl.hora);cl.hora_inicio=horaHHMM(cl.hora_inicio||(cl.tipo==='espacio'?cl.hora:''));cl.hora_fin=horaHHMM(cl.hora_fin);cl.intervalo_minutos=cl.intervalo_minutos==null?null:Number(cl.intervalo_minutos);cl.cupo=Math.max(0,Number(cl.cupo)||0);cl.horarios=Array.isArray(cl.horarios)?cl.horarios:[];return cl;
  }
  function normalizarHorarioClase(h){h=h||{};var d=h.dias;if(typeof d==='string'){try{d=JSON.parse(d);}catch(e){d=d.replace(/[{}\[\]\"']/g,'').split(',').map(function(x){return x.trim();}).filter(Boolean);}}if(!Array.isArray(d))d=[];h.id=h.id==null?null:String(h.id);h.clase_id=String(h.clase_id||'');h.hora=horaHHMM(h.hora);h.dias=d;h.cupo=Math.max(1,Number(h.cupo)||1);h.coach=String(h.coach||'');h.activo=h.activo!==false;return h;}
  function vincularHorariosClases(){C.claseHorarios=(C.claseHorarios||[]).map(normalizarHorarioClase);C.clases.forEach(function(cl){cl.horarios=C.claseHorarios.filter(function(h){return h.activo&&String(h.clase_id)===String(cl.id);}).sort(function(a,b){return String(a.hora).localeCompare(String(b.hora))||Number(a.id||0)-Number(b.id||0);});});}
  function horariosClaseLocal(cl){cl=normalizarClase(cl||{});if(cl.tipo!=='clase')return[];var hs=Array.isArray(cl.horarios)?cl.horarios.filter(function(h){return h&&h.activo!==false;}):[];if(hs.length)return hs.map(normalizarHorarioClase);if(cl.hora)return[normalizarHorarioClase({id:null,clase_id:cl.id,hora:cl.hora,dias:cl.dias,cupo:cl.cupo,coach:cl.coach,activo:true,legacy:true})];return[];}
  function keyInscritos(cid,fecha,horaSlot,horarioId){var slot=horaHHMM(horaSlot),hid=horarioId==null||horarioId===''?'':String(horarioId);return String(cid)+'|'+String(fecha||hoy())+(hid?'|H'+hid:(slot?'|S'+slot:''));}
  function turnosClaseLocal(cl,fecha){cl=normalizarClase(cl||{});if(cl.tipo!=='espacio')return[];var ini=minutosHHMM(cl.hora_inicio),fin=minutosHHMM(cl.hora_fin),paso=Number(cl.intervalo_minutos)||0,out=[];if(ini==null||fin==null||fin<=ini||paso<=0)return out;for(var m=ini;m+paso<=fin;m+=paso){var h=hhmmDesdeMin(m),hf=hhmmDesdeMin(m+paso),key=keyInscritos(cl.id,fecha,h),ids=(C.inscritos[key]||[]).slice();if(SOCIO_AUTH_SESSION){var total=Math.max(Number(C.cuposClases[key])||0,ids.length),i=0;while(ids.length<total)ids.push('__ocupado_'+(++i));}var cupo=Math.max(0,Number(cl.cupo)||0);out.push({hora:h,fin:hf,inscritos:ids,cupo:cupo,disponibles:Math.max(cupo-ids.length,0)});}return out;}
  function planEsVisitas(plan){var key=String(plan||'').trim().toLowerCase();return C.membresias.some(function(m){return String(m.nombre||'').trim().toLowerCase()===key&&String(m.unidad_duracion||'').toLowerCase()==='visitas';});}

  // Nunca descarga todos los socios, ventas, abonos, check-ins, saldo o cuentas.
  // Membresías y clases se consultan ya autenticado.
  // Inscripciones: solo baja las propias; los cupos vienen de un RPC agregado que NO revela socio_id ajenos.
  function loadSocioActual(){
    if(!SOCIO_AUTH_SESSION||!SOCIO_AUTH_SESSION.user)return Promise.reject(new Error('Sesión Auth de socio requerida'));
    var sid=socioIdDesdeUsuario(SOCIO_AUTH_SESSION.user),f0=hoy();
    if(!sid)return Promise.reject(new Error('La cuenta Auth no está vinculada a un socio'));
    return Promise.all([
      get('socios','select=*&id=eq.'+encodeURIComponent(sid)+'&limit=1'),
      get('abonos','select=*&socio_id=eq.'+encodeURIComponent(sid)+'&order=fecha_pago.desc,id.desc'),
      get('checkins','select=*&socio_id=eq.'+encodeURIComponent(sid)+'&order=fecha.desc,hora.desc'),
      get('ventas','select=*&tipo=eq.prod&socio_id=eq.'+encodeURIComponent(sid)+'&order=id.desc'),
      get('membresias','select=*&order=id.asc'),
      get('clases','select=*&order=id.asc'),
      get('inscritos','select=clase_id,fecha,socio_id,hora_slot,horario_id&socio_id=eq.'+encodeURIComponent(sid)+'&fecha=gte.'+f0),
      post('rpc/contender_cupos_clases',{p_desde:f0}),
      get('saldo_movimientos','select=*&socio_id=eq.'+encodeURIComponent(sid)+'&order=created_at.desc,id.desc'),
      get('socio_abonos_visitas','select=*&socio_id=eq.'+encodeURIComponent(sid)+'&order=id.desc'),
      get('anuncios','select=*&order=created_at.desc,id.desc'),
      get('socio_app_estado','select=*&socio_id=eq.'+encodeURIComponent(sid)+'&limit=1'),
      get('clase_horarios','select=*&activo=eq.true&order=hora.asc,id.asc')
    ]).then(function(res){
      for(var ri=0;ri<res.length;ri++)if(res[ri]&&res[ri]._error)throw new Error(res[ri].userMessage||res[ri].message||'No se pudieron cargar los datos del socio');
      function arr(x){return Array.isArray(x)?x:[];}res=res.map(arr);
      var socio=res[0].length?res[0][0]:null;if(!socio)throw new Error('No se encontró el socio vinculado a esta sesión');
      socio.id=String(socio.id);
      socio.abonos=res[1].map(function(a){a.id=String(a.id);a.socio_id=String(a.socio_id||sid);a.monto=Number(a.monto)||0;a.plan=a.plan||null;a.membresia_inicio=a.membresia_inicio||null;a.membresia_vencimiento=a.membresia_vencimiento||null;a.trainer=a.trainer||null;return a;});
      C.socios=[socio];
      C.checkins={};res[2].forEach(function(c){c.socio_id=String(c.socio_id||sid);var f=String(c.fecha||'');if(!C.checkins[f])C.checkins[f]=[];C.checkins[f].push(c);});
      C.ventas=res[3].map(function(v){v.socio_id=String(v.socio_id||sid);return v;});
      C.membresias=res[4].map(normalizarMembresia);
      C.clases=res[5].map(normalizarClase);
      C.inscritos={};res[6].forEach(function(i){var f=i.fecha||f0,key=keyInscritos(i.clase_id,f,i.hora_slot,i.horario_id);if(!C.inscritos[key])C.inscritos[key]=[];if(C.inscritos[key].indexOf(sid)===-1)C.inscritos[key].push(sid);});
      C.cuposClases={};res[7].forEach(function(i){var f=i.fecha||f0,key=keyInscritos(i.clase_id,f,i.hora_slot,i.horario_id);C.cuposClases[key]=Math.max(0,Number(i.inscritos)||0);});
      C.saldoMovimientos=res[8].map(function(m){m.socio_id=String(m.socio_id||sid);m.monto=Number(m.monto)||0;return m;});
      C.abonosVisitas=res[9].map(normalizarAbonoVisitas);
      C.anuncios=res[10].map(function(a){a.id=String(a.id);return a;});
      C.socioAppEstado=res[11].length?res[11][0]:null;C.claseHorarios=res[12].map(normalizarHorarioClase);vincularHorariosClases();
      // Vacía caches administrativas para que la app socio no conserve datos globales.
      C.productos=[];C.mensajes=[];C.trainers=[];
      return true;
    });
  }

  // ETAPA 12 / 2159: carga operativa del entrenador. Descarga anuncios vigentes;
  // el estado visto/no visto se conserva localmente en trainer.html, sin tabla adicional.
  function loadTrainer(){
    if(!TRAINER_AUTH_SESSION||!TRAINER_AUTH_SESSION.user)return Promise.reject(new Error('Sesión Auth de entrenador requerida'));
    return Promise.all([
      get('socios','select=*,abonos(*)&order=id.asc'),
      get('checkins','select=*&fecha=eq.'+hoy()),
      get('ventas','select=*&tipo=eq.prod&order=id.desc&limit=200'),
      get('membresias','select=*&order=id.asc'),
      get('clases','select=*&order=id.asc'),
      get('productos','select=*&order=id.asc'),
      get('mensajes_wa','select=*&order=id.asc'),
      get('inscritos','select=*'),
      get('saldo_movimientos','select=*&order=created_at.desc,id.desc'),
      get('socio_abonos_visitas','select=*&order=id.desc'),
      get('anuncios','select=*&order=created_at.desc,id.desc'),
      get('clase_horarios','select=*&activo=eq.true&order=hora.asc,id.asc')
    ]).then(function(res){
      for(var ri=0;ri<res.length;ri++)if(res[ri]&&res[ri]._error)throw new Error(res[ri].userMessage||res[ri].message||'No se pudieron cargar los datos operativos');
      function arr(x){return Array.isArray(x)?x:[];}res=res.map(arr);
      C.socios=res[0].map(function(s){s.id=String(s.id);s.abonos=(s.abonos||[]).sort(function(a,b){return(Number(a.numero)||0)-(Number(b.numero)||0);});s.abonos.forEach(function(a){a.id=String(a.id);a.socio_id=String(a.socio_id||s.id);a.monto=Number(a.monto)||0;a.plan=a.plan||null;a.membresia_inicio=a.membresia_inicio||null;a.membresia_vencimiento=a.membresia_vencimiento||null;a.trainer=a.trainer||null;});return s;});
      Object.keys(_pending).forEach(function(pid){if(findIdx(C.socios,pid)===-1)C.socios.push(_pending[pid]);else delete _pending[pid];});
      C.checkins={};C.checkins[hoy()]=res[1].map(function(c){c.socio_id=String(c.socio_id);return c;});
      C.ventas=res[2].map(function(v){v.socio_id=v.socio_id==null?null:String(v.socio_id);return v;});
      C.membresias=res[3].map(normalizarMembresia);
      C.clases=res[4].map(normalizarClase);
      C.productos=res[5];C.mensajes=res[6];
      C.inscritos={};res[7].forEach(function(i){var f=i.fecha||hoy(),key=keyInscritos(i.clase_id,f,i.hora_slot,i.horario_id);if(!C.inscritos[key])C.inscritos[key]=[];C.inscritos[key].push(String(i.socio_id));});
      C.saldoMovimientos=res[8].map(function(m){m.socio_id=String(m.socio_id);m.monto=Number(m.monto)||0;return m;});
      C.abonosVisitas=res[9].map(normalizarAbonoVisitas);
      C.anuncios=res[10].map(function(a){a.id=String(a.id);return a;});C.claseHorarios=res[11].map(normalizarHorarioClase);vincularHorariosClases();
      C.trainers=[];C.socioAppEstado=null;
      return true;
    });
  }

  function loadAll(){
    // ETAPA 9: el admin ya no descarga tablas legacy que no usa (cuentas,
    // deudas, historico, rutinas). Todas las consultas se realizan autenticadas.
    return Promise.all([
      get('socios','select=*,abonos(*)&order=id.asc'),
      get('checkins','select=*&fecha=eq.'+hoy()),
      get('ventas','select=*&tipo=eq.prod&order=id.desc&limit=200'),
      get('membresias','select=*&order=id.asc'),
      get('clases','select=*&order=id.asc'),
      get('productos','select=*&order=id.asc'),
      get('mensajes_wa','select=*&order=id.asc'),
      get('inscritos','select=*'),
      get('trainers','select=*'),
      get('saldo_movimientos','select=*&order=created_at.desc,id.desc'),
      get('socio_abonos_visitas','select=*&order=id.desc'),
      get('anuncios','select=*&order=created_at.desc,id.desc'),
      get('clase_horarios','select=*&activo=eq.true&order=hora.asc,id.asc')
    ]).then(function(res){
      for(var ri=0;ri<res.length;ri++)if(res[ri]&&res[ri]._error)throw new Error(res[ri].userMessage||res[ri].message||'No se pudieron cargar los datos administrativos');
      function arr(x){return Array.isArray(x)?x:[];}res=res.map(arr);
      C.socios=res[0].map(function(s){s.id=String(s.id);s.abonos=(s.abonos||[]).sort(function(a,b){return (Number(a.numero)||0)-(Number(b.numero)||0);});s.abonos.forEach(function(a){a.id=String(a.id);a.socio_id=String(a.socio_id||s.id);a.monto=Number(a.monto)||0;a.plan=a.plan||null;a.membresia_inicio=a.membresia_inicio||null;a.membresia_vencimiento=a.membresia_vencimiento||null;a.trainer=a.trainer||null;});return s;});
      Object.keys(_pending).forEach(function(pid){if(findIdx(C.socios,pid)===-1)C.socios.push(_pending[pid]);else delete _pending[pid];});
      C.checkins={};C.checkins[hoy()]=res[1].map(function(c){c.socio_id=String(c.socio_id);return c;});
      C.ventas=res[2].map(function(v){v.socio_id=v.socio_id==null?null:String(v.socio_id);return v;});
      C.membresias=res[3].map(normalizarMembresia);
      C.clases=res[4].map(normalizarClase);
      C.productos=res[5];C.mensajes=res[6];
      C.inscritos={};res[7].forEach(function(i){var f=i.fecha||hoy(),key=keyInscritos(i.clase_id,f,i.hora_slot,i.horario_id);if(!C.inscritos[key])C.inscritos[key]=[];C.inscritos[key].push(String(i.socio_id));});
      C.trainers=res[8];
      C.saldoMovimientos=res[9].map(function(m){m.socio_id=String(m.socio_id);m.monto=Number(m.monto)||0;return m;});
      C.abonosVisitas=res[10].map(normalizarAbonoVisitas);C.anuncios=res[11].map(function(a){a.id=String(a.id);return a;});C.claseHorarios=res[12].map(normalizarHorarioClase);vincularHorariosClases();C.socioAppEstado=null;
      // Tablas legacy cerradas en Etapa 9: no se mantienen en memoria.
    });
  }

  function marcaTiempoAnuncio(a){if(!a)return 0;var c=Date.parse(a.created_at||0)||0,u=Date.parse(a.updated_at||0)||0,f=a.fecha_inicio?Date.parse(String(a.fecha_inicio)+"T00:00:00-06:00"):0;return Math.max(c,u,f);}
  function urlImagenAnuncio(path){path=String(path||"");return path?PROJECT_URL+"/storage/v1/object/public/anuncios/"+path.split("/").map(encodeURIComponent).join("/"):"";}

  return {
    VERSION:CONTENDER_SUPABASE_VERSION,
    PUNTOS_POR_CHECKIN:DB_CONFIG.PUNTOS_POR_CHECKIN,
    init:function(){return loadAll();},
    initTrainer:function(){return loadTrainer();},
    initSocio:function(){return loadSocioActual();},
    reset:function(){console.warn('[GymDB] reset() no disponible en modo Supabase.');},

    // ── SEGURIDAD ETAPA 8D: sesión real del administrador ─────
    loginAdmin:function(email,password){
      email=String(email||'').trim().toLowerCase();password=String(password||'');
      if(!email||!password)return Promise.resolve({ok:false,error:'Correo y contraseña son requeridos'});
      return authCall('/token?grant_type=password',{email:email,password:password}).then(function(s){guardarSesionAdmin(s);return{ok:true,user:s.user||null};}).catch(function(e){limpiarSesionAdmin();return{ok:false,error:e&&e.message?e.message:String(e)};});
    },
    restaurarSesionAdmin:function(){return asegurarSesionAdmin().then(function(s){return s?{ok:true,user:s.user||null}:{ok:false,error:'AUTH_REQUIRED'};});},
    esAdminAutorizado:function(){
      if(!AUTH_SESSION||!AUTH_SESSION.access_token)return Promise.resolve(false);
      return sbFetch('POST','rpc/contender_es_admin',null,{}).then(function(r){if(r&&r._error)return false;return r===true||(Array.isArray(r)&&r[0]===true);});
    },
    logoutAdmin:function(){
      var token=AUTH_SESSION&&AUTH_SESSION.access_token;var done=function(){limpiarSesionAdmin();return true;};
      if(!token)return Promise.resolve(done());
      return rawFetch(AUTH_URL+'/logout',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+token}}).then(done).catch(done);
    },
    getAdminUser:function(){return AUTH_SESSION&&AUTH_SESSION.user?deepCopyObj(AUTH_SESSION.user):null;},
    provisionarSocioAuth:function(socioId,telefono,codigo){return functionCall('provisionar-socio-auth',{socio_id:String(socioId||''),telefono:String(telefono||''),codigo:String(codigo||'')});},
    provisionarTrainerAuth:function(trainerId,telefono,pin){return functionCall('provisionar-trainer-auth',{trainer_id:String(trainerId||''),telefono:String(telefono||''),pin:String(pin||'')});},

    // ── ETAPA 12: sesión Auth real del entrenador ──────────────
    loginTrainer:function(telefono,pin){
      telefono=String(telefono||'').replace(/\D/g,'');pin=String(pin||'').trim();
      if(!/^\d{10,15}$/.test(telefono))return Promise.resolve({ok:false,error:'Ingresa un número de celular válido'});
      if(!/^\d{4}$/.test(pin))return Promise.resolve({ok:false,error:'El PIN debe contener 4 dígitos'});
      return authCall('/token?grant_type=password',{email:emailTrainer(telefono),password:passwordTrainer(telefono,pin)}).then(function(s){
        return validarSesionTrainer(s).then(function(actual){return{ok:true,user:deepCopyObj(actual.user),trainer:deepCopyObj(TRAINER_ACTUAL)};});
      }).catch(function(e){limpiarSesionTrainer();var msg=e&&e.message?String(e.message):String(e);if(/invalid login credentials/i.test(msg))msg='Número o PIN incorrecto';return{ok:false,error:msg};});
    },
    restaurarSesionTrainer:function(){return asegurarSesionTrainer().then(function(s){return s?{ok:true,user:deepCopyObj(s.user),trainer:deepCopyObj(TRAINER_ACTUAL)}:{ok:false,error:'AUTH_REQUIRED'};});},
    esTrainerAutorizado:function(){if(!TRAINER_AUTH_SESSION||!TRAINER_AUTH_SESSION.access_token)return Promise.resolve(false);return sbFetch('POST','rpc/contender_es_trainer',null,{}).then(function(r){if(r&&r._error)return false;return r===true||(Array.isArray(r)&&r[0]===true);});},
    logoutTrainer:function(){var token=TRAINER_AUTH_SESSION&&TRAINER_AUTH_SESSION.access_token,done=function(){limpiarSesionTrainer();return true;};if(!token)return Promise.resolve(done());return rawFetch(AUTH_URL+'/logout',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+token}}).then(done).catch(done);},
    getTrainerUser:function(){return TRAINER_AUTH_SESSION&&TRAINER_AUTH_SESSION.user?deepCopyObj(TRAINER_AUTH_SESSION.user):null;},
    getTrainerActual:function(){return TRAINER_ACTUAL?deepCopyObj(TRAINER_ACTUAL):null;},

    // ── SEGURIDAD ETAPA 1: sesión Auth real del socio ──────────
    loginSocio:function(telefono,codigo){
      telefono=String(telefono||'').replace(/\D/g,'');codigo=String(codigo||'').trim();
      if(!/^\d{10,15}$/.test(telefono))return Promise.resolve({ok:false,error:'Ingresa un número de celular válido'});
      if(!/^\d{3,4}$/.test(codigo))return Promise.resolve({ok:false,error:'El código debe contener 3 o 4 dígitos'});
      var email=emailSocio(telefono),password=passwordSocio(telefono,codigo);
      return authCall('/token?grant_type=password',{email:email,password:password}).then(function(s){
        return validarSesionSocio(s,true).then(function(actual){return{ok:true,socio_id:socioIdDesdeUsuario(actual.user),user:deepCopyObj(actual.user),session:deepCopyObj(actual)};});
      }).catch(function(e){limpiarSesionSocio();var msg=e&&e.message?String(e.message):String(e);if(/invalid login credentials/i.test(msg))msg='Número o código incorrecto';return{ok:false,error:msg};});
    },
    restaurarSesionSocio:function(){return asegurarSesionSocio().then(function(s){return s?{ok:true,socio_id:socioIdDesdeUsuario(s.user),user:deepCopyObj(s.user),session:deepCopyObj(s)}:{ok:false,error:'AUTH_REQUIRED'};});},
    usarSesionSocio:function(session){return validarSesionSocio(deepCopyObj(session),true).then(function(s){return{ok:true,socio_id:socioIdDesdeUsuario(s.user),user:deepCopyObj(s.user),session:deepCopyObj(s)};}).catch(function(e){return{ok:false,error:e&&e.message?e.message:String(e)};});},
    logoutSocio:function(){
      var token=SOCIO_AUTH_SESSION&&SOCIO_AUTH_SESSION.access_token;var done=function(){limpiarSesionSocio();return true;};
      if(!token)return Promise.resolve(done());
      return rawFetch(AUTH_URL+'/logout',{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+token}}).then(done).catch(done);
    },
    getSocioAuthActual:function(){return SOCIO_AUTH_SESSION&&SOCIO_AUTH_SESSION.user?{socio_id:socioIdDesdeUsuario(SOCIO_AUTH_SESSION.user),user:deepCopyObj(SOCIO_AUTH_SESSION.user),session:deepCopyObj(SOCIO_AUTH_SESSION)}:null;},

    // ── ETAPA 11: uso de la app y anuncios ────────────────────
    registrarAccesoApp:function(){
      if(!SOCIO_AUTH_SESSION||!SOCIO_AUTH_SESSION.access_token)return Promise.resolve({ok:false,error:'Sesión de socio requerida'});
      return post('rpc/contender_registrar_acceso_app',{}).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo registrar el acceso'};var x=Array.isArray(r)?r[0]:r;return x&&typeof x==='object'?x:{ok:true};});
    },
    getAccesosAppRango:function(desde,hasta){
      var q='select=socio_id,fecha,cantidad,ultimo_acceso&order=fecha.asc,socio_id.asc';if(desde)q+='&fecha=gte.'+encodeURIComponent(desde);if(hasta)q+='&fecha=lte.'+encodeURIComponent(hasta);return get('app_accesos_diarios',q).then(function(r){if(r&&r._error)throw new Error(r.userMessage||r.message||'No se pudieron cargar los accesos');return Array.isArray(r)?r:[];});
    },
    getAnuncios:function(){return deepCopy(C.anuncios);},
    getAnunciosAdmin:function(){return deepCopy(C.anuncios);},
    getAnunciosNoVistos:function(){var last=C.socioAppEstado&&C.socioAppEstado.ultimo_anuncio_visto_at?Date.parse(C.socioAppEstado.ultimo_anuncio_visto_at)||0:0;return deepCopy(C.anuncios.filter(function(a){return marcaTiempoAnuncio(a)>last;}));},
    marcarAnunciosVistos:function(){
      if(!SOCIO_AUTH_SESSION||!SOCIO_AUTH_SESSION.access_token)return Promise.resolve({ok:false,error:'Sesión de socio requerida'});
      return post('rpc/contender_marcar_anuncios_vistos',{}).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo actualizar anuncios vistos'};var x=Array.isArray(r)?r[0]:r;if(x&&x.ultimo_anuncio_visto_at)C.socioAppEstado={socio_id:socioIdDesdeUsuario(SOCIO_AUTH_SESSION.user),ultimo_anuncio_visto_at:x.ultimo_anuncio_visto_at};return x||{ok:true};});
    },
    urlImagenAnuncio:urlImagenAnuncio,
    subirImagenAnuncio:function(file){
      if(!AUTH_SESSION||!AUTH_SESSION.access_token)return Promise.resolve({ok:false,error:'Sesión de administrador requerida'});if(!file)return Promise.resolve({ok:false,error:'Selecciona una imagen'});
      var ext=(String(file.name||'imagen').split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');if(['jpg','jpeg','png','webp'].indexOf(ext)===-1)ext='jpg';var path=Date.now()+'_'+Math.random().toString(36).slice(2,9)+'.'+ext;
      return rawFetch(PROJECT_URL+'/storage/v1/object/anuncios/'+encodeURIComponent(path),{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+AUTH_SESSION.access_token,'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file},DB_CONFIG.REQUEST_TIMEOUT_MS*2).then(function(r){if(!r.ok)return{ok:false,error:String((r.data&&(r.data.message||r.data.error))||('Storage HTTP '+r.status))};return{ok:true,path:path,url:urlImagenAnuncio(path)};}).catch(function(e){return{ok:false,error:e&&e.message?e.message:String(e)};});
    },
    eliminarImagenAnuncio:function(path){if(!path||!AUTH_SESSION||!AUTH_SESSION.access_token)return Promise.resolve({ok:false});return rawFetch(PROJECT_URL+'/storage/v1/object/anuncios',{method:'DELETE',headers:{'apikey':KEY,'Authorization':'Bearer '+AUTH_SESSION.access_token,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[String(path)]})},DB_CONFIG.REQUEST_TIMEOUT_MS).then(function(r){return{ok:r.ok};}).catch(function(){return{ok:false};});},
    guardarAnuncio:function(datos){
      var body={titulo:datos.titulo||null,texto:datos.texto||null,imagen_path:datos.imagen_path||null,fecha_inicio:datos.fecha_inicio||hoy(),fecha_fin:datos.fecha_fin||null,activo:datos.activo!==false,updated_at:new Date().toISOString()},id=datos.id,req=id!=null?pat('anuncios','id=eq.'+encodeURIComponent(id),body):post('anuncios',body);
      return req.then(function(r){if(!r)return{ok:false,error:'No hubo respuesta de Supabase'};if(r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo guardar el anuncio'};var a=Array.isArray(r)&&r.length?r[0]:null;if(!a)return{ok:false,error:'Supabase no devolvió el anuncio'};a.id=String(a.id);var idx=findIdx(C.anuncios,a.id);if(idx>-1)C.anuncios[idx]=a;else C.anuncios.unshift(a);C.anuncios.sort(function(x,y){return String(y.created_at||'').localeCompare(String(x.created_at||''))||Number(y.id)-Number(x.id);});bump();return{ok:true,data:deepCopy([a])[0]};});
    },
    eliminarAnuncio:function(id){id=String(id);return del('anuncios','id=eq.'+encodeURIComponent(id)).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo eliminar el anuncio'};C.anuncios=C.anuncios.filter(function(a){return String(a.id)!==id;});bump();return{ok:true};});},

    getSocios:function(){return deepCopy(C.socios);},
    saveSocios:function(arr){C.socios=arr;},
    getSocio:function(id){var idx=findIdx(C.socios,id);return idx>-1?C.socios[idx]:null;},

    setSocio:function(socio){
      var self=this,idx=findIdx(C.socios,socio.id);
      function nd(v){return(v===''||v===undefined)?null:v;}
      var abonosCache=idx>-1?(C.socios[idx].abonos||[]):(socio.abonos||[]);
      var socioCache=deepCopy([socio])[0];socioCache.abonos=deepCopy(abonosCache);
      var data={id:String(socio.id),nombre:socio.nombre,apellido_paterno:socio.apellido_paterno,apellido_materno:nd(socio.apellido_materno),numero:nd(socio.numero),correo:nd(socio.correo),numero_emergencia:nd(socio.numero_emergencia),plan:nd(socio.plan),fecha_alta:nd(socio.fecha_alta),fecha_inicio:nd(socio.fecha_inicio),fecha_vencimiento:nd(socio.fecha_vencimiento),fecha_nacimiento:nd(socio.fecha_nacimiento),visitas:socio.visitas||0,activo:socio.activo!==false,sexo:nd(socio.sexo),notas:nd(socio.notas),color:socio.color||'#C8F135',vendedor_id:nd(socio.vendedor_id),vendedor_nombre:nd(socio.vendedor_nombre),ultima_visita:nd(socio.ultima_visita),avisos_ids:JSON.stringify(Array.isArray(socio.avisos_ids)?socio.avisos_ids:[])};
      if(idx>-1){
        C.socios[idx]=socioCache;
        return pat('socios','id=eq.'+encodeURIComponent(socio.id),data).then(function(r){
          if(r&&r._error)throw new Error(r.userMessage||r.message||'No se pudo guardar el socio');
          bump();return true;
        });
      }
      _pending[String(socio.id)]=socioCache;C.socios.push(socioCache);
      return post('socios',data).then(function(r){
        if(r&&r._error){C.socios=C.socios.filter(function(x){return String(x.id)!==String(socio.id);});delete _pending[String(socio.id)];throw new Error(r.userMessage||r.message||'No se pudo crear el socio');}
        delete _pending[String(socio.id)];bump();return true;
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
        Object.keys(C.checkins).forEach(function(f){(C.checkins[f]||[]).forEach(function(c){if(String(c.socio_id)===anterior)c.socio_id=nuevo;});});
        C.ventas.forEach(function(v){if(String(v.socio_id)===anterior)v.socio_id=nuevo;});
        C.saldoMovimientos.forEach(function(m){if(String(m.socio_id)===anterior)m.socio_id=nuevo;});
        C.abonosVisitas.forEach(function(m){if(String(m.socio_id)===anterior)m.socio_id=nuevo;});
        Object.keys(C.inscritos).forEach(function(k){C.inscritos[k]=(C.inscritos[k]||[]).map(function(x){return String(x)===anterior?nuevo:String(x);});});
        if(_pending[anterior]){_pending[nuevo]=_pending[anterior];delete _pending[anterior];}
        bump();return true;
      });
    },

    getAbonosVisitas:function(sid){sid=String(sid);return deepCopy(C.abonosVisitas.filter(function(x){return String(x.socio_id)===sid;}).sort(function(a,b){return Number(b.id)-Number(a.id);}));},
    getAbonoVisitasActual:function(sid){sid=String(sid);var socio=C.socios[findIdx(C.socios,sid)]||null,plan=socio&&socio.plan?String(socio.plan):'';var arr=C.abonosVisitas.filter(function(x){return String(x.socio_id)===sid&&(!plan||String(x.plan)===plan);}).sort(function(a,b){return Number(b.id)-Number(a.id);});return arr.length?deepCopy([arr[0]])[0]:null;},
    recargarAbonoVisitas:function(sid,membresiaId,monto,actorNombre){
      sid=String(sid);var body={p_socio_id:sid,p_membresia_id:String(membresiaId),p_monto:Number(monto)||0,p_registrado_por_nombre:actorNombre||null,p_timezone:DB_CONFIG.CLUB_TIMEZONE};
      return post('rpc/contender_recargar_abono_visitas',body).then(function(r){
        if(!r)return{ok:false,error:'No hubo respuesta de Supabase'};if(r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo registrar el abono por visitas'};
        var x=Array.isArray(r)?(r.length?r[0]:null):r;if(!x||!x.estado)return{ok:false,error:'Supabase no devolvió el estado del abono'};
        var estado=normalizarAbonoVisitas(x.estado),ei=C.abonosVisitas.findIndex(function(z){return String(z.id)===String(estado.id);});if(ei>-1)C.abonosVisitas[ei]=estado;else C.abonosVisitas.unshift(estado);
        C.abonosVisitas.forEach(function(z){if(String(z.socio_id)===sid&&String(z.id)!==String(estado.id))z.activo=false;});
        var si=findIdx(C.socios,sid);if(si>-1){C.socios[si].plan=estado.plan;C.socios[si].fecha_inicio=estado.fecha_inicio;C.socios[si].fecha_vencimiento=null;if(x.abono){var a=x.abono;a.id=String(a.id);a.socio_id=sid;a.monto=Number(a.monto)||0;var arr=C.socios[si].abonos||[],ai=arr.findIndex(function(z){return String(z.id)===String(a.id);});if(ai>-1)arr[ai]=a;else arr.push(a);arr.sort(function(a,b){return(Number(a.numero)||0)-(Number(b.numero)||0);});C.socios[si].abonos=arr;}}
        bump();return{ok:true,estado:deepCopy([estado])[0],abono:x.abono||null,visitas_agregadas:Number(x.visitas_agregadas)||0,visitas_disponibles:Number(x.visitas_disponibles)||0,remanente:Number(x.remanente)||0};
      });
    },
    desactivarAbonoVisitas:function(sid){sid=String(sid);return post('rpc/contender_desactivar_abono_visitas',{p_socio_id:sid}).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo cerrar el abono por visitas'};C.abonosVisitas.forEach(function(x){if(String(x.socio_id)===sid)x.activo=false;});bump();return{ok:true};});},
    getAbonos:function(socioId){var si=findIdx(C.socios,socioId);return si>-1?deepCopy(C.socios[si].abonos||[]):[];},
    guardarAbono:function(datos){
      var sid=String(datos.socio_id||''),si=findIdx(C.socios,sid);if(si<0)return Promise.resolve({ok:false,error:'Socio no encontrado'});
      var existentes=C.socios[si].abonos||[],id=datos.id!=null?String(datos.id):null,numero=Number(datos.numero)||0;
      if(!numero)numero=existentes.reduce(function(m,a){return Math.max(m,Number(a.numero)||0);},0)+1;
      var body={socio_id:sid,numero:numero,monto:Number(datos.monto)||0,fecha_pago:datos.fecha_pago||hoy(),fecha_limite:datos.membresia_vencimiento||datos.fecha_limite||null,pagado:true,plan:datos.plan||null,membresia_inicio:datos.membresia_inicio||null,membresia_vencimiento:datos.membresia_vencimiento||null,trainer:datos.trainer||null,registrado_por_auth_id:datos.registrado_por_auth_id||null,registrado_por_nombre:datos.registrado_por_nombre||null};
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

    // ── SALDO DEL SOCIO: +1 por check-in; abonos/cargos manuales ─
    getSaldoMovimientos:function(sid){sid=String(sid);return deepCopy(C.saldoMovimientos.filter(function(m){return String(m.socio_id)===sid;}).sort(function(a,b){return String(b.created_at||b.fecha||'').localeCompare(String(a.created_at||a.fecha||''))||(Number(b.id)||0)-(Number(a.id)||0);}));},
    getSaldo:function(sid){sid=String(sid);return C.saldoMovimientos.filter(function(m){return String(m.socio_id)===sid;}).reduce(function(a,m){return a+(Number(m.monto)||0);},0);},
    addSaldoMovimiento:function(sid,monto,tipo,concepto,actor){
      sid=String(sid);monto=Number(monto)||0;if(!monto)return Promise.resolve({ok:false,error:'El monto debe ser distinto de cero'});actor=actor||{};
      var body={socio_id:sid,tipo:tipo||'ajuste',monto:monto,concepto:concepto||null,fecha:hoy(),hora:ahoraHora(),registrado_por_auth_id:actor.auth_id||null,registrado_por_nombre:actor.nombre||null};
      return post('saldo_movimientos',body).then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo guardar el movimiento de saldo'};
        var mov=Array.isArray(r)&&r.length?r[0]:null;if(!mov)return {ok:false,error:'Supabase no devolvió el movimiento guardado'};
        mov.socio_id=String(mov.socio_id||sid);mov.monto=Number(mov.monto)||0;C.saldoMovimientos.unshift(mov);bump();return {ok:true,data:deepCopy([mov])[0]};
      });
    },

    getSeguimiento:function(socioId,callback){get('seguimiento_socio','select=*&socio_id=eq.'+encodeURIComponent(socioId)+'&order=fecha.desc,mes.desc').then(function(r){callback(Array.isArray(r)?r:[]);});},
    saveSeguimiento:function(socioId,mes,peso,musculo,imc,grasa,fecha,callback){var fechaFinal=fecha||hoy(),data={socio_id:socioId,mes:mes,peso:peso||null,musculo:musculo||null,imc:imc||null,grasa:grasa||null,fecha:fechaFinal};get('seguimiento_socio','select=id&socio_id=eq.'+encodeURIComponent(socioId)+'&mes=eq.'+encodeURIComponent(mes)).then(function(r){if(Array.isArray(r)&&r.length)pat('seguimiento_socio','id=eq.'+r[0].id,data);else post('seguimiento_socio',data);if(callback)callback();});},
    removeSeguimiento:function(id,callback){del('seguimiento_socio','id=eq.'+id).then(function(){if(callback)callback();});},

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
        var si=findIdx(C.socios,sid);if(si>-1){C.socios[si].visitas=(C.socios[si].visitas||0)+1;pat('socios','id=eq.'+encodeURIComponent(sid),{visitas:C.socios[si].visitas});if(planEsVisitas(C.socios[si].plan)){var ev=C.abonosVisitas.filter(function(x){return String(x.socio_id)===sid&&x.activo&&String(x.plan)===String(C.socios[si].plan);}).sort(function(a,b){return Number(b.id)-Number(a.id);})[0];if(ev){ev.visitas_consumidas=Math.min(ev.visitas_asignadas,ev.visitas_consumidas+1);}}}
        return consultarSaldoCheckin(sid,fecha).then(function(sr){
          if(sr&&sr.ok&&sr.data){var existe=C.saldoMovimientos.some(function(m){return String(m.id)===String(sr.data.id)||(String(m.socio_id)===sid&&m.tipo==='checkin'&&String(m.fecha)===fecha);});if(!existe)C.saldoMovimientos.unshift(sr.data);}
          bump();return {ok:true,checkin:deepCopy([ci])[0],saldo_sumado:!!(sr&&sr.ok&&sr.data),warning:sr&&sr.ok?null:(sr&&sr.error?sr.error:'El check-in se guardó, pero no se pudo consultar el saldo')};
        });
      });
    },

    getVentas:function(){return deepCopy(C.ventas);},
    agregarVentaProducto:function(datos){
      var body={p_socio_id:String(datos.socio_id),p_socio_nombre:String(datos.socio_nombre||''),p_producto_id:String(datos.producto_id),p_cantidad:Number(datos.cantidad)||0,p_registrado_por_auth_id:datos.registrado_por_auth_id||null,p_registrado_por_nombre:datos.registrado_por_nombre||null,p_timezone:DB_CONFIG.CLUB_TIMEZONE};
      return post('rpc/contender_agregar_venta_producto_v2',body).then(function(r){
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
    aguaCheckin:function(sid){
      sid=String(sid||'').trim();if(!sid)return Promise.resolve({ok:false,error:'Socio requerido'});
      return post('rpc/contender_agua_checkin',{p_socio_id:sid,p_timezone:DB_CONFIG.CLUB_TIMEZONE}).then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo registrar el agua'};
        var x=Array.isArray(r)?(r.length?r[0]:null):r;if(!x||!x.venta)return {ok:false,error:'Supabase no devolvió la venta de agua'};
        var v=x.venta;v.socio_id=v.socio_id==null?null:String(v.socio_id);v.total=Number(v.total)||0;v.cantidad=Number(v.cantidad)||0;v.status=v.status||'debe';
        C.ventas=C.ventas.filter(function(z){return String(z.id)!==String(v.id)});C.ventas.unshift(v);
        if(x.producto){var pi=findIdx(C.productos,x.producto.id);if(pi>-1)C.productos[pi]=x.producto;else C.productos.push(x.producto);}
        bump();return {ok:true,accion:String(x.accion||''),data:deepCopy([v])[0],producto:x.producto?deepCopy([x.producto])[0]:null};
      });
    },

    getMembresias:function(){return deepCopy(C.membresias);},
    guardarMembresia:function(datos){
      var unidad=String(datos.unidad_duracion||'dias').toLowerCase(),deposito=datos.deposito_minimo==null?null:Number(datos.deposito_minimo),costo=datos.costo_por_visita==null?null:Number(datos.costo_por_visita);
      var body={
        nombre:String(datos.nombre||'').trim(),
        unidad_duracion:unidad,
        cantidad_duracion:unidad==='visitas'?1:(Number(datos.cantidad_duracion)||1),
        precio:unidad==='visitas'?(Number(deposito)||0):(Number(datos.precio)||0),
        deposito_minimo:unidad==='visitas'?deposito:null,
        costo_por_visita:unidad==='visitas'?costo:null,
        descripcion:datos.descripcion||null
      };
      var id=datos.id;
      var req=id!==undefined&&id!==null?pat('membresias','id=eq.'+encodeURIComponent(id),body):post('membresias',body);
      return req.then(function(r){
        if(!r)return {ok:false,error:'No hubo respuesta de Supabase'};
        if(r._error)return {ok:false,error:r.userMessage||r.message||'No se pudo guardar la membresía'};
        var guardada=Array.isArray(r)&&r.length?normalizarMembresia(r[0]):null;
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
    getHorariosClase:function(cid){var cl=C.clases.find(function(x){return String(x.id)===String(cid);});return cl?deepCopy(horariosClaseLocal(cl)):[];},
    guardarClase:function(datos){
      datos=datos||{};var tipo=String(datos.tipo||'clase').toLowerCase()==='espacio'?'espacio':'clase',id=datos.id,horarios=tipo==='clase'&&Array.isArray(datos.horarios)?datos.horarios:[],primero=horarios.length?horarios[0]:null,body={nombre:String(datos.nombre||'').trim(),tipo:tipo,hora:tipo==='espacio'?horaHHMM(datos.hora_inicio):horaHHMM(primero?primero.hora:datos.hora),coach:tipo==='espacio'?'':String(primero?primero.coach:(datos.coach||'')).trim(),cupo:Math.max(1,Number(tipo==='clase'&&primero?primero.cupo:datos.cupo)||1),dias:Array.isArray(datos.dias)?datos.dias:[],hora_inicio:tipo==='espacio'?horaHHMM(datos.hora_inicio):null,hora_fin:tipo==='espacio'?horaHHMM(datos.hora_fin):null,intervalo_minutos:tipo==='espacio'?Math.max(1,Number(datos.intervalo_minutos)||0):null};
      if(tipo==='clase'&&horarios.length){var union=[];horarios.forEach(function(hh){(hh.dias||[]).forEach(function(d){if(union.indexOf(d)===-1)union.push(d);});});body.dias=union;}
      var req=id!==undefined&&id!==null?pat('clases','id=eq.'+encodeURIComponent(id),body):post('clases',body);
      return req.then(function(r){if(!r)return{ok:false,error:'No hubo respuesta de Supabase'};if(r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo guardar la clase'};var cl=Array.isArray(r)&&r.length?normalizarClase(r[0]):null;if(!cl)return{ok:false,error:'Supabase no devolvió la clase guardada'};var idx=findIdx(C.clases,cl.id);if(idx>-1)C.clases[idx]=cl;else C.clases.push(cl);C.clases.sort(function(a,b){return Number(a.id)-Number(b.id);});if(tipo!=='clase')return{ok:true,data:cl};return GymDB.guardarHorariosClase(cl.id,horarios).then(function(hr){if(!hr.ok)return hr;vincularHorariosClases();bump();return{ok:true,data:deepCopy(C.clases.find(function(x){return String(x.id)===String(cl.id);})||cl)};});}).catch(function(e){return{ok:false,error:e&&e.message?e.message:String(e)};});
    },
    guardarHorariosClase:function(cid,horarios){
      cid=String(cid);horarios=Array.isArray(horarios)?horarios:[];var payload=horarios.map(function(hh){return{id:hh.id==null||hh.id===''?null:+hh.id,hora:horaHHMM(hh.hora),dias:Array.isArray(hh.dias)?hh.dias:[],cupo:Math.max(1,Number(hh.cupo)||1),coach:String(hh.coach||'').trim()};});
      return post('rpc/contender_guardar_horarios_clase',{p_clase_id:+cid,p_horarios:payload}).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudieron guardar los horarios'};var rr=Array.isArray(r)?r[0]:r;if(rr&&rr.ok===false)return{ok:false,error:rr.error||'No se pudieron guardar los horarios'};var rows=rr&&Array.isArray(rr.horarios)?rr.horarios:[];C.claseHorarios=C.claseHorarios.filter(function(h){return String(h.clase_id)!==cid;}).concat(rows.map(normalizarHorarioClase));vincularHorariosClases();bump();return{ok:true,data:deepCopy(C.claseHorarios.filter(function(h){return String(h.clase_id)===cid&&h.activo;}))};}).catch(function(e){return{ok:false,error:e&&e.message?e.message:String(e)};});
    },
    eliminarClase:function(id){id=String(id);return del('clases','id=eq.'+encodeURIComponent(id)).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo eliminar la clase'};C.clases=C.clases.filter(function(c){return String(c.id)!==id;});C.claseHorarios=C.claseHorarios.filter(function(h){return String(h.clase_id)!==id;});Object.keys(C.inscritos).forEach(function(k){if(k.indexOf(id+'|')===0)delete C.inscritos[k];});bump();return{ok:true};});},
    saveClases:function(arr){_syncCat('clases',C.clases,arr,['nombre','tipo','hora','coach','cupo','dias','hora_inicio','hora_fin','intervalo_minutos']);C.clases=arr.map(normalizarClase);vincularHorariosClases();bump();},
    getProductos:function(){return deepCopy(C.productos);},
    saveProductos:function(arr){_syncCat('productos',C.productos,arr,['nombre','costo','stock','cat']);C.productos=arr;bump();},
    getMensajes:function(){return deepCopy(C.mensajes);},
    saveMensajes:function(arr){_syncCat('mensajes_wa',C.mensajes,arr,['nombre','cuerpo']);C.mensajes=arr;bump();},

    getAllInscritos:function(){return deepCopyObj(C.inscritos);},
    getInscritosPorClase:function(cid,fecha,horaSlot,horarioId){
      var f=fecha||hoy(),key=keyInscritos(cid,f,horaSlot,horarioId),mios=(C.inscritos[key]||[]).slice();
      if(!SOCIO_AUTH_SESSION)return mios;
      var total=Math.max(Number(C.cuposClases[key])||0,mios.length),out=mios.slice(),i=0;
      while(out.length<total){out.push('__ocupado_'+(++i));}
      return out;
    },
    getTurnosClase:function(cid,fecha){var cl=C.clases.find(function(x){return String(x.id)===String(cid);});return cl?deepCopy(turnosClaseLocal(cl,fecha||hoy())):[];},
    saveAllInscritos:function(obj){C.inscritos=obj;},
    inscribirSocio:function(cid,sid,fecha,horaSlot,horarioId){
      var cids=String(cid),sids=String(sid),f=fecha||hoy(),slot=horaHHMM(horaSlot),hid=horarioId==null||horarioId===''?null:String(horarioId),key=keyInscritos(cids,f,slot,hid),authSid=SOCIO_AUTH_SESSION&&SOCIO_AUTH_SESSION.user?socioIdDesdeUsuario(SOCIO_AUTH_SESSION.user):'';
      if(authSid&&authSid!==sids)return Promise.resolve({ok:false,error:'No puedes inscribir a otro socio'});
      if(!C.inscritos[key])C.inscritos[key]=[];
      if(C.inscritos[key].indexOf(sids)>-1)return Promise.resolve({ok:true,already:true});
      if(authSid){
        return post('rpc/contender_inscribir_clase',{p_clase_id:+cid,p_fecha:f,p_horario_id:hid==null?null:+hid,p_hora_slot:slot||null}).then(function(r){
          if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo guardar la inscripción'};
          var rr=Array.isArray(r)?r[0]:r;if(rr&&rr.ok===false)return{ok:false,error:rr.error||'No se pudo guardar la inscripción'};
          var slotReal=horaHHMM(rr&&rr.hora_slot)||slot,hidReal=rr&&rr.horario_id!=null?String(rr.horario_id):hid,keyReal=keyInscritos(cids,f,slotReal,hidReal);if(!C.inscritos[keyReal])C.inscritos[keyReal]=[];if(C.inscritos[keyReal].indexOf(sids)===-1)C.inscritos[keyReal].push(sids);
          if(rr&&rr.inscritos!=null)C.cuposClases[keyReal]=Math.max(0,Number(rr.inscritos)||0);else C.cuposClases[keyReal]=(Number(C.cuposClases[keyReal])||0)+1;
          bump();return{ok:true,already:!!(rr&&rr.already),data:rr||null};
        });
      }
      var body={clase_id:+cid,socio_id:sids,fecha:f,hora_slot:slot||null,horario_id:hid==null?null:+hid};
      return post('inscritos',body).then(function(r){if(r&&r._error){var dup=String(r.code||'')==='23505'||Number(r.status)===409;return{ok:false,duplicate:dup,error:dup?'Ya está inscrito en este horario':(r.userMessage||r.message||'No se pudo guardar la inscripción')};}C.inscritos[key].push(sids);bump();return{ok:true,data:Array.isArray(r)&&r.length?deepCopy(r)[0]:null};});
    },
    desinscribirSocio:function(cid,sid,fecha,horaSlot,horarioId){
      var f=fecha||hoy(),slot=horaHHMM(horaSlot),hid=horarioId==null||horarioId===''?null:String(horarioId),key=keyInscritos(cid,f,slot,hid),sids=String(sid),authSid=SOCIO_AUTH_SESSION&&SOCIO_AUTH_SESSION.user?socioIdDesdeUsuario(SOCIO_AUTH_SESSION.user):'';
      if(authSid&&authSid!==sids)return Promise.resolve({ok:false,error:'No puedes cancelar la inscripción de otro socio'});
      if(authSid){
        return post('rpc/contender_cancelar_clase',{p_clase_id:+cid,p_fecha:f,p_horario_id:hid==null?null:+hid,p_hora_slot:slot||null}).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo cancelar la inscripción'};var rr=Array.isArray(r)?r[0]:r;if(rr&&rr.ok===false)return{ok:false,error:rr.error||'No se pudo cancelar la inscripción'};if(C.inscritos[key])C.inscritos[key]=C.inscritos[key].filter(function(x){return String(x)!==sids;});if(rr&&rr.inscritos!=null)C.cuposClases[key]=Math.max(0,Number(rr.inscritos)||0);else C.cuposClases[key]=Math.max(0,(Number(C.cuposClases[key])||0)-1);bump();return{ok:true,data:rr||null};});
      }
      var q='clase_id=eq.'+encodeURIComponent(cid)+'&socio_id=eq.'+encodeURIComponent(sids)+'&fecha=eq.'+encodeURIComponent(f)+(hid!=null?'&horario_id=eq.'+encodeURIComponent(hid):(slot?'&hora_slot=eq.'+encodeURIComponent(slot):'&horario_id=is.null&hora_slot=is.null'));
      return del('inscritos',q).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo cancelar la inscripción'};if(C.inscritos[key])C.inscritos[key]=C.inscritos[key].filter(function(x){return String(x)!==sids;});bump();return{ok:true};});
    },


    getTrainers:function(){return deepCopy(C.trainers);},
    guardarTrainer:function(datos){
      var body={nombre:String(datos.nombre||'').trim(),telefono:String(datos.telefono||'').replace(/\D/g,''),codigo:null,especialidad:datos.especialidad||null},id=datos.id;
      var req=id!==undefined&&id!==null?pat('trainers','id=eq.'+encodeURIComponent(id),body):post('trainers',body);
      return req.then(function(r){if(!r)return{ok:false,error:'No hubo respuesta de Supabase'};if(r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo guardar el entrenador'};var t=Array.isArray(r)&&r.length?r[0]:null;if(!t)return{ok:false,error:'Supabase no devolvió el entrenador guardado'};var idx=findIdx(C.trainers,t.id);if(idx>-1)C.trainers[idx]=t;else C.trainers.push(t);C.trainers.sort(function(a,b){return String(a.nombre||'').localeCompare(String(b.nombre||''),'es-MX');});bump();return{ok:true,data:deepCopy([t])[0]};});
    },
    eliminarTrainer:function(id){id=String(id);return del('trainers','id=eq.'+encodeURIComponent(id)).then(function(r){if(r&&r._error)return{ok:false,error:r.userMessage||r.message||'No se pudo eliminar el entrenador'};C.trainers=C.trainers.filter(function(t){return String(t.id)!==id;});bump();return{ok:true};});},
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
ETAPA 11 + ANUNCIOS · VERSION 2026.08.12.2153
ETAPA 12 TRAINER AUTH · VERSION 2026.08.12.2163
La migración SQL correspondiente se instala con:
seguridad_etapa_11_app_anuncios_v2026.08.12.2153.txt
*/
