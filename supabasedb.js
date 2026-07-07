// ═══════════════════════════════════════════════════════════════
// supabasedb.js  ·  Base de datos real con Supabase
// Contender Club · v1.0
// ═══════════════════════════════════════════════════════════════
// Misma API que gymdb.js — los 3 HTMLs no cambian su lógica.
// init() ahora devuelve una Promise; los HTMLs esperan .then().
// Reads: síncronos desde cache en memoria.
// Writes: actualiza cache inmediatamente + async a Supabase.
// ═══════════════════════════════════════════════════════════════

var GymDB = (function () {
  'use strict';

  var URL = 'https://ytbujmamijrzmpeqiadx.supabase.co/rest/v1';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YnVqbWFtaWpyem1wZXFpYWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDcxODcsImV4cCI6MjA5NTc4MzE4N30.u76APTL2nKmhZy-hpPx4iPPyT5wPC1BHbsBkNcZYZqg';

  // ── Cache en memoria (misma estructura que gymdb.js) ───────────
  var C = {
    socios:    [],
    deudas:    {},   // { socio_id: [deuda,...] }
    checkins:  {},   // { "YYYY-MM-DD": [checkin,...] }
    ventas:    [],
    membresias:[],
    clases:    [],
    productos: [],
    mensajes:  [],
    inscritos: {},   // { clase_id: [socio_id,...] }
    rutinas:   {},   // { socio_id: [{dia,grupo,icono,ejercicios:[]},...] }
    historico: { ventas:[], checkins:[], socios:[] },
    trainers:  [],
    cuentas:   []
  };

  // ── HTTP helpers ───────────────────────────────────────────────
  function h(extra) {
    var base = {
      'apikey':        KEY,
      'Authorization': 'Bearer ' + KEY,
      'Content-Type':  'application/json'
    };
    if (extra) Object.keys(extra).forEach(function(k){ base[k]=extra[k]; });
    return base;
  }

  function sbFetch(method, table, query, body) {
    var url = URL + '/' + table + (query ? '?' + query : '');
    var opts = { method: method, headers: h(method!=='GET'?{'Prefer':'return=representation'}:null) };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(url, opts)
      .then(function(r) {
        if (r.status === 204) return [];
        return r.json().then(function(json){
          if (!r.ok) {
            var msg=(json&&json.message)?json.message:JSON.stringify(json);
            console.error('[GymDB]',method,table,r.status,msg);
            if(typeof mostrarToast==='function') mostrarToast('⚠ DB '+r.status+': '+msg.slice(0,80));
            return {_error:true,status:r.status,message:msg};
          }
          return json;
        });
      })
      .catch(function(e){ console.error('[GymDB]',method,table,e); return null; });
  }

  var get  = function(t,q)   { return sbFetch('GET',   t, q); };
  var post = function(t,b)   { return sbFetch('POST',  t, null, b); };
  var pat  = function(t,q,b) { return sbFetch('PATCH', t, q, b); };
  var del  = function(t,q)   { return sbFetch('DELETE',t, q); };

  // ── Utilidades ─────────────────────────────────────────────────
  function hoy() { return new Date().toISOString().slice(0,10); }

  function findIdx(arr, id) {
    var sid=String(id);
    for (var i=0; i<arr.length; i++) if (String(arr[i].id)===sid) return i;
    return -1;
  }
  function deepCopy(arr){ return JSON.parse(JSON.stringify(arr||[])); }
  function deepCopyObj(obj){ return JSON.parse(JSON.stringify(obj||{})); }
  var _pending = {};

  // Notifica a otros tabs que hubo un cambio
  function bump() {
    try { localStorage.setItem('gymdb_sb_v', Date.now().toString()); } catch(e){}
  }

  // ── Carga inicial desde Supabase ───────────────────────────────
  function loadAll() {
    return Promise.all([
      get('socios',    'select=*,abonos(*)&order=id.asc'),
      get('deudas',    'select=*&order=fecha.desc'),
      get('checkins',  'select=*&fecha=eq.' + hoy()),
      get('ventas',    'select=*&order=created_at.desc&limit=200'),
      get('membresias','select=*&order=id.asc'),
      get('clases',    'select=*&order=id.asc'),
      get('productos', 'select=*&order=id.asc'),
      get('mensajes_wa','select=*&order=id.asc'),
      get('inscritos', 'select=*'),
      get('trainers',  'select=*'),
      get('cuentas',   'select=*'),
      get('historico', 'select=*&order=id.asc'),
      get('rutinas',   'select=*,ejercicios(*)&order=dia.asc')
    ]).then(function(res) {

      // Socios con abonos embebidos
      C.socios = (res[0]||[]).map(function(s) {
        s.id = String(s.id);
        s.abonos = (s.abonos||[]).sort(function(a,b){ return a.numero-b.numero; });
        s.abonos.forEach(function(a){ a.id = String(a.id); });
        // Parse historial_membresias (stored as JSONB, may arrive as string)
        if (typeof s.historial_membresias === 'string') {
          try { s.historial_membresias = JSON.parse(s.historial_membresias); } catch(e){ s.historial_membresias=[]; }
        }
        if (!Array.isArray(s.historial_membresias)) s.historial_membresias = [];
        return s;
      });
      Object.keys(_pending).forEach(function(pid){
        if(findIdx(C.socios,pid)===-1) C.socios.push(_pending[pid]);
        else delete _pending[pid];
      });

      // Deudas → { socio_id: [deudas] }
      C.deudas = {};
      (res[1]||[]).forEach(function(d) {
        d.id = String(d.id); // bigserial → string
        if (!C.deudas[d.socio_id]) C.deudas[d.socio_id] = [];
        C.deudas[d.socio_id].push(d);
      });

      // Checkins de hoy
      C.checkins = {};
      C.checkins[hoy()] = res[2] || [];

      C.ventas    = res[3]  || [];
      C.membresias= (res[4]||[]).map(function(m){
        // Parse abonos (stored as JSONB, may arrive as string or array)
        if (typeof m.abonos === 'string') {
          try { m.abonos = JSON.parse(m.abonos); } catch(e){ m.abonos=[]; }
        }
        if (!Array.isArray(m.abonos)) m.abonos = [];
        return m;
      });
      C.clases    = (res[5]||[]).map(function(cl){
        if(typeof cl.dias==='string') cl.dias=cl.dias.replace(/[{}]/g,'').split(',').map(function(d){return d.trim();});
        if(!Array.isArray(cl.dias)) cl.dias=[];
        return cl;
      });
      C.productos = res[6]  || [];
      C.mensajes  = res[7]  || [];

      // Inscritos → { clase_id: [socio_ids] }
      // Inscritos por fecha: { "clase_id|fecha": [socio_ids] }
      C.inscritos = {};
      (res[8]||[]).forEach(function(i) {
        var fecha = i.fecha || new Date().toISOString().slice(0,10);
        var key   = String(i.clase_id)+'|'+fecha;
        if (!C.inscritos[key]) C.inscritos[key] = [];
        C.inscritos[key].push(String(i.socio_id));
      });

      C.trainers = res[9]  || [];
      C.cuentas  = res[10] || [];

      // Historico → { ventas:[], checkins:[], socios:[] }
      var hist = { ventas:[], checkins:[], socios:[] };
      (res[11]||[]).forEach(function(h) {
        if (hist[h.tipo]) hist[h.tipo].push({ m:h.mes, v:h.valor });
      });
      C.historico = hist;

      // Rutinas → { socio_id: [{dia,grupo,icono,ejercicios:[]}] }
      C.rutinas = {};
      (res[12]||[]).forEach(function(r) {
        if (!C.rutinas[r.socio_id]) C.rutinas[r.socio_id] = [];
        C.rutinas[r.socio_id].push({
          dia:       r.dia,
          grupo:     r.grupo,
          icono:     r.icono,
          _id:       r.id,   // id interno Supabase
          ejercicios:(r.ejercicios||[]).map(function(e){
            return { id:e.id, nombre:e.nombre, series:e.series,
                     notas:e.notas, manual:e.manual };
          })
        });
      });

    });
  }

  // ── API PÚBLICA ────────────────────────────────────────────────
  return {

    // ── INIT ────────────────────────────────────────────────────
    init: function() { return loadAll(); },

    reset: function() {
      console.warn('[GymDB] reset() no disponible en modo Supabase. Borra datos desde el dashboard.');
    },

    // ── SOCIOS ──────────────────────────────────────────────────
    getSocios: function()    { return deepCopy(C.socios); },
    saveSocios: function(arr){ C.socios = arr; },  // usado solo internamente

    getSocio: function(id) {
      var idx = findIdx(C.socios, id);
      return idx > -1 ? C.socios[idx] : null;
    },

    setSocio: function(socio) {
      var self=this, idx=findIdx(C.socios,socio.id), abonos=(socio.abonos||[]).slice();
      function nd(v){ return (v===''||v===undefined)?null:v; }
      var data={
        id:String(socio.id),nombre:socio.nombre,apellido_paterno:socio.apellido_paterno,
        apellido_materno:nd(socio.apellido_materno),numero:nd(socio.numero),
        correo:nd(socio.correo),numero_emergencia:nd(socio.numero_emergencia),
        plan:nd(socio.plan),fecha_inicio:nd(socio.fecha_inicio),
        fecha_vencimiento:nd(socio.fecha_vencimiento),fecha_nacimiento:nd(socio.fecha_nacimiento),
        visitas:socio.visitas||0,activo:socio.activo!==false,sexo:nd(socio.sexo),
        notas:nd(socio.notas),color:socio.color||'#C8F135',
        vendedor_id:nd(socio.vendedor_id),vendedor_nombre:nd(socio.vendedor_nombre),
        ultima_visita:nd(socio.ultima_visita),
        avisos_ids:JSON.stringify(Array.isArray(socio.avisos_ids)?socio.avisos_ids:[]),
        historial_membresias:JSON.stringify(Array.isArray(socio.historial_membresias)?socio.historial_membresias:[])
      };
      if(idx>-1){
        C.socios[idx]=socio;
        pat('socios','id=eq.'+socio.id,data);
        if(nd(socio.numero)){
          var ci=findIdx(C.cuentas,String(socio.id));
          if(ci>-1&&C.cuentas[ci].telefono!==socio.numero){
            C.cuentas[ci].telefono=socio.numero;
            pat('cuentas','id=eq.'+C.cuentas[ci].id,{telefono:socio.numero});
          }
        }
        bump();
      } else {
        _pending[String(socio.id)]=socio;
        C.socios.push(socio);
        post('socios',data).then(function(r){
          if(r&&!r._error&&Array.isArray(r)&&r.length>0){
            delete _pending[String(socio.id)];
            if(nd(socio.numero)) self.crearCuenta(String(socio.id),socio.numero);
            bump();
          }
        });
        return;
      }

      // Sincronizar abonos
      abonos.forEach(function(a) {
        var aData = { socio_id:socio.id, numero:a.numero, monto:a.monto,
                      fecha_limite:a.fecha_limite, pagado:a.pagado, fecha_pago:a.fecha_pago||null };
        if (a.id && !isNaN(Number(a.id))) {
          // Existente → PATCH
          pat('abonos', 'id=eq.'+a.id, { pagado:a.pagado, fecha_pago:a.fecha_pago||null });
        } else {
          // Nuevo → POST
          post('abonos', aData).then(function(r){
            if(r&&r[0]) a.id = String(r[0].id);
          });
        }
      });

      bump();
    },

    getCuenta: function(telefono, codigo) {
      for (var i=0; i<C.cuentas.length; i++) {
        var c = C.cuentas[i];
        if (c.telefono===telefono && c.codigo===codigo) return c;
      }
      return null;
    },
    crearCuenta: function(socioId, telefono) {
      var codigo=String(socioId);
      var existe=C.cuentas.some(function(c){return c.socios&&c.socios.indexOf(socioId)>-1;});
      if(existe) return;
      var cuenta={telefono:telefono,codigo:codigo,socios:[socioId]};
      C.cuentas.push(cuenta);
      post('cuentas',cuenta).then(function(r){if(r&&!r._error&&Array.isArray(r)&&r[0])cuenta.id=r[0].id;});
    },

    // ── COBROS / VENTAS (para comisiones) ──────────────────────
    registrarCobro: function(cobro) {
      // cobro = {tipo, socio_id, socio_nombre, producto, monto, vendedor_id, vendedor_nombre, notas}
      var data = {
        tipo:            cobro.tipo||'deuda',
        socio_id:        cobro.socio_id||null,
        socio_nombre:    cobro.socio_nombre||null,
        producto:        cobro.producto,
        monto:           cobro.monto,
        fecha:           new Date().toISOString().slice(0,10),
        vendedor_id:     cobro.vendedor_id||null,
        vendedor_nombre: cobro.vendedor_nombre||null,
        notas:           cobro.notas||null
      };
      return post('cobros', data);
    },

    getCobros: function(vendedorId) {
      var q = vendedorId ? 'vendedor_id=eq.'+vendedorId+'&order=fecha.desc' : 'order=fecha.desc';
      return get('cobros', q);
    },

    // ── SEGUIMIENTO MENSUAL ─────────────────────────────────────
    getSeguimiento: function(socioId, callback) {
      get('seguimiento_socio','select=*&socio_id=eq.'+socioId+'&order=fecha.desc,mes.desc')
        .then(function(r){ callback(Array.isArray(r)?r:[]); });
    },
    saveSeguimiento: function(socioId, fechaOmes, peso, musculo, imc, grasa, fecha, callback) {
      var fechaReal = fecha || new Date().toISOString().slice(0,10);
      var data = {
        socio_id: socioId,
        mes: fechaReal.slice(0,7),   // still populate mes for legacy reads
        peso: peso||null, musculo: musculo||null,
        imc: imc||null, grasa: grasa||null,
        fecha: fechaReal
      };
      // Upsert por fecha exacta (no por mes): si ya existe ese día actualiza, si no inserta
      get('seguimiento_socio','select=id&socio_id=eq.'+socioId+'&fecha=eq.'+fechaReal)
        .then(function(r){
          if(Array.isArray(r)&&r.length>0){
            pat('seguimiento_socio','id=eq.'+r[0].id, data);
          } else {
            post('seguimiento_socio', data);
          }
          if(callback) callback();
        });
    },

    // ── DEUDAS ──────────────────────────────────────────────────
    getAllDeudas:   function()    { return deepCopyObj(C.deudas); },
    getDeudas:      function(sid) { return C.deudas[sid] || []; },

    saveAllDeudas: function(obj) {
      // Diff: detecta eliminadas e insertadas
      var self = this;
      Object.keys(C.deudas).forEach(function(sid) {
        var prev = C.deudas[sid] || [];
        var next = obj[sid]      || [];
        // Eliminadas (en prev, no en next)
        prev.forEach(function(pd) {
          var existe = next.some(function(nd){ return nd.id===pd.id; });
          if (!existe) del('deudas', 'id=eq.'+pd.id);
        });
        // Nuevas (en next, no en prev)
        next.forEach(function(nd) {
          var existe = prev.some(function(pd){ return pd.id===nd.id; });
          if (!existe) {
            post('deudas', { socio_id:sid, producto:nd.producto, total:nd.total, fecha:nd.fecha })
              .then(function(r){ if(r&&r[0]) nd.id=String(r[0].id); });
          }
        });
      });
      // Socios nuevos en obj que no estaban en cache
      Object.keys(obj).forEach(function(sid) {
        if (!C.deudas[sid]) {
          obj[sid].forEach(function(nd) {
            post('deudas', { socio_id:sid, producto:nd.producto, total:nd.total, fecha:nd.fecha })
              .then(function(r){ if(r&&r[0]) nd.id=String(r[0].id); });
          });
        }
      });
      C.deudas = obj;
      bump();
    },

    addDeuda: function(sid, deuda) {
      if (!C.deudas[sid]) C.deudas[sid] = [];
      C.deudas[sid].push(deuda);
      post('deudas', { socio_id:sid, producto:deuda.producto, total:deuda.total, fecha:deuda.fecha })
        .then(function(r){ if(r&&r[0]) deuda.id=String(r[0].id); });
      bump();
    },

    removeDeuda: function(sid, did) {
      if (C.deudas[sid]) C.deudas[sid] = C.deudas[sid].filter(function(d){ return d.id!==did; });
      del('deudas', 'id=eq.'+did);
      bump();
    },

    // ── CHECKINS ────────────────────────────────────────────────
    getAllCheckins:    function()      { return C.checkins; },
    getTodayCheckins: function()      {
      // Si hay checkins de días anteriores en cache los ignora automáticamente
      // porque hoy() devuelve la fecha actual
      return C.checkins[hoy()] || [];
    },
    getCheckinsByFecha: function(f)   { return C.checkins[f]    || []; },
    saveTodayCheckins: function(arr)  { C.checkins[hoy()] = arr; },

    addCheckin: function(sid) {
      var arr = this.getTodayCheckins();
      for (var i=0; i<arr.length; i++) if (arr[i].socio_id===sid) return false;
      var hora = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      arr.push({ socio_id:sid, hora:hora, fecha:hoy() });
      C.checkins[hoy()] = arr;
      // Incrementar visitas en cache
      var si = findIdx(C.socios, sid);
      if (si>-1) {
        C.socios[si].visitas = (C.socios[si].visitas||0)+1;
        pat('socios','id=eq.'+sid,{ visitas:C.socios[si].visitas });
      }
      post('checkins',{ socio_id:sid, hora:hora, fecha:hoy() });
      bump();
      return true;
    },

    // ── VENTAS ──────────────────────────────────────────────────
    getVentas: function() { return C.ventas; },

    saveVentas: function(arr) {
      var prev = C.ventas;
      C.ventas = arr;
      // Detectar nuevas (están en arr pero no en prev)
      arr.forEach(function(v) {
        var inPrev = prev.some(function(p){ return p.id===v.id; });
        if (!inPrev) {
          post('ventas',{
            socio_id:v.socio_id, socio_nombre:v.socio_nombre,
            producto:v.producto, cantidad:v.cantidad, total:v.total,
            fecha:v.fecha, status:v.status, tipo:v.tipo
          }).then(function(r){ if(r&&r[0]) v.id=r[0].id; });
        }
      });
      bump();
    },

    // ── CATÁLOGO ────────────────────────────────────────────────
    getMembresias:  function()    { return deepCopy(C.membresias); },
    saveMembresias: function(arr) {
      _syncCat('membresias', C.membresias, arr, ['nombre','dias','precio','descripcion','abonos']);
      C.membresias = arr;
      bump();
    },

    getClases:  function()    { return deepCopy(C.clases); },
    saveClases: function(arr) {
      _syncCat('clases', C.clases, arr, ['nombre','hora','coach','cupo','dias','color']);
      C.clases = arr;
      bump();
    },

    getProductos:  function()    { return deepCopy(C.productos); },
    saveProductos: function(arr) {
      _syncCat('productos', C.productos, arr, ['nombre','costo','stock','cat']);
      C.productos = arr;
      bump();
    },

    getMensajes:  function()    { return deepCopy(C.mensajes); },
    saveMensajes: function(arr) {
      _syncCat('mensajes_wa', C.mensajes, arr, ['nombre','cuerpo']);
      C.mensajes = arr;
      bump();
    },

    // ── INSCRITOS ────────────────────────────────────────────────
    getAllInscritos:       function()    { return deepCopyObj(C.inscritos); },
    getInscritosPorClase: function(cid, fecha) { var f=fecha||new Date().toISOString().slice(0,10); return C.inscritos[String(cid)+'|'+f] || []; },
    saveAllInscritos:     function(obj) { C.inscritos = obj; },

    inscribirSocio: function(cid, sid, fecha) {
      var cids=String(cid), sids=String(sid);
      var f = fecha || new Date().toISOString().slice(0,10);
      var key = cids+'|'+f;
      if (!C.inscritos[key]) C.inscritos[key] = [];
      if (C.inscritos[key].indexOf(sids) === -1) {
        C.inscritos[key].push(sids);
        post('inscritos',{ clase_id:+cid, socio_id:sids, fecha:f });
        bump();
      }
    },

    desinscribirSocio: function(cid, sid, fecha) {
      var cids=String(cid), sids=String(sid);
      var f = fecha || new Date().toISOString().slice(0,10);
      var key = cids+'|'+f;
      if (C.inscritos[key])
        C.inscritos[key] = C.inscritos[key].filter(function(x){ return x!==sids; });
      del('inscritos','clase_id=eq.'+cid+'&socio_id=eq.'+sid+'&fecha=eq.'+f);
      bump();
    },

    // ── RUTINAS ─────────────────────────────────────────────────
    getRutina: function(sid) { return C.rutinas[sid] || null; },

    saveRutina: function(sid, rutina) {
      C.rutinas[sid] = rutina;
      // Borrar todo lo existente del socio y reinsertar
      del('rutinas','socio_id=eq.'+sid).then(function() {
        rutina.forEach(function(dia) {
          post('rutinas',{ socio_id:sid, dia:dia.dia, grupo:dia.grupo, icono:dia.icono })
            .then(function(r) {
              if (!r||!r[0]) return;
              var rid = r[0].id;
              (dia.ejercicios||[]).forEach(function(e) {
                post('ejercicios',{
                  rutina_id:rid, nombre:e.nombre,
                  series:e.series, notas:e.notas, manual:!!e.manual
                });
              });
            });
        });
      });
      bump();
    },

    // ── HISTÓRICO / TRAINERS ────────────────────────────────────
    getHistorico: function() { return C.historico; },
    getTrainers:  function() { return deepCopy(C.trainers); },
    saveTrainers: function(arr) {
      _syncCat('trainers', C.trainers, arr, ['telefono','codigo','nombre']);
      C.trainers = arr;
      bump();
    },

    // ── SINCRONIZACIÓN CROSS-TAB / CROSS-DEVICE ─────────────────
    onChange: function(callback) {
      // Solo cross-tab mismo navegador via localStorage
      // Sin polling automático — el usuario sincroniza manualmente con ↻
      window.addEventListener('storage', function(e) {
        if (e.key === 'gymdb_sb_v') {
          loadAll().then(function(){ setTimeout(callback, 80); });
        }
      });
    }

  }; // fin return

  // ── Helper: sync de tablas de catálogo ─────────────────────────
  function _syncCat(table, prev, next, fields) {
    var prevMap = {};
    prev.forEach(function(p){ prevMap[p.id]=p; });

    next.forEach(function(item) {
      var body = {};
      fields.forEach(function(f){ body[f]=item[f]; });

      if (item.id && prevMap[item.id]) {
        // Existente: comparar si cambió
        var cambio = fields.some(function(f){
          return JSON.stringify(item[f]) !== JSON.stringify(prevMap[item.id][f]);
        });
        if (cambio) pat(table, 'id=eq.'+item.id, body);
      } else {
        // Nuevo
        post(table, body).then(function(r){ if(r&&r[0]) item.id=r[0].id; });
      }
    });

    // Eliminados
    var nextIds = next.map(function(n){ return n.id; });
    prev.forEach(function(p) {
      if (nextIds.indexOf(p.id) === -1) del(table, 'id=eq.'+p.id);
    });
  }

})();
